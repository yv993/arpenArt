"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { about } from "@/lib/content";
import products from "@/lib/products.json";

type Shot = { id: string; src: string; thumb: string; w: number; h: number; alpha: boolean; avg: string };
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
            <dl className="ap-about__facts" data-rise>
              {about.facts.map((f) => (
                <div key={f.k}>
                  <dt>{f.k}</dt>
                  <dd>{f.v}</dd>
                </div>
              ))}
            </dl>
            <a className="ap-about__link" href={about.link.href} target="_blank" rel="noopener noreferrer">
              {about.link.label} <span aria-hidden>↗</span>
            </a>
          </div>
          {shot && (
            <figure className="ap-about__fig" data-rise>
              <img
                src={shot.src}
                alt="Arpine at work, laying out the Armenia illustration series on screen"
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
