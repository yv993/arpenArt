"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { add, dram, priceText } from "@/lib/cart";
import { flyToCart } from "@/lib/fly";
import { isSoldOut, posterGallery, priceTbc, priceTbcMid } from "@/lib/content";

// ============================================================================
// THE POSTERS — /shop/posters (client, change 5.pdf p5, 2026-11-04).
//
// The totes' anatomy (ToteGallery.tsx), as a sibling rather than a
// generalisation of it — that page was tuned over three client rounds and is
// left untouched. Same shape: four fixed pieces, two pictures each, her title
// and paragraph side by side, every piece opening a WINDOW that is where it
// is bought. The window is the totes' own (focus moves in and comes back,
// Escape and the veil close it, Tab cannot leave, the page behind stops
// scrolling, the buy row sticks to its foot) and wears the totes' classes,
// so the two windows cannot drift apart.
//
// WHAT IS THIS LINE'S OWN:
//   · A POSTER IS A PICTURE, so the page never crops one. The totes' cards
//     open on hover and cut every other card to a sliver; here the four stand
//     whole at their own 596:842, side by side.
//   · HER TWO KINDS OF FILE do two jobs. The flats are only 596 × 842, so
//     they are the cards and the poster in the window; her wall photographs
//     (5249 × 3500) are the window's large picture — the poster on a wall,
//     which is what her title promises. Paired BY PICTURE (her mockup numbers
//     are not the flats'): scripts/posters.mjs checks every pair.
//   · NO PRICE YET (content.ts `categories`, posters `from: null`): the head
//     and the window say «Price confirmed by Arpine», the cart says the same
//     and leaves the line out of every total, and Add to cart stays — every
//     order on this site is a request she confirms. No size, paper or frame
//     is named: she has not given them.
// ============================================================================

export type PosterShot = {
  id: string;
  src: string;
  thumb: string;
  w: number;
  h: number;
  /** the -sm file's real width, for the srcset */
  thumbW?: number;
  avg: string;
  /** her wall photograph of this poster, in three widths */
  wall: { src: string; md: string; sm: string; w: number; h: number; mdW: number; smW: number; avg: string };
};

/** a card: a fifth of the screen in the row of four (posters.css: the
 *  column is ~91% of it, less three gaps), at most ~330px where a short
 *  screen caps the column; two across a phone. The -sm file is 400px, so a
 *  1x desktop takes it and a 2x one the 596px flat. */
const CARD_SIZES = "(max-width: 700px) 46vw, (max-width: 1560px) 21vw, 330px";
/** the window's wall: ~800px at most beside the flat (posters.css), the box's
 *  width on a phone */
const WALL_SIZES = "(max-width: 760px) 92vw, 800px";
const FLAT_SIZES = "(max-width: 760px) 300px, 380px";

const flatSet = (s: PosterShot) => (s.thumbW ? `${s.thumb} ${s.thumbW}w, ${s.src} ${s.w}w` : undefined);
const wallSet = (s: PosterShot) => `${s.wall.sm} ${s.wall.smW}w, ${s.wall.md} ${s.wall.mdW}w, ${s.wall.src} ${s.wall.w}w`;

