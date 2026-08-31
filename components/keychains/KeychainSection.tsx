"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import KeychainCard from "./KeychainCard";
import { add, dram } from "@/lib/cart";
import { flyToCart } from "@/lib/fly";
import type { Keychain, KeychainWall } from "@/types/keychain";

// ============================================================================
// THE KEYCHAIN SHOWROOM — the whole line on one endless wall.
//
// Third pass (client 2026-08-31 night: "it must be smaller … user can also to
// move right and next keychains must appere from right and circle must go to
// left"). The three fixed pegs became a CAROUSEL: all twenty-four hang in a
// row, the row slides, and it is a CIRCLE — advancing moves the wall left and
// the next keychains enter from the right edge, forever.
//
// THE WRAP is the standard doubled-track marquee: the track renders the line
// TWICE, total width W = half the track's scrollWidth, and the offset lives
// in ((off % W) + W) % W — translate by −off and the second copy always
// covers the seam. The copies are `ghost` cards: identical pixels,
// aria-hidden with untabbable buttons, because a screen reader must meet
// each keychain once.
//
// TWO GESTURES SHARE THE WALL, split by TARGET, not by axis: a drag that
// starts ON a keychain turns that keychain (KeychainCard owns it, and its
// pointer-capture keeps it); a drag that starts on the wall between them
// slides the row, with velocity carrying it after release. The arrows do the
// same slide for anyone who does not find the drag — and they are real
// buttons, so the carousel works from a keyboard.
//
// live=false (phone, reduced motion, no JS): no transform, no arrows — the
// track is an ordinary overflow-x rail the thumb scrolls natively, ghosts
// display:none, and the rack below remains the comfortable surface.
// ============================================================================

const GATE = "(min-width: 861px) and (hover: hover) and (prefers-reduced-motion: no-preference)";

