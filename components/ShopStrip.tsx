"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PhotoLightbox from "./PhotoLightbox";
import Link from "next/link";
import gsap from "gsap";
import { soon } from "@/lib/content";
import { SoonLink } from "./Soon";

// ============================================================================
// SHOP STRIP — the client's expandable gallery, rebuilt for a shop.
//
// Ported, not pasted: framer-motion is not in this project's three-dependency
// budget, so the flex-grow and overlay tweens are GSAP; Tailwind is not here
// either, so the classes are `ap-xg` rules in app/shop.css.
//
// One deliberate change of behaviour. In the original, clicking a panel opens
// a lightbox — a dead end. This is a shop index, so a panel click OPENS THE
// CATEGORY, which is what a buyer is reaching for; the lightbox lives on its
// own small button, showing every photograph of that line. Nothing that looks
// like a product link leads to a viewer instead of the product.
//
// The plain layer is the real grid of category cards underneath (see
// app/shop/page.tsx): phones, reduced motion and no-JS never see this strip.
// ============================================================================

export type StripShot = { src: string; w: number; h: number; avg: string };
export type StripCat = {
  slug: string;
  name: string;
  from: number;
  status: "open" | "soon";
  blurb: string;
  photo: StripShot;
  shots: StripShot[];
};

const DESKTOP = "(min-width: 861px) and (prefers-reduced-motion: no-preference)";
/** hovered panel : every other panel — the original's 2 and 0.5 */
const GROW_ON = 2;
const GROW_OFF = 0.5;
const DIM_REST = 0.22;

