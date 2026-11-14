import artworks from "./artworks.json";
import products from "./products.json";
import { categories, ownItemMedia, ownItemWord, scarfDesigns } from "./content";

// WHICH ITEM IDS A LINE CAN NAME — one copy, read by /api/order (which
// un-names any other id before the order goes) and by the cart page (which
// does the same to the stored cart first, lib/cart.ts unname), so the line
// the buyer sees is the line Arpine's mail names (review O7, L1-cart-order#2,
// 2026-11-13: a stored «Bookmark no. 28» showed in the cart with another
// design's picture while the mail said only «Bookmarks»). Split from
// lib/lineRules.ts because it needs the item rolls: the cart page and the
// order route import these two JSON files anyway; the cart badge on every
// other page must not.

type Shot = { id: string };
const P = products as unknown as Record<string, Shot[]>;
const artIds = new Set((artworks as unknown as Shot[]).map((a) => a.id));

/** The ids an OWN-ITEM line (ownItemWord) may name — its own roll, never the
 *  57 illustrations: the scarves' three designs, the four tote bags
 *  (ownItemMedia), the magnets', keychains' and 3D stickers' photographs. */
const ownIds = new Map(
  categories
    .filter((c) => ownItemWord[c.slug])
    .map((c) => [
      c.slug,
      new Set(
        c.slug === "scarves"
          ? scarfDesigns.designs.map((d) => d.id)
          : (P[ownItemMedia[c.slug] ?? c.media] ?? []).map((s) => s.id),
      ),
    ]),
);

/** true when `art` names an item of this line: an own-item line's id in its
 *  own roll, any other line's id among the 57 illustrations */
export const nameable = (slug: string, art: string) =>
  ownItemWord[slug] ? !!ownIds.get(slug)?.has(art) : artIds.has(art);
