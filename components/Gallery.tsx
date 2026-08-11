"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import { ParticleSphere, newSpin } from "./ParticleSphere";
import products from "@/lib/products.json";
import { categories, home } from "@/lib/content";

// The sphere used to hold the 57 illustrations. It holds THE SHOP now (client
// 2026-08-06) — every photograph of every piece she actually sells.
type Shot = { id: string; src: string; thumb: string; w: number; h: number; avg: string };
type Card = Shot & { slug: string; name: string; from: number; blurb: string };
const P = products as Record<string, Shot[]>;

/** One card per product photograph, ROUND-ROBIN across the categories rather
 *  than category by category: consecutive indices land near each other often
 *  enough on a Fibonacci lattice that fifteen scarves in a row would read as a
 *  scarf patch on one side of the ball. */
const CARDS: Card[] = (() => {
  const byCat = categories
    .filter((c) => c.status === "open")
    .map((c) => ({ cat: c, shots: P[c.media] ?? [] }))
    .filter((g) => g.shots.length > 0);
  const out: Card[] = [];
  const most = Math.max(0, ...byCat.map((g) => g.shots.length));
  for (let i = 0; i < most; i++) {
    for (const g of byCat) {
      const s = g.shots[i];
      if (!s) continue;
      out.push({ ...s, slug: g.cat.slug, name: g.cat.name, from: g.cat.from, blurb: g.cat.blurb });
    }
  }
  return out;
})();

/** A full drag across the canvas turns the sphere most of the way round,
 *  measured against the element so it feels identical at any width. */
const SWEEP = Math.PI * 1.6;
/** Tipping is clamped hard in the sphere, so vertical travel is geared down. */
const PITCH_GEAR = 0.45;
/** One arrow-key press. Roughly a tenth of a turn — enough to feel like
 *  progress, small enough to aim with. */
const KEY_STEP = 0.32;

