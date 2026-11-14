"use client";

// A small, dependency-free cart held in localStorage.
//
// A line is a category plus the choices that change what gets made: which
// illustration, and — where the category offers one — which variant (a
// hoodie's size, a card format). Two sizes of one hoodie are two lines, so
// all three fields key the merge below. Prices live in lib/content.ts and are
// PLACEHOLDERS until Arpine supplies real ones; the cart never invents a
// total of its own, it only ever multiplies what is written there.

import { categories, isSoldOut, priceTbc } from "./content";
import { ART_MAX, MAX_QTY, orderLine, plainText, qtyOf, VARIANT_MAX } from "./lineRules";

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

const same = (a: Line, b: Pick<Line, "cat" | "art" | "variant">) =>
  a.cat === b.cat && (a.art ?? "") === (b.art ?? "") && (a.variant ?? "") === (b.variant ?? "");

/** identical lines folded into the first, the way /api/order merges them —
 *  their quantities added, never past MAX_QTY */
function merge(lines: Line[]): Line[] {
  const out: Line[] = [];
  for (const l of lines) {
    const hit = out.find((o) => same(o, l));
    if (hit) hit.qty = Math.min(MAX_QTY, hit.qty + l.qty);
    else out.push({ ...l });
  }
  return out;
}

/** THE LINES IN ONE STORED VALUE, AS AN ORDER WOULD RECORD THEM (review O7,
 *  L1-cart-order#2 + #3, 2026-11-13). Every rule /api/order applies that
 *  needs no item roll runs here, from the same code (lib/lineRules.ts
 *  orderLine): a category that is unknown or not open, an illustration the
 *  client withdrew (`withheldArt`), a variant the line does not offer, an
 *  Armenia Eternal piece whose kind does not match, all drop the line; a
 *  sticker sheet loses any illustration; the quantity becomes a whole number
 *  from 1 to 99; identical lines merge. Before this the cart kept its own
 *  copy of some of them (the category, the withdrawn illustrations, the
 *  Armenia Eternal kind) and not the variant or quantity rules, so a stale
 *  or hand-edited cart could show «Poster no. 01 (A3)»,
 *  a bookmark at 101 or −3, and count them in Items, while the order mail
 *  dropped the line or charged another amount. (The one rule that needs the
 *  rolls — an id the roll does not hold loses its number — is applied by the
 *  cart page: unname below.) Every write goes through read(), so what this
 *  returns is also what the next write stores. */
function parse(raw: string | null): Line[] {
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    const kept: Line[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const l = item as Record<string, unknown>;
      if (typeof l.cat !== "string" || typeof l.qty !== "number" || !Number.isFinite(l.qty)) continue;
      // a stored id or variant that is not plain text (old or tampered data)
      // would poison the merge key, or read differently on the server, so
      // such lines are dropped, not coerced — the cart never sends them.
      // A null id is no id, as it is to the server.
      const art = l.art ?? undefined;
      if (art !== undefined && (typeof art !== "string" || !plainText(art, ART_MAX))) continue;
      if (l.variant !== undefined && (typeof l.variant !== "string" || !plainText(l.variant, VARIANT_MAX))) continue;
      const line = orderLine(l.cat, art || null, (l.variant as string | undefined) || null);
      if (!line) continue;
      kept.push({ cat: line.cat.slug, art: line.art ?? undefined, variant: line.variant ?? undefined, qty: qtyOf(l.qty) });
    }
    return merge(kept);
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

/** false (and nothing stored) when the piece is sold out — content.ts
 *  `soldOut`; the buttons say so first, this is the last word */
export function add(cat: string, art?: string, qty = 1, variant?: string): boolean {
  if (isSoldOut(cat, art, variant)) return false;
  const lines = read();
  const hit = lines.find((l) => same(l, { cat, art, variant }));
  if (hit) hit.qty = Math.min(MAX_QTY, hit.qty + qty);
  else lines.push({ cat, art, variant, qty: Math.min(MAX_QTY, qty) });
  write(lines);
  return true;
}

export function setQty(cat: string, art: string | undefined, qty: number, variant?: string) {
  // a sold-out line saved before it sold out can go down or out, never up;
  // and no line goes past what an order carries (MAX_QTY, the same 99 as
  // add() and /api/order — the cart's "+" went on to 100, 101 and counted
  // them, while the order recorded 99: L1-cart-order#3)
  const out = isSoldOut(cat, art, variant);
  const lines = read()
    .map((l) => (same(l, { cat, art, variant }) ? { ...l, qty: Math.min(MAX_QTY, out ? Math.min(qty, l.qty) : qty) } : l))
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
  if (hit) hit.qty = Math.min(MAX_QTY, hit.qty + line.qty);
  else lines.splice(Math.max(0, Math.min(at, lines.length)), 0, line);
  write(lines);
}

/** AN ITEM NUMBER THE LINE'S ROLL DOES NOT HOLD LEAVES THE LINE — the cart
 *  page's copy of /api/order's rule (review O7, L1-cart-order#2, 2026-11-13).
 *  `named` is lib/lineIds.ts nameable, passed in because this module rides
 *  on every page and must not carry the rolls. The server keeps such a line
 *  at its category's price but sends it without a number; the cart showed
 *  «Bookmark no. 28» with another design's picture. Stored, not only drawn,
 *  so Remove and the quantity buttons still find the line, and identical
 *  lines it leaves behind merge as the server merges them. Writes only when
 *  something changed. Returns the lines as the order will record them. */
export function unname(named: (cat: string, art: string) => boolean): Line[] {
  const lines = read();
  const ok = (l: Line) => !l.art || named(l.cat, l.art);
  if (lines.every(ok)) return lines;
  const next = merge(lines.map((l) => (ok(l) ? l : { ...l, art: undefined })));
  write(next);
  return next;
}

export function clear() {
  write([]);
}

export function count(lines = read()) {
  return lines.reduce((n, l) => n + l.qty, 0);
}

/** The category's own price, in dram — what one item costs when no variant
 *  says otherwise — or null when the site does not know it (a null `from`,
 *  or an unknown slug). A LINE's price is unitOf. */
export function unit(cat: string): number | null {
  return categories.find((c) => c.slug === cat)?.from ?? null;
}

/** A line's unit price, in dram — or null when the site does not know it.
 *  A variant priced in content.ts (`variants.prices`) costs that; null there
 *  means "Arpine confirms it by reply" (the postcards' full series set,
 *  2026-10-31: it was being charged as one card). Every other line costs
 *  its category's `from`. /api/order applies the same rule to re-price.
 *  An unknown slug is null too, like unit() — it was 0, which would print
 *  «0 ֏» and add nothing (L8-hostile-code#8); parse() drops such a line
 *  before any caller sees it, and every caller already handles null. */
export function unitOf(l: Pick<Line, "cat" | "variant">): number | null {
  const cat = categories.find((c) => c.slug === l.cat);
  if (!cat) return null;
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

/** a price as a page prints it: "1,500 ֏" — or, when the site does not know
 *  it (a null `from` or variant price), content.ts `priceTbc`, «Price
 *  confirmed by Arpine» */
export const priceText = (n: number | null) => (n === null ? priceTbc : dram(n));
