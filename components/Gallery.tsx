"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { newSpin } from "./sphereSpin";
import MapBoundary from "./MapBoundary";
import { SoonLink, openSoon } from "./Soon";
import globeShots from "@/lib/globe.json";
import { categories, globe, home, priceList, soon } from "@/lib/content";
import { dram } from "@/lib/cart";
import { FX_MEDIA } from "@/lib/textfx";

/** THREE.JS OFF THE CRITICAL PATH (2026-10-05 package, done 2026-10-07):
 *  the Canvas and the sphere are their own chunk, requested only when the
 *  canvas mounts (`live`, below). Measured before, at 390x844 and scrollY 0:
 *  window.__THREE__ "171" and WebGLRenderer in the home route's page.js —
 *  three evaluated on every phone that opened the home, two screens above
 *  the gallery. `ssr: false` because a WebGL canvas has nothing to render on
 *  the server; it never did (it mounted from an effect). */
const GlobeCanvas = dynamic(() => import("./GlobeCanvas"), { ssr: false });
/** the same chunk, for the idle-time warm-up on the desktop moved layer */
const warmGlobe = () => import("./GlobeCanvas");

// The sphere used to hold the 57 illustrations, then every photograph of
// every piece for sale (client 2026-08-06) — sixty cards, and she found it
// crowded. It holds HER OWN SET now (client, change.pdf p3, 2026-09-21: «the
// pictures are far too many — put only the pictures of this folder, remove
// the rest»): sixteen cut-outs, one line each, in the order of her folder.
// `globe` in content.ts says which line each one shows; lib/globe.json holds
// the files and their measured sizes.
type Shot = { id: string; src: string; w: number; h: number; avg: string };
type Card = Shot & {
  name: string;
  blurb: string;
  /** the page to buy it on — absent for a line that is not open yet */
  href?: string;
  /** the Available Soon window's kicker — present exactly when `href` is not */
  soonName?: string;
  /** her price for a line the shop does not carry yet (priceList) */
  price?: number;
  /** the line has options to set on its page (its `variants`: the postcard
   *  format, the scarf cut) rather than fixed pieces to pick from */
  choose?: boolean;
};
const G = globeShots as Shot[];

