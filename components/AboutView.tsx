"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { about } from "@/lib/content";
import products from "@/lib/products.json";

/** `thumbW` is the small file's measured width (scratchpad/assets-1001-about.cjs
 *  writes it) — the srcSet below needs a true `w` descriptor for both files */
type Shot = { id: string; src: string; thumb: string; w: number; h: number; thumbW?: number; alpha: boolean; avg: string };
const P = products as Record<string, Shot[]>;

// ============================================================================
// ABOUT — Arpine, in her own words. Lifted out of the home page onto /about
// so the nav's About link goes to a real page rather than an anchor part-way
// down a five-section scroll story.
//
// It carries its own [data-rise] reveals: those used to come from HomeView's
// matchMedia block, which does not run here. The name still writes itself
// letter by letter — that is the shared TextFX runner in the layout, which
// scans every route.
//
// CLIENT ROUND 3 (change 3.pdf p10, 2026-10-01), three notes on this page:
//   · «փոխենք նկարը» — the laptop picture is replaced by her own photograph,
//     Arpine on a balcony holding her postcards;
//   · «Հանենք էս սաղ» — the whole fact list (Based in / Studied at / Solo
//     exhibitions / Member of) and the «Artist page» link under it are gone,
//     so the page is now her biography and her picture, nothing else;
//   · «Դարձնենք» — the exhibitions sentence is rewritten (lib/content.ts).
//
// HER PHOTOGRAPH ARRIVES BEHIND A CURTAIN (2026-10-14 — Vardan: «Dual-Layer
// Curtain Mask (Clip-Path Wipe)» and «Counter-Scale Parallax Reveal», for
// this page). Two layers in the frame, both opened by a clip-path wipe from
// the bottom edge up instead of a fade:
//   · the CURTAIN, a flat panel in the colour the page is not (the site's
//     dark slate by day, its cream by night), leads by CURTAIN_LEAD — it
//     draws the frame's shape before there is anything in it;
//   · the PICTURE follows over it. While its mask opens, the photograph
//     inside settles from PIC_FROM to PIC_REST: the window grows, the
//     picture shrinks into it — the counter-scale.
// Then the PARALLAX: the photograph is held a little larger than its frame
// (PIC_REST) and drifts through it, up to DRIFT of its height, AGAINST the
// scroll: as the page goes up, the photograph sinks in its frame, so it
// moves a little slower than the page around it and reads as further away.
// On a desktop the drift is driven by the section's own scroll (the frame
// is sticky there, standing still wherever her biography is the taller
// column); in one column the frame crossing the screen drives it.
// Reduced motion: none of it, the photograph simply stands. Without
// scripts the curtain lies behind the opaque photograph and never shows.
// ============================================================================

/** clip-path polygons: the frame shut along its bottom edge, and open */
const SHUT = "polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)";
const OPEN = "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)";
/** seconds the curtain runs ahead of the picture (Vardan's 0.1s) */
const CURTAIN_LEAD = 0.1;
const WIPE = 1.05;
/** the photograph's scale while its mask opens, and where it comes to rest —
 *  above 1, so the drift never shows the frame's edge */
const PIC_FROM = 1.32;
const PIC_REST = 1.1;
/** the drift, in % of the photograph's own height, each way: 4.5% of a picture
 *  held at 1.1 stays inside the 5% it overhangs the frame by */
const DRIFT = 4.5;
/** the stylesheet's failsafe: a photograph held shut for the curtain opens by
 *  itself this long after it is put in, if no script has come to open it
 *  (globals.css, ap-curtain-park — keep the two equal) */
const PARK_MS = 4000;

