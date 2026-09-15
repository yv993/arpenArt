"use client";

import { useRef, useState } from "react";
import PhotoLightbox from "./PhotoLightbox";
import { add } from "@/lib/cart";
import { flyToCart } from "@/lib/fly";
import { scarfDesigns, type Category } from "@/lib/content";
import products from "@/lib/products.json";

type Shot = { id: string; src: string; thumb: string; w: number; h: number; alpha: boolean; avg: string };
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
  const timer = useRef(0);
  const [lb, setLb] = useState<{ d: number; i: number } | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const H = heading;
  const D = heading === "h1" ? "h2" : "h3";

  const buy = (id: string, from: HTMLElement) => {
    add(cat.slug, id, 1, variant);
    flyToCart(from.closest("li")?.querySelector("img") ?? null);
    setAdded(id);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAdded((p) => (p === id ? null : p)), 2600);
  };

  const lbDesign = lb ? scarfDesigns.designs[lb.d] : null;
  const lbShots = lbDesign ? lbDesign.shots.map(byId).filter((s): s is Shot => !!s) : [];

  return (
    <section className="ap-sd" aria-labelledby="ap-sd-title">
      <div className="ap-sec__head">
        <p className="ap-kicker">{scarfDesigns.kicker}</p>
        <H className="ap-h2" id="ap-sd-title" data-tfx="rise">
          {scarfDesigns.title}
        </H>
        <p className="ap-lede">{scarfDesigns.copy}</p>
      </div>

      {/* one Style choice for the page — it is a property of the order, not
          of a design, and the three blocks below all add with it */}
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
                  srcSet={`${print.thumb} 700w, ${print.src} ${print.w}w`}
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
                  <button type="button" className="ap-btn" onClick={(e) => buy(d.id, e.currentTarget)}>
                    {scarfDesigns.add}
                  </button>
                  <p className="ap-sd__added" role="status">
                    {added === d.id ? scarfDesigns.added : ""}
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