export default function KeychainSection({
  items,
  wall,
  heading = "h2",
}: {
  items: Keychain[];
  wall: KeychainWall;
  /** the page decides whether this block carries its h1 */
  heading?: "h1" | "h2";
}) {
  const [live, setLive] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const addedTimer = useRef(0);

  const track = useRef<HTMLUListElement>(null);
  const half = useRef(1); // width of ONE copy of the line
  const off = useRef(0); // current scroll of the circle, px
  const vel = useRef(0); // px/ms, smoothed, for the throw
  const lastX = useRef(0);
  const lastT = useRef(0);
  const sliding = useRef(false);

  useEffect(() => {
    // no `(scripting: enabled)` here — inside an effect it is a tautology, and
    // on browsers without the `scripting` media feature the unknown query is
    // `not all` and would kill the live layer. See MagnetFridge.tsx.
    if (typeof window === "undefined") return;
    if (!window.matchMedia(GATE).matches) return;
    setLive(true);
  }, []);

  useEffect(() => () => window.clearTimeout(addedTimer.current), []);

  const paint = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const W = half.current;
    off.current = ((off.current % W) + W) % W;
    el.style.transform = `translate3d(${-off.current}px, 0, 0)`;
  }, []);

  // measure one copy's width — after mount and again on resize. The images
  // carry width/height attributes, so layout is right before they decode.
  useEffect(() => {
    if (!live) return;
    const el = track.current;
    if (!el) return;
    const measure = () => {
      half.current = Math.max(1, el.scrollWidth / 2);
      paint();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [live, paint]);

  /** one keychain's slot: a copy's width over the number of keychains */
  const step = () => half.current / Math.max(1, items.length);

  const glide = (delta: number) => {
    const p = { v: off.current };
    gsap.killTweensOf(track.current!, "x"); // never two glides at once
    gsap.to(p, {
      v: off.current + delta,
      duration: 0.55,
      ease: "power3.out",
      onUpdate: () => {
        off.current = p.v;
        paint();
      },
    });
  };

  // ---- sliding the wall (background drag) ---------------------------------
  const wallDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!live) return;
    // a press on a keychain belongs to that keychain's own turn; a press on
    // a button belongs to the button
    if ((e.target as HTMLElement).closest(".ap-kc__hang, button, a")) return;
    sliding.current = true;
    lastX.current = e.clientX;
    lastT.current = e.timeStamp;
    vel.current = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const wallMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!sliding.current) return;
    const dx = e.clientX - lastX.current;
    const dt = Math.max(1, e.timeStamp - lastT.current);
    // the wall follows the hand: content moves WITH the pointer
    off.current -= dx;
    vel.current = vel.current * 0.7 + (-dx / dt) * 0.3;
    lastX.current = e.clientX;
    lastT.current = e.timeStamp;
    paint();
  };
  const wallUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!sliding.current) return;
    sliding.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    // the throw: carry the release velocity out over ~0.9s
    glide(vel.current * 420);
  };

  const H = heading;
  const racked = items.slice(3);

  const rackBuy = (id: string, from: HTMLElement) => {
    add("keychains", id, 1);
    flyToCart(from.closest("li")?.querySelector("img"));
    setAdded(id);
    window.clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => setAdded((p) => (p === id ? null : p)), 2600);
  };

  return (
    <section className="ap-kc" data-live={live || undefined} aria-labelledby="ap-kc-title">
      {/* the room: warm pools of light and soft bokeh over a charcoal wall.
          Purely decorative, so it is drawn in CSS and announced to nobody. */}
      <div className="ap-kc__room" aria-hidden />

      <div className="ap-kc__head">
        <p className="ap-kicker">{wall.kicker}</p>
        <H className="ap-h2 ap-kc__title" id="ap-kc-title" data-tfx="rise">
          {wall.title}
        </H>
        {wall.copy.map((t) => (
          <p className="ap-lede" key={t}>
            {t}
          </p>
        ))}
        <p className="ap-kc__from">
          <strong>1,000 ֏</strong> each
        </p>
      </div>

      {/* ---- the endless wall --------------------------------------------- */}
      <div
        className="ap-kc__rail"
        onPointerDown={wallDown}
        onPointerMove={wallMove}
        onPointerUp={wallUp}
        onPointerCancel={wallUp}
      >
        <ul className="ap-kc__track" ref={track}>
          {items.map((k) => (
            <KeychainCard key={k.id} item={k} wall={wall} live={live} />
          ))}
          {/* the wrap copy — the circle's other half, pixels only */}
          {items.map((k) => (
            <KeychainCard key={`g-${k.id}`} item={k} wall={wall} live={live} ghost />
          ))}
        </ul>
        {live && (
          <>
            <button
              type="button"
              className="ap-kc__arrow ap-kc__arrow--prev"
              aria-label="Slide the keychains back — the circle turns right"
              onClick={() => glide(-step() * 2)}
            >
              ‹
            </button>
            <button
              type="button"
              className="ap-kc__arrow ap-kc__arrow--next"
              aria-label="Slide to the next keychains — they come in from the right"
              onClick={() => glide(step() * 2)}
            >
              ›
            </button>
          </>
        )}
      </div>
      {live && <p className="ap-kc__hint">{wall.grab}</p>}

      {/* ---- the rack: the line again as light cards, the plain surface --- */}
      <ul className="ap-kc__rack">
        {racked.map((k) => (
          <li key={k.id} className="ap-kc__rackcell">
            <img src={k.thumb} alt={`${k.title} — acrylic keychain by Arpine Baroyan`} width={k.w} height={k.h} loading="lazy" />
            <button type="button" className="ap-kc__rackadd" onClick={(e) => rackBuy(k.id, e.currentTarget)}>
              {wall.add}
            </button>
            <p className="ap-kc__rackname">
              {k.title} · {dram(1000)}
            </p>
            <p className="ap-kc__added" role="status">
              {added === k.id ? wall.added : ""}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
