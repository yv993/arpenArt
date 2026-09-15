"use client";

import { useEffect, useRef, useState } from "react";
import HangingKeychainDisplay from "./HangingKeychainDisplay";
import { add, dram } from "@/lib/cart";
import { flyToCart } from "@/lib/fly";
import type { Keychain, KeychainWall } from "@/types/keychain";

// ============================================================================
// THE KEYCHAIN SHOWROOM — the walnut board, then the rack.
//
// Fourth pass (client 2026-09-01, with the render pair: "use first and 3rd
// images to replace existing hangers … keep movement logic"). The endless
// carousel is REPLACED by HangingKeychainDisplay: the client's photographed
// walnut wall with brass hooks, three keychains hanging on the three
// plate-hooks at measured anchor points, paged three at a time by the
// arrows. What "keep movement logic" kept is the keychain's own physics —
// KeychainCard is untouched: the idle sway, the drag-to-turn with the
// elastic spring-back, the glare and the travelling shadow all ride along
// into the new display.
//
// The carousel (doubled-track marquee, background-drag slide, ghost copies)
// was deleted with its markup, not parked: its logic lived HERE and this
// file's history is the transcript. The 3D stage removed earlier the same
// day stays parked on disk (Keychain3D.tsx / KeychainStage.tsx,
// unreferenced) — that one was never superseded, only switched off.
//
// live=false (phone, reduced motion, no JS): the board still shows, the
// keychains hang still, the arrows still page — paging is not motion — and
// the rack below carries the whole line for comfortable buying.
// ============================================================================

const GATE = "(min-width: 861px) and (hover: hover) and (prefers-reduced-motion: no-preference)";

export default function KeychainSection({
  items,
  wall,
  heading = "h2",
}: {
  items: Keychain[];
  wall: KeychainWall;
  /** the page decides whether this block carries its h1 */
  heading?: "h1" | "h2";
}) {
  const [live, setLive] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const addedTimer = useRef(0);

  useEffect(() => {
    // no `(scripting: enabled)` here — inside an effect it is a tautology, and
    // on browsers without the `scripting` media feature the unknown query is
    // `not all` and would kill the live layer. See MagnetFridge.tsx.
    if (typeof window === "undefined") return;
    if (!window.matchMedia(GATE).matches) return;
    setLive(true);
  }, []);

  useEffect(() => () => window.clearTimeout(addedTimer.current), []);

  const H = heading;
  // the board shows three at a time now, so the rack below carries the WHOLE
  // line — with a rotating trio, "everything except the first three" stopped
  // meaning anything
  const racked = items;

  const rackBuy = (id: string, from: HTMLElement) => {
    add("keychains", id, 1);
    flyToCart(from.closest("li")?.querySelector("img"));
    setAdded(id);
    window.clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => setAdded((p) => (p === id ? null : p)), 2600);
  };

  return (
    <section className="ap-kc" data-live={live || undefined} aria-labelledby="ap-kc-title">
      {/* the room: warm pools of light and soft bokeh over a charcoal wall.
          Purely decorative, so it is drawn in CSS and announced to nobody. */}
      <div className="ap-kc__room" aria-hidden />

      <div className="ap-kc__head">
        <p className="ap-kicker">{wall.kicker}</p>
        <H className="ap-h2 ap-kc__title" id="ap-kc-title" data-tfx="rise">
          {wall.title}
        </H>
        {wall.copy.map((t) => (
          <p className="ap-lede" key={t}>
            {t}
          </p>
        ))}
        <p className="ap-kc__from">
          <strong>1,000 ֏</strong> each
        </p>
      </div>

      {/* ---- the walnut board: three on the photographed brass hooks ------ */}
      <HangingKeychainDisplay items={items} wall={wall} live={live} />

      {/* ---- the rack: the line again as light cards, the plain surface --- */}
      <ul className="ap-kc__rack">
        {racked.map((k) => (
          <li key={k.id} className="ap-kc__rackcell">
            <img src={k.thumb} alt={`${k.title} — acrylic keychain by Arpine Baroyan`} width={k.w} height={k.h} loading="lazy" decoding="async" />
            <button type="button" className="ap-kc__rackadd" onClick={(e) => rackBuy(k.id, e.currentTarget)}>
              {wall.add}
            </button>
            <p className="ap-kc__rackname">
              {k.title} · {dram(1000)}
            </p>
            <p className="ap-kc__added" role="status">
              {added === k.id ? wall.added : ""}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
