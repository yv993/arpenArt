"use client";

import { useEffect, useRef } from "react";

// ============================================================================
// THE SUN LEAVES THE PICTURE.
//
// Arpine's hero illustration has a big hand-painted sun in its top-left. It is
// cut out of the artwork (public/hero/sun.webp, a real alpha cutout made by
// flood-filling the disc and rebuilding the crown the image edge had clipped),
// and the hero is swapped for a plate with the sun painted out
// (hero-nosun.webp, diffusion-inpainted). At rest the two line up exactly, so
// the hero looks untouched. Then it scrolls: the sun slides right, drops, and
// travels down behind the whole page until it settles into the footer.
//
// THE PLATE SWAP IS DONE HERE, IN JS, ON PURPOSE. The plain layer — phones, no
// JS, reduced motion — never runs this, keeps `/hero/hero.webp`, and therefore
// keeps its painted sun. Baking the sunless plate into the markup would leave
// those visitors looking at a sky with nothing in it.
//
// PROGRESS IS HAND-COMPUTED, NOT ScrollTrigger. This page pins three sections,
// and with pins present nothing ScrollTrigger-based can measure the end of the
// document — refresh() measures with every pin-spacer reverted, so a trigger on
// main, an absolute maxScroll, and an end-of-main sentinel all read ~1440px too
// high and report progress 1 for the whole last screen. Same trap, same fix as
// components/FootReveal.tsx: read scrollHeight at scroll time, in a
// rAF-throttled listener, when the pins have already been applied.
// ============================================================================

const DESKTOP = "(min-width: 861px) and (prefers-reduced-motion: no-preference)";

/** Where the sun sits inside the source illustration, in its own pixels.
 *
 *  THE CENTRE IS THE DISC'S, NOT THE CENTROID'S. Averaging every sun pixel put
 *  it at y=126 and produced a 506x376 OVAL, because the crown is clipped by
 *  the top of the picture and the missing pixels drag the average down. The
 *  disc's real centre is the point furthest from any edge of the shape — the
 *  centre of the largest inscribed circle, which a distance transform finds
 *  and which does not care what the image edge cut off. That is y=74, and
 *  built around it the sun comes out 538x538, aspect 1.000, round like the
 *  painting. See scratchpad/sun4.mjs. */
const ART_W = 1427;
const ART_H = 1102;
const SUN_CX = 414;
const SUN_CY = 74;
const SUN_W = 538;
const SUN_H = 538;

/** The journey, as fractions of the viewport. `p` is progress through the
 *  whole document. The first two legs are the ones the client asked for by
 *  name — right, then down — and they are deliberately quick: they happen
 *  while the hero is still on screen, which is what makes it read as the sun
 *  leaving the picture rather than a decoration that was always floating. */
