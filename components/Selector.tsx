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

function Face({ p, on, run, i }: { p: Panel; on: boolean; run: boolean; i: number }) {
  const vid = useRef<HTMLVideoElement>(null);
  const { shot, still } = frameOf(p);
  /** the film has a frame of its own: the still under it has done its job
   *  and goes, so a card that has played paints one layer, as it did when
   *  the still was the video's poster (two stacked layers under the card's
   *  rounded clip antialiased its corners differently — measured as a few
   *  dozen corner pixels at 1440) */
  const [framed, setFramed] = useState(false);

  // THE OPEN FILM RUNS ONLY WHILE IT CAN BE SEEN, AND NOT WHEN IT IS PAUSED
  // (2026-10-05 package). It used to start the moment it was opened — film
  // 1 at page load, so on a phone at scrollY 0 it was already playing
  // (paused false, readyState 4) and studio-mountains.mp4 (635 KB) came down
  // ~1s after load, two screens above the strip (synthesis/v1.json films).
  // `run` is the open panel AND the strip on screen AND not paused by the
  // reader. Leaving the screen or pausing keeps the frame where it is;
  // closing the panel still rewinds it, as before.
  useEffect(() => {
    const v = vid.current;
    if (!v) return;
    // A looping film IS motion. Someone who asked for less of it gets the
    // still and a still panel; the accordion still opens, because that is
    // the control rather than the decoration.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (on && run) {
      // rejects when a browser's autoplay policy says no — muted + playsInline
      // satisfies every current one, and a refusal is not worth an error
      v.play().catch(() => {});
    } else if (on) {
      v.pause();
    } else {
      v.pause();
      v.currentTime = 0;
    }
  }, [on, run]);

  return (
    <span
      className="ap-isel__media"
      aria-hidden="true"
      // THE STILL, HANDED TO CSS FOR A BROWSER RUNNING NO SCRIPTS (no-JS
      // repair, 2026-10-05). With scripting off the HTML spec lets a browser
      // draw its own controls on a <video> that has none, and Chromium does:
      // every film card at 1440 and 390 wore a play button over the card's
      // own badge, "0:00", a ⋮ menu and a timeline across its title. Nothing
      // can start these films without this component's script anyway, so
      // selector.css swaps the <video> for this same poster, painted as the
      // card's ground, only under (scripting: none). Inert with scripts on.
      style={p.video && still ? ({ "--still": `url("${still}")` } as React.CSSProperties) : undefined}
    >
      {p.video ? (
        <>
          {/* THE STILL IS A LAZY <img> UNDER THE FILM, NOT ITS POSTER
              (2026-10-05 package). A poster attribute is fetched as soon as
              the parser meets it: all fifteen came down at page load on a
              phone, in the same 262ms batch as the hero (synthesis/v1.json
              homeRes). As an <img loading="lazy"> it waits until the strip
              is near. The film paints over it once it has a frame — a
              <video> with no poster and no data draws nothing — so a closed
              card looks exactly as it did. The no-JS --still ground above is
              untouched; selector.css hides this <img> under
              (scripting: none). */}
          {still && !framed && <img className="ap-isel__still" src={still} alt="" loading="lazy" decoding="async" />}
          <video
            ref={vid}
            className="ap-isel__vid"
            src={p.video}
            muted
            loop
            playsInline
            preload="none"
            onLoadedData={() => setFramed(true)}
          />
        </>
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
  /** the strip is on screen — the open film runs only then */
  const [seen, setSeen] = useState(false);
  /** the reader paused the open film by pressing it (WCAG 2.2.2: a moving
   *  film that starts by itself must be stoppable). Opening another panel
   *  clears it — opening is asking to watch. */
  const [paused, setPaused] = useState(false);
  /** motion is welcome — under reduced motion the films never run, so the
   *  open panel's name does not offer a pause it cannot honour */
  const [motionOk, setMotionOk] = useState(false);
  /** which panel was open when the pointer went down: the press that OPENS a
   *  panel focuses it first (and focus opens it), so by the click it already
   *  looks open — this tells "open it" from "it was open, pause it" */
  const openAtDown = useRef<number | null>(null);

  useEffect(() => {
    setMotionOk(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // The entrance plays when the strip is REACHED, not when the page loads —
  // it sits below four full sections, so a mount-time stagger is an animation
  // nobody is present for. The observer STAYS CONNECTED now (2026-10-05
  // package): it also says when the strip leaves the screen, which is when
  // the open film stops.
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      el.dataset.in = "";
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1];
        if (e.isIntersecting) el.dataset.in = "";
        setSeen(e.isIntersecting);
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // ON A PHONE THE FILM ALSO STOPS WHEN IT IS SWIPED OUT OF THE ROW
  // (2026-10-05 repair). The strip observer above only knows the row is on
  // screen; after a swipe to the last reel, film 1 — still the open one —
  // kept playing off the row's left edge (measured at 390x844: playing [1]
  // at scrollLeft 1872). Each panel is watched against the strip itself;
  // under half of it in the row counts as out. Swiping back plays it again
  // unless the reader paused it. Below 861px only: the desktop accordion
  // never scrolls sideways, so there every panel counts as in the row.
  const [inRow, setInRow] = useState<boolean[] | null>(null);
  useEffect(() => {
    const el = strip.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const mq = window.matchMedia("(max-width: 860px)");
    let io: IntersectionObserver | null = null;
    const arm = () => {
      io?.disconnect();
      io = null;
      if (!mq.matches) {
        setInRow(null);
        return;
      }
      const panels = Array.from(el.children) as HTMLElement[];
      const vis = panels.map(() => true);
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            const i = panels.indexOf(e.target as HTMLElement);
            if (i >= 0) vis[i] = e.intersectionRatio >= 0.5;
          }
          setInRow([...vis]);
        },
        { root: el, threshold: [0, 0.5, 1] },
      );
      panels.forEach((p) => io!.observe(p));
    };
    arm();
    mq.addEventListener("change", arm);
    return () => {
      mq.removeEventListener("change", arm);
      io?.disconnect();
    };
  }, []);

  const open = (i: number) => {
    if (i !== active) setPaused(false);
    setActive(i);
  };

  return (
    <div className="ap-isel">
      <div className="ap-isel__strip" ref={strip}>
        {home.studio.panels.map((p, i) => {
          const on = active === i;
          const shown = inRow ? inRow[i] !== false : true;
          const playing = !!p.video && on && seen && shown && !paused && motionOk;
          return (
            <button
              type="button"
              key={p.id}
              className="ap-isel__panel"
              data-on={on || undefined}
              data-playing={playing || undefined}
              style={{ "--i": i, "--ar": frameOf(p).ar } as React.CSSProperties}
              // the visible title is hidden on every panel but the open one,
              // so the accessible name has to carry it regardless.
              // MICROCOPY (2026-10-05 package): the open film's name also
              // says what a press does now — it pauses or plays it.
              aria-label={`${p.title} — ${p.line}${on && p.video && motionOk ? (paused ? ". Paused — press to play" : ". Playing — press to pause") : ""}`}
              aria-pressed={on}
              onPointerDown={() => {
                openAtDown.current = active;
              }}
              onClick={(e) => {
                // a press on the film that was ALREADY open pauses or plays
                // it; a keyboard press (detail 0) lands on a panel its focus
                // has opened, so it toggles too
                const was = e.detail === 0 ? active : openAtDown.current;
                openAtDown.current = null;
                if (was === i && p.video) setPaused((x) => !x);
                else open(i);
              }}
              // opening on focus as well as click means a keyboard walks the
              // strip the same way a pointer does, instead of having to commit
              onFocus={() => open(i)}
            >
              <Face p={p} on={on} run={seen && shown && !paused} i={i} />

              {/* the ground the label sits on, raised only on the open panel —
                  a closed 62px sliver has nothing to darken for */}
              <span className="ap-isel__scrim" aria-hidden="true" />

              <span className="ap-isel__label">
                <span className="ap-isel__badge" aria-hidden="true">
                  {p.video ? (
                    <>
                      {/* ▶ — the badge every card wears, and the only one the
                          desktop shows until the client has seen the rest */}
                      <svg className="ap-isel__g-play" viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      {/* ❚❚ — on a phone (or any screen without hover) the
                          open, running film shows the pause it offers */}
                      <svg className="ap-isel__g-pause" viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                        <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
                      </svg>
                    </>
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
