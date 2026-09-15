"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { magnetFridge } from "@/lib/content";
import { add, dram } from "@/lib/cart";
import { flyToCart } from "@/lib/fly";
import PhotoLightbox from "./PhotoLightbox";

// ============================================================================
// THE FRIDGE — her thirty-five magnets, stuck to a refrigerator door, each one
// opening big in the window the client's mock drew (✕ top-left, ‹ › arrows,
// the magnet large in a light panel). That window is PhotoLightbox, which the
// shop strip and the sticker sheets already use — the mock's anatomy and the
// existing dialog are the same thing, so building a second dialog for it
// would only create two opinions about which key closes.
//
// THE DOOR HOLDS THE 6×5 PLAN, THE PAGE HOLDS ALL THIRTY-FIVE. The client's
// second reference (2026-08-31) fixed the door as a precise thirty-slot grid
// with named positions — see DOOR_PLAN below for the mapping and for why some
// slots are reserved frames rather than pictures. The full set still stands
// in the plain grid below, where every magnet has its own buy button, and the
// lightbox walks the WHOLE catalogue from either entrance — a door magnet
// opens at its own place in all 35, not in a separate door-set.
//
// THE MAGNET LAYER SITS ON THE DOOR'S OWN PLANE. The photograph looks at the
// fridge from its right, so the door face recedes left. A flat grid pasted
// over it would float in front of the photo the way a sticker floats on a
// screen. One perspective transform on the layer — tuned against screenshots
// of the real render, not computed from theory — leans the grid back into the
// scene; the per-magnet jitter (rotation, a few px of drift) is deterministic
// from the index so the server and the browser lay the door out identically.
//
// TWO-LAYER CONTRACT, as always: the fridge is the live layer's staging and
// carries aria-hidden — the same pictures, names, prices and buy buttons all
// exist in the grid below for phones, keyboards, reduced motion and no-JS.
// The door magnets are still real buttons (they are clickable), but the
// content they open is reachable without them.
// ============================================================================

export type MagnetShot = {
  id: string;
  src: string;
  thumb: string;
  w: number;
  h: number;
  avg: string;
};

const GATE = "(min-width: 861px) and (hover: hover) and (prefers-reduced-motion: no-preference)";

