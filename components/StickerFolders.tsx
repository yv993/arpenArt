"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Draggable } from "gsap/Draggable";
import { stickerSheets } from "@/lib/content";
import { add, dram } from "@/lib/cart";
import { flyToCart } from "@/lib/fly";
import PhotoLightbox from "./PhotoLightbox";

// ============================================================================
// STICKER FOLDERS — six folders side by side, one per sheet, three pictures
// in each (the print and its two mockups).
//
// Ported from a supplied framer-motion + Tailwind "InteractiveFolderGallery":
// the anatomy is kept — a folder whose photographs fan on hover, spread when
// opened, and are dragged down to put away — and the implementation is not,
// because framer-motion and Tailwind are both outside this project's budget
// (the same trade Selector, LocationCard and the morph hero already made).
// The springs became GSAP tweens; the drag became gsap/Draggable, which ships
// inside the gsap package this route already loads.
//
// CHANGES FROM THE SUPPLIED DESIGN, each for a reason:
//   · SIX folders in a row, not one centred stage — that is the ask ("all
//     sticker folder must placed side by side"), so the geometry is measured
//     from each cell at open time instead of hardcoded to a 400px stage.
//   · The folder is a real <button> with aria-expanded, and Escape / a second
//     press / a press on the page ground all close it — a control that can
//     only be closed by dragging is unusable from a keyboard.
//   · Only ONE folder may be open: the spread rides over the neighbouring
//     cells, and two spreads at once print through each other.
//   · The hardcoded #1e1e1e blacks became the site's tokens, so the folders
//     sit on paper in the day and on the night ground after dark without a
//     single colour named here.
//
// TWO-LAYER CONTRACT, as everywhere on this site: this component renders the
// PLAIN layer (a grid of the eighteen pictures, grouped by sheet) for
// everyone; the folder stage is layered on only when the gate passes —
// desktop, fine pointer, motion allowed, scripting on. Phones get the grid,
// not a toy that needs hover.
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

/** resting z of card i — the CENTRE card (the print) on top of the stack */
const zOf = (i: number) => (i === 1 ? 3 : i === 0 ? 1 : 2);

/** rest / hover / open offsets for card i of 3 (offset o = i − 1), as
 *  fractions of the CARD's width so the fan survives any cell size */
const rest = (o: number) => ({ x: o * 3, y: o * -5, r: o * 3, s: 1 - Math.abs(o) * 0.03 });
const fan = (o: number) => ({ x: o * 34, y: o * -12 - 44, r: o * 8, s: 1 - Math.abs(o) * 0.03 });

