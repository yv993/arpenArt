"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { add, dram } from "@/lib/cart";
import { flyToCart } from "@/lib/fly";
import { toteBags } from "@/lib/content";

// ============================================================================
// TOTE GALLERY — the four designs in a row; the one you point at opens and the
// others give way. Since 2026-10-01 it is also WHERE A BAG IS BOUGHT.
//
// The anatomy is shadcnblocks' "gallery1", which the client sent (2026-08-24):
// a static row of cards, the active one expanding to about 60% while the rest
// shrink, rounded corners, a dark plate with a gradient fade at the foot
// carrying badges and a title, and a stack on small screens with the
// expand/shrink dropped.
//
// THE EXPANSION IS STILL TWO CSS RULES — the ROW being hovered shrinks every
// card, the card being hovered grows — and it still reveals the second
// photograph: collapsed, a card shows the bag held up against the mountains,
// where the printed grid can be read; opened, it cross-fades to the same bag
// carried. None of that needs JavaScript and none of it changed.
//
// WHAT CHANGED (client, change 3.pdf p4 + p5 + p6, 2026-10-01):
//
// 1. A CARD OPENS A WINDOW. «երբ որ քլիք եմ անում նկարի վրա, ոչ մի բան չի
//    բացվում, թող բացվի պատուհանիկ ու բերի իմ ուղարկած 2 նկարը ամեն տեսակի, ու
//    կարանք գին գրենք՝ 8000 դրամ» — the cards were buttons that did nothing on
//    a press. Each one now opens a small window with HER TWO photographs of
//    that bag, whole (the cards crop them), its number, the price, and Add to
//    cart. That is what made this a client component.
//
// 2. THE WINDOW IS THE ONLY PLACE TO BUY. The choose-an-illustration panel
//    that sat under this gallery is gone from the page (p5: «էս մասը մենակ
//    պետք չի, վերևում … դրանք հերիք են»), so without a buy button here the
//    line would sell nothing. The cart line is `totes` + the BAG number
//    (content.ts `ownItemWord.totes`), priced by /api/order from the
//    category's own `from` exactly as every other line is — the price shown
//    here is that same number, passed in, never typed.
//
// 3. THE HEAD IS TWO COLUMNS: her title on her two lines at the left, the
//    paragraph beside it at the right (p6), stacked again on a phone.
// ============================================================================

export type ToteShot = {
  id: string;
  src: string;
  thumb: string;
  worn: string;
  wornThumb: string;
  w: number;
  h: number;
  avg: string;
};

