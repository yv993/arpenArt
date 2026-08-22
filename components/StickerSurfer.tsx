"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { stickers3d } from "@/lib/content";
import { add, dram } from "@/lib/cart";
import { flyToCart } from "@/lib/fly";

// ============================================================================
// THE 3D STICKER LANE — 48 domed stickers flown past on a receding diagonal.
//
// Ported from a supplied framer-motion + Tailwind "CollectionSurfer". Its
// anatomy is kept verbatim where it is the look: the step vector
// (240, −84, −288), the −50° yaw on every card, perspective 2000px with the
// vanishing point up at 10% 10%, and the magnetic swell as the pointer nears
// a card. Its IMPLEMENTATION is not kept, for the usual two reasons — this
// project carries neither framer-motion nor Tailwind — so the springs are
// GSAP and the scroll is a pinned ScrollTrigger.
//
// THREE DELIBERATE DEPARTURES FROM THE SOURCE:
//
// 1. IT REALLY LOOPS (client: "scroll must not finish but start circle from
//    first after reached last"). The original fakes endlessness with a 50,000px
//    spacer and a duplicated array, so it does end — at 50,000px — and it
//    renders every item twice. Here each card is placed at an offset WRAPPED
//    into a window that travels with the scroll, so card 48 is followed by
//    card 1 because they are the same ring. Nothing is duplicated and there is
//    no end to reach.
//
// 2. A PINNED SECTION, not a fixed overlay over a giant spacer. This is one
//    section of a shop page and has a footer under it; `position: fixed` with
//    a 50,000px spacer would have eaten the whole document.
//
// 3. Clicking opens a real dialog rather than transforming the card in place.
//    The lane is a 3D scene whose cards are mid-flight and mid-scale; growing
//    one inside it fights every transform on the element and cannot be given
//    focus, Escape or a heading. The picked design comes to the middle in its
//    own layer, which is also what makes it buyable.
//
// TWO-LAYER CONTRACT as everywhere: the lane needs a pointer and motion, so it
// is desktop + hover + no-reduced-motion + scripting. Everyone else gets the
// same 48 designs as a plain grid, and can open and buy any of them.
// ============================================================================

export type Shot = {
  id: string;
  src: string;
  thumb: string;
  w: number;
  h: number;
  avg: string;
};

const GATE = "(min-width: 861px) and (hover: hover) and (prefers-reduced-motion: no-preference)";

/** the source's step vector — this IS the look, so it is copied exactly */
const STEP_X = 240;
const STEP_Y = -84;
const STEP_Z = -288;
const PERSPECTIVE = 2000;

/** how many cards' worth of scroll the pin lasts. Per-card, so adding designs
 *  buys its own scroll rather than making the lane faster (the same rule
 *  FloatShop's pin follows). */
const PIN_PER_CARD = 0.34;
/** how many complete times round the ring one pass through the pin makes */
const TURNS = 1.6;

/** Cards nearer than this stay in front of the camera; the window ahead is the
 *  rest of the ring receding. Asymmetric on purpose: at perspective 2000 an
 *  offset of −3 would put a card BEHIND the viewer and it would flip. */
const BEHIND = 2;
/** past this the card is a sub-pixel speck — stop painting it */
const VISIBLE = 14;