// ============================================================================
// THE DOOR PLAN — six rows of five, per the client's reference render of
// 2026-08-31 ("a precise 6x5 grid", positions given as [Row, Column]).
//
// Two kinds of slot, and the difference is the shop's honesty line:
//   { id }   — one of her real 35 magnets, clickable, buyable.
//   { soon } — a design the client named that DOES NOT EXIST in her set yet
//              ("next i will give remaining images"). It renders as an empty
//              acrylic frame with the design's name — visibly a reserved
//              slot, NOT a product. The reference render is AI-generated and
//              paints finished art for these; putting invented pictures on a
//              real shop as hers is the one thing this site never does. When
//              her files arrive, a slot flips to { id } and nothing else
//              changes.
//
// The six positions the client fixed (verified against the numbered contact
// sheet, scratchpad/mg-ids.png):
//   R1C1 = 10 (ԲԱՐԵՎ ՀԱՅԱՍՏԱՆ, Ararat)   R1C2 = alphabet block — NOT in the
//   set (the render's version is Cyrillic, an AI slip) → reserved
//   R1C5 = 05 (the Cascade)               R2C1 = 03 (red skirt, Ararat)
//   R3C2 = 30 (We Are Our Mountains)      R4C5 = 32 (Երազելով, wine)
// One more from the "required new" list already exists and is used real:
// the bearded monk on the grassy hill is her magnet 31 (R3C1, as in the
// render). The other free slots carry more of her real magnets — a shop
// stages what it can actually sell.
// ============================================================================
type DoorSlot = { id: string } | { soon: string };
// ALL THIRTY-FIVE, 7×5 (client 2026-08-31, third pass: "it must stay in this
// image all 35 images of magnet like in first screenshot" — the whole real
// catalogue on the door, dense as the reference). The six positions the
// client fixed earlier keep their seats (all sat in rows 1–4, which a 7-row
// grid contains unchanged), the monk keeps R3C1, and the other 28 fill the
// remaining slots in numeric order. The reserved-frame machinery ({ soon })
// stays dormant below for the day the eleven announced designs arrive as
// real files — they would extend products.json and take slots here as ids.
const DOOR_PLAN: DoorSlot[] = [
  // row 1
  { id: "10" }, { id: "01" }, { id: "02" }, { id: "04" }, { id: "05" },
  // row 2
  { id: "03" }, { id: "06" }, { id: "07" }, { id: "08" }, { id: "09" },
  // row 3
  { id: "31" }, { id: "30" }, { id: "11" }, { id: "12" }, { id: "13" },
  // row 4
  { id: "14" }, { id: "15" }, { id: "16" }, { id: "17" }, { id: "32" },
  // row 5
  { id: "18" }, { id: "19" }, { id: "20" }, { id: "21" }, { id: "22" },
  // row 6
  { id: "23" }, { id: "24" }, { id: "25" }, { id: "26" }, { id: "27" },
  // row 7
  { id: "28" }, { id: "29" }, { id: "33" }, { id: "34" }, { id: "35" },
];

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
  const [live, setLive] = useState(false);
  const [big, setBig] = useState<number | null>(null);
  /** a magnet is in the air and will land on the dialog's picture */
  const [arriving, setArriving] = useState(false);
  const flyRef = useRef<HTMLImageElement | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const bigOpener = useRef<HTMLElement | null>(null);
  const addedTimer = useRef(0);

  useEffect(() => {
    // No `(scripting: enabled)` check here, although the older siblings carry
    // one: inside a running effect it is a tautology, and on browsers that
    // predate the `scripting` media feature (Safari <17, Chrome <120) the
    // unknown query parses to `not all` and would switch the live layer off
    // for exactly the users it was meant to serve. The feature's real home is
    // CSS/media attributes, where a no-JS visitor needs the fallback.
    if (typeof window === "undefined") return;
    if (!window.matchMedia(GATE).matches) return;
    setLive(true);
  }, []);

  // a confirmation fading after unmount would setState on a dead component
  useEffect(() => () => window.clearTimeout(addedTimer.current), []);

  const H = heading;

  const open = (idx: number, e: React.MouseEvent<HTMLElement>) => {
    bigOpener.current = e.currentTarget;
    setBig(idx);
  };

  // --------------------------------------------------------------------------
  // THE MAGNET MOVES LIKE A MAGNET (client 2026-08-31: "when user click
  // magnets must move more realistic and have 3d animated effect").
  //
  // Two motions, both GSAP-owned:
  //   · HOVER — the magnet tilts toward the pointer (rotationX/Y from the
  //     pointer's place on it, a small lift off the door) and settles back
  //     with an elastic wobble when the pointer leaves, the way a loosely
  //     held magnet rocks flat against steel.
  //   · CLICK — the peel. A real magnet does not fade off a fridge: one edge
  //     tips up first (rotation IN, toward the door), then it pops free at
  //     the viewer with a back.out overshoot. The lightbox opens only when
  //     the pull lands (~0.4s), and the transform is cleared behind the
  //     dialog's overlay so nothing jumps on close.
  //
  // GSAP owns `transform` on these buttons EXCLUSIVELY — the stylesheet's old
  // hover `scale(1.06)` and its `transition: transform` are gone, because a
  // CSS transition re-easing every GSAP write turns motion to soup (the same
  // trap KeychainCard documents). CSS keeps only `filter` for the deepening
  // drop-shadow, which GSAP never touches. The door renders solely under the
  // live gate (fine pointer + motion allowed), so reduced-motion visitors
  // never meet this code — but the pull still guards, because the gate is
  // checked once at mount and the OS preference can change after.
  // --------------------------------------------------------------------------
  const pulling = useRef(false);

  const tiltMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (pulling.current) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5; // −0.5 … 0.5 across
    const py = (e.clientY - r.top) / r.height - 0.5;
    gsap.to(el, {
      rotationY: px * 22,
      rotationX: -py * 18,
      z: 26,
      scale: 1.06,
      transformPerspective: 650,
      duration: 0.35,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  const tiltLeave = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (pulling.current) return;
    gsap.to(e.currentTarget, {
      rotationX: 0,
      rotationY: 0,
      z: 0,
      scale: 1,
      duration: 0.9,
      ease: "elastic.out(1, 0.5)",
      overwrite: "auto",
    });
  };

  const pullOff = (idx: number, e: React.MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget;
    bigOpener.current = el;
    if (pulling.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setBig(idx);
      return;
    }
    // THE FLIGHT (client 2026-08-31: "magnets must come close procedurally
    // and go until its show price and add to cart part"). The magnet does
    // not blink into the detail window — it TRAVELS there: a fixed-position
    // clone of the very pixels on the door peels off (the two-beat tip that
    // was already here) and then flies to where the lightbox is about to
    // stand — centre of the viewport, ~62vh tall — growing the whole way.
    // The lightbox (price, Add to cart, arrows) opens underneath at the
    // moment the flight lands, the clone crossfades out over it, and the
    // door magnet is restored silently behind the overlay.
    const img = el.querySelector("img");
    if (!img) {
      setBig(idx);
      return;
    }
    pulling.current = true;
    const li = el.parentElement;
    if (li) li.style.zIndex = "6";
    const r = img.getBoundingClientRect();
    const clone = img.cloneNode() as HTMLImageElement;
    clone.className = "ap-mf__fly";
    Object.assign(clone.style, {
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
    document.body.appendChild(clone);
    el.style.visibility = "hidden"; // the door copy steps aside for the flight
    flyRef.current = clone;

    // ONE UNBROKEN MOVE, ONTO THE REAL DESTINATION (client 2026-08-31: "must
    // move and didn't stop, it must go to place where appear button price and
    // text"). The first cut flew to the middle of the viewport and only then
    // opened the dialog — but the dialog centres the whole STAGE, picture plus
    // the Add to cart button under it, so its picture sits above centre. The
    // magnet therefore stopped, the dialog appeared, and the picture jumped.
    //
    // This is the FLIP order instead: open the dialog FIRST and hold its
    // picture invisible (`arriving`), let it lay out, measure where that
    // picture actually is, and fly there. The traveller lands on the exact
    // pixels it is about to become, so the swap is invisible and the motion
    // never pauses. The ground darkening and the button fading in happen
    // WHILE it flies, which is the whole effect.
    setBig(idx);
    setArriving(true);
    gsap.set(clone, { transformPerspective: 700 });
    // the peel starts immediately — it does not wait for the measurement
    gsap.to(clone, { rotationY: -14, rotationX: 8, scale: 1.06, duration: 0.13, ease: "power2.in" });

    // two frames: one for React to commit the dialog, one for layout to settle
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const dest = document.querySelector<HTMLImageElement>(".ap-xg__lb .ap-xg__stage img");
        const d = dest?.getBoundingClientRect();
        // THE HANDOFF IS OVERLAPPED, and it has to be. Flipping `arriving`
        // and removing the clone in the same tick leaves one painted frame
        // with NEITHER on screen — React has not committed the dialog's
        // picture yet and the traveller is already gone, which reads as a
        // blink at the exact moment the eye is on it. The clone therefore
        // stays for two frames after the state change, sitting on the same
        // pixels as the picture that replaces it, and only then leaves.
        const land = () => {
          setArriving(false);
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              clone.remove();
              flyRef.current = null;
              el.style.visibility = "";
              if (li) li.style.zIndex = "";
              pulling.current = false;
            }),
          );
        };
        if (!d || !d.width) {
          land();
          return;
        }
        gsap.to(clone, {
          left: d.left,
          top: d.top,
          width: d.width,
          height: d.height,
          rotationY: 0,
          rotationX: 0,
          scale: 1,
          duration: 0.62,
          ease: "power3.inOut",
          onComplete: land,
        });
      }),
    );
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
    <section className="ap-mf" data-live={live || undefined} aria-labelledby="ap-mf-title">
      <div className="ap-mf__head">
        <p className="ap-kicker">{magnetFridge.kicker}</p>
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

      {/* ---- the fridge: live layer only ---------------------------------- */}
      <div className="ap-mf__scene" aria-hidden={!live || undefined}>
        <img
          className="ap-mf__fridge"
          src="/products/fridge-front.webp"
          alt=""
          width={1500}
          height={2252}
          loading="lazy"
          draggable={false}
        />
        {/* the grid is PRECISE per the reference — no lean, no drift */}
        <ul className="ap-mf__door">
          {DOOR_PLAN.map((slot, i) => {
            if ("soon" in slot) {
              // a reserved acrylic frame: the design is named, the art is
              // not here yet, and nothing about it can be clicked or bought
              return (
                <li key={`soon-${i}`} className="ap-mf__soonslot">
                  <span>{slot.soon}</span>
                  <em>{magnetFridge.soon}</em>
                </li>
              );
            }
            const s = shots.find((x) => x.id === slot.id);
            if (!s) return null;
            const idx = shots.indexOf(s);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  aria-label={`Magnet no. ${s.id} — see it up close`}
                  tabIndex={live ? undefined : -1}
                  onPointerMove={tiltMove}
                  onPointerLeave={tiltLeave}
                  onClick={(e) => pullOff(idx, e)}
                >
                  <img src={s.thumb} alt="" width={s.w} height={s.h} loading="lazy" draggable={false} />
                </button>
              </li>
            );
          })}
        </ul>
        <p className="ap-mf__cue">{magnetFridge.cue}</p>
      </div>

      {/* ---- every magnet, buyable: the layer everyone gets --------------- */}
      <div className="ap-mf__allwrap">
        <h3 className="ap-mf__allhead">{magnetFridge.all}</h3>
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
                <button type="button" className="ap-btn ap-mf__add" onClick={(e) => buy(s.id, e.currentTarget)}>
                  {magnetFridge.add}
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
          onClose={() => {
            // closing mid-flight would strand the clone on screen forever
            if (flyRef.current) {
              gsap.killTweensOf(flyRef.current);
              flyRef.current.remove();
              flyRef.current = null;
              pulling.current = false;
            }
            setArriving(false);
            setBig(null);
          }}
          arriving={arriving}
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
