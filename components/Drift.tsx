"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type Shot = { id: string; src: string; thumb: string; w: number; h: number; alpha: boolean; avg: string };

// ============================================================================
// DRIFT — columns of photographs crossing the frame at different speeds.
//
// The idea is feturesss21/best/scroll/parallax-gallery.tsx (Skiper30); the
// maths is not. That original multiplies the viewport height by 1.25–3.3 and
// lets the columns run, which at some window sizes walks a column off the top
// of the frame and leaves a bare strip behind it. Here each column is pinned
// to the VISIBLE WINDOW and then slides through its own slack (column height −
// viewport height): its top can never fall below the top of the window and its
// bottom can never rise above the bottom, whatever the viewport, so the frame
// is provably always full — and each column still travels at its own speed,
// which is the whole point of the effect.
//
// Two placements, because where the band sits decides what scroll it can have:
//
//   overture  the first thing on a page. Already fully in view at scroll 0, so
//             it runs "top top" → "bottom top" — one viewport of scrolling.
//   lookbook  the last thing on a page. Ends "bottom bottom", not "bottom top":
//             measured at 1440×900 the latter wanted 5409px of document when
//             only 4509px existed, which stranded the run at 78% and the late
//             column never moved at all.
// ============================================================================

/** How fast each column crosses its own slack. All three map 0→1 across the
 *  band, so no column ever runs out of photograph; the exponents are what make
 *  them read as three different speeds rather than one sheet sliding. */
const CURVES = [(p: number) => p, (p: number) => Math.pow(p, 0.62), (p: number) => Math.pow(p, 1.65)];

export default function Drift({
  shots,
  placement,
  columns = 3,
}: {
  shots: Shot[];
  placement: "overture" | "lookbook";
  columns?: number;
}) {
  const frame = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();

    mm.add("(min-width: 861px) and (prefers-reduced-motion: no-preference)", () => {
      const cols = gsap.utils.toArray<HTMLElement>(".ap-drift__col", el);
      if (!cols.length) return;
      const setY = cols.map((c) => gsap.quickSetter(c, "y", "px"));
      let vh = 0;
      let frameH = 0;
      let colH: number[] = [];

      const measure = () => {
        vh = window.innerHeight;
        frameH = el.offsetHeight;
        // read each column's laid-out height once, at refresh: reading it per
        // frame would measure the transform we had just written
        colH = cols.map((c) => c.getBoundingClientRect().height);
      };

      const place = (p: number) => {
        // taken from the live rect rather than derived from progress, so it
        // stays correct whatever start/end the trigger is given
        const windowTop = Math.min(Math.max(-el.getBoundingClientRect().top, 0), Math.max(0, frameH - vh));
        for (let i = 0; i < cols.length; i++) {
          const slack = Math.max(0, colH[i] - vh);
          const q = CURVES[i % CURVES.length](Math.min(1, Math.max(0, p)));
          setY[i](windowTop - slack * q);
        }
      };

      // A PIN WAS TRIED HERE AND REVERTED (2026-08-11). The intent was right —
      // hold the page while the columns run, then release — but the pin's
      // length has to come from the columns' slack, and `measure()` reads their
      // height before the photographs have loaded. The slack computed to ~0, so
      // the spacer came out exactly the element's own height and the pin held
      // for nothing while still making the drift `position: fixed`.
      // Doing it properly needs a ScrollTrigger.refresh() once the images have
      // decoded, and it has to be checked against FootReveal, which reads
      // scrollHeight at scroll time and would see the new spacer.
      ScrollTrigger.create({
        trigger: el,
        start: placement === "overture" ? "top top" : "top bottom",
        end: placement === "overture" ? "bottom top" : "bottom bottom",
        invalidateOnRefresh: true,
        onRefresh: (self) => {
          measure();
          place(self.progress);
        },
        onUpdate: (self) => place(self.progress),
      });
    });

    return () => mm.revert();
  }, [placement]);

  const lanes: Shot[][] = Array.from({ length: columns }, () => []);
  shots.forEach((s, i) => lanes[i % columns].push(s));

  return (
    <div className={`ap-drift ap-drift--${placement}`} ref={frame}>
      {lanes.map((lane, i) => (
        <div className="ap-drift__col" key={i}>
          {lane.map((s) => (
            <figure className="ap-drift__cell" key={s.id} style={{ background: s.avg }}>
              <img src={s.thumb} alt="" width={s.w} height={s.h} loading="lazy" decoding="async" />
            </figure>
          ))}
        </div>
      ))}
    </div>
  );
}