const CARDS: Card[] = globe.flatMap((g) => {
  const shot = G.find((s) => s.id === g.id);
  if (!shot) return [];
  if (g.slug) {
    const cat = categories.find((c) => c.slug === g.slug);
    if (!cat) return [];
    return [
      cat.status === "open"
        ? { ...shot, name: cat.name, blurb: cat.blurb, href: `/shop/${cat.slug}`, choose: !!cat.variants }
        : { ...shot, name: cat.name, blurb: cat.blurb, soonName: cat.name },
    ];
  }
  const line = g.list ? priceList[g.list] : undefined;
  if (!line) return [];
  return [{ ...shot, name: line.name, blurb: home.gallery.soonNote, soonName: line.name, price: line.from }];
});
/** built once: the canvas chunk receives the same array on every render */
const IMAGES = CARDS.map((c) => c.src);

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
        // straight to the piece it is a photograph OF — or, for a line that
        // is not open yet, the small Available Soon window
        if (Date.now() - lastPickAt.current > 450) {
          const c = CARDS[i];
          if (c.href) router.push(c.href);
          else openSoon(c.soonName);
        }
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

  // THE DESKTOP KEEPS ITS TIMING. On the moved layer the sphere's chunk is
  // fetched in idle time right after hydration — long before a 1440 reader
  // has scrolled the ~2,800px to the gallery — so the canvas mounts as soon
  // as `live` turns true, as it did when three shipped in the page chunk.
  // Phones (and reduced motion) never warm it: they load it when the
  // gallery comes near, or never.
  useEffect(() => {
    if (!window.matchMedia(FX_MEDIA).matches) return;
    const warm = () => {
      warmGlobe().catch(() => {});
    };
    // Safari has no requestIdleCallback; the type says it always exists
    const idle = window.requestIdleCallback as typeof window.requestIdleCallback | undefined;
    if (idle) {
      const id = window.requestIdleCallback(warm, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(warm, 1200);
    return () => window.clearTimeout(t);
  }, []);

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

  // PUTTING THE PICTURE BACK RETURNS FOCUS TO THE SPHERE (2026-10-05
  // package). The ✕ is removed with the panel it belongs to, so pressing it
  // dropped focus on <body> (measured at 390x844: document.activeElement was
  // BODY after the ✕), and a keyboard or switch user restarted from the top
  // of the page. Escape now works from anywhere inside the gallery — the
  // canvas, the ✕ or the buy link — where before it was heard only on the
  // canvas. preventScroll: on a phone the canvas is mostly on screen when
  // the panel is open, and the page must not jump under the finger.
  const canvasEl = useRef<HTMLDivElement | null>(null);
  const putBack = useCallback(() => {
    setChosen(null);
    canvasEl.current?.focus({ preventScroll: true });
  }, []);
  const onEscape = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "Escape" || chosenRef.current === null) return;
      e.preventDefault();
      putBack();
    },
    [putBack],
  );

  // A drag-only control is unusable without a pointer. The arrows nudge the
  // same numbers the drag writes, so the sphere behaves identically either way.
  // (Escape is the wrapper's now — see onEscape above.)
  const onKey = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
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

  const card = chosen !== null ? CARDS[chosen] : null;
  const onPointerMissed = useCallback(() => setChosen(null), []);

  return (
    <div className="ap-gal" ref={host} onKeyDown={onEscape}>
      {ok ? (
        <>
          <div
            className="ap-gal__canvas"
            ref={canvasEl}
            data-drag={dragging || undefined}
            tabIndex={0}
            role="group"
            // MICROCOPY (2026-10-05 package): «click» → «press». A phone
            // reader taps and a keyboard reader presses; "click" named the
            // one input this control is least often operated with.
            aria-label="The shop as a turning sphere. Drag it or use the arrow keys to look around; press a piece to bring it forward, press it again to open it, Escape puts it back."
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onKeyDown={onKey}
          >
            {/* A LAZY CHUNK CAN FAIL TO ARRIVE (2026-10-12): a page left open
                across a deploy asks for a filename that no longer exists, and
                next/dynamic throws that past itself to app/error.tsx — the
                whole home replaced by "SOMETHING BROKE" for a sphere. The
                boundary the map already has (MapBoundary.tsx) lets the
                optional thing fail alone: `ok` false is the link grid that
                reduced motion and no-WebGL already get. */}
            {live && (
              <MapBoundary onError={() => setOk(false)}>
                <GlobeCanvas
                  images={IMAGES}
                  spin={spin}
                  chosenRef={chosenRef}
                  onPick={onPick}
                  onPointerMissed={onPointerMissed}
                />
              </MapBoundary>
            )}
          </div>

          {/* what the centred piece IS — its own name, its real starting
              price, and its own blurb, all read from the catalogue */}
          {card && (
            <>
              <div className="ap-gal__info" role="status">
                <p className="ap-gal__no">{card.name}</p>
                {/* no "from" price for a line the shop sells (client,
                    change.pdf p5/p8, 2026-09-15: prices leave the catalogue);
                    a line that exists only on her price list so far shows
                    that price — it is the one place the number can live */}
                {card.price !== undefined && <p className="ap-gal__price">{dram(card.price)}</p>}
                <p className="ap-gal__blurb">{card.blurb}</p>
                {card.href ? (
                  <>
                    {/* THE BUY BUTTON, and it opens the piece rather than
                        dropping it in the basket. Not a hedge — a measured
                        fact about this catalogue: every open category needs a
                        choice first. Six need an illustration; postcards,
                        scarves and hoodies need a format, style or size.
                        Adding from here would mean picking the artwork FOR
                        the customer, on a site whose whole shop is built the
                        other way. This is what a variable product does in any
                        real shop. */}
                    <Link className="ap-btn ap-gal__buy" href={card.href}>
                      Buy it <span aria-hidden>→</span>
                    </Link>
                    {/* LINE-AWARE (2026-10-05 package): "choose the
                        illustration and the options" was said under every
                        open line, and only the lines with options to set
                        (postcards, scarves) have any; a magnet, a keychain
                        or a sticker sheet is a fixed piece you pick. */}
                    <p className="ap-gal__note">{card.choose ? home.gallery.buyNote.choose : home.gallery.buyNote.pick}</p>
                  </>
                ) : (
                  <SoonLink className="ap-btn ap-gal__buy" name={card.soonName ?? card.name}>
                    {soon.tile} <span aria-hidden>→</span>
                  </SoonLink>
                )}
              </div>
              <button
                type="button"
                className="ap-gal__close"
                onClick={putBack}
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
                <li key={c.id}>
                  <a href={c.href ?? "/shop"} aria-label={c.name}>
                    <img src={c.src} alt="" width={c.w} height={c.h} loading="lazy" />
                  </a>
                </li>
              ))}
            </ul>
          </noscript>
        </>
      ) : (
        // Phones, reduced motion and no WebGL get the same pieces as a real
        // grid — and every tile is a LINK, because these are things for sale
        // rather than pictures to look at; a line that is not open yet opens
        // the Available Soon window here too. The sphere's whole purpose is
        // reachable here.
        <ul className="ap-gal__grid">
          {CARDS.map((c) => (
            <li key={c.id} style={{ background: c.avg }}>
              {c.href ? (
                <Link href={c.href} aria-label={c.name}>
                  <img src={c.src} alt="" width={c.w} height={c.h} loading="lazy" decoding="async" />
                </Link>
              ) : (
                <SoonLink name={c.soonName ?? c.name} aria-label={`${c.name} — ${soon.tile}`}>
                  <img src={c.src} alt="" width={c.w} height={c.h} loading="lazy" decoding="async" />
                </SoonLink>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
