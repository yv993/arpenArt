import { categories, ownItemWord } from "./content";

/** A cart line in words, as the buyer reads it: "Keychain no. 04",
 *  "Postcards — Illustration no. 05 (Full series set)", "Stickers (Sheet 03)".
 *  A fixed-item line names itself (the category would only repeat the noun);
 *  a choose-an-illustration line needs the category, because "Illustration
 *  no. 05" alone does not say it is a tote bag.
 *
 *  ONE RULE for the cart page and for /api/order's sold-out refusal
 *  (2026-11-02): the review found the two naming the same piece differently
 *  ("Magnet no. 01" in the cart, "Magnets (magnet no. 01)" from the server).
 *  The order MAIL keeps its own wording (route.ts labelOf), which is what
 *  Arpine's inbox already reads. Plain module, no "use client": both sides
 *  import it. */
export function lineWords(l: { cat: string; art?: string | null; variant?: string | null }): string {
  const own = ownItemWord[l.cat];
  const name = categories.find((c) => c.slug === l.cat)?.name ?? l.cat;
  const what = l.art ? (own ? `${own} no. ${l.art}` : `${name} — Illustration no. ${l.art}`) : name;
  return `${what}${l.variant ? ` (${l.variant})` : ""}`;
}

/** THE sold-out sentence (readiness #25), word for word the same in the
 *  browser (before sending) and in /api/order's 422 errors.lines. */
/** the labels a soldOutSay sentence names, in its order — null for any other
 *  words. The cart reads the server's 422 back with it, so the sentence can
 *  follow the cart in a tab older than the sold-out list (2026-11-02). No
 *  label holds ", " (checked against every category, option and sheet). */
export function soldOutNamed(said: string): string[] | null {
  const m = /^Sold out: (.+)\. Please remove (?:it|them) from your cart, then send again\.$/.exec(said);
  return m ? m[1].split(", ") : null;
}
export const soldOutSay = (labels: string[]) =>
  `Sold out: ${labels.join(", ")}. Please remove ${labels.length > 1 ? "them" : "it"} from your cart, then send again.`;