export default function StickerFolders({
  shots,
  slug,
  price,
  heading = "h2",
}: {
  shots: Shot[];
  /** "h1" when this section IS the page — /shop/stickers has no other title */
  heading?: "h1" | "h2";
  /** the category slug the cart line is filed under — "stickers" */
  slug: string;
  /** ONE price for all six, from `categories[stickers].from`. It is deliberately
   *  not a per-sheet number: /api/order re-prices every line from its own copy
   *  of that table and never trusts the browser, and a per-sheet price the
   *  server did not also hold would be a figure the server would silently
   *  under-charge. The sheets are all one size and count, so one number is
   *  also simply true. */
  price: number;
}) {
  const [live, setLive] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  /** which sheet just went in, so the confirmation sits on its own folder */
  const [added, setAdded] = useState<string | null>(null);
  /** the sheet whose pictures are open big, and which of its three */
  const [big, setBig] = useState<{ sheet: string; i: number } | null>(null);
  const bigOpener = useRef<HTMLElement | null>(null);
  const addTimer = useRef<number | null>(null);
  const root = useRef<HTMLElement>(null);
  /** card elements per sheet id, in DOM order */
  const decks = useRef<Map<string, HTMLElement[]>>(new Map());
  const drags = useRef<Draggable[]>([]);
  const openRef = useRef<string | null>(null);
  openRef.current = open;

  const byId = (id: string) => shots.find((s) => s.id === id);

  useEffect(() => {
    if (!window.matchMedia("(scripting: enabled)").matches) return;
    if (!window.matchMedia(GATE).matches) return;
    gsap.registerPlugin(Draggable);
    setLive(true);
  }, []);

  /** every card of a sheet back to its resting stack */
  const settle = useCallback((id: string, state: "rest" | "fan") => {
    const els = decks.current.get(id);
    if (!els) return;
    els.forEach((el, i) => {
      const o = i - 1;
      const p = state === "fan" ? fan(o) : rest(o);
      // back below the flap the moment the fold-away starts, or the cards
      // slide down IN FRONT of the folder they are meant to drop into
      gsap.set(el, { zIndex: zOf(i) });
      gsap.to(el, {
        x: p.x,
        y: p.y,
        rotation: p.r,
        scale: p.s,
        duration: 0.5,
        ease: "back.out(1.4)",
        overwrite: "auto",
      });
    });
  }, []);

  const close = useCallback(() => {
    const id = openRef.current;
    if (!id) return;
    drags.current.forEach((d) => d.kill());
    drags.current = [];
    settle(id, "rest");
    setOpen(null);
  }, [settle]);

  const openSheet = useCallback(
    (id: string) => {
      // one folder at a time — a second spread would print through the first
      if (openRef.current && openRef.current !== id) close();
      const els = decks.current.get(id);
      if (!els) return;
      setOpen(id);

      // measured, not hardcoded: the spread is proportional to the card the
      // cell actually laid out, so it survives every grid breakpoint
      const w = els[0]?.offsetWidth || 190;
      const spreadX = w * 0.82;
      const riseY = -(els[0]?.offsetHeight || 240) * 0.5;

      els.forEach((el, i) => {
        const o = i - 1;
        // over the flap (z 4) while spread — the flap stays pressable
        // underneath as the keyboard's close control
        gsap.set(el, { zIndex: 10 + i });
        gsap.to(el, {
          x: o * spreadX,
          y: riseY,
          rotation: 0,
          scale: 1.05,
          duration: 0.55,
          ease: "back.out(1.2)",
          overwrite: "auto",
        });
        // draggable AFTER the tween owns the transform: Draggable reads the
        // current x/y when it is created, so making it first would freeze the
        // card mid-flight
        drags.current.push(
          Draggable.create(el, {
            type: "x,y",
            zIndexBoost: true,
            onDragEnd() {
              // the supplied gesture: a decent pull DOWN puts the sheet away
              if (this.y > riseY + 96) close();
              else
                gsap.to(el, {
                  x: o * spreadX,
                  y: riseY,
                  duration: 0.45,
                  ease: "back.out(1.4)",
                });
            },
          })[0],
        );
      });
    },
    [close],
  );

  /** Escape and the page ground both put the folder away */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onDown = (e: PointerEvent) => {
      const cell = (e.target as HTMLElement).closest?.("[data-sheet]");
      if (!cell || cell.getAttribute("data-sheet") !== open) close();
    };
    window.addEventListener("keydown", onKey);
    // pointerdown, not click: a drag that ends outside the cell must not
    // ALSO count as a press on the ground and close what it just tidied
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open, close]);

  useEffect(() => () => drags.current.forEach((d) => d.kill()), []);
  useEffect(() => () => { if (addTimer.current) window.clearTimeout(addTimer.current); }, []);

  /** WHICH SHEET travels as the line's `variant`. The cart already keys lines
   *  by cat+art+variant, so six sheets are six lines rather than one line of
   *  six, and /api/order echoes the variant into the order mail — she reads
   *  "Sheet 03", not "Stickers ×1" with no way to know which. */
  const buy = useCallback(
    (sheetId: string, name: string) => {
      add(slug, undefined, 1, name);
      // the picture the buyer is looking at is the one that flies
      const card = decks.current.get(sheetId)?.[1] ?? decks.current.get(sheetId)?.[0];
      flyToCart(card?.querySelector("img") ?? null);
      setAdded(sheetId);
      if (addTimer.current) window.clearTimeout(addTimer.current);
      addTimer.current = window.setTimeout(() => setAdded(null), 2600);
    },
    [slug],
  );

  /** the opened sheet and its three pictures, at FULL size. Resolved here so
   *  the dialog below stays a single block rather than three lookups inline. */
  const bigSheet = big ? stickerSheets.sheets.find((s) => s.id === big.sheet) : undefined;
  const bigShots = bigSheet
    ? (() => {
        const ordered = bigSheet.shots.map(byId).filter((s): s is Shot => !!s);
        // the same reordering the folder uses (print in the middle), so the
        // picture that opens is the one that was pressed
        return ordered.length === 3 ? [ordered[1], ordered[0], ordered[2]] : ordered;
      })()
    : [];

  return (
    <section
      ref={root}
      className="ap-sf"
      data-live={live || undefined}
      aria-label={`${stickerSheets.title} — sticker sheets`}
    >
      <div className="ap-sec__head">
        <p className="ap-kicker">{stickerSheets.kicker}</p>
        {heading === "h1" ? (
          <h1 className="ap-h2" data-tfx="rise">
            {stickerSheets.title}
          </h1>
        ) : (
          <h2 className="ap-h2" data-tfx="rise">
            {stickerSheets.title}
          </h2>
        )}
        {/* THE RIGHT HALF WAS EMPTY (client, change.pdf p14, 2026-09-15:
            «looks like we forgot the right side — set the text in two parts
            so it fills the right, and the stickers rise a little»). The lead
            keeps the line to itself; the two paragraphs stand side by side
            under it (.ap-sf__cols, shop.css), which is what lets the folders
            below start higher. */}
        <p className="ap-lede">{stickerSheets.copy[0]}</p>
        <div className="ap-sf__cols">
          {stickerSheets.copy.slice(1).map((t) => (
            <p key={t}>{t}</p>
          ))}
        </div>
        <p className="ap-cv__price ap-sf__from">
          <strong>{dram(price)}</strong> a sheet
        </p>
      </div>

      <ul className="ap-sf__row">
        {stickerSheets.sheets.map((sheet) => {
          const ordered = sheet.shots.map(byId).filter((s): s is Shot => !!s);
          // THE PRINT RIDES IN THE MIDDLE, ON TOP. content.ts lists it first
          // (it is the sheet's identity), but at rest only the top card shows
          // — and the mockups are grey product photographs, so leading with
          // them made six folders of grey cards out of her most colourful
          // work. Centre position + top z gives the fan mockups either side.
          const three = ordered.length === 3 ? [ordered[1], ordered[0], ordered[2]] : ordered;
          const isOpen = open === sheet.id;
          return (
            <li
              key={sheet.id}
              className="ap-sf__cell"
              data-sheet={sheet.id}
              data-open={isOpen || undefined}
              data-dim={(open !== null && !isOpen) || undefined}
              onPointerEnter={live && !openRef.current ? () => settle(sheet.id, "fan") : undefined}
              onPointerLeave={live && !openRef.current ? () => settle(sheet.id, "rest") : undefined}
            >
              {/* ---- the folder stage: live layer only (CSS hides it plain) */}
              <div className="ap-sf__stage" aria-hidden={!live || undefined}>
                <div className="ap-sf__back" />
                <div className="ap-sf__deck">
                  {three.map((s, i) => (
                    <button
                      type="button"
                      key={s.id}
                      className="ap-sf__card"
                      style={{ zIndex: zOf(i), background: s.avg }}
                      aria-label={`${sheet.name}, picture ${i + 1} of ${three.length} — see it bigger`}
                      // A CLOSED folder belongs to the flap: the cards are
                      // stacked behind it and a press there should open the
                      // folder, not a picture nobody can see yet.
                      onClick={(e) => {
                        if (openRef.current !== sheet.id) return;
                        bigOpener.current = e.currentTarget;
                        setBig({ sheet: sheet.id, i });
                      }}
                      ref={(el) => {
                        const list = decks.current.get(sheet.id) ?? [];
                        list[i] = el as HTMLElement;
                        decks.current.set(sheet.id, list);
                      }}
                    >
                      {/* thumbs are 700px files — plenty for a ~200px card */}
                      <img src={s.thumb} alt="" width={s.w} height={s.h} loading="lazy" draggable={false} />
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="ap-sf__flap"
                  aria-expanded={isOpen}
                  onClick={() => (isOpen ? close() : openSheet(sheet.id))}
                >
                  <span className="ap-sf__chip">{sheet.name}</span>
                  <span className="ap-sf__spec">{stickerSheets.spec}</span>
                </button>
              </div>

              {/* ---- price and buy, under every folder ------------------
                  OUTSIDE the stage on purpose: the stage is aria-hidden on
                  the plain layer and its cards are dragged about, and a
                  purchase control must never live somewhere a gesture can
                  throw it. This row renders in BOTH layers, so a phone can
                  buy a sheet exactly as a desktop can. */}
              <div className="ap-sf__buy">
                <p className="ap-sf__price">
                  <span className="ap-sf__pname">{sheet.name}</span>
                  <strong>{dram(price)}</strong>
                </p>
                <button type="button" className="ap-btn ap-sf__add" onClick={() => buy(sheet.id, sheet.name)}>
                  {stickerSheets.add}
                </button>
                <p className="ap-sf__added" role="status">
                  {added === sheet.id ? stickerSheets.added : ""}
                </p>
              </div>

              {/* ---- the plain layer: the same three pictures as a row ----
                   This is the whole content for phones, reduced motion and
                   no-JS — real images, not an empty stage. */}
              <div className="ap-sf__plain">
                {/* h2, not h3: on the plain layer these follow the page's h1
                    directly (the audit read h1 → h3 on phones) */}
                <h2 className="ap-sf__plainname">
                  {sheet.name} <span>{stickerSheets.spec}</span>
                </h2>
                <ul>
                  {three.map((s, i) => (
                    <li key={s.id} style={{ background: s.avg }}>
                      {/* the same "make it bigger" the folder gives — a phone
                          has no folder to open, so the picture itself is the
                          control */}
                      <button
                        type="button"
                        aria-label={`${sheet.name}, picture ${i + 1} of ${three.length} — see it bigger`}
                        onClick={(e) => {
                          bigOpener.current = e.currentTarget;
                          setBig({ sheet: sheet.id, i });
                        }}
                      >
                        <img
                          src={s.thumb}
                          alt={`${sheet.name} — sticker sheet by Arpine Baroyan`}
                          width={s.w}
                          height={s.h}
                          loading="lazy"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ul>

      {/* the way out, said once for the whole row — live layer only */}
      <p className="ap-sf__hint" data-on={open !== null || undefined} aria-hidden={!live || undefined}>
        {stickerSheets.hint}
      </p>

      {/* A PICTURE, BIG (client 2026-08-23: "images must become bigger when
          user click in images"). The FULL file, not the 700px thumb the folder
          shows — the sheet is twenty stickers and the point of opening it is
          to see them. The arrows walk the sheet's other two pictures, and the
          sheet stays buyable from in here rather than making anyone close the
          picture to find the button again. */}
      {bigSheet && (
        <PhotoLightbox
          shots={bigShots}
          i={big!.i}
          onIndex={(n) => setBig((p) => (p ? { ...p, i: n } : p))}
          onClose={() => setBig(null)}
          opener={bigOpener.current}
          label={`${bigSheet.name} — ${stickerSheets.spec}`}
          alt={(n) => `${bigSheet.name}, picture ${n + 1} of ${bigShots.length}, by Arpine Baroyan`}
          footer={
            <button
              type="button"
              className="ap-btn"
              onClick={() => buy(bigSheet.id, bigSheet.name)}
            >
              {stickerSheets.add} — {dram(price)}
            </button>
          }
        />
      )}
    </section>
  );
}
