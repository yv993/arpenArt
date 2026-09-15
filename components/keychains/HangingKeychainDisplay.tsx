"use client";

import { useState } from "react";
import KeychainCard from "./KeychainCard";
import type { Keychain, KeychainWall } from "@/types/keychain";

// ============================================================================
// THE WALNUT BOARD — three keychains on the photographed brass hooks.
//
// The client's render pair (2026-09-01): a walnut wall with a row of brass
// pegs, three of them proper plate-hooks, and the keychains hanging on
// exactly those three. The wall is the PHOTOGRAPH; the hooks are pixels in
// it. So the anchors are measured, not styled: a 5% ruler over the render
// put the three plate-hooks' knobs at x 20.5 / 50.6 / 80.6 with the knob
// shaft at y ≈ 25 — those numbers below are coordinates read off the image,
// and they survive every viewport because the stage is aspect-locked 1:1,
// exactly the plate's own shape, so background-size: cover neither crops nor
// letterboxes and a percentage means the same pixel at every width.
//
// The card is the SAME KeychainCard the carousel used — same idle sway, same
// drag-to-turn with the elastic spring-back, same travelling shadow, same
// buy — with `peg={false}`, because a drawn peg over a photographed hook
// would put two hooks on one keychain.
//
// THE TRIO PAGES. Twenty-four keychains, three hooks: the arrows advance the
// wall three at a time, wrapping. They are plain buttons and NOT gated on
// `live` — paging is not motion, and a phone or a reduced-motion visitor
// pages the same wall (their keychains simply hang still).
//
// The brief asked for a click-to-flip showing "the back side design" — not
// built, deliberately: no back has been photographed or supplied, and this
// shop does not render product faces it has never seen. When a back design
// exists, it slots into the spin layer KeychainCard already owns.
// ============================================================================

/** The three plate-hooks, as measured on wood-wall.webp — x of the knob's
 *  centre, y of the keychain photo's top edge.
 *
 *  THE RING HANGS, IT DOES NOT ORBIT (client 2026-09-07, with the two
 *  reference crops: "look how keychains must hang … which is bad"). The
 *  first calibration seated the ring's top arc BELOW the knob head — the
 *  ring floated against the flat plate with nothing holding it. A ring on a
 *  knob rests at the TOP of its opening: the knob head must sit just inside
 *  the hole's top edge and the rest of the hole stays open air. Measured on
 *  the rendered page (stage 1073px): head top at y 290px, ring hole's top
 *  edge = photo top + ~1.2% of stage — so the photo tops moved UP 5.8% from
 *  the old figures to put the head at the hole's ceiling. */
/** y carries the WHOLE seat now — the card's old 30px margin-top is zeroed on
 *  the board (see keychains.css), because a fixed-pixel offset inside this
 *  percentage system meant the seat only held at one viewport: measured
 *  18.33% of the stage at 1280px wide but 24.01% on a phone. These are the
 *  1280-calibrated positions with that margin folded in as %, so they now
 *  mean the same pixel of the photograph at every width. */
const ANCHORS = [
  { x: 21.3, y: 18.33 },
  { x: 51.6, y: 18.73 },
  { x: 81.7, y: 18.33 },
];

export default function HangingKeychainDisplay({
  items,
  wall,
  live,
}: {
  items: Keychain[];
  wall: KeychainWall;
  live: boolean;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / ANCHORS.length));
  const trio = ANCHORS.map((_, k) => items[(page * ANCHORS.length + k) % items.length]).filter(Boolean);

  return (
    <div className="ap-kh">
      <div className="ap-kh__wall">
        {trio.map((k, slot) => (
          <div
            key={k.id}
            className="ap-kh__anchor"
            style={{ left: `${ANCHORS[slot].x}%`, top: `${ANCHORS[slot].y}%` }}
          >
            <ul className="ap-kh__mount">
              <KeychainCard item={k} wall={wall} live={live} peg={false} />
            </ul>
          </div>
        ))}

        <button
          type="button"
          className="ap-kc__arrow ap-kc__arrow--prev"
          aria-label="The three keychains before these"
          onClick={() => setPage((p) => (p - 1 + pages) % pages)}
        >
          ‹
        </button>
        <button
          type="button"
          className="ap-kc__arrow ap-kc__arrow--next"
          aria-label="The next three keychains"
          onClick={() => setPage((p) => (p + 1) % pages)}
        >
          ›
        </button>
      </div>
      {live && <p className="ap-kh__hint ap-kc__hint">{wall.grab}</p>}
    </div>
  );
}
