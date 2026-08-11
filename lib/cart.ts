"use client";

// A small, dependency-free cart held in localStorage.
//
// A line is a category plus the choices that change what gets made: which
// illustration, and — where the category offers one — which variant (a
// hoodie's size, a card format). Two sizes of one hoodie are two lines, so
// all three fields key the merge below. Prices live in lib/content.ts and are
// PLACEHOLDERS until Arpine supplies real ones; the cart never invents a
// total of its own, it only ever multiplies what is written there.

import { categories } from "./content";

export type Line = {
  /** category slug, e.g. "postcards" */
  cat: string;
  /** artwork id when the buyer chose a specific illustration */
  art?: string;
  /** buyer-chosen variant (size, format…) when the category offers one */
  variant?: string;
  qty: number;
};

const KEY = "arpenart.cart.v1";
const EVT = "arpenart:cart";

export function read(): Line[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
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
        ((l as Line).variant === undefined || typeof (l as Line).variant === "string"),
    );
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
