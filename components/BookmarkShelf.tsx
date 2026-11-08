"use client";

import { useEffect, useRef, useState } from "react";
import { bookmarkShelf, isSoldOut, priceTbc } from "@/lib/content";
import { add, dram } from "@/lib/cart";
import { flyToCart } from "@/lib/fly";
import FlipCard from "./FlipCard";

// ============================================================================
// THE BOOKMARKS — /shop/bookmarks (client, change 5.pdf p4, 2026-11-04).
//
// The magnets' anatomy (MagnetFridge.tsx), one layer for every screen: her
// heading and paragraph, the price, then every design in one grid with its
// own «Add to cart». Two things are this line's own:
//   · THE BACK IS ONE PICTURE for all of them (her file -01, a reading log),
//     so the page head shows it once, captioned — that is the whole answer
//     for a screen reader, a phone held still, or a browser without script;
//   · EVERY CARD TURNS OVER (FlipCard.tsx) to that back, the way her note
//     asks: a resting mouse previews it, a click, tap or key keeps it turned.
// No lightbox: the card is already the size the bookmark reads at, and a
// press on it means "turn it", not "open it".
//
// Each bookmark is a fixed design; the cart's `art` is its number (01–27,
// scripts/bookmarks.mjs prints which of her files each one is), priced from
// content.ts by the cart and again by /api/order.
// ============================================================================

export type BookmarkShot = {
  id: string;
  src: string;
  thumb: string;
  w: number;
  h: number;
  /** the -sm file's real width, for the srcset */
  thumbW?: number;
  avg: string;
};

/** the printed piece: 56 × 190 mm */
const RATIO = "56 / 190";
/** a card's width: ~150px in the desktop grid, a third of the column on a
 *  phone — the srcset picks the -sm (331w) at 1x–2x, the master at 3x */
const SIZES = "(max-width: 640px) 30vw, 160px";

export default function BookmarkShelf({
  shots,
  back,
  slug,
  price,
  heading = "h2",
}: {
  shots: BookmarkShot[];
  /** the one shared back */
  back: BookmarkShot | undefined;
  slug: string;
  /** null = Arpine confirms it (content.ts `priceTbc`) */
  price: number | null;
  heading?: "h1" | "h2";
}) {
  const [added, setAdded] = useState<string | null>(null);
  const addedTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(addedTimer.current), []);

  const H = heading;
  const srcSet = (s: BookmarkShot) => (s.thumbW ? `${s.thumb} ${s.thumbW}w, ${s.src} ${s.w}w` : undefined);
  const backFace = back
    ? { src: back.thumb, srcSet: srcSet(back), w: back.w, h: back.h, alt: bookmarkShelf.backAlt }
    : null;

  const buy = (id: string, from: HTMLElement) => {
    // add() refuses a sold-out bookmark (lib/cart.ts) — no flight, no "Added"
    if (!add(slug, id, 1)) return;
    // the flight leaves from the side of the card that is up
    const card = from.closest("li")?.querySelector<HTMLElement>(".ap-flip");
    const face = card?.querySelector<HTMLImageElement>(
      card.hasAttribute("data-back") ? ".ap-flip__face--back" : ".ap-flip__face--front",
    );
    flyToCart(face);
    setAdded(id);
    // supersede, never stack (the magnets' rule)
    window.clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => setAdded((p) => (p === id ? null : p)), 2600);
  };

  return (
    <section className="ap-bm" aria-labelledby="ap-bm-title">
      <div className="ap-bm__head">
        <div className="ap-bm__say">
          <H className="ap-h2" id="ap-bm-title" data-tfx="rise">
            {bookmarkShelf.title}
          </H>
          <p className="ap-lede">{bookmarkShelf.copy}</p>
          <p className="ap-bm__from">
            {price === null ? (
              priceTbc
            ) : (
              <>
                <strong>{dram(price)}</strong> each
              </>
            )}
          </p>
        </div>
        {back && (
          <figure className="ap-bm__back">
            <img
              src={back.thumb}
              srcSet={srcSet(back)}
              sizes="(max-width: 640px) 72px, 112px"
              alt={bookmarkShelf.backAlt}
              width={back.w}
              height={back.h}
              style={{ background: back.avg }}
            />
            <figcaption>{bookmarkShelf.back}</figcaption>
          </figure>
        )}
      </div>

      <ul className="ap-bm__all">
        {shots.map((s, i) => {
          const sold = isSoldOut(slug, s.id);
          const label = bookmarkShelf.item(s.id);
          const front = { src: s.thumb, srcSet: srcSet(s), w: s.w, h: s.h, alt: `${label} by Arpine Baroyan` };
          return (
            <li key={s.id}>
              {backFace ? (
                <FlipCard
                  front={front}
                  back={backFace}
                  ratio={RATIO}
                  sizes={SIZES}
                  avg={s.avg}
                  name={`${label}: ${bookmarkShelf.turn}`}
                  eager={i < 4}
                />
              ) : (
                <div className="ap-flip" style={{ aspectRatio: RATIO }}>
                  <img className="ap-flip__face" src={s.thumb} alt={front.alt} width={s.w} height={s.h} loading="lazy" />
                </div>
              )}
              <div className="ap-bm__buy">
                <p className="ap-bm__name">{label}</p>
                {/* the bookmark rides in the button's NAME after the visible
                    words, as on the magnets: 27 identical «Add to cart» could
                    not be told apart in a screen reader's list of buttons */}
                <button
                  type="button"
                  className="ap-btn ap-bm__add"
                  onClick={(e) => buy(s.id, e.currentTarget)}
                  disabled={sold}
                  data-sold={sold || undefined}
                >
                  {sold ? "Sold out" : bookmarkShelf.add}
                  <span className="ap-sr">: {label}</span>
                </button>
                <p className="ap-bm__added" role="status">
                  {added === s.id ? bookmarkShelf.added : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
