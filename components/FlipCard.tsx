"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================================
// FLIP CARD — a two-sided printed piece that turns over (change 5, 2026-11).
//
// Her note under the bookmark files (change 5.pdf p4): «սա էջանշանի հետևի
// կողմն ա, կարա նենց լինի, որ պահեն ասենք նկարի վրա հետևի կողմը երևա, հենց
// կլիկ անեն, եսիմ, տենց մի բան» — this is the back of the bookmark; when
// they hold [the pointer] on the picture the back could show, or as soon as
// they click, something like that. So BOTH, by input:
//   · a mouse resting on the card turns it after ~120 ms (a preview — it
//     turns back when the pointer leaves), only where the device can hover
//     with a fine pointer: (hover: hover) and (pointer: fine);
//   · a click, a tap, Enter or Space TOGGLES it, and the turn stays (the
//     button's aria-pressed). A click on a card the hover has already
//     turned keeps it turned — the corner mark fills to say so — and the
//     next click turns it back, with the hover preview held off until the
//     pointer leaves, so a press always ends on the side it chose.
// No long-press: it collides with the phone's own image menu and has no
// keyboard twin.
//
// NOT MorphHero's flip, which turns on :hover alone and cannot be reached by
// keyboard or touch.
//
// THE PARTS (app/flip.css):
//   .ap-flip            the box; its ratio is the piece's print ratio, so the
//                       grid is laid out before a picture arrives (CLS 0)
//   .ap-flip__btn       the native <button>: hit area, focus ring, perspective.
//                       It never moves, so the ring never turns away.
//   .ap-flip__in        the span that turns (preserve-3d), both faces in one
//                       grid cell
//   .ap-flip__face      the two <img>s; the back is pre-turned 180°, and both
//                       hide their backface (-webkit- too, for Safari)
// Reduced motion: no rotation at all — the faces crossfade (flip.css).
//
// THE BACK IS DECODED BEFORE THE FIRST TURN (the cloud viewer's trap,
// Cloud.tsx `img.decode()`): a face that turns into view still decoding shows
// a blank card for a frame. The card never turns onto a back that is not
// there (`backOk`: the file arrived and `img.decode()` settled).
//
// A PRESS ANSWERS AT ONCE, THE TURN FOLLOWS THE BACK (review O1, 2026-11-12).
// It used to wait for the decode before it set any state, raced against a
// 700 ms cap: on a slow line a tap did nothing for 0.6–0.7 s (a second tap
// to check then cancelled the first, so the card never turned) and then the
// card turned anyway onto the empty average-colour face. Now:
//   · the press sets `pressed` (and the filled mark) in the same frame;
//   · the card turns the moment its back is ready — no second press; until
//     then it stays on its front and the mark's arrows turn, quietly
//     (`data-wait`, flip.css), a beat late so a back that is merely
//     decoding never flashes it;
//   · the back is made ready in practice: once the page has loaded and gone
//     idle, the backs of the cards on or near the screen are fetched and
//     decoded (`warm`); the first sign of intent — pointer over, focus,
//     press — asks for that card's back at once, ahead of the pictures still
//     queued (`loading` eager, `fetchPriority` high).
// A back that fails outright (a broken file) lets the card turn: nothing is
// coming, and the press must not wait forever.
//
// The hidden face is aria-hidden. The button's name is fixed (`name`); the
// pressed state, not a changing name, says which side is up.
// ============================================================================

export type FlipFace = {
  src: string;
  /** optional srcset (e.g. "-sm 331w, full 662w"); `sizes` applies to both faces */
  srcSet?: string;
  w: number;
  h: number;
  alt: string;
};

const HOVER_DELAY = 120;
const FINE = "(hover: hover) and (pointer: fine)";
/** "near the screen" for the idle warm-up: a screen above and below; in a
 *  sideways rail (the phone's), a rail's width either side too — Chromium
 *  reads `scrollMargin`, the others ignore it and warm on sight */
const WARM_NEAR = { rootMargin: "100% 0px", scrollMargin: "0px 100%" } as IntersectionObserverInit;