type Key = { p: number; x: number; y: number; s: number; o: number };
const PATH: Key[] = [
  { p: 0.0, x: 0, y: 0, s: 1, o: 1 }, // start: exactly on the painted sun
  { p: 0.06, x: 0.78, y: 0.14, s: 0.92, o: 1 }, // → right
  { p: 0.15, x: 0.84, y: 0.66, s: 0.8, o: 0.85 }, // → down
  // OPACITY IS TUNED TO WHAT IT CROSSES, and it has to be. The sun is pale
  // yellow: against the dark bands (the cloud and the gallery) a third of it
  // is plenty and more would glare, but the same value over cream paper is
  // invisible — measured at p=0.80, where 0.41 left nothing on screen at all.
  // So it is held low through the dark sections and lifted through the light
  // ones, which is also what a sun crossing a sky would do.
  { p: 0.34, x: 0.2, y: 0.34, s: 0.66, o: 0.4 }, // cloud — dark
  { p: 0.55, x: 0.74, y: 0.6, s: 0.6, o: 0.34 }, // gallery — dark
  { p: 0.76, x: 0.22, y: 0.3, s: 0.7, o: 0.66 }, // shop — paper
  { p: 0.93, x: 0.58, y: 0.78, s: 0.9, o: 0.82 }, // studio — paper
  // IT SETS. Measured, not guessed: the footer is 310px tall and the sun is
  // ~536px, so it cannot sit inside without covering something — the first
  // attempt landed dead centre and cut "drawn by hand" in half. The tagline's
  // glyphs end at x≈580 and the Privacy/Terms links start at x=1215, so the
  // sun drops into the gap between them and mostly below the fold, leaving a
  // half-sun on the horizon and every word of the footer legible.
  { p: 1.0, x: 0.62, y: 1.06, s: 1.05, o: 0.95 },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** smoothstep — a linear ramp between keys makes the sun visibly change
 *  direction at each one, like a paper cut-out being dragged */
const ease = (t: number) => t * t * (3 - 2 * t);

export default function Sun() {
  const wrap = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!window.matchMedia(DESKTOP).matches) return;
    const el = img.current;
    const box = wrap.current;
    if (!el || !box) return;

    const hero = document.querySelector<HTMLElement>(".ap-hero__img");
    if (!hero) return;

    // THE ANIMATED HERO HAS NO SUN TO LEAVE (2026-08-11). This whole component
    // exists because the painted illustration had a sun in its top-left: it is
    // cut out, the plate is swapped for one with the sun inpainted away, and
    // the cutout then flies down the page. Arpine's animated cut of the same
    // artwork is framed tighter and the sun is not in it — so there is nothing
    // to take out, nothing to fly, and a sun appearing over her sky would be a
    // decoration we invented rather than a piece of her painting that moved.
    // Every constant below (SUN_CX/CY, the geometry read off ART_W x ART_H) is
    // measured against the STILL, and would land in the wrong place here.
    // So: while the hero is the film, the sun stays out of it. Put the still
    // back in HomeView and this returns on its own.
    if (hero.tagName === "VIDEO") return;

    // The sunless plate is chosen by <picture> in HomeView, not swapped here.
    // A JS swap made desktop download both plates and showed the change; the
    // <source> media query is the same gate as this component's, so the two
    // cannot disagree — if this effect is running, scripting is enabled and
    // the browser has already resolved to the sunless plate.
    box.dataset.on = "";

    /** the painted sun's screen position and size, from the hero's real
     *  geometry — it is `contain` on the plain layer and `cover` once the
     *  media expansion engages, so the fit has to be read, not assumed */
    let home = { x: 0, y: 0, w: 0 };
    /** Where the sun stops being part of the picture and becomes scenery.
     *  Read from the hero's own laid-out height — which INCLUDES its pin
     *  spacer, so it is the real scroll distance the hero occupies — rather
     *  than a guessed fraction of the document. Until this point the sun is
     *  above the hero, or leaving the picture would mean disappearing into
     *  it; after it, the sun drops behind every section's content. */
    let handover = 0;
    const measure = () => {
      const r = hero.getBoundingClientRect();
      const fit = getComputedStyle(hero).objectFit;
      const k =
        fit === "cover"
          ? Math.max(r.width / ART_W, r.height / ART_H)
          : Math.min(r.width / ART_W, r.height / ART_H);
      const dw = ART_W * k;
      const dh = ART_H * k;
      // object-position is 50% 50% on both branches
      home = {
        x: r.left + (r.width - dw) / 2 + SUN_CX * k,
        y: r.top + (r.height - dh) / 2 + SUN_CY * k,
        w: SUN_W * k,
      };
      el.style.width = `${home.w}px`;
      el.style.height = `${(SUN_H / SUN_W) * home.w}px`;

      const heroSec = hero.closest<HTMLElement>(".ap-hero");
      // half a screen before the hero's last pixel: by then the picture is
      // mostly gone, so the change of depth happens where there is nothing to
      // see it against
      handover = heroSec ? heroSec.offsetTop + heroSec.offsetHeight - window.innerHeight * 0.5 : 0;
    };

    /** SECTIONS THE SUN MUST NOT PASS BEHIND.
     *
     *  Over open ground the cutout reads as what it is — the gallery's dark
     *  sky has room around the sphere and a painted sun sits in it happily.
     *  Behind the cloud's wall of 57 cards you never see the whole disc, only
     *  the slivers between pictures, and slivers of a pale yellow shape read
     *  as a stain on the artwork rather than as a sun (client 2026-08-10:
     *  "central part like blurred it must not show that way"). So it fades
     *  out in proportion to how much of it that section is covering, and
     *  comes back the moment it is clear again. */
    const veils = [...document.querySelectorAll<HTMLElement>("[data-nosun]")];

    let raf = 0;
    const draw = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;

      let i = 0;
      while (i < PATH.length - 2 && p > PATH[i + 1].p) i++;
      const a = PATH[i];
      const b = PATH[i + 1];
      const t = ease(b.p === a.p ? 0 : Math.min(1, Math.max(0, (p - a.p) / (b.p - a.p))));

      // leg 0 starts from the sun's real place in the picture rather than a
      // viewport fraction, so it begins exactly where it was painted
      const ax = a.p === 0 ? home.x : a.x * window.innerWidth;
      const ay = a.p === 0 ? home.y : a.y * window.innerHeight;
      const x = lerp(ax, b.x * window.innerWidth, t);
      const y = lerp(ay, b.y * window.innerHeight, t);
      const s = lerp(a.s, b.s, t);
      const o = lerp(a.o, b.o, t);

      const h = (SUN_H / SUN_W) * home.w;
      el.style.transform = `translate3d(${x - home.w / 2}px, ${y - h / 2}px, 0) scale(${s})`;

      // the disc's box on screen, computed rather than measured — scale is
      // about the centre, and asking for a rect here would force a layout
      // every frame right after writing the transform
      const dw = home.w * s;
      const dh = h * s;
      const dx = x - dw / 2;
      const dy = y - dh / 2;
      let veil = 0;
      for (const sec of veils) {
        const r = sec.getBoundingClientRect();
        const ox = Math.max(0, Math.min(dx + dw, r.right) - Math.max(dx, r.left));
        const oy = Math.max(0, Math.min(dy + dh, r.bottom) - Math.max(dy, r.top));
        const f = dw * dh > 0 ? (ox * oy) / (dw * dh) : 0;
        if (f > veil) veil = f;
      }
      el.style.opacity = String(o * (1 - ease(veil)));

      // in front of the hero while it is still the hero's sun, behind the
      // page's content from there on
      if (window.scrollY > handover) box.dataset.behind = "";
      else delete box.dataset.behind;
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    const onResize = () => {
      measure();
      draw();
    };

    measure();
    draw();
    // the hero's own plate finishes loading after this runs, and the media
    // expansion changes object-fit — both move where the sun belongs
    const settle = window.setTimeout(onResize, 900);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.clearTimeout(settle);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
      delete box.dataset.on;
    };
  }, []);

  return (
    <div className="ap-sun" ref={wrap} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- positioned by
          transform against measured hero geometry; next/image's own wrapper
          fights that, and this is one small decorative cutout */}
      <img ref={img} className="ap-sun__disc" src="/hero/sun.webp" alt="" width={SUN_W} height={SUN_H} />
    </div>
  );
}
