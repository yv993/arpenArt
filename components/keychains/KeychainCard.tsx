"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { add, dram } from "@/lib/cart";
import { flyToCart } from "@/lib/fly";
import { categories } from "@/lib/content";
import type { Keychain, KeychainWall } from "@/types/keychain";

// ============================================================================
// ONE KEYCHAIN, HANGING.
//
// Built with CSS 3D transforms rather than react-three-fiber, which the brief
// offered as its preferred option. R3F, drei and three are all already in this
// project — the choice was not about adding a dependency, it was about what
// twenty-four of these cost on one page. A transmission material needs an
// environment map and a render target per refractive object; the whole point
// of the acrylic here is already IN the photograph, lit in a real studio,
// including the glare on the bevel and the chrome on the ring. Re-simulating
// glass in front of a photograph of glass would be slower and look worse. What
// the browser adds is the part a photograph cannot have: it turns.
//
// THREE LAYERS, because each is driven by something different:
//   · .ap-kc__peg   — the wall hook. Static, drawn in CSS, never moves.
//   · .ap-kc__sway  — the pendulum. A CSS animation, so twenty-four of them
//                     idle on the compositor without any JS running at all.
//   · .ap-kc__spin  — the turn. The only layer JS writes to, and only while a
//                     pointer is actually down on it.
// Splitting them means the drag never fights the idle motion: they are
// different elements on different axes.
//
// THE PIVOT IS MEASURED, not guessed: the split ring in these photographs is a
// circle from y=6 to y≈195 of 820, so its inner top edge — the bit that would
// actually rest on a peg — is at 3% of the frame. That is the transform-origin
// for the swing, and where the peg is drawn. Hanging it from the top of the
// image instead makes the whole thing pivot in mid-air above the ring.
//
// ROTATION IS CLAMPED to ±62°. There is no photograph of the back of a
// keychain, so at 90° the card would either vanish edge-on or, worse, show a
// mirrored front and claim to be the back. The clamp keeps every frame honest.
//
// ACCESSIBILITY: turning it is a pointer-only enhancement and is treated as
// one — the glare and the pill are aria-hidden, and nothing you can only reach
// by dragging is needed to understand or buy the product. The photograph
// carries a real alt, and the price and the Add to cart button are ordinary
// controls that work with a keyboard, with the live layer switched off, and
// with no JS at all.
// ============================================================================

const MAX_TURN = 62; // degrees either way — see the note above
const PER_PX = 0.42; // how many degrees a pixel of drag is worth

/** ONE price for the line, and it is the catalogue's — the same field the
 *  cart and /api/order re-price from (1,500 ֏ on her 2026-09-21 list; the
 *  1,000 that used to be typed here three times over is what her list
 *  corrected). */
export const KEYCHAIN_PRICE = categories.find((c) => c.slug === "keychains")?.from ?? 0;

