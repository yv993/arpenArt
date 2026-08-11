"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Drift from "./Drift";

type Shot = { id: string; src: string; thumb: string; w: number; h: number; alpha: boolean; avg: string };

// ============================================================================
// LOOKBOOK — the photographs of a finished thing, out in the world.
//
// Two movements, both ported from the collection in feturesss21/best/scroll
// onto the GSAP ScrollTrigger this project already ships. Neither original
// could be dropped in as a file: zoom-parallax and parallax-gallery are
// framer-motion + lenis + Tailwind, and adding three packages to a 3-package
// project to buy two effects is a bad trade. The geometry below is transcribed
// from them; the driver is ours.
//
//   ZOOM   one photograph fills the frame while six satellites fly outward
//          past the edges. Tile positions and per-tile zoom rates are
//          verbatim from best/scroll/zoom-parallax.tsx.
//   DRIFT  three columns crossing the frame at different speeds. The idea is
//          best/scroll/parallax-gallery.tsx (Skiper30); the maths is not —
//          see the note above the drift block for why its transform can open
//          a gap and this one provably cannot.
//
// Everything is gated on `(scripting: enabled)`, a real pointer width and no
// reduced-motion request. Outside that gate the same markup is an ordinary
// grid of photographs, which is what the markup is for.
// ============================================================================

/** Tile geometry + zoom rate, verbatim from best/scroll/zoom-parallax.tsx.
 *  Index 0 is the centre plate; 1–6 are its satellites. `top`/`left` offset
 *  each tile from the centre of the frame; `scale` is where it ends up. */
const TILES = [
  { top: "0", left: "0", h: "25vh", w: "25vw", scale: 4 },
  { top: "-30vh", left: "5vw", h: "30vh", w: "35vw", scale: 5 },
  { top: "-10vh", left: "-25vw", h: "45vh", w: "20vw", scale: 6 },
  { top: "0", left: "27.5vw", h: "25vh", w: "25vw", scale: 5 },
  { top: "27.5vh", left: "5vw", h: "25vh", w: "20vw", scale: 6 },
  { top: "27.5vh", left: "-22.5vw", h: "25vh", w: "30vw", scale: 8 },
  { top: "22.5vh", left: "25vw", h: "15vh", w: "15vw", scale: 9 },
];

export default function Lookbook({
  shots,
  kicker,
  title,
  copy,
  caption,
  alt,
}: {
  shots: Shot[];
  kicker: string;
  title: string;
  copy: string;
  /** one short line, shown over the dark ground midway through the zoom */
  caption: string;
  /** describes one photograph — the zoom band carries it, the drift band
   *  repeats the same pictures and is therefore decorative */
  alt: string;
}) {
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();

    mm.add("(min-width: 861px) and (prefers-reduced-motion: no-preference)", () => {
      // ---- ZOOM ------------------------------------------------------------
      // Each layer is a full-frame box scaled about the centre of the screen,
      // so the centre plate grows toward you while its neighbours leave past
      // the edges. Scaling the layer rather than the photograph is what keeps
      // every tile travelling outward from one shared vanishing point.
      const zoom = el.querySelector<HTMLElement>(".ap-lb-zoom");
      if (zoom) {
        const track = {
          trigger: zoom,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          invalidateOnRefresh: true,
        } as const;

        const layers = gsap.utils.toArray<HTMLElement>(".ap-lb-zoom__lyr", zoom);
        layers.forEach((layer, i) => {
          gsap.fromTo(
            layer,
            { scale: 1 },
            { scale: TILES[i % TILES.length].scale, ease: "none", scrollTrigger: track },
          );
        });

        // The satellites have all left the frame by roughly the halfway mark,
        // and the rest of the run is one photograph growing quietly toward
        // full bleed. The caption fills that stretch and then clears out
        // before the picture covers the screen — so it never has to sit on
        // the photograph, where nothing here would pass 4.5:1.
        const cap = zoom.querySelector<HTMLElement>(".ap-lb-zoom__cap");
        if (cap) {
          gsap
            .timeline({ scrollTrigger: track })
            .set(cap, { autoAlpha: 0, y: 18 })
            .to(cap, { autoAlpha: 1, y: 0, ease: "power2.out", duration: 0.16 }, 0.44)
            .to(cap, { autoAlpha: 0, y: -14, ease: "power2.in", duration: 0.12 }, 0.85);
        }
      }

      // the drifting columns are <Drift> — it runs its own trigger
    });

    return () => mm.revert();
  }, []);

  // seven for the zoom, all of them for the drift; the centre plate is the
  // first shot, so pass the strongest photograph first
  const zoomShots = shots.slice(0, TILES.length);

  return (
    <div className="ap-lb" ref={root}>
      <div className="ap-lb__head">
        <p className="ap-kicker">{kicker}</p>
        <h2 className="ap-h2">{title}</h2>
        <p className="ap-lede">{copy}</p>
      </div>

      {/* ═══ ZOOM ═══════════════════════════════════════════════════════════ */}
      <section className="ap-lb-zoom" aria-label={`${title} — in close`}>
        <div className="ap-lb-zoom__stage">
          {zoomShots.map((s, i) => {
            const t = TILES[i];
            return (
              <div className="ap-lb-zoom__lyr" key={s.id}>
                <figure
                  className="ap-lb-zoom__box"
                  // Carried as custom properties, NOT as inline top/left/width/
                  // height. Inline geometry beats every stylesheet rule, so on
                  // a phone — where the moved layer is switched off and this is
                  // meant to be a plain grid — the tiles kept their 20vw × 45vh
                  // scatter and tore the page open. Only the moved layer reads
                  // these; everywhere else they are inert.
                  style={
                    {
                      "--t": t.top,
                      "--l": t.left,
                      "--h": t.h,
                      "--w": t.w,
                      background: s.avg,
                    } as React.CSSProperties
                  }
                >
                  <img
                    src={s.src}
                    alt={`${alt} — photograph ${i + 1} of ${zoomShots.length}`}
                    width={s.w}
                    height={s.h}
                    loading={i === 0 ? undefined : "lazy"}
                    decoding="async"
                  />
                </figure>
              </div>
            );
          })}
          <p className="ap-lb-zoom__cap">{caption}</p>
        </div>
      </section>

      {/* ═══ DRIFT ══════════════════════════════════════════════════════════ */}
      <Drift shots={shots} placement="lookbook" />
    </div>
  );
}