export default function ToteGallery({
  shots,
  slug,
  price,
  heading = "h2",
}: {
  shots: ToteShot[];
  /** the category the cart line is filed under — the server re-prices by it */
  slug: string;
  /** the category's `from`, in dram */
  price: number;
  heading?: "h1" | "h2";
}) {
  // the gallery opens /shop/totes, so there it carries the page's h1
  const H = heading;

  /** which bag's window is open — an index into `shots`, or nothing */
  const [open, setOpen] = useState<number | null>(null);
  const [added, setAdded] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const closeBtn = useRef<HTMLButtonElement | null>(null);
  const firstShot = useRef<HTMLImageElement | null>(null);
  const addTimer = useRef(0);

  const show = (i: number, from: HTMLElement) => {
    opener.current = from;
    setAdded(false);
    setOpen(i);
  };

  const close = useCallback(() => {
    setOpen(null);
    // focus goes back to the card it came from, or closing strands the
    // keyboard at the top of the document
    opener.current?.focus?.();
  }, []);

  // OPEN-ONCE work, keyed on `open` alone: focus moves in, the page behind
  // stops scrolling, Escape closes and Tab cannot leave. The same contract
  // PhotoLightbox and the Available Soon window keep — plus the Tab loop,
  // because this window holds a buy button and a keyboard that tabbed out of
  // it would be operating a page it cannot see.
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

  const buy = (s: ToteShot) => {
    // `art` carries the BAG number — see ownItemWord in content.ts. The cart
    // and the order mail both read "Tote bag no. 02" from it, and the server
    // prices the line from the category table, never from this page.
    add(slug, s.id, 1);
    // the flight throws the photograph the buyer is looking at
    flyToCart(firstShot.current);
    setAdded(true);
    // supersede, never stack: a second press starts its 2.6s over
    window.clearTimeout(addTimer.current);
    addTimer.current = window.setTimeout(() => setAdded(false), 2600);
  };

  if (!shots.length) return null;
  const bag = open !== null ? shots[open] : undefined;

  return (
    <section className="ap-tg" aria-labelledby="ap-tg-title">
      <div className="ap-tg__head">
        <p className="ap-kicker">{toteBags.kicker}</p>
        {/* ONE SPAN PER LINE, each revealed by the text-FX runner on its own
            and the second a beat behind — the same model as the shop and
            series titles. The stylesheet makes them blocks with a DIRECT-CHILD
            selector: the runner nests a span per letter inside each line. */}
        <H className="ap-h2 ap-tg__title" id="ap-tg-title">
          {toteBags.title.map((line, i) => (
            <Fragment key={line}>
              {/* A REAL SPACE BETWEEN THE LINES. Two block spans draw as two
                  lines with or without it, but the heading's TEXT did not:
                  it read "ARMENIA,WHEREVER" to anything that takes the string
                  rather than the layout — this section's own accessible name
                  (aria-labelledby), a crawler, a copy-paste. Between blocks
                  the space collapses to nothing on screen. */}
              {i > 0 && " "}
              <span data-tfx="rise" data-tfx-delay={i ? "0.16" : undefined}>
                {line}
              </span>
            </Fragment>
          ))}
        </H>
        <div className="ap-tg__copy">
          {toteBags.copy.map((t) => (
            <p className="ap-lede" key={t}>
              {t}
            </p>
          ))}
          {/* THE PRICE, ON THE PAGE ITSELF (change 3.pdf p4: «կարանք գին
              գրենք՝ 8000 դրամ»). With the buy panel gone this line and the
              window are the only places the figure can be read before the
              cart, so it is said here once for all four bags — they cost the
              same — rather than only behind a click. */}
          <p className="ap-tg__price">
            <strong>{dram(price)}</strong> {toteBags.open.each}
          </p>
        </div>
      </div>

      <ul className="ap-tg__row">
        {shots.map((s, i) => (
          <li className="ap-tg__card" key={s.id} style={{ background: s.avg }}>
            {/* A card is a real control: the keyboard reaches it, focus opens
                it exactly as hover does, and a press opens that bag's window.
                aria-haspopup says so before the press. */}
            <button
              type="button"
              aria-haspopup="dialog"
              aria-label={`Tote bag no. ${s.id}, ${dram(price)} — open`}
              onClick={(e) => show(i, e.currentTarget)}
            >
              <span className="ap-tg__shots">
                <img
                  className="ap-tg__hold"
                  src={s.thumb}
                  srcSet={`${s.thumb} 700w, ${s.src} 1400w`}
                  sizes="(max-width: 860px) 100vw, 60vw"
                  alt={`Tote bag no. ${s.id}, printed with Arpine Baroyan's Armenia stamp grid`}
                  width={s.w}
                  height={s.h}
                  loading={i < 2 ? undefined : "lazy"}
                  decoding="async"
                />
                {/* the reveal. alt="" on purpose: it is the SAME bag, and a
                    screen reader gains nothing from hearing it described twice */}
                <img
                  className="ap-tg__worn"
                  src={s.wornThumb}
                  srcSet={`${s.wornThumb} 700w, ${s.worn} 1400w`}
                  sizes="(max-width: 860px) 100vw, 60vw"
                  alt=""
                  width={s.w}
                  height={s.h}
                  loading="lazy"
                  decoding="async"
                  aria-hidden="true"
                />
              </span>

              <span className="ap-tg__say">
                <span className="ap-tg__badges">
                  {toteBags.badges.map((b) => (
                    <span key={b}>{b}</span>
                  ))}
                </span>
                <strong>No. {s.id}</strong>
                <em>{toteBags.series}</em>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* aria-hidden: each card's own name already says it opens */}
      <p className="ap-tg__cue" aria-hidden>
        <span className="ap-tg__cue-hover">{toteBags.cue}</span>
        <span className="ap-tg__cue-touch">{toteBags.cueTouch}</span>
      </p>

      {/* ---- the bag's window ------------------------------------------- */}
      {bag && (
        // the veil closes it; the box stops the press getting there
        <div className="ap-tgq" role="dialog" aria-modal="true" aria-labelledby="ap-tgq-title" onClick={close}>
          <div className="ap-tgq__box" ref={box} onClick={(e) => e.stopPropagation()}>
            <div className="ap-tgq__top">
              <div>
                <p className="ap-kicker">{toteBags.series}</p>
                {/* The cards say "No. 01" and so does this — no invented
                    name. The noun rides along for a screen reader only: the
                    dialog is NAMED by this heading, and "No. 01" alone does
                    not say what it is a number of. */}
                <h2 className="ap-tgq__title" id="ap-tgq-title">
                  <span className="ap-sr">Tote bag </span>No. {bag.id}
                </h2>
              </div>
              <button ref={closeBtn} type="button" className="ap-tgq__x" onClick={close} aria-label={toteBags.open.close}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 18L18 6M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* HER TWO PHOTOGRAPHS, WHOLE. The cards crop both to a tall
                column; here each keeps its own 3:2, side by side where there
                is room and stacked on a phone. width/height reserve the box,
                and the picture's average colour holds it while the file
                arrives, so nothing in the window moves when they land. */}
            <ul className="ap-tgq__shots">
              <li style={{ background: bag.avg }}>
                <img
                  ref={firstShot}
                  src={bag.thumb}
                  srcSet={`${bag.thumb} 700w, ${bag.src} 1400w`}
                  sizes="(max-width: 760px) 92vw, 46vw"
                  alt={`Tote bag no. ${bag.id} held up, printed with Arpine Baroyan's Armenia stamp grid`}
                  width={bag.w}
                  height={bag.h}
                  loading="lazy"
                  decoding="async"
                />
              </li>
              <li style={{ background: bag.avg }}>
                <img
                  src={bag.wornThumb}
                  srcSet={`${bag.wornThumb} 700w, ${bag.worn} 1400w`}
                  sizes="(max-width: 760px) 92vw, 46vw"
                  alt={`Tote bag no. ${bag.id} carried over the shoulder`}
                  width={bag.w}
                  height={bag.h}
                  loading="lazy"
                  decoding="async"
                />
              </li>
            </ul>

            <div className="ap-tgq__buy">
              <div className="ap-tgq__facts">
                <p className="ap-tgq__price">{dram(price)}</p>
                {/* the two facts the cards' badges already carry, lifted from
                    the category's spec rows — nothing new is claimed here */}
                <p className="ap-tgq__spec">{toteBags.badges.join(" · ")}</p>
              </div>
              <div className="ap-tgq__act">
                {/* reserves its line whether or not it has spoken, so the
                    button beside it never jumps */}
                <p className="ap-tgq__added" role="status">
                  {added ? toteBags.open.added : ""}
                </p>
                <button type="button" className="ap-btn" onClick={() => buy(bag)}>
                  {toteBags.open.add}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
