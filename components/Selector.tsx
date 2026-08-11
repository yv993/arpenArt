"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import products from "@/lib/products.json";
import { home } from "@/lib/content";

// ============================================================================
// FROM THE STUDIO — the client's InteractiveSelector, ported, now playing her
// own animated illustrations.
//
// The accordion behaviour is kept exactly: five panels share a row, the chosen
// one takes flex 7 against the others' 1, its picture un-zooms, its border
// lights, its shadow deepens, and its title and line slide in from the right.
// Everything else changed, because none of it could survive the trip:
//
//   react-icons          → inline SVG. One icon set is a poor reason to add a
//                          dependency to a project this deliberately small.
//   Tailwind classes     → .ap-isel* in app/selector.css
//   <style jsx>          → the same stylesheet; nothing else here uses
//                          styled-jsx and one file should not introduce it
//   40 lines of inline   → CSS. The original set flex, shadow, border, cursor
//     style objects        and will-change per panel per render, for values
//                          that never change
//   setTimeout stagger   → a CSS animation-delay keyed off --i, started when
//                          the strip scrolls into view. The original's five
//                          timers fire on mount, so on a page this tall the
//                          entrance would play unseen, far below the fold
//   Unsplash camping     → her own films, self-hosted in /public/studio
//   background-image     → next/image and <video>, so stills are responsive
//                          and lazy, and the zoom is a transform that
//                          composites rather than a background that repaints
//
// The panels are BUTTONS. The original toggles on a div's onClick and nothing
// in it can be reached, named, or operated without a mouse.
//
// PLAYBACK IS DELIBERATE, not declarative: `autoPlay` is an attribute React
// will happily flip on a mounted element without anything starting, so the
// open panel's film is driven by play()/pause() in an effect. Only the open
// one runs — four films behind a 62px sliver is battery spent on nothing —
// and with preload="none" a closed panel downloads only its poster.
// ============================================================================

type Shot = { src: string; thumb: string; w: number; h: number };
const P = products as Record<string, Shot[]>;
type Panel = (typeof home.studio.panels)[number];

/** What is actually in the frame, and what shape it is. The aspect ratio is
 *  the panel's, not the picture's decoration: the open panel's width is
 *  computed from it in selector.css, so the frame comes out exactly the size
 *  of the film. Falls back to the still's own dimensions for a panel that has
 *  no video, and to 9:16 only if a piece arrives with neither. */
function frameOf(p: Panel) {
  const shot = p.media ? P[p.media]?.[p.shot ?? 0] : undefined;
  const still = p.poster ?? shot?.src;
  const w = p.w ?? shot?.w;
  const h = p.h ?? shot?.h;
  return { shot, still, ar: w && h ? w / h : 9 / 16 };
}

function Face({ p, on, i }: { p: Panel; on: boolean; i: number }) {
  const vid = useRef<HTMLVideoElement>(null);
  const { shot, still } = frameOf(p);

  useEffect(() => {
    const v = vid.current;
    if (!v) return;
    // A looping film IS motion. Someone who asked for less of it gets the
    // poster and a still panel; the accordion still opens, because that is
    // the control rather than the decoration.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (on) {
      // rejects when a browser's autoplay policy says no — muted + playsInline
      // satisfies every current one, and a refusal is not worth an error
      v.play().catch(() => {});
    } else {
      v.pause();
      v.currentTime = 0;
    }
  }, [on]);

  return (
    <span className="ap-isel__media" aria-hidden="true">
      {p.video ? (
        <video
          ref={vid}
          className="ap-isel__vid"
          src={p.video}
          poster={still}
          muted
          loop
          playsInline
          preload="none"
        />
      ) : (
        shot && (
          <Image
            className="ap-isel__img"
            src={shot.src}
            alt=""
            fill
            sizes="(max-width: 860px) 100vw, 640px"
            priority={i === 0}
          />
        )
      )}
    </span>
  );
}

export default function Selector() {
  const [active, setActive] = useState(0);
  const strip = useRef<HTMLDivElement>(null);

  // The entrance plays when the strip is REACHED, not when the page loads —
  // it sits below four full sections, so a mount-time stagger is an animation
  // nobody is present for.
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      el.dataset.in = "";
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.dataset.in = "";
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="ap-isel">
      <div className="ap-isel__strip" ref={strip}>
        {home.studio.panels.map((p, i) => {
          const on = active === i;
          return (
            <button
              type="button"
              key={p.id}
              className="ap-isel__panel"
              data-on={on || undefined}
              style={{ "--i": i, "--ar": frameOf(p).ar } as React.CSSProperties}
              // the visible title is hidden on every panel but the open one,
              // so the accessible name has to carry it regardless
              aria-label={`${p.title} — ${p.line}`}
              aria-pressed={on}
              onClick={() => setActive(i)}
              // opening on focus as well as click means a keyboard walks the
              // strip the same way a pointer does, instead of having to commit
              onFocus={() => setActive(i)}
            >
              <Face p={p} on={on} i={i} />

              {/* the ground the label sits on, raised only on the open panel —
                  a closed 62px sliver has nothing to darken for */}
              <span className="ap-isel__scrim" aria-hidden="true" />

              <span className="ap-isel__label">
                <span className="ap-isel__badge" aria-hidden="true">
                  {p.video ? (
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                </span>
                <span className="ap-isel__info" aria-hidden="true">
                  <span className="ap-isel__title">{p.title}</span>
                  <span className="ap-isel__line">{p.line}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
