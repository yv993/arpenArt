"use client";

import { useEffect, useRef, useState } from "react";
import { magnetFridge } from "@/lib/content";
import { add, dram } from "@/lib/cart";
import { flyToCart } from "@/lib/fly";
import PhotoLightbox from "./PhotoLightbox";

// ============================================================================
// THE MAGNETS — her thirty-five, in one arranged grid, every one opening big
// in the shared lightbox (PhotoLightbox, the window the shop strip and the
// sticker sheets already use) and buyable from the grid and from the window.
//
// THE FRIDGE IS GONE (client, change 4.pdf p8–p9, 2026-10-12: «էս սառնարանով
// նկարի հատվածն էլ հանենք, թող մնա մենակ տակի շարվածների հատվածը» — take the
// fridge-picture part out too, let only the arranged part below stay). Until
// then the live layer opened on the client's own refrigerator render with a
// 7×5 door plan laid over its steel, a GSAP tilt under the pointer, a peel on
// click and a flight of the magnet's pixels into the lightbox. All of it
// existed to stage that door, so all of it left with it: the render and its
// three sibling files in public/products (fridge*.webp — referenced by nothing
// else, grep 2026-10-12), the door plan and the reserved-slot machinery, the
// live gate (GATE / data-live), gsap, and the `arriving` handoff into
// PhotoLightbox (the prop and its `[data-arriving]` rule in shop.css are gone
// too — nothing was left to set them). The kicker «(On the fridge)», the
// «click a magnet» cue and the reserved slot's «coming» went from content.ts
// on the same page; quality.css lost its pre-hydration `.ap-mf__scene` rule.
//
// ONE LAYER NOW. What every phone, keyboard, reduced-motion and no-JS visitor
// already had — the head, «The whole set», the grid with a buy button under
// each magnet — is what every screen gets; there is no staging left to gate.
// The file keeps its name: the page, the stylesheet (magnets.css) and the
// project notes point at it, and a rename would only move history.
// ============================================================================

export type MagnetShot = {
  id: string;
  src: string;
  thumb: string;
  w: number;
  h: number;
  avg: string;
};

export default function MagnetFridge({
  shots,
  slug,
  price,
  heading = "h2",
}: {
  shots: MagnetShot[];
  slug: string;
  price: number;
  heading?: "h1" | "h2";
}) {
  const [big, setBig] = useState<number | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const bigOpener = useRef<HTMLElement | null>(null);
  const addedTimer = useRef(0);

  // a confirmation fading after unmount would setState on a dead component
  useEffect(() => () => window.clearTimeout(addedTimer.current), []);

  const H = heading;

  const open = (idx: number, e: React.MouseEvent<HTMLElement>) => {
    bigOpener.current = e.currentTarget;
    setBig(idx);
  };

  const buy = (id: string, from?: HTMLElement | null) => {
    add(slug, id, 1);
    // the flight starts from whatever picture of this magnet is on screen —
    // the open lightbox if there is one, otherwise the clicked grid cell's own
    // thumbnail (the caller passes its button). A missed lookup skips the
    // garnish; flyToCart takes null.
    flyToCart(
      document.querySelector<HTMLImageElement>(".ap-xg__stage img") ??
        from?.closest("li")?.querySelector("img"),
    );
    setAdded(id);
    // supersede, never stack: a second press on the SAME magnet must start
    // its 2.6s over, not inherit the first press's expiry
    window.clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => setAdded((p) => (p === id ? null : p)), 2600);
  };

  return (
    <section className="ap-mf" aria-labelledby="ap-mf-title">
      <div className="ap-mf__head">
        {/* no kicker above the title since 2026-10-12 (change 4.pdf p8,
            «(ON THE FRIDGE)» circled: «հանենք սա») — the title is the first
            line under the breadcrumb and nothing holds the kicker's place */}
        <H className="ap-h2" id="ap-mf-title" data-tfx="rise">
          {magnetFridge.title}
        </H>
        {magnetFridge.copy.map((t) => (
          <p className="ap-lede" key={t}>
            {t}
          </p>
        ))}
        <p className="ap-mf__from">
          <strong>{dram(price)}</strong> each
        </p>
      </div>

      {/* ---- every magnet, buyable — the grid follows the head directly ---- */}
      <div className="ap-mf__allwrap">
        {/* h2: it follows the page's h1 with nothing between (the audit read
            h1 → h3 → h2 here) */}
        <h2 className="ap-mf__allhead">{magnetFridge.all}</h2>
        <ul className="ap-mf__all">
          {shots.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                className="ap-mf__cell"
                aria-label={`Magnet no. ${s.id} — see it up close`}
                onClick={(e) => open(i, e)}
              >
                <img src={s.thumb} alt={`Magnet no. ${s.id} by Arpine Baroyan`} width={s.w} height={s.h} loading="lazy" />
              </button>
              <div className="ap-mf__buy">
                <p className="ap-mf__name">Magnet no. {s.id}</p>
                {/* the magnet rides in the button's NAME, after the visible
                    words (2026-10-05): 35 identical «Add to cart» could not be
                    told apart in a screen reader's list of buttons. The
                    name still starts with the label the eye reads. */}
                <button type="button" className="ap-btn ap-mf__add" onClick={(e) => buy(s.id, e.currentTarget)}>
                  {magnetFridge.add}
                  <span className="ap-sr">: Magnet no. {s.id}</span>
                </button>
                <p className="ap-mf__added" role="status">
                  {added === s.id ? magnetFridge.added : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ---- the big window: the mock's panel is this dialog -------------- */}
      {big !== null && shots[big] && (
        <PhotoLightbox
          shots={shots}
          i={big}
          onIndex={(n) => setBig(n)}
          onClose={() => setBig(null)}
          opener={bigOpener.current}
          label={`Magnet no. ${shots[big].id} — ${magnetFridge.title}`}
          alt={(n) => `Magnet no. ${shots[n].id} of ${shots.length}, by Arpine Baroyan`}
          footer={
            <button type="button" className="ap-btn" onClick={() => buy(shots[big].id)}>
              {added === shots[big].id ? magnetFridge.added : `${magnetFridge.add} — ${dram(price)}`}
            </button>
          }
        />
      )}
    </section>
  );
}