export default function ShopStrip({ cats }: { cats: StripCat[] }) {
  const root = useRef<HTMLDivElement | null>(null);
  const [live, setLive] = useState(false);
  /** which category's photographs are open, or null */
  const [lb, setLb] = useState<number | null>(null);
  const [i, setI] = useState(0);

  // THE STRIP FOLLOWS ITS QUERY (2026-10-12, the gate before the phone pass
  // was pushed). `live` used to be read once at mount, which was harmless
  // while the panels held plain <img>s. The phone pass put each photograph
  // behind a <picture> whose <source> is a LIVE media query (below, and the
  // first grid card in CatFig.tsx) — so a tablet turned to portrait, a window
  // snapped to half, or a page zoomed past 860px swapped all eleven pictures
  // for the 1x1 GIF while the strip stayed on screen and the grid stayed
  // hidden: a shop index of flat colour panels until a reload. The other way
  // round, the grid's first card went blank. Strip, grid and both sources now
  // switch together. The viewer is rendered INSIDE the strip and locks the
  // page's scroll, so it is closed when the strip stops — otherwise it would
  // be an invisible dialog holding a locked page.
  useEffect(() => {
    const m = window.matchMedia(DESKTOP);
    const read = () => {
      const on = m.matches && window.matchMedia("(scripting: enabled)").matches;
      setLive(on);
      if (!on) setLb(null);
    };
    read();
    m.addEventListener("change", read);
    return () => m.removeEventListener("change", read);
  }, []);

  // the section attribute is what hides the plain grid — set only once the
  // strip is really running, never from CSS, which cannot know about JS
  useEffect(() => {
    const el = root.current;
    if (!el || !live) return;
    const sec = el.closest(".ap-shop");
    sec?.setAttribute("data-strip", "");
    return () => sec?.removeAttribute("data-strip");
  }, [live]);

  const focusPanel = useCallback(
    (idx: number | null) => {
      const el = root.current;
      if (!el || !live) return;
      const panels = Array.from(el.querySelectorAll<HTMLElement>(".ap-xg__panel"));
      const veils = panels.map((p) => p.querySelector<HTMLElement>(".ap-xg__veil"));
      gsap.to(panels, {
        flexGrow: (n: number) => (idx === null ? 1 : n === idx ? GROW_ON : GROW_OFF),
        duration: 0.5,
        ease: "power2.inOut",
        overwrite: true,
      });
      gsap.to(veils.filter(Boolean) as HTMLElement[], {
        opacity: (n: number) => (idx !== null && n === idx ? 0 : DIM_REST),
        duration: 0.3,
        ease: "none",
        overwrite: true,
      });
    },
    [live],
  );

  // ---- the lightbox ------------------------------------------------------
  const shots = lb === null ? [] : cats[lb].shots;
  const openerRef = useRef<HTMLElement | null>(null);

  const open = (idx: number, from: HTMLElement) => {
    openerRef.current = from;
    setI(0);
    setLb(idx);
  };
  // Escape, the arrow keys, the scroll lock and the focus round-trip all moved
  // INTO PhotoLightbox when it was extracted. Leaving copies here would have
  // meant two listeners racing to close the same dialog and two writes to
  // body.overflow, the second of which restores the wrong value.

  return (
    <div className="ap-xg" ref={root} data-live={live || undefined}>
      <div className="ap-xg__row">
        {cats.map((c, idx) => (
          <div
            className="ap-xg__panel"
            key={c.slug}
            onMouseEnter={() => focusPanel(idx)}
            onMouseLeave={() => focusPanel(null)}
          >
            {/* the whole panel is the category link — a buyer's click goes to
                the product, never to a viewer. A line that is not open yet
                opens the small Available Soon window instead (client,
                change.pdf p8, 2026-09-15), and no panel names a price now. */}
            {(() => {
              const face = (
                <>
                  {/* NOT FETCHED WHERE THE STRIP CANNOT SHOW (2026-10-05
                      package). The strip is display:none on the plain layer,
                      but its first four photographs are eager — so /shop on
                      a phone downloaded 664 KB of full-size tiles
                      (tile-postcards.webp 363 KB, scarves 121, cups 106,
                      hoodies 74) at 177ms, ahead of the grid's own first
                      card, the page's LCP (synthesis/v3.json shop; live LCP
                      7.9s). On the plain layer's media — narrow, reduced
                      motion, no scripting — the source is a 1x1 GIF inlined
                      as data: no request. The desktop matches none of them
                      and keeps its eager first four. display: contents so
                      `.ap-xg__go img` lays out exactly as before. */}
                  <picture style={{ display: "contents" }}>
                    <source
                      media="(max-width: 860px), (prefers-reduced-motion: reduce), (scripting: none)"
                      srcSet="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
                    />
                    <img
                      src={c.photo.src}
                      alt={`${c.name} by Arpine Baroyan`}
                      width={c.photo.w}
                      height={c.photo.h}
                      style={{ background: c.photo.avg }}
                      loading={idx < 4 ? undefined : "lazy"}
                      decoding="async"
                    />
                  </picture>
                  <span className="ap-xg__veil" aria-hidden="true" style={{ opacity: DIM_REST }} />
                  <span className="ap-xg__say">
                    <strong>{c.name}</strong>
                    {c.status !== "open" && <em>{soon.tile}</em>}
                    <span className="ap-xg__blurb">{c.blurb}</span>
                  </span>
                </>
              );
              return c.status === "open" ? (
                <Link className="ap-xg__go" href={`/shop/${c.slug}`} onFocus={() => focusPanel(idx)} onBlur={() => focusPanel(null)}>
                  {face}
                </Link>
              ) : (
                <SoonLink className="ap-xg__go" name={c.name} onFocus={() => focusPanel(idx)} onBlur={() => focusPanel(null)}>
                  {face}
                </SoonLink>
              );
            })()}

            {c.shots.length > 1 && (
              <button
                type="button"
                className="ap-xg__zoom"
                aria-label={`See all ${c.shots.length} photographs of ${c.name}`}
                onClick={(e) => open(idx, e.currentTarget)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {lb !== null && (
        <PhotoLightbox
          shots={shots}
          i={i}
          onIndex={setI}
          onClose={() => setLb(null)}
          opener={openerRef.current}
          label={`Photographs of ${cats[lb].name}`}
          alt={(n) => `${cats[lb].name}, photograph ${n + 1} of ${shots.length}`}
          footer={
            <Link className="ap-btn" href={`/shop/${cats[lb].slug}`}>
              Open {cats[lb].name} <span aria-hidden>→</span>
            </Link>
          }
        />
      )}
    </div>
  );
}