export default function StickerSurfer({
  shots,
  slug,
  price,
}: {
  shots: Shot[];
  slug: string;
  price: number;
}) {
  const [live, setLive] = useState(false);
  const [open, setOpen] = useState<Shot | null>(null);
  const [added, setAdded] = useState(false);

  const root = useRef<HTMLElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const cards = useRef<HTMLButtonElement[]>([]);
  /** where the ring has travelled to, in cards */
  const head = useRef(0);
  /** pointer in viewport coords; far away until it arrives */
  const ptr = useRef({ x: -99999, y: -99999 });
  /** per-card magnetic swell, eased toward its target every frame */
  const swell = useRef<number[]>([]);
  const addTimer = useRef<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const N = shots.length;

  useEffect(() => {
    if (!window.matchMedia("(scripting: enabled)").matches) return;
    if (!window.matchMedia(GATE).matches) return;
    setLive(true);
  }, []);

  /* THE LANE. A second effect keyed on `live`, never the one that sets it:
     state is async, so a pin created alongside setLive measures the PLAIN
     layer's box and locks that height into inline styles before the live CSS
     has laid out the tall one. This project has paid for that lesson once. */
  useEffect(() => {
    if (!live || !root.current || !N) return;
    gsap.registerPlugin(ScrollTrigger);
    swell.current = new Array(N).fill(0);

    const ctx = gsap.context(() => {
      const st = ScrollTrigger.create({
        trigger: root.current!,
        start: "top top",
        end: () => "+=" + window.innerHeight * PIN_PER_CARD * N,
        pin: scene.current,
        pinSpacing: true,
        scrub: true,
        onUpdate: (self) => {
          head.current = self.progress * N * TURNS;
        },
      });

      const wrap = gsap.utils.wrap(-BEHIND, N - BEHIND);
      const draw = () => {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        for (let i = 0; i < N; i++) {
          const el = cards.current[i];
          if (!el) continue;
          const o = wrap(i - head.current);
          if (o > VISIBLE) {
            if (el.style.display !== "none") el.style.display = "none";
            continue;
          }
          if (el.style.display === "none") el.style.display = "";

          const z = o * STEP_Z;
          // the magnet only bothers with cards big enough to point at
          let target = 0;
          if (o < 7) {
            const r = el.getBoundingClientRect();
            const dx = ptr.current.x - (r.left + r.width / 2);
            const dy = ptr.current.y - (r.top + r.height / 2);
            const d = Math.sqrt(dx * dx + dy * dy);
            // the source's range: touching = 1.5×, 400px away = 1×
            target = Math.max(0, 1 - d / 400) * 0.5;
          }
          const s = (swell.current[i] += (target - swell.current[i]) * 0.12);

          el.style.transform =
            `translate3d(${o * STEP_X}px, ${o * STEP_Y}px, ${z}px) rotateY(-50deg) scale(${1 + s})`;
          // nearer cards sit in front — the browser's own z sorting is not
          // reliable across a preserve-3d subtree of this depth
          el.style.zIndex = String(Math.round(1000 - o * 10));
          void cx;
          void cy;
        }
      };

      gsap.ticker.add(draw);
      draw();
      return () => {
        gsap.ticker.remove(draw);
        st.kill();
      };
    }, root);

    return () => ctx.revert();
  }, [live, N]);

  /** pointer for the magnet — stored, never rendered, so it costs no React */
  const onMove = useCallback((e: React.PointerEvent) => {
    ptr.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onLeave = useCallback(() => {
    ptr.current = { x: -99999, y: -99999 };
  }, []);

  const pick = useCallback((s: Shot, el?: HTMLElement | null) => {
    opener.current = el ?? null;
    setAdded(false);
    setOpen(s);
  }, []);

  const close = useCallback(() => {
    setOpen(null);
    // focus goes back where it came from, or the dialog's closing strands it
    opener.current?.focus?.();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  useEffect(() => () => { if (addTimer.current) window.clearTimeout(addTimer.current); }, []);

  const buy = useCallback(
    (s: Shot) => {
      // `art` is the design — the same field the postcards use, so the order
      // mail reads "(illustration 07)" and /api/order prices it from its own
      // copy of the category table exactly as it does everything else
      add(slug, s.id, 1);
      flyToCart(document.querySelector<HTMLImageElement>(".ap-s3__bigimg"));
      setAdded(true);
      if (addTimer.current) window.clearTimeout(addTimer.current);
      addTimer.current = window.setTimeout(() => setAdded(false), 2600);
    },
    [slug],
  );

  return (
    <section ref={root} className="ap-s3" data-live={live || undefined}>
      {/* ---- the lane (live layer only) ---- */}
      <div className="ap-s3__scene" ref={scene} onPointerMove={onMove} onPointerLeave={onLeave}>
        <div className="ap-s3__head">
          <p className="ap-kicker">{stickers3d.kicker}</p>
          <h2 className="ap-h2" data-tfx="rise">
            {stickers3d.title}
          </h2>
          <p className="ap-lede">{stickers3d.copy}</p>
          <p className="ap-s3__price">
            <strong>{dram(price)}</strong> each
          </p>
        </div>

        <div className="ap-s3__stage">
          <div className="ap-s3__lane">
            {shots.map((s, i) => (
              <button
                type="button"
                key={s.id}
                className="ap-s3__card"
                ref={(el) => {
                  cards.current[i] = el as HTMLButtonElement;
                }}
                onClick={(e) => pick(s, e.currentTarget)}
                aria-label={`3D sticker no. ${s.id} — open`}
              >
                <span className="ap-s3__no" aria-hidden>
                  {s.id}
                </span>
                <img src={s.thumb} alt="" width={s.w} height={s.h} loading="lazy" draggable={false} />
              </button>
            ))}
          </div>
        </div>

        <p className="ap-s3__cue" aria-hidden>
          {stickers3d.cue}
        </p>
      </div>

      {/* ---- the plain layer: all 48, openable and buyable without the lane */}
      <div className="ap-s3__plain">
        <div className="ap-sec__head">
          <p className="ap-kicker">{stickers3d.kicker}</p>
          <h2 className="ap-h2">{stickers3d.title}</h2>
          <p className="ap-lede">{stickers3d.copy}</p>
          <p className="ap-s3__price">
            <strong>{dram(price)}</strong> each
          </p>
        </div>
        <ul className="ap-s3__grid">
          {shots.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={(e) => pick(s, e.currentTarget)}
                aria-label={`3D sticker no. ${s.id} — open`}
                style={{ background: s.avg }}
              >
                <img src={s.thumb} alt="" width={s.w} height={s.h} loading="lazy" />
                <span>{s.id}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* ---- the picked design, in the middle, with a way to buy it ---- */}
      {open && (
        <div className="ap-s3__open" role="dialog" aria-modal="true" aria-label={`3D sticker no. ${open.id}`}>
          {/* the ground closes it; the panel stops the press getting there */}
          <button type="button" className="ap-s3__scrim" onClick={close} aria-label={stickers3d.open.close} />
          <div className="ap-s3__panel">
            <img className="ap-s3__bigimg" src={open.src} alt={`3D sticker no. ${open.id} by Arpine Baroyan`} />
            <div className="ap-s3__meta">
              <p className="ap-kicker">{stickers3d.open.series}</p>
              <p className="ap-s3__bigno">No. {open.id}</p>
              <p className="ap-s3__bigprice">{dram(price)}</p>
              <button type="button" className="ap-btn" onClick={() => buy(open)} autoFocus>
                {stickers3d.open.add}
              </button>
              <p className="ap-s3__added" role="status">
                {added ? stickers3d.open.added : ""}
              </p>
              <button type="button" className="ap-s3__close" onClick={close}>
                {stickers3d.open.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
