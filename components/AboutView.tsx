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
// ============================================================================

export default function AboutView() {
  const root = useRef<HTMLDivElement | null>(null);
  const shot = P.about?.[0];

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      el.querySelectorAll<HTMLElement>("[data-rise]").forEach((n) => {
        gsap.from(n, {
          y: 28,
          autoAlpha: 0,
          duration: 0.85,
          ease: "power3.out",
          scrollTrigger: { trigger: n, start: "top 88%", toggleActions: "play none none none" },
        });
      });
    });
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
            <figure className="ap-about__fig" data-rise>
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
            </figure>
          )}
        </div>
      </section>
    </div>
  );
}
