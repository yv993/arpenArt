"use client";

// A small, dependency-free cart held in localStorage.
//
// A line is a category plus the choices that change what gets made: which
// illustration, and — where the category offers one — which variant (a
// hoodie's size, a card format). Two sizes of one hoodie are two lines, so
// all three fields key the merge below. Prices live in lib/content.ts and are
// PLACEHOLDERS until Arpine supplies real ones; the cart never invents a
// total of its own, it only ever multiplies what is written there.

import { categories, isSoldOut, withheldArt } from "./content";

export type Line = {
  /** category slug, e.g. "postcards" */
  cat: string;
  /** artwork id when the buyer chose a specific illustration */
  art?: string;
  /** buyer-chosen variant (size, format…) when the category offers one */
  variant?: string;
  qty: number;
};

const KEY = "arpenart.cart.v2";
// THE KEY BEFORE 2026-10-01. Bumped because a TOTE line's `art` changed its
// meaning that day: it had been one of the 57 illustrations (the
// choose-a-picture panel on /shop/totes, live since 2026-09-21) and became the
// BAG number, 01–04 (change 3.pdf p4 + p5; `ownItemWord.totes` in
// content.ts). Read under the new meaning, a v1 tote line is a bag the buyer
// never chose — or, for an illustration id outside 01–04, a bag that does not
// exist — with nothing on the cart page to say so. The first read on a
// returning browser carries every OTHER line across once, then empties v1.
const OLD_KEY = "arpenart.cart.v1";
const EVT = "arpenart:cart";

/** the lines in one stored value, with anything malformed or withdrawn dropped */
function parse(raw: string | null): Line[] {
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l): l is Line =>
        !!l &&
        typeof l === "object" &&
        typeof (l as Line).cat === "string" &&
        Number.isFinite((l as Line).qty) &&
        // a stored variant that is not a string (old or tampered data) would
        // poison the merge key, so such lines are dropped, not coerced
        ((l as Line).variant === undefined || typeof (l as Line).variant === "string") &&
        // an illustration the client has since withdrawn from this line
        // (`withheldArt` — the two postcards of change 3.pdf p2, 2026-10-01)
        // may still sit in a cart saved before she did; it is dropped here,
        // silently, the way the picker no longer offers it
        !withheldArt[(l as Line).cat]?.includes((l as Line).art ?? ""),
    );
  } catch {
    return [];
  }
}

// STORAGE CAN REFUSE (2026-11-03, peer review #4). With site data blocked,
// or a full or private store, localStorage throws: read() caught it, but
// write() did not, so every add() threw inside the click handler — the buy
// button did nothing and said nothing. From the first refused write the cart
// lives here, in this page's memory: it survives moving between pages (the
// app keeps its modules), not a reload or another tab. Reads come from here
// too while it lasts, so a store that still reads but cannot write does not
// hand back its stale lines. Every later write tries the store again, and the
// first one it takes ends this. A full store usually takes a SHORTER cart —
// such as the one an order leaves behind — so the lines an order took out of
// memory leave the store too, and a reload does not bring them back
// (V6-CART-3).
// KNOWN AND LEFT (2026-11-03, final check of round 9). Both need this site's
// store to be FULL, and nothing on the site fills it (the cart is ~100 bytes;
// the checkers had to stuff the store to reach these):
// - V9-CHG-1: when the page held lines the store never took, what an order
//   leaves can be longer than what is stored. Then the store keeps the
//   ordered lines, and a reload shows them again.
// - V9-CHG-2: a page in this state writes its own copy back once the store
//   has room, and so undoes a removal another tab made meanwhile.
// Nothing more is attempted: removing the stored cart (round 7) emptied every
// other tab's cart, and a per-tab "stale" mark (round 8) hid a good cart from
// the tab that set it and let its next write replace the one other tabs held.
// Each cleverer rule made the shared cart worse than the case it was for.
let memory: string | null = null;

export function read(): Line[] {
  if (typeof window === "undefined") return [];
  if (memory !== null) return parse(memory);
  try {
    let raw = window.localStorage.getItem(KEY);
    if (raw === null) {
      // the one-time move from v1 — see OLD_KEY. Tote lines stay behind: the
      // number in them names an illustration, not one of the four bags
      const old = window.localStorage.getItem(OLD_KEY);
      if (old !== null) {
        raw = JSON.stringify(parse(old).filter((l) => l.cat !== "totes"));
        try {
          window.localStorage.setItem(KEY, raw);
          window.localStorage.removeItem(OLD_KEY);
        } catch {
          // a store that cannot take the move still shows the moved cart;
          // it moves on the first write the store takes
        }
      }
    }
    return parse(raw);
  } catch {
    return [];
  }
}