export default function PosterGallery({
  shots,
  slug,
  name,
  price,
  heading = "h2",
}: {
  shots: PosterShot[];
  /** the category the cart line is filed under — the server re-prices by it */
  slug: string;
  /** the line's name, the window's kicker */
  name: string;
  /** the category's `from`, in dram — null = Arpine confirms it (content.ts
   *  `priceTbc`) */
  price: number | null;
  heading?: "h1" | "h2";
}) {
  const H = heading;

  /** which poster's window is open — an index into `shots`, or nothing */
  const [open, setOpen] = useState<number | null>(null);
  const [added, setAdded] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const closeBtn = useRef<HTMLButtonElement | null>(null);
  const flatImg = useRef<HTMLImageElement | null>(null);
  const addTimer = useRef(0);
  /** whether the press in flight BEGAN on the veil — see the veil's onClick */
  const veilPress = useRef(false);
  /** the walls already asked for (see `warm`) */
  const warmed = useRef(new Set<string>());

  const show = (i: number, from: HTMLElement) => {
    opener.current = from;
    setAdded(false);
    setOpen(i);
  };

  const close = useCallback(() => {
    setOpen(null);
    // focus goes back to the poster it came from, or closing strands the
    // keyboard at the top of the document
    opener.current?.focus?.();
  }, []);

  // THE WALL IS ASKED FOR ON INTENT. A pointer coming to rest on a poster,
  // or the keyboard reaching it, starts its wall photograph — the same file
  // the window will pick, chosen by the same srcset and sizes — so a press
  // opens a window whose large picture is usually already here. Nothing is
  // fetched for a poster nobody comes near.
  const warm = (s: PosterShot) => {
    if (warmed.current.has(s.id)) return;
    warmed.current.add(s.id);
    const img = new Image();
    img.decoding = "async";
    img.sizes = WALL_SIZES;
    img.srcset = wallSet(s);
    img.src = s.wall.md;
  };

  // OPEN-ONCE work, keyed on `open` alone — ToteGallery's, word for word:
  // focus moves in, the page behind stops scrolling, Escape closes and Tab
  // cannot leave.
  useEffect(() => {
    if (open === null) return;
    closeBtn.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab" || !box.current) return;
      const stops = Array.from(
        box.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'),
      );
      if (!stops.length) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const at = document.activeElement;
      const outside = !box.current.contains(at);
      if (e.shiftKey ? at === first || outside : at === last || outside) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  useEffect(() => () => window.clearTimeout(addTimer.current), []);

  const buy = (s: PosterShot) => {
    // `art` carries the POSTER number — see ownItemWord in content.ts. The
    // cart and the order mail both read "Poster no. 02" from it; the server
    // prices the line from the category table (null today: «price confirmed
    // by Arpine», out of the total), never from this page.
    // add() refuses a sold-out poster (lib/cart.ts) — no flight, no "Added"
    if (!add(slug, s.id, 1)) return;
    // the flight throws the poster itself, not the wall around it
    flyToCart(flatImg.current);
    setAdded(true);
    // supersede, never stack: a second press starts its 2.6s over
    window.clearTimeout(addTimer.current);
    addTimer.current = window.setTimeout(() => setAdded(false), 2600);
  };

  if (!shots.length) return null;
  const poster = open !== null ? shots[open] : undefined;
  const label = poster ? posterGallery.item(poster.id) : "";
  /** SOLD OUT (content.ts `soldOut`): the window still opens, with her
   *  pictures, and its button reads «Sold out», disabled */
  const sold = !!poster && isSoldOut(slug, poster.id);

  return (
    <section className="ap-pg" aria-labelledby="ap-pg-title">
      <div className="ap-pg__head">
        {/* ONE SPAN PER LINE, each revealed by the text-FX runner on its own
            and the second a beat behind — the totes' title. A REAL SPACE
            between them, so the heading's text is her line, not
            "BRINGSWALLS" (ToteGallery.tsx says why). */}
        <H className="ap-h2 ap-pg__title" id="ap-pg-title">
          {posterGallery.title.map((line, i) => (
            <Fragment key={line}>
              {i > 0 && " "}
              <span data-tfx="rise" data-tfx-delay={i ? "0.16" : undefined}>
                {line}
              </span>
            </Fragment>
          ))}
        </H>
        <div className="ap-pg__copy">
          <p className="ap-lede">{posterGallery.copy}</p>
          {/* said once for all four, as on the totes — and today that is
              her not-yet-named price, in the words the cart uses */}
          <p className="ap-pg__price">
            {price === null ? (
              priceTbc
            ) : (
              <>
                <strong>{dram(price)}</strong> {posterGallery.open.each}
              </>
            )}
          </p>
        </div>
      </div>

      {/* aria-hidden: each poster's own name already says it opens */}
      <p className="ap-pg__cue" aria-hidden>
        <span className="ap-pg__cue-hover">{posterGallery.cue}</span>
        <span className="ap-pg__cue-touch">{posterGallery.cueTouch}</span>
      </p>

      <ul className="ap-pg__row">
        {shots.map((s, i) => {
          const item = posterGallery.item(s.id);
          return (
            <li className="ap-pg__card" key={s.id}>
              {/* A poster is a real control: the keyboard reaches it and a
                  press opens its window; aria-haspopup says so first. The
                  name starts with the words under the picture. */}
              <button
                type="button"
                className="ap-pg__open"
                aria-haspopup="dialog"
                aria-label={`${item}, ${price === null ? priceTbcMid : dram(price)} — open`}
                onClick={(e) => show(i, e.currentTarget)}
                onPointerEnter={() => warm(s)}
                onFocus={() => warm(s)}
              >
                <span className="ap-pg__art" style={{ background: s.avg }}>
                  <img
                    src={s.thumb}
                    srcSet={flatSet(s)}
                    sizes={CARD_SIZES}
                    alt={`${item} by Arpine Baroyan`}
                    width={s.w}
                    height={s.h}
                    decoding="async"
                  />
                </span>
                <span className="ap-pg__name">{item}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* ---- the poster's window ---------------------------------------- */}
      {poster && (
        // THE VEIL CLOSES IT — on a press that both began AND ended on the
        // veil (ToteGallery.tsx: a drag that started inside the box and was
        // let go on the veil must not take the window away)
        <div
          className="ap-tgq ap-pgq"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ap-pgq-title"
          onPointerDown={(e) => {
            veilPress.current = e.target === e.currentTarget;
          }}
          onClick={(e) => {
            if (veilPress.current && e.target === e.currentTarget) close();
            veilPress.current = false;
          }}
        >
          <div className="ap-tgq__box ap-pgq__box" ref={box}>
            <div className="ap-tgq__top">
              <div>
                <p className="ap-kicker">{name}</p>
                {/* "No. 01", as on the totes' window; the noun rides along
                    for a screen reader, which names the dialog by this */}
                <h2 className="ap-tgq__title" id="ap-pgq-title">
                  <span className="ap-sr">Poster </span>No. {poster.id}
                </h2>
              </div>
              <button ref={closeBtn} type="button" className="ap-tgq__x" onClick={close} aria-label={posterGallery.open.close}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 18L18 6M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* HER WALL, LARGE, AND THE POSTER ITSELF BESIDE IT, both whole.
                width/height reserve each box and the picture's average
                colour holds it while the file arrives, so nothing in the
                window moves when they land. */}
            <ul className="ap-pgq__shots">
              <li className="ap-pgq__wall" style={{ background: poster.wall.avg }}>
                <img
                  src={poster.wall.md}
                  srcSet={wallSet(poster)}
                  sizes={WALL_SIZES}
                  alt={`${label} by Arpine Baroyan, ${posterGallery.onWall}`}
                  width={poster.wall.w}
                  height={poster.wall.h}
                  decoding="async"
                />
              </li>
              <li className="ap-pgq__flat" style={{ background: poster.avg }}>
                <img
                  ref={flatImg}
                  src={poster.thumb}
                  srcSet={flatSet(poster)}
                  sizes={FLAT_SIZES}
                  alt={`${label} by Arpine Baroyan`}
                  width={poster.w}
                  height={poster.h}
                  decoding="async"
                />
              </li>
            </ul>

            <div className="ap-tgq__buy">
              <div className="ap-tgq__facts">
                <p className="ap-tgq__price">{priceText(price)}</p>
              </div>
              <div className="ap-tgq__act">
                {/* reserves its line whether or not it has spoken, so the
                    button beside it never jumps */}
                <p className="ap-tgq__added" role="status">
                  {added ? posterGallery.open.added : ""}
                </p>
                <button type="button" className="ap-btn" onClick={() => buy(poster)} disabled={sold} data-sold={sold || undefined}>
                  {sold ? "Sold out" : posterGallery.open.add}
                  <span className="ap-sr">: {label}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