// The sphere is expensive, so it only mounts once the section is actually on
// screen, and never at all if the visitor asked for reduced motion or the
// browser has no WebGL — both fall back to a real, scrollable grid.
export default function Gallery() {
  const host = useRef<HTMLDivElement | null>(null);
  const [live, setLive] = useState(false);
  const [ok, setOk] = useState(true);
  const [dragging, setDragging] = useState(false);

  // The picture brought to the centre. State for the info panel, plus a
  // render-time ref mirror for the 60fps card loop, which cannot read state.
  const [chosen, setChosen] = useState<number | null>(null);
  const chosenRef = useRef<number | null>(null);
  chosenRef.current = chosen;

  // First click brings the picture forward; a second click on the SAME
  // picture opens it in the shop. The 450ms guard swallows a double-click
  // that lands while the card is still flying in — closing stays on
  // ✕ / Escape / clicking empty space.
  const router = useRouter();
  const lastPickAt = useRef(0);
  const onPick = useCallback(
    (i: number) => {
      if (chosenRef.current === i) {
        // straight to the piece it is a photograph OF, not a fixed slug
        if (Date.now() - lastPickAt.current > 450) router.push(`/shop/${CARDS[i].slug}`);
        return;
      }
      lastPickAt.current = Date.now();
      setChosen(i);
    },
    [router],
  );

  // Shared with the render loop by reference. A drag fires pointermove far
  // faster than React should re-render, so the numbers live here and only the
  // grab/release — twice per gesture — touches state.
  const spin = useRef(newSpin());
  const last = useRef({ x: 0, y: 0, sens: 0.004, sx: 0, sy: 0, id: -1, captured: false });

  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let webgl = false;
    try {
      const c = document.createElement("canvas");
      webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      webgl = false;
    }
    if (still || !webgl) {
      setOk(false);
      return;
    }
    const el = host.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setLive(e.isIntersecting), { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Capture is taken at an 8px SLOP, not on pointerdown: capturing up front
  // retargets the release to this wrapper, the canvas never sees pointerup,
  // and r3f can never synthesise a click — no card would ever be pickable.
  // Under the slop the events flow to the canvas and a tap picks a card;
  // past it the pointer is ours and the drag survives leaving the element.
  const onDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    last.current = {
      x: e.clientX,
      y: e.clientY,
      sens: SWEEP / Math.max(1, el.clientWidth),
      sx: e.clientX,
      sy: e.clientY,
      id: e.pointerId,
      captured: false,
    };
    spin.current.dragging = true;
    spin.current.vYaw = 0;
    spin.current.vPitch = 0;
  }, []);

  const onMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const s = spin.current;
    if (!s.dragging) return;
    const L = last.current;
    const dYaw = (e.clientX - L.x) * L.sens;
    const dPitch = (e.clientY - L.y) * L.sens * PITCH_GEAR;
    s.yaw += dYaw;
    s.pitch += dPitch;
    // smoothed so a twitchy final pixel cannot become the whole throw
    s.vYaw = s.vYaw * 0.7 + dYaw * 0.3;
    s.vPitch = s.vPitch * 0.7 + dPitch * 0.3;
    L.x = e.clientX;
    L.y = e.clientY;
    if (!L.captured && Math.hypot(e.clientX - L.sx, e.clientY - L.sy) > 8) {
      try {
        e.currentTarget.setPointerCapture(L.id);
      } catch {}
      L.captured = true;
      setDragging(true);
    }
  }, []);

  const onUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (last.current.captured && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    // the velocity built up during the move is left in place: letting go
    // throws the sphere, and the frame loop bleeds it off
    spin.current.dragging = false;
    setDragging(false);
  }, []);

  // A drag-only control is unusable without a pointer. The arrows nudge the
  // same numbers the drag writes, so the sphere behaves identically either way.
  const onKey = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      setChosen(null);
      return;
    }
    const s = spin.current;
    const nudge: Record<string, () => void> = {
      ArrowLeft: () => (s.yaw -= KEY_STEP),
      ArrowRight: () => (s.yaw += KEY_STEP),
      ArrowUp: () => (s.pitch -= KEY_STEP * PITCH_GEAR),
      ArrowDown: () => (s.pitch += KEY_STEP * PITCH_GEAR),
    };
    const go = nudge[e.key];
    if (!go) return;
    e.preventDefault(); // or the page scrolls out from under the sphere
    s.vYaw = 0;
    s.vPitch = 0;
    go();
  }, []);

  const images = CARDS.map((c) => c.thumb);
  const card = chosen !== null ? CARDS[chosen] : null;

  return (
    <div className="ap-gal" ref={host}>
      {ok ? (
        <>
          <div
            className="ap-gal__canvas"
            data-drag={dragging || undefined}
            tabIndex={0}
            role="group"
            aria-label="The shop as a turning sphere. Drag it or use the arrow keys to look around; click a piece to bring it forward, click it again to open it, Escape puts it back."
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onKeyDown={onKey}
          >
            {live && (
              <Canvas
                camera={{ position: [0, 0, 20], fov: 50 }}
                dpr={[1, 1.6]}
                gl={{ antialias: true, alpha: true }}
                onPointerMissed={() => setChosen(null)}
              >
                <Suspense fallback={null}>
                  <ParticleSphere images={images} spin={spin} chosenRef={chosenRef} onPick={onPick} />
                </Suspense>
              </Canvas>
            )}
          </div>

          {/* what the centred piece IS — its own name, its real starting
              price, and its own blurb, all read from the catalogue */}
          {card && (
            <>
              <div className="ap-gal__info" role="status">
                <p className="ap-gal__no">{card.name}</p>
                <p className="ap-gal__line">from {card.from.toLocaleString()} ֏</p>
                <p className="ap-gal__blurb">{card.blurb}</p>
                {/* THE BUY BUTTON, and it opens the piece rather than dropping
                    it in the basket. Not a hedge — a measured fact about this
                    catalogue: every open category needs a choice first. Six
                    need an illustration; postcards, scarves and hoodies need a
                    format, style or size. Adding from here would mean picking
                    the artwork FOR the customer, on a site whose whole shop is
                    built the other way ("the artwork IS the product, so
                    choosing one silently would be worse than asking"). This is
                    what a variable product does in any real shop. */}
                <Link className="ap-btn ap-gal__buy" href={`/shop/${card.slug}`}>
                  Buy it <span aria-hidden>→</span>
                </Link>
                <p className="ap-gal__note">{home.gallery.buyNote}</p>
              </div>
              <button
                type="button"
                className="ap-gal__close"
                onClick={() => setChosen(null)}
                aria-label="Put the picture back"
              >
                ✕
              </button>
            </>
          )}
          {/* the sphere is decorative; the shop stays reachable without it */}
          <noscript>
            <ul className="ap-gal__grid">
              {CARDS.map((c) => (
                <li key={c.slug + c.id}>
                  <a href={`/shop/${c.slug}`} aria-label={c.name}>
                    <img src={c.thumb} alt="" width={c.w} height={c.h} loading="lazy" />
                  </a>
                </li>
              ))}
            </ul>
          </noscript>
        </>
      ) : (
        // Phones, reduced motion and no WebGL get the same pieces as a real
        // grid — and now every tile is a LINK, because these are things for
        // sale rather than pictures to look at. The sphere's whole purpose is
        // reachable here.
        <ul className="ap-gal__grid">
          {CARDS.map((c) => (
            <li key={c.slug + c.id} style={{ background: c.avg }}>
              <Link href={`/shop/${c.slug}`} aria-label={`${c.name} — from ${c.from.toLocaleString()} ֏`}>
                <img src={c.thumb} alt="" width={c.w} height={c.h} loading="lazy" decoding="async" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
