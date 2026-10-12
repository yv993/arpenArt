"use client";

import { useRef, useState } from "react";
import PhotoLightbox from "./PhotoLightbox";
import { add, dram } from "@/lib/cart";
import { flyToCart } from "@/lib/fly";
import { scarfDesigns, type Category } from "@/lib/content";
import products from "@/lib/products.json";

/** `md`: the 1,080px-wide middle rung, on the three prints only (2026-10-05) —
 *  see the print's srcSet below */
type Shot = { id: string; src: string; thumb: string; md?: string; w: number; h: number; alpha: boolean; avg: string };
const P = products as Record<string, Shot[]>;

// ============================================================================
// SCARF DESIGNS — /shop/scarves, since the client's 2026-09-15 drop.
//
// Three fixed designs, each delivered as the flat print plus three
// photographs (on a wall, on a rail, folded or worn), with a title and a
// paragraph in her own words (content.ts `scarfDesigns`). The old view for
// this line was the generic one — a roll of fifteen photographs and a Style
// picker — and it could not say which scarf was which. Now the print is the
// hero of each block, the photographs open in the shared lightbox, and the
// buy button sits with its design, the way the sticker sheets and the
// keychains already work.
//
// The cart line's `art` is the DESIGN number (ownItemWord: "Scarf"), never
// one of the 57 illustrations; the Style choice (silk square / bandana)
// rides along as the variant, one choice for the page.
// ============================================================================

