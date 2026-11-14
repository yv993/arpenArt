import { categories, ETERNAL, eternalLineOk, stickerSheets, withheldArt, type Category } from "./content";

// THE RULES A CART LINE PASSES TO BE ORDERED — one copy, read by the browser
// (lib/cart.ts parse) and by /api/order (review O7, L1-cart-order#2 + #3,
// 2026-11-13). Each kept its own copy before, and they drifted: the server
// dropped a line whose variant its category does not offer and recorded any
// quantity as a whole number from 1 to 99, while the cart showed and counted
// such lines as they were stored. A stale or hand-edited cart could then show
// «Poster no. 01 (A3)», or a bookmark at 101, and an Items total the order
// mail never had. Now what the cart shows and counts is what the order sends,
// and what the order sends is what it records.
//
// Plain module, no "use client": both sides import it. Only lib/content.ts
// stands behind it, because the cart badge on every page reaches this through
// lib/cart.ts — so the item rolls (products.json, artworks.json) stay out. The
// one rule that needs them, an item id the line's roll does not hold, is
// lib/lineIds.ts; the cart page applies it (lib/cart.ts unname).

/** the most of one line an order carries — the cart's "+" stops here */
export const MAX_QTY = 99;

/** a quantity as an order records it: a whole number from 1 to MAX_QTY */
export const qtyOf = (q: number) => Math.max(1, Math.min(MAX_QTY, Math.floor(q || 0)));

/** how much of each field /api/order reads (its `clean(…, max)`) */
export const CAT_MAX = 40;
export const ART_MAX = 8;
export const VARIANT_MAX = 60;

/** true when /api/order reads this text exactly as it is: its clean() turns
 *  control characters into spaces, trims and caps, so text that passes here
 *  comes through it unchanged. The cart keeps only such text, so the line it
 *  shows is the line the server reads. */
export const plainText = (s: string, max: number) =>
  s.length <= max && s === s.trim() && !/[\u0000-\u001f\u007f]/.test(s);

/** The variant labels a line of this category can legitimately carry — every
 *  cart `add(…)` call site, checked 2026-10-31: the picker options
 *  (CategoryView, ScarfDesigns, the cloud's "Single card"), and for stickers
 *  the sheet names StickerFolders sends. Everything else sends none. */
export const variantsOf = (cat: Category): readonly string[] =>
  cat.slug === "stickers" ? stickerSheets.sheets.map((s) => s.name) : (cat.variants?.options ?? []);

/** ONE LINE THROUGH THE ORDER'S RULES, once its text is read: the line as an
 *  order records it, or null when the order leaves it out. `named` says
 *  whether `art` is an id the line's own roll holds (lib/lineIds.ts); the
 *  cart's parse() has no rolls and leaves it out, and the cart page applies
 *  it afterwards. A line that passes without `named` passes with it too (an
 *  id that loses its number fails no later rule), so the cart never keeps a
 *  line the order would leave out. */
export function orderLine(
  slug: string,
  art: string | null,
  variant: string | null,
  named?: (slug: string, art: string) => boolean,
): { cat: Category; art: string | null; variant: string | null } | null {
  // A LINE THAT CANNOT BE ORDERED LEAVES (change 5, 2026-11). A cart saved
  // while cups, plates and puzzles still had tiles (before 2026-09-15 they
  // could be added) kept such a line: the badge counted it, the total charged
  // its old `from`, and /api/order dropped it without a word — so Arpine's
  // mail lacked a line the buyer saw. A category that is unknown or not open
  // is dropped, silently; it also covers any line removed or paused later.
  const cat = categories.find((c) => c.slug === slug && c.status === "open");
  if (!cat) return null;
  // an illustration the client withdrew from this line (`withheldArt`,
  // change 3.pdf p2, 2026-10-01) is refused the way an unknown category is:
  // the line is dropped, so a cart saved before the withdrawal — or a
  // hand-made request — cannot put it in front of Arpine as an order
  if (art && withheldArt[cat.slug]?.includes(art)) return null;
  // AN ID THE LINE CANNOT NAME IS NOT NAMED. An own-item line's `art` is its
  // own numbering (a TOTE line's has been a bag number since 2026-10-01,
  // change 3.pdf p4 + p5); every other line's is one of the 57
  // illustrations. Anything else — a cart saved under an older meaning, or a
  // hand-made request — keeps the line (its price is the category's either
  // way) but reaches Arpine without a number rather than as an item she
  // never made. The browser drops the v1 totes itself (lib/cart.ts).
  if (art && named && !named(cat.slug, art)) art = null;
  // the variant must be one this category offers; an unknown one drops the
  // line rather than guessing which product was meant
  if (variant && !variantsOf(cat).includes(variant)) return null;
  // AN ARMENIA ETERNAL PIECE AND ITS KIND MUST AGREE (change 5, 2026-11).
  // The page sets both: `art` the piece id (sq03), `variant` its kind
  // (Square postcard), and the kind alone prices the line. A line with no
  // kind, or whose id names another kind, would let a runner be ordered at a
  // postcard's price once the kinds are priced — it names no product, so it
  // is dropped, like an unknown variant. An id the roll does not hold was
  // already un-named above; its kind still says what to make.
  if (cat.slug === ETERNAL && !eternalLineOk(art, variant)) return null;
  // a sticker SHEET is the whole product — it never carries an illustration
  if (cat.slug === "stickers" && variant) art = null;
  return { cat, art, variant };
}