export default function AboutView() {
  const root = useRef<HTMLDivElement | null>(null);
  const shot = P.about?.[0];

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    gsap.registerPlugin(ScrollTrigger);
    const fig = el.querySelector<HTMLElement>(".ap-about__fig");
    const curtain = fig?.querySelector<HTMLElement>(".ap-about__curtain") ?? null;
    const pic = fig?.querySelector<HTMLElement>(".ap-about__pic") ?? null;
    const img = pic?.querySelector<HTMLElement>("img") ?? null;
    const section = el.querySelector<HTMLElement>(".ap-about");
    /** the curtain plays once per visit: a context rebuilt across 861px or
     *  after a reduced-motion change must not draw it a second time */
    let shown = false;
    const mm = gsap.matchMedia();
    mm.add(
      { motion: "(prefers-reduced-motion: no-preference)", desk: "(min-width: 861px)" },
      (ctx) => {
        const { motion, desk } = ctx.conditions as { motion: boolean; desk: boolean };
        if (!motion) {
          // motion switched off after load (or mid-reveal): whatever the
          // previous context left, the photograph stands plain and open
          if (img) img.style.transform = "";
          if (pic) pic.style.clipPath = "";
          if (curtain) curtain.style.clipPath = "";
          return;
        }
        el.querySelectorAll<HTMLElement>("[data-rise]").forEach((n) => {
          gsap.from(n, {
            y: 28,
            autoAlpha: 0,
            duration: 0.85,
            ease: "power3.out",
            scrollTrigger: { trigger: n, start: "top 88%", toggleActions: "play none none none" },
          });
        });
        if (!fig || !curtain || !pic || !img || !section) return;

        // ---- the curtain and the counter-scale -------------------------
        // A desktop page is held shut by the stylesheet from the first paint
        // (globals.css, the .ap-about__fig rules), so the photograph is never
        // seen and then taken away. If this runs so late that the
        // stylesheet's own failsafe has already opened it, it is left open:
        // drawing the curtain over a photograph already looked at is worse
        // than no curtain.
        // (Measured on the failsafe itself, not on page time: after a
        // client-side navigation the page is minutes old and the photograph
        // has only just been put in.)
        const late =
          fig.dataset.curtain !== "on" &&
          (pic.getAnimations?.() ?? []).some((a) => (a as CSSAnimation).animationName === "ap-curtain-park" && Number(a.currentTime ?? 0) >= PARK_MS - 150);
        // Only the desktop page is held shut from the first paint. Anywhere
        // else the photograph has been on view since the page appeared if
        // its frame is on screen now (a tablet, a phone reloaded at the
        // photograph): shutting it to draw the curtain would take away what
        // the visitor is looking at. It plays only for a frame still below
        // the screen, which is the ordinary one-column case.
        const held = document.documentElement.hasAttribute("data-footfx") && fig.dataset.curtain !== "on";
        const seen = !held && fig.getBoundingClientRect().top < window.innerHeight;
        if (!shown && !late && !seen) {
          gsap.set([curtain, pic], { clipPath: SHUT });
          gsap.set(img, { scale: PIC_FROM });
          fig.dataset.curtain = "on";
          const tl = gsap.timeline({
            paused: true,
            onComplete: () => {
              shown = true;
              // nothing left to clip once it is open, and the curtain is
              // behind an opaque photograph from here on
              gsap.set([curtain, pic], { clearProps: "clipPath" });
              // a plain style write, not a recorded set: a context rebuilt
              // later (across 861px, a motion change) reverts what it set,
              // and the curtain must not come back
              curtain.style.visibility = "hidden";
            },
          });
          tl.to(curtain, { clipPath: OPEN, duration: WIPE, ease: "power4.inOut" }, 0)
            .to(pic, { clipPath: OPEN, duration: WIPE, ease: "power4.inOut" }, CURTAIN_LEAD)
            .to(img, { scale: PIC_REST, duration: WIPE + 0.6, ease: "expo.out" }, CURTAIN_LEAD);
          // a beat after the page's own entrance (her name starts writing
          // at once); in one column the photograph is under the biography
          // and opens as it comes up the screen
          ScrollTrigger.create({ trigger: fig, start: "top 85%", once: true, onEnter: () => tl.delay(desk ? 0.25 : 0).play() });
        } else {
          shown = true;
          fig.dataset.curtain = "on";
          curtain.style.visibility = "hidden";
          gsap.set(img, { scale: PIC_REST });
        }

        // ---- the parallax ------------------------------------------------
        // On a desktop the photograph is in the first screen, so at rest it
        // stands where the page composed it (object-position: her face, her
        // postcards) and sinks from there as the page scrolls. In one column
        // it sinks through its frame from top to bottom as the frame crosses
        // the screen, the usual way.
        gsap.fromTo(
          img,
          { yPercent: desk ? 0 : -DRIFT },
          {
            yPercent: DRIFT,
            ease: "none",
            scrollTrigger: desk
              ? { trigger: section, start: "top top", end: "bottom center", scrub: 0.6 }
              : { trigger: fig, start: "top bottom", end: "bottom top", scrub: 0.6 },
          },
        );
      },
    );
    return () => mm.revert();
  }, []);

  return (
    <div ref={root}>
      <section className="ap-sec ap-about" id="about">
        <div className="ap-about__grid">
          <div className="ap-about__say">
            <p className="ap-kicker" data-rise>
              {about.kicker}
            </p>
            {/* her name is WRITTEN, letter by letter — the caret types line
                one, hands over, and blinks off after the surname */}
            <h1 className="ap-h2">
              {about.title.map((l, i) => (
                <span
                  key={l}
                  style={{ display: "block" }}
                  data-tfx="write"
                  data-tfx-delay={i ? "0.95" : undefined}
                  data-tfx-tail={i === about.title.length - 1 ? "1" : undefined}
                >
                  {l}
                </span>
              ))}
            </h1>
            <p className="ap-about__lead" data-rise>
              {about.lead}
            </p>
            {about.body.map((p) => (
              <p key={p.slice(0, 24)} data-rise>
                {p}
              </p>
            ))}
          </div>
          {shot && (
            <figure className="ap-about__fig">
              {/* the curtain and the picture's own mask — see HER
                  PHOTOGRAPH ARRIVES BEHIND A CURTAIN above */}
              <span className="ap-about__curtain" aria-hidden="true" />
              <div className="ap-about__pic">
                {/* The alt says what the photograph shows and no more: the
                    building behind her is not named, because a caption is not
                    where this site starts asserting addresses.
                    srcSet: a phone column is ~350px wide, so the 525px file
                    serves it at 1x and the 1200px one takes over from there;
                    the desktop column is ~41% of the window. */}
                <img
                  src={shot.src}
                  srcSet={shot.thumbW ? `${shot.thumb} ${shot.thumbW}w, ${shot.src} ${shot.w}w` : undefined}
                  sizes="(max-width: 860px) 92vw, 42vw"
                  alt="Arpine on a balcony shaded by vine leaves, above a square with a fountain in Yerevan, smiling and holding up a fan of her illustrated postcards"
                  width={shot.w}
                  height={shot.h}
                  decoding="async"
                />
              </div>
            </figure>
          )}
        </div>
      </section>
    </div>
  );
}