export default function ScarfDesigns({ cat, heading = "h2" }: { cat: Category; heading?: "h1" | "h2" }) {
  const roll = P[cat.media] ?? [];
  const byId = (id: string) => roll.find((s) => s.id === id);
  const [variant, setVariant] = useState<string | undefined>(cat.variants?.options[0]);
  const [added, setAdded] = useState<string | null>(null);
  const [addedStyle, setAddedStyle] = useState<string | undefined>(undefined);
  const timer = useRef(0);
  const [lb, setLb] = useState<{ d: number; i: number } | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const H = heading;
  const D = heading === "h1" ? "h2" : "h3";

  const buy = (id: string, from: HTMLElement) => {
    add(cat.slug, id, 1, variant);
    flyToCart(from.closest("li")?.querySelector("img") ?? null);
    setAddedStyle(variant);
    setAdded(id);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAdded((p) => (p === id ? null : p)), 2600);
  };

  // the confirmation names the cut that WENT IN (content.ts `added`) — the
  // one chosen at the press, not whatever the chips say a second later
  const addedLine = addedStyle
    ? scarfDesigns.added.replace("{style}", addedStyle)
    : scarfDesigns.added.replace(" — {style}", "");

  const lbDesign = lb ? scarfDesigns.designs[lb.d] : null;
  const lbShots = lbDesign ? lbDesign.shots.map(byId).filter((s): s is Shot => !!s) : [];

  return (
    <section className="ap-sd" aria-labelledby="ap-sd-title">
      {/* THE LEAD SITS BESIDE THE TITLE (client, change 3.pdf p7, 2026-10-01,
          circling the paragraph under the title: «էս էլ բերել հիմնական
          տեքստի կողքը» — bring this one, too, beside the main text). Same
          three elements in the same order — the kicker, the title, her
          paragraph — so a phone, a reader and a crawler meet them exactly as
          before; the two columns are the stylesheet's (`.ap-sd__head`). */}
      <div className="ap-sec__head ap-sd__head">
        <p className="ap-kicker">{scarfDesigns.kicker}</p>
        <H className="ap-h2 ap-sd__title" id="ap-sd-title" data-tfx="rise">
          {scarfDesigns.title}
        </H>
        <p className="ap-lede ap-sd__lead">{scarfDesigns.copy}</p>
      </div>

      {/* THE ORDER ROW: the one Style choice and the one price. The Style is
          a property of the order, not of a design, and the three blocks
          below all add with it — and so is the PRICE (change 3.pdf p7:
          «ինչ-որ մի տեղ գինն էլ ավելացնենք՝ 8000 դրամ» — let's add the price
          somewhere too, 8000 dram). It is ONE figure for every design and
          either cut, so it is said once, on the row where the buyer settles
          what they are ordering, before the first design — not three times
          beside three buttons. Read from `cat.from`, the same field the cart
          and /api/order price the line from, so the page can never show a
          number the order does not use. */}
      <div className="ap-sd__bar">
        {cat.variants && (
          <div className="ap-var ap-sd__var" role="group" aria-labelledby="ap-sd-var">
            <p className="ap-pick__lab" id="ap-sd-var">
              {cat.variants.label}
              {variant ? ` — ${variant}` : ""}
            </p>
            <div className="ap-var__row">
              {cat.variants.options.map((o) => (
                <button key={o} type="button" aria-pressed={variant === o} className={variant === o ? "on" : ""} onClick={() => setVariant(o)}>
                  {o}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="ap-cv__price ap-sd__price">
          <strong>{dram(cat.from)}</strong> {scarfDesigns.each}
        </p>
      </div>

      <ol className="ap-sd__list">
        {scarfDesigns.designs.map((d, di) => {
          const shots = d.shots.map(byId).filter((s): s is Shot => !!s);
          const [print, ...rest] = shots;
          if (!print) return null;
          return (
            <li className="ap-sd__item" key={d.id}>
              {/* THE PRINT IS THE HERO — the square as she drew it, edge to
                  edge, with the photographs as its witnesses beside it */}
              <figure className="ap-sd__art" style={{ background: print.avg }}>
                <img
                  src={print.src}
                  // THE MIDDLE RUNG (2026-10-05): from 700w the ladder went
                  // straight to the 1,600 master, which every phone took —
                  // 92vw is 359px at 390, so DPR 2 needs 718 and DPR 3
                  // 1,076; scarf-01 at 387 KB was the live LCP. The 1,080
                  // file (201 KB) is a smaller copy of the same print: made
                  // with sharp from the original the master came from, 1,080
                  // wide, webp q82 — pair()'s policy in
                  // scratchpad/redesign-assets.cjs. Only a shot with `md`
                  // offers the rung, and `md` is always 1,080 wide.
                  srcSet={`${print.thumb} 700w, ${print.md ? `${print.md} 1080w, ` : ""}${print.src} ${print.w}w`}
                  sizes="(max-width: 860px) 92vw, 48vw"
                  alt={`${d.name} — the printed square, by Arpine Baroyan`}
                  width={print.w}
                  height={print.h}
                  loading={di === 0 ? undefined : "lazy"}
                  decoding="async"
                />
              </figure>

              <div className="ap-sd__say">
                <D className="ap-sd__name">{d.name}</D>
                <p className="ap-sd__copy">{d.copy}</p>

                {rest.length > 0 && (
                  <ul className="ap-sd__shots">
                    {rest.map((s, i) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          aria-label={`${d.name} — photograph ${i + 2} of ${shots.length}`}
                          style={{ background: s.avg }}
                          onClick={(e) => {
                            opener.current = e.currentTarget;
                            setLb({ d: di, i: i + 1 });
                          }}
                        >
                          <img src={s.thumb} alt="" width={s.w} height={s.h} loading="lazy" decoding="async" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="ap-sd__act">
                  {/* WHAT THIS BUTTON ADDS, BESIDE IT (2026-10-05, mobile
                      pass). On a phone the page's one Style choice is a
                      screen or three above the second and third designs —
                      2,127px above the third's Add at 390x664 — so the cut
                      and the price are repeated here from the values the
                      bar already holds, no new words (UX laws M4). Phone
                      layout only (shop.css); it also describes the button,
                      for a reader on any screen. */}
                  <button
                    type="button"
                    className="ap-btn"
                    aria-describedby={variant ? `sd-style-${d.id}` : undefined}
                    onClick={(e) => buy(d.id, e.currentTarget)}
                  >
                    {scarfDesigns.add}
                  </button>
                  {variant && (
                    <p className="ap-sd__style" id={`sd-style-${d.id}`}>
                      {variant} · {dram(cat.from)}
                    </p>
                  )}
                  <p className="ap-sd__added" role="status">
                    {added === d.id ? addedLine : ""}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {lb && lbDesign && (
        <PhotoLightbox
          shots={lbShots.map((s) => ({ src: s.src, w: s.w, h: s.h, avg: s.avg }))}
          i={lb.i}
          onIndex={(i) => setLb({ d: lb.d, i })}
          onClose={() => setLb(null)}
          opener={opener.current}
          label={`Photographs of ${lbDesign.name}`}
          alt={(n) => `${lbDesign.name}, photograph ${n + 1} of ${lbShots.length}`}
        />
      )}
    </section>
  );
}