export default function FlipCard({
  front,
  back,
  ratio,
  name,
  sizes,
  avg,
  eager = false,
  className,
}: {
  front: FlipFace;
  back: FlipFace;
  /** the printed piece's ratio as CSS aspect-ratio, e.g. "56 / 190", "1 / 1",
   *  "105 / 148" — the faces are cropped to it (object-fit: cover) */
  ratio: string;
  /** the button's accessible name, fixed for both sides — e.g. "Bookmark
   *  no. 05: show the back" (pressed = the back is up) */
  name: string;
  sizes?: string;
  /** the piece's average colour, painted while the picture loads */
  avg?: string;
  /** the first row of a page may ask for its pictures at once */
  eager?: boolean;
  className?: string;
}) {
  const [pressed, setPressed] = useState(false);
  const [hover, setHover] = useState(false);
  /** set by a press that turned the card BACK to the front while the pointer
   *  is still on it — the hover preview stays off until the pointer leaves */
  const [hold, setHold] = useState(false);
  /** the back has arrived and is decoded: the only state a turn may show */
  const [backOk, setBackOk] = useState(false);
  /** the latest toggle, read in the press handler itself: a resting mouse
   *  needs `next` before React has rendered the last press */
  const pressedNow = useRef(false);
  /** a mouse is resting on the card (fine-pointer devices only) */
  const mouseIn = useRef(false);
  const box = useRef<HTMLDivElement>(null);
  const backImg = useRef<HTMLImageElement>(null);
  const started = useRef(false);
  const timer = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      window.clearTimeout(timer.current);
    };
  }, []);

  /** fetch the back now (not when the lazy loader gets to it) and decode it;
   *  `backOk` once it is paintable — or once it has failed for good */
  const warm = useCallback(() => {
    const img = backImg.current;
    if (!img || started.current) return;
    started.current = true;
    const ok = () => {
      if (alive.current) setBackOk(true);
    };
    const settle = () => {
      // still on its way (a deferred lazy image reports false too): its load
      // or error event comes back here
      if (!img.complete) return;
      img.removeEventListener("load", settle);
      img.removeEventListener("error", settle);
      if (img.naturalWidth === 0) ok();
      else img.decode().catch(() => undefined).then(ok);
    };
    img.addEventListener("load", settle);
    img.addEventListener("error", settle);
    if (img.loading !== "eager") img.loading = "eager";
    settle();
  }, []);

  /** the first sign of intent on THIS card: its back goes first */
  const want = useCallback(() => {
    const img = backImg.current;
    if (img && !backOk) img.fetchPriority = "high";
    warm();
  }, [backOk, warm]);

  // the idle warm-up: once the page has loaded and gone quiet, the backs of
  // the cards on or near the screen, so the first turn needs no wait at all
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let io: IntersectionObserver | null = null;
    let idle = 0;
    // Safari has no requestIdleCallback
    const ric = "requestIdleCallback" in window;
    const watch = () => {
      io = new IntersectionObserver((entries) => {
        if (!entries.some((en) => en.isIntersecting)) return;
        io?.disconnect();
        warm();
      }, WARM_NEAR);
      io.observe(el);
    };
    const arm = () => {
      idle = ric ? window.requestIdleCallback(watch, { timeout: 2500 }) : window.setTimeout(watch, 300);
    };
    if (document.readyState === "complete") arm();
    else window.addEventListener("load", arm, { once: true });
    return () => {
      window.removeEventListener("load", arm);
      if (ric) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      io?.disconnect();
    };
  }, [warm]);

  /** the side the visitor has asked for */
  const wantBack = pressed || (hover && !hold);
  const showBack = wantBack && backOk;

  const onEnter = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !window.matchMedia(FINE).matches) return;
    mouseIn.current = true;
    want();
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (alive.current && mouseIn.current) setHover(true);
    }, HOVER_DELAY);
  };
  const onLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    mouseIn.current = false;
    window.clearTimeout(timer.current);
    setHover(false);
    setHold(false);
  };
  const onPress = () => {
    want();
    const next = !pressedNow.current;
    pressedNow.current = next;
    // turning back to the front under a resting mouse: keep the preview
    // off until the pointer leaves, or the card would stay on its back
    // (only then — a key or a tap with no mouse on the card holds nothing)
    if (!next && mouseIn.current) setHold(true);
    setPressed(next);
  };

  return (
    <div
      ref={box}
      className={`ap-flip${className ? ` ${className}` : ""}`}
      data-back={showBack || undefined}
      data-pressed={pressed || undefined}
      data-wait={(wantBack && !backOk) || undefined}
      style={{ aspectRatio: ratio }}
    >
      <button
        type="button"
        className="ap-flip__btn"
        aria-pressed={pressed}
        aria-label={name}
        onClick={onPress}
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
        onPointerDown={want}
        onFocus={want}
      >
        <span className="ap-flip__in" style={avg ? { background: avg } : undefined}>
          <img
            className="ap-flip__face ap-flip__face--front"
            src={front.src}
            srcSet={front.srcSet}
            sizes={front.srcSet ? sizes : undefined}
            alt={front.alt}
            width={front.w}
            height={front.h}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            aria-hidden={showBack || undefined}
            draggable={false}
          />
          <img
            ref={backImg}
            className="ap-flip__face ap-flip__face--back"
            src={back.src}
            srcSet={back.srcSet}
            sizes={back.srcSet ? sizes : undefined}
            alt={back.alt}
            width={back.w}
            height={back.h}
            loading="lazy"
            decoding="async"
            aria-hidden={!showBack || undefined}
            draggable={false}
          />
        </span>
        {/* the turn mark: says the card has another side; filled while a
            press keeps it turned. Decoration — the button's state is the
            accessible half. */}
        <span className="ap-flip__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M4 12a8 8 0 0 1 13.7-5.6M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6M4 20v-5h5" />
          </svg>
        </span>
      </button>
    </div>
  );
}
