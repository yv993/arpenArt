"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import Keychain3D, { type Swing } from "./Keychain3D";
import { add, dram } from "@/lib/cart";
import { flyToCart } from "@/lib/fly";
import type { Keychain, KeychainWall } from "@/types/keychain";

// ============================================================================
// THE 3D STAGE — the host for one modelled keychain.
//
// Same three gates the rest of this site's WebGL wears (Gallery.tsx set the
// pattern): desktop + fine pointer + motion allowed, WebGL actually present,
// and the section in view. A transmission material re-renders the scene into
// its own buffer every frame, so this Canvas must never exist on a page
// nobody is looking at, and must never be the only way to see the product.
//
// WITHOUT ALL THREE the fallback is not a spinner or an empty box — it is the
// photograph of the real keychain, which is what the wall below shows anyway.
// The buy button, the name and the price sit OUTSIDE the Canvas in ordinary
// DOM, so they work identically in both states, with a keyboard, and with no
// JS at all.
//
// The pendulum is pushed by pointer velocity through a ref (`swing`), never
// through React state: a spring that re-renders at 60fps is not a spring.
// ============================================================================

const GATE = "(min-width: 861px) and (hover: hover) and (prefers-reduced-motion: no-preference)";

export default function KeychainStage({
  item,
  wall,
  onPrev,
  onNext,
}: {
  item: Keychain;
  wall: KeychainWall;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [live, setLive] = useState(false);
  const [inView, setInView] = useState(false);
  const [added, setAdded] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const shot = useRef<HTMLImageElement>(null);
  const addedTimer = useRef(0);
  const swing = useRef<Swing>({ a: 0, va: 0, b: 0, vb: 0, push: 0 });
  const dragging = useRef(false);
  const lastX = useRef(0);
  const lastT = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia(GATE).matches) return;
    let webgl = false;
    try {
      const c = document.createElement("canvas");
      webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      webgl = false;
    }
    if (webgl) setLive(true);
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!live || !el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [live]);

  useEffect(() => () => window.clearTimeout(addedTimer.current), []);

  const buy = useCallback(() => {
    add("keychains", item.id, 1);
    flyToCart(shot.current);
    setAdded(true);
    window.clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => setAdded(false), 2600);
  }, [item.id]);

  // ---- the push: pointer velocity becomes angular velocity ----------------
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!live) return;
    if ((e.target as HTMLElement).closest("button")) return;
    dragging.current = true;
    lastX.current = e.clientX;
    lastT.current = e.timeStamp;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastX.current;
    const dt = Math.max(1, e.timeStamp - lastT.current);
    // a shove, scaled to the frame: the pendulum takes it as torque and its
    // own gravity decides what happens next
    swing.current.push += (dx / dt) * 1.1;
    lastX.current = e.clientX;
    lastT.current = e.timeStamp;
  };
  const up = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="ap-kc__stage" ref={box}>
      <button type="button" className="ap-kc__arrow ap-kc__arrow--prev" onClick={onPrev} aria-label="The keychain before this one">
        ‹
      </button>

      <div
        className="ap-kc__glass"
        data-live={live || undefined}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        {live && inView ? (
          <Canvas
            /* 5.4 units of mechanism at fov 34 needs (5.4/2)/tan(17°) ≈ 8.8
               to fit; 9.9 leaves it a margin to swing into */
            camera={{ position: [0, 0, 9.9], fov: 34 }}
            dpr={[1, 1.6]}
            gl={{ antialias: true, alpha: true }}
            style={{ touchAction: "pan-y" }}
          >
            <ambientLight intensity={0.5} />
            <directionalLight position={[3, 5, 4]} intensity={1.4} />
            <Suspense fallback={null}>
              <Keychain3D src={`/products/keychain-${item.id}-art.webp`} swing={swing} />
            </Suspense>
          </Canvas>
        ) : null}

        {/* the photograph: the fallback when the Canvas cannot run, and the
            flight source for the cart either way. Hidden from sight (never
            from the DOM) once the model is up. */}
        <img
          ref={shot}
          className="ap-kc__stageshot"
          src={item.src}
          alt={`${item.title} — a clear acrylic keychain of an illustration by Arpine Baroyan`}
          width={item.w}
          height={item.h}
          data-hidden={(live && inView) || undefined}
        />
        {live && <p className="ap-kc__hint ap-kc__hint--stage">{wall.grab}</p>}
      </div>

      <button type="button" className="ap-kc__arrow ap-kc__arrow--next" onClick={onNext} aria-label="The next keychain">
        ›
      </button>

      <div className="ap-kc__stagebuy">
        <button type="button" className="ap-btn ap-kc__add" onClick={buy}>
          {wall.add}
        </button>
        <p className="ap-kc__name">{item.title}</p>
        <p className="ap-kc__price">{dram(1000)}</p>
        <p className="ap-kc__added" role="status">
          {added ? wall.added : ""}
        </p>
      </div>
    </div>
  );
}