function write(lines: Line[]) {
  const value = JSON.stringify(lines);
  try {
    window.localStorage.setItem(KEY, value);
    memory = null;
  } catch {
    memory = value;
  }
  window.dispatchEvent(new CustomEvent(EVT));
}

const same = (a: Line, b: Pick<Line, "cat" | "art" | "variant">) =>
  a.cat === b.cat && (a.art ?? "") === (b.art ?? "") && (a.variant ?? "") === (b.variant ?? "");

/** false (and nothing stored) when the piece is sold out — content.ts
 *  `soldOut`; the buttons say so first, this is the last word */
export function add(cat: string, art?: string, qty = 1, variant?: string): boolean {
  if (isSoldOut(cat, art, variant)) return false;
  const lines = read();
  const hit = lines.find((l) => same(l, { cat, art, variant }));
  if (hit) hit.qty = Math.min(99, hit.qty + qty);
  else lines.push({ cat, art, variant, qty });
  write(lines);
  return true;
}

export function setQty(cat: string, art: string | undefined, qty: number, variant?: string) {
  // a sold-out line saved before it sold out can go down or out, never up
  const out = isSoldOut(cat, art, variant);
  const lines = read()
    .map((l) => (same(l, { cat, art, variant }) ? { ...l, qty: out ? Math.min(qty, l.qty) : qty } : l))
    .filter((l) => l.qty > 0);
  write(lines);
}

/** true when this line's piece is sold out (content.ts `soldOut`) */
export const lineSoldOut = (l: Pick<Line, "cat" | "art" | "variant">) => isSoldOut(l.cat, l.art, l.variant);

/** the lines that must leave the cart before it can be sent */
export function soldOutLines(lines = read()) {
  return lines.filter(lineSoldOut);
}

export function remove(cat: string, art?: string, variant?: string) {
  write(read().filter((l) => !same(l, { cat, art, variant })));
}

/** Put a removed line back WHERE IT WAS — the cart page's Undo (2026-10-05).
 *  `add` appends, so an undone middle line would have come back at the foot
 *  of the list and the stored order would have changed under the buyer.
 *  If the same line was added again in the meantime, the two merge. */
export function restore(line: Line, at: number) {
  const lines = read();
  const hit = lines.find((l) => same(l, line));
  if (hit) hit.qty = Math.min(99, hit.qty + line.qty);
  else lines.splice(Math.max(0, Math.min(at, lines.length)), 0, line);
  write(lines);
}

export function clear() {
  write([]);
}

export function count(lines = read()) {
  return lines.reduce((n, l) => n + l.qty, 0);
}

/** The category's own price, in dram (0 for an unknown slug) — what one
 *  item costs when no variant says otherwise. A LINE's price is unitOf. */
export function unit(cat: string) {
  return categories.find((c) => c.slug === cat)?.from ?? 0;
}

/** A line's unit price, in dram — or null when the site does not know it.
 *  A variant priced in content.ts (`variants.prices`) costs that; null there
 *  means "Arpine confirms it by reply" (the postcards' full series set,
 *  2026-10-31: it was being charged as one card). Every other line costs
 *  its category's `from`. /api/order applies the same rule to re-price. */
export function unitOf(l: Pick<Line, "cat" | "variant">): number | null {
  const cat = categories.find((c) => c.slug === l.cat);
  if (!cat) return 0;
  const prices = cat.variants?.prices;
  if (l.variant && prices && Object.prototype.hasOwnProperty.call(prices, l.variant)) return prices[l.variant] ?? null;
  return cat.from;
}

/** a line's sum, or null when its price is Arpine's to confirm */
export function lineSum(l: Line): number | null {
  const u = unitOf(l);
  return u === null ? null : u * l.qty;
}

/** the goods that HAVE a price — an unpriced line is left out, never
 *  guessed, and so is a sold-out one: it cannot be bought */
export function total(lines = read()) {
  return lines.reduce((n, l) => n + (lineSoldOut(l) ? 0 : (lineSum(l) ?? 0)), 0);
}

/** true when some line's price is not on the site (see unitOf), so a total
 *  is only part of what the order will cost and must say so */
export function hasUnpriced(lines = read()) {
  return lines.some((l) => !lineSoldOut(l) && unitOf(l) === null);
}

/** Subscribe to cart changes (same tab and across tabs). */
export function subscribe(fn: () => void) {
  window.addEventListener(EVT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVT, fn);
    window.removeEventListener("storage", fn);
  };
}

export const dram = (n: number) => n.toLocaleString("en-US") + " ֏";
