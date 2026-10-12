"use client";

// A small, dependency-free cart held in localStorage.
//
// A line is a category plus the choices that change what gets made: which
// illustration, and — where the category offers one — which variant (a
// hoodie's size, a card format). Two sizes of one hoodie are two lines, so
// all three fields key the merge below. Prices live in lib/content.ts and are
// PLACEHOLDERS until Arpine supplies real ones; the cart never invents a
// total of its own, it only ever multiplies what is written there.

import { categories, withheldArt } from "./content";

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

export function read(): Line[] {
  if (typeof window === "undefined") return [];
  try {
    let raw = window.localStorage.getItem(KEY);
    if (raw === null) {
      // the one-time move from v1 — see OLD_KEY. Tote lines stay behind: the
      // number in them names an illustration, not one of the four bags
      const old = window.localStorage.getItem(OLD_KEY);
      if (old !== null) {
        raw = JSON.stringify(parse(old).filter((l) => l.cat !== "totes"));
        window.localStorage.setItem(KEY, raw);
        window.localStorage.removeItem(OLD_KEY);
      }
    }
    return parse(raw);
  } catch {
    return [];
  }
}

function write(lines: Line[]) {
  window.localStorage.setItem(KEY, JSON.stringify(lines));
  window.dispatchEvent(new CustomEvent(EVT));
}

const same = (a: Line, b: Pick<Line, "cat" | "art" | "variant">) =>
  a.cat === b.cat && (a.art ?? "") === (b.art ?? "") && (a.variant ?? "") === (b.variant ?? "");

export function add(cat: string, art?: string, qty = 1, variant?: string) {
  const lines = read();
  const hit = lines.find((l) => same(l, { cat, art, variant }));
  if (hit) hit.qty = Math.min(99, hit.qty + qty);
  else lines.push({ cat, art, variant, qty });
  write(lines);
}

export function setQty(cat: string, art: string | undefined, qty: number, variant?: string) {
  const lines = read()
    .map((l) => (same(l, { cat, art, variant }) ? { ...l, qty } : l))
    .filter((l) => l.qty > 0);
  write(lines);
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

/** Unit price for a line, in dram. Returns 0 for anything not yet priced. */
export function unit(cat: string) {
  return categories.find((c) => c.slug === cat)?.from ?? 0;
}

export function total(lines = read()) {
  return lines.reduce((n, l) => n + unit(l.cat) * l.qty, 0);
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
