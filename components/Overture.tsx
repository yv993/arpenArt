"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Drift from "./Drift";

type Shot = { id: string; src: string; thumb: string; w: number; h: number; alpha: boolean; avg: string };

// ============================================================================
// OVERTURE — what a category shows before it shows you the counter.
//
// One screen, no more. It is tempting to give an entrance the 130vh the
// lookbook gets, but this sits ABOVE the buy panel: every extra viewport is
// another screen a visitor has to scroll through before they can put the thing
// in a basket. One screen reads as an entrance; two reads as an obstacle.
//
// The title rides over the top of it and clears out as you scroll, handing the
// page to the product itself.
// ============================================================================

export default function Overture({
  shots,
  name,
  kicker,
  from,
}: {
  shots: Shot[];
  name: string;
  kicker: string;
  from: string;
}) {
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();

    mm.add("(min-width: 861px) and (prefers-reduced-motion: no-preference)", () => {
      // Rise only — deliberately NOT a fade. The block's own gradient is what
      // gives this type a legible ground over garments shot on black, and
      // fading the block fades the gradient with it: measured mid-scroll, the
      // price and the cue dropped under 2:1 while still perfectly visible.
      // Moving it keeps text and ground together the whole way out, and the
      // band is only one screen tall, so it leaves on its own regardless.
      gsap.to(el.querySelector(".ap-ovt__say"), {
        yPercent: -18,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: true, invalidateOnRefresh: true },
      });
    });

    return () => mm.revert();
  }, []);

  return (
    // The heading comes FIRST in the DOM. In the moved layer it is positioned
    // absolutely so the order costs nothing, but in the plain layer — a phone,
    // no scripting, reduced motion — order is the layout, and with the columns
    // first a visitor landed on 4,500px of photographs before they reached the
    // name of what they had clicked.
    <section className="ap-ovt" ref={root} aria-label={name}>
      <div className="ap-ovt__say">
        <p className="ap-kicker">{kicker}</p>
        {/* FLIP ON SCROLL (client 2026-08-11). This heading had no text effect
            at all — every other display title on the site announces itself and
            this one simply sat there. `flip` turns each glyph in on its own
            axis; the shared runner in components/TextFX.tsx owns the timing
            (ScrollTrigger at "top 88%", once) and the desktop + motion gate, so
            a phone and a reduced-motion reader still get plain text. */}
        <h1 className="ap-ovt__title" data-tfx="flip">
          {name}
        </h1>
        <p className="ap-ovt__from">from {from}</p>
        <span className="ap-ovt__cue" aria-hidden="true">
          Scroll ↓
        </span>
      </div>
      {/* THREE COLUMNS — the client prefers the look, and the travel problem
          they were meant to fix is solved in CSS instead (see the cell
          `min-height` in lookbook.css). Drift moves each column by its own
          slack, `colH - vh`, so the fix is to make the columns tall rather
          than to make them few. */}
      <Drift shots={shots} placement="overture" />
    </section>
  );
}