export default function KeychainCard({
  item,
  wall,
  live,
  ghost = false,
}: {
  item: Keychain;
  wall: KeychainWall;
  live: boolean;
  /** the wrap copy on the carousel: visually identical, invisible to AT —
   *  a screen reader must meet each keychain once, not twice */
  ghost?: boolean;
}) {
  const spin = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const turn = useRef(0); // current angle, degrees
  const from = useRef(0); // pointer x at the start of this drag
  const base = useRef(0); // angle when this drag started
  const frame = useRef(0);
  const [holding, setHolding] = useState(false);
  const [added, setAdded] = useState(false);
  const addedTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(addedTimer.current), []);

  // One write per frame, straight to style. GSAP is superb at tweening but a
  // tween per pointermove is a tween queued sixty times a second; the settle
  // below is where it earns its place.
  const paint = useCallback(() => {
    frame.current = 0;
    const el = spin.current;
    if (!el) return;
    const t = turn.current;
    el.style.transform = `rotateY(${t}deg) rotateX(${-t * 0.06}deg)`;
    // the sheen tracks the face: −1 fully left, +1 fully right
    el.style.setProperty("--kc-turn", String(t / MAX_TURN));
  }, []);

  const schedule = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(paint);
  }, [paint]);

  useEffect(() => () => { if (frame.current) cancelAnimationFrame(frame.current); }, []);

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!live) return;
    // let the buy button below keep its own presses
    if ((e.target as HTMLElement).closest("button")) return;
    gsap.killTweensOf(turn);
    e.currentTarget.setPointerCapture(e.pointerId);
    from.current = e.clientX;
    base.current = turn.current;
    setHolding(true);
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!holding) return;
    const raw = base.current + (e.clientX - from.current) * PER_PX;
    turn.current = Math.max(-MAX_TURN, Math.min(MAX_TURN, raw));
    schedule();
  };

  const release = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!holding) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setHolding(false);
    // it swings back the way a light object on a ring does — overshoots once,
    // then settles. `elastic` with a low amplitude reads as weight, not bounce.
    gsap.to(turn, {
      current: 0,
      duration: 1.15,
      ease: "elastic.out(0.72, 0.5)",
      onUpdate: paint,
    });
  };

  const buy = () => {
    add("keychains", item.id, 1);
    flyToCart(img.current);
    setAdded(true);
    window.clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => setAdded(false), 2600);
  };

  return (
    <li
      className="ap-kc__cell"
      data-ghost={ghost || undefined}
      aria-hidden={ghost || undefined}
      style={{ ["--kc-avg" as string]: item.avg }}
    >
      {/* THE PEG IS PHOTOGRAPHED NOW, not drawn (client 2026-08-31, with the
          showroom reference): a real brushed-steel wall peg cut from the
          supplied render — plate, hook arm, knurled collar, drop tongue —
          alpha'd off its wall by scratchpad's flood cut. This section keeps
          its own dark ground in both themes, so a fixed photograph is safe
          where a theme-following drawing used to be needed. */}
      <img className="ap-kc__peg" src="/products/peg.webp" alt="" width={109} height={600} loading="lazy" draggable={false} aria-hidden />

      <div
        className="ap-kc__hang"
        data-holding={holding || undefined}
        style={{ ["--kc-lean" as string]: `${item.lean}deg` }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <div className="ap-kc__sway">
          <div className="ap-kc__spin" ref={spin}>
            {/* EAGER, and offered at two sizes. These three ARE the page's
                hero — lazy-loading them deferred the largest paint on the
                route's own showcase. The card renders at ~193px, so the
                560px thumb serves 1x screens and the full file only ships
                to dense displays; the old markup sent 361×820 to everyone. */}
            <img
              ref={img}
              src={item.src}
              srcSet={`${item.thumb} 247w, ${item.src} 361w`}
              sizes="(min-width: 861px) 193px, 34vw"
              alt={`${item.title} — a clear acrylic keychain of an illustration by Arpine Baroyan`}
              width={item.w}
              height={item.h}
              decoding="async"
              fetchPriority="high"
              draggable={false}
            />
            {/* the light that runs across the acrylic as it turns */}
            <span className="ap-kc__glare" aria-hidden />
          </div>
        </div>
        {/* the per-card pill is gone — the wall carries ONE central
            "drag to rotate" pill, as the reference lays it out */}
      </div>

      {/* the buy rides WITH the card now: on a carousel the wall moves, so a
          separate button row could not stay under its keychain */}
      <div className="ap-kc__buy">
        <button type="button" className="ap-btn ap-kc__add" onClick={buy} tabIndex={ghost ? -1 : undefined}>
          {wall.add}
        </button>
        <p className="ap-kc__name">{item.title}</p>
        <p className="ap-kc__price">{dram(KEYCHAIN_PRICE)}</p>
        <p className="ap-kc__added" role="status">
          {added ? wall.added : ""}
        </p>
      </div>
    </li>
  );
}
