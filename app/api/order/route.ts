import artworks from "@/lib/artworks.json";
import products from "@/lib/products.json";
import {
  brand,
  categories,
  delivery,
  isSoldOut,
  ownItemMedia,
  ownItemWord,
  scarfDesigns,
  stickerSheets,
  withheldArt,
  type Category,
} from "@/lib/content";
import { lineWords, soldOutSay } from "@/lib/lineWords";
import { origin as site } from "@/lib/site";
import { botCheck, caught, clean, intake, reply } from "@/lib/server/intake";
import { deadlineOf, deliver } from "@/lib/server/mail";
import { randomBytes, randomInt } from "node:crypto";

// Zero-dependency order intake.
//
// It NEVER trusts a price from the browser: the client sends only which
// category, which illustration or item, and which variant, and the total is
// recomputed here from the server's own copy of the catalogue. Every one of
// those three is checked against what that line can actually send (readiness
// #6, 2026-10-31) — the variant used to be free text that went straight into
// the buyer's copy, i.e. into a mail to any address the form named.
//
// It also never claims delivery it did not achieve: with nothing configured
// it returns delivered:false and the UI says so plainly. The sending rules
// (both channels; the buyer's copy only after a delivery, only from a
// verified sender and only while Turnstile is enforced; timeouts, retry,
// idempotency, the deadline) live in lib/server/mail.ts.

export const runtime = "nodejs";
// Vercel's limit for this function, and the source of its DEADLINE
// (deadlineOf: 60 s less a 10 s margin = 50 s from the request's start).
// Unbounded, the worst case is siteverify 16.4 s + (webhook 24.4 ‖ Resend to
// Arpine 25.9) + the buyer's copy 25.9 = 68.2 s; under the deadline every
// attempt is cut to the time left, so the route ends by ~50 s and only the
// buyer's copy can be shortened or skipped (lib/server/mail.ts, TIME).
export const maxDuration = 60;

type Shot = { id: string; src: string };
const P = products as unknown as Record<string, Shot[]>;
const ART = artworks as unknown as Shot[];
const artIds = new Set(ART.map((a) => a.id));

/** A cart merges identical lines, so forty different ones is already a big
 *  order; the cap keeps a crafted request from mailing Arpine a novel. */
const MAX_LINES = 40;
const TOO_MANY = "That is more than one order can carry — please split it into two.";
const REF_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** The variant labels a line of this category can legitimately carry — every
 *  cart `add(…)` call site, checked 2026-10-31: the picker options
 *  (CategoryView, ScarfDesigns, the cloud's "Single card"), and for stickers
 *  the sheet names StickerFolders sends. Everything else sends none. */
const variantsOf = (cat: Category): readonly string[] =>
  cat.slug === "stickers" ? stickerSheets.sheets.map((s) => s.name) : (cat.variants?.options ?? []);

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

/** Unit price in dram for one line (readiness #7). A variant with its own
 *  entry in `variants.prices` costs that; null there means the price is not on
 *  the site and Arpine confirms it by reply — such a line is never counted in
 *  a total. No entry: the category's `from`. Read through a cast so this file
 *  compiles before and after `prices` joins the Category type. */
function priceOf(cat: Category, variant: string | null): number | null {
  const prices = (cat.variants as { prices?: Record<string, number | null> } | undefined)?.prices;
  if (variant && prices && Object.prototype.hasOwnProperty.call(prices, variant)) {
    const p = prices[variant];
    return typeof p === "number" && Number.isFinite(p) ? p : null;
  }
  return cat.from;
}

/** THE PICTURE THE BUYER CHOSE, as an absolute link for the order mail
 *  (readiness #26 — the mail named items by number only). The same
 *  resolution as CartView's thumbOf, but the full-size file: an own item in
 *  its own roll (a scarf design by its flat print), a sticker sheet by its
 *  print, anything else by its illustration. Nothing resolvable → no link,
 *  rather than the roll's first photograph standing in for the wrong item. */
function pictureOf(cat: Category, art: string | null, variant: string | null): string | null {
  let path: string | undefined;
  if (ownItemWord[cat.slug]) {
    const id = cat.slug === "scarves" ? scarfDesigns.designs.find((d) => d.id === art)?.shots[0] : art;
    path = id ? P[ownItemMedia[cat.slug] ?? cat.media]?.find((s) => s.id === id)?.src : undefined;
  } else if (cat.slug === "stickers" && variant) {
    const print = stickerSheets.sheets.find((s) => s.name === variant)?.shots[0];
    path = print ? P[cat.media]?.find((s) => s.id === print)?.src : undefined;
  } else if (art) {
    path = ART.find((a) => a.id === art)?.src;
  }
  return path ? site + path : null;
}

type OrderLine = {
  slug: string;
  name: string;
  art: string | null;
  variant: string | null;
  qty: number;
  /** dram each; null = "price confirmed by Arpine", never added to a total */
  unit: number | null;
  sum: number | null;
  picture: string | null;
  page: string;
};

/** A line as the order mail names it — "Postcards [Single card]
 *  (illustration no. 05)". The word next to the id must match the id's OWN
 *  numbering (ownItemWord): "(illustration 12)" on a magnet order would send
 *  Arpine to a different picture than the one the buyer chose. One rendering
 *  for the mail and the buyer's copy, so both say the same thing about the
 *  same line. (The sold-out refusal speaks the CART's words instead —
 *  lib/lineWords.ts — because the buyer reads it next to the cart.) */
const labelOf = (l: OrderLine) =>
  `${l.name}${l.variant ? ` [${l.variant}]` : ""}${
    l.art ? ` (${(ownItemWord[l.slug] ?? "illustration").toLowerCase()} no. ${l.art})` : ""
  }`;

/** THE SOLD-OUT REFUSAL (readiness #25, 2026-11-01) — word for word the
 *  sentence the cart shows before sending, each line named the way the cart
 *  names it (lib/lineWords.ts, shared since 2026-11-02 so the two cannot
 *  drift). It matters most for a tab older than the `soldOut` entry: its
 *  bundle still thinks the piece is on sale, so this answer is the only one
 *  it gets. */
const soldOutSentence = (gone: OrderLine[]) =>
  soldOutSay(gone.map((l) => lineWords({ cat: l.slug, art: l.art, variant: l.variant })));

export async function POST(req: Request) {
  // every outbound call below is cut to fit this (lib/server/mail.ts, TIME)
  const deadline = deadlineOf(maxDuration);
  const gate = await intake(req, { bucket: "order", busy: "Too many requests. Try again shortly.", site });
  if (gate.res) return gate.res;
  const { body, ip } = gate;

  // honeypot — accept, then quietly drop
  if (caught(body)) return reply({ ok: true, delivered: false, copied: false, ref: "" });

  const name = clean(body.name, 120);
  const email = clean(body.email, 160);
  const phone = clean(body.phone, 40);
  const note = clean(body.note, 1200);

  // Delivery: the browser sends only WHICH service, and the price comes from
  // the server's own table — the same rule the products follow, so a forged
  // postage figure is impossible. An unknown id is rejected rather than
  // guessed at, since guessing could silently discard a typed address.
  const shipId = clean(body.ship, 20);
  const ship = delivery.options.find((o) => o.id === shipId);
  const address = clean(body.address, 240);
  const city = clean(body.city, 90);
  const postcode = clean(body.postcode, 24);
  const country = clean(body.country, 90);

  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = "Please give a name.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = "That email does not look right.";
  // deliberately loose: Armenian, Russian and every diaspora format has to
  // pass, so this only asks for enough digits to be dialled
  if (phone.replace(/\D/g, "").length < 6) errors.phone = "Please give a phone number Arpine can reach you on.";
  if (!ship) errors.ship = "Please choose how it should reach you.";
  if (ship?.address) {
    if (address.length < 4) errors.address = "Please give the street address.";
    if (city.length < 2) errors.city = "Please give the city or town.";
    if (country.length < 2) errors.country = "Please give the country.";
  }

  const raw: unknown[] = Array.isArray(body.lines) ? body.lines : [];
  // identical lines are merged (a cart never sends two, a crafted body may),
  // so the cap below counts what Arpine would actually read
  const merged = new Map<string, OrderLine>();
  // a raw list this long is refused before any of it is looked at
  if (raw.length > MAX_LINES * 5) errors.lines = TOO_MANY;
  else
    for (const item of raw) {
      // `lines: [null]` and friends used to throw here and come back a 500
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const l = item as Record<string, unknown>;
      const cat = categories.find((c) => c.slug === clean(l.cat, 40) && c.status === "open");
      if (!cat) continue;
      // Number() on a crafted object can throw, so only a number or a string is read
      const q = typeof l.qty === "number" ? l.qty : typeof l.qty === "string" ? Number(l.qty) : 0;
      const qty = Math.max(1, Math.min(99, Math.floor(q || 0)));
      let art = clean(l.art, 8) || null;
      // an illustration the client withdrew from this line (`withheldArt`,
      // change 3.pdf p2, 2026-10-01) is refused the way an unknown category
      // is: the line is dropped, so a cart saved before the withdrawal — or
      // a hand-made request — cannot put it in front of Arpine as an order
      if (art && withheldArt[cat.slug]?.includes(art)) continue;
      // AN ID THE LINE CANNOT NAME IS NOT NAMED. An own-item line's `art` is
      // its own numbering (a TOTE line's has been a bag number since
      // 2026-10-01, change 3.pdf p4 + p5); every other line's is one of the
      // 57 illustrations. Anything else — a cart saved under an older
      // meaning, or a hand-made request — keeps the line (its price is the
      // category's either way) but reaches Arpine without a number rather
      // than as an item she never made. The browser drops the v1 totes itself
      // (lib/cart.ts); this is the server's own copy of the rule.
      if (art && !(ownItemWord[cat.slug] ? ownIds.get(cat.slug)?.has(art) : artIds.has(art))) art = null;
      // the variant must be one this category offers; an unknown one drops
      // the line rather than guessing which product was meant
      const variant = clean(l.variant, 60) || null;
      if (variant && !variantsOf(cat).includes(variant)) continue;
      // a sticker SHEET is the whole product — it never carries an illustration
      if (cat.slug === "stickers" && variant) art = null;
      const key = `${cat.slug}|${art ?? ""}|${variant ?? ""}`;
      const hit = merged.get(key);
      if (hit) {
        hit.qty = Math.min(99, hit.qty + qty);
        continue;
      }
      merged.set(key, {
        slug: cat.slug,
        name: cat.name,
        art,
        variant,
        qty,
        unit: priceOf(cat, variant),
        sum: null,
        picture: pictureOf(cat, art, variant),
        page: `${site}/shop/${cat.slug}`,
      });
    }
  const lines = [...merged.values()].map((l) => ({ ...l, sum: l.unit === null ? null : l.unit * l.qty }));

  if (!errors.lines) {
    // A SOLD-OUT PIECE (content.ts `soldOut`) is refused, never dropped
    // quietly: the buyer chose it, so the order must not reach Arpine
    // without it while they believe it is in there. Judged on the line as
    // this order names it (after the checks above), so the refusal names
    // exactly what the mail would have. With the other 422s, i.e. before the
    // bot check: no token is spent on an order that cannot go.
    const gone = lines.filter((l) => isSoldOut(l.slug, l.art ?? undefined, l.variant ?? undefined));
    if (!lines.length) errors.lines = "Your cart is empty.";
    else if (lines.length > MAX_LINES) errors.lines = TOO_MANY;
    else if (gone.length) errors.lines = soldOutSentence(gone);
  }
  if (Object.keys(errors).length) return reply({ ok: false, errors }, 422);

  // the bot check comes last, so a token is spent only on a request that
  // would otherwise be accepted (lib/server/intake.ts)
  const blocked = await botCheck(body, ip, deadline, "order");
  if (blocked) return blocked;

  // a line without a price on the site is left out of every figure below
  const goods = lines.reduce((n, l) => n + (l.sum ?? 0), 0);
  const unpriced = lines.filter((l) => l.unit === null);
  // ship is proven non-null above: a missing one is a 422 before this point
  const post = ship!.price;
  const total = goods + post;
  // five characters a buyer can read back over the phone (no 0/O, 1/I)
  const ref = "AR-" + Array.from({ length: 5 }, () => REF_CHARS[randomInt(REF_CHARS.length)]).join("");

  // one rendering of the lines, used by both the artist's and the buyer's copy
  // (labelOf). The picture link under it is the one the buyer was looking
  // at; the page link is the product's shop page.
  const lineText = lines.flatMap((l) => [
    `  ${l.qty} x ${labelOf(l)} — ${l.sum === null ? "price confirmed by Arpine" : `${l.sum} AMD`}`,
    ...(l.picture ? [`      Picture: ${l.picture}`] : []),
    `      Page: ${l.page}`,
  ]);

  // the delivery half, rendered once for both copies
  const shipText = [
    `Delivery: ${ship!.label} — ${post ? post + " AMD" : "free"} (${ship!.eta})`,
    ...(ship!.address
      ? [`  ${address}`, `  ${[postcode, city].filter(Boolean).join(" ")}`, `  ${country}`]
      : []),
  ];

  // what the total leaves out, said where the total is
  const plus = !unpriced.length
    ? ""
    : unpriced.every((l) => /\bset\b/i.test(l.variant ?? ""))
      ? " + the set price, confirmed by Arpine"
      : " + the price of the lines marked above, confirmed by Arpine";
  const money = [`Items: ${goods} AMD`, `Delivery: ${post} AMD`, `TOTAL: ${total} AMD${plus}`];

  const summary = [
    `ArpenArt order ${ref}`,
    `${name} <${email}>`,
    `Phone: ${phone}`,
    "",
    ...lineText,
    "",
    ...money,
    "",
    ...shipText,
    note ? `\nNote: ${note}` : "",
  ].join("\n");

  const to = process.env.ORDER_TO_EMAIL;
  const out = await deliver({
    key: `order-${ref}-${randomBytes(4).toString("hex")}`,
    deadline,
    webhook: {
      url: process.env.ORDER_WEBHOOK_URL,
      payload: {
        ref,
        name,
        email,
        phone,
        note,
        consent: body.consent === true,
        lines,
        goods,
        unpriced: unpriced.length,
        delivery: { id: ship!.id, label: ship!.label, price: post },
        total,
        ...(ship!.address ? { address, city, postcode, country } : {}),
      },
    },
    owner: to ? { to, replyTo: email, subject: `Order ${ref} — ${name}`, text: summary } : undefined,
    // The buyer's copy repeats the site's one promise — nothing is charged
    // yet. It goes out only once Arpine's copy did, and only while Turnstile
    // is on (deliver() decides). Its reply-to is Arpine's inbox; with the
    // webhook as the only channel (ORDER_TO_EMAIL unset, 2026-11-01) it is
    // the shop's public address instead — the copy invites a reply, and
    // without one that reply would land in MAIL_FROM's mailbox, which may
    // not exist.
    copy: {
      to: email,
      replyTo: to || brand.email,
      subject: `Your ArpenArt order ${ref}`,
      text: [
        `Thank you — this is a copy of your order request ${ref}.`,
        "",
        "Nothing has been charged. Arpine will reply herself to confirm",
        "availability, the final total and the postage — you pay only after",
        "that confirmation.",
        "",
        ...lineText,
        "",
        ...money,
        "",
        ...shipText,
      ].join("\n"),
    },
  });

  // Nothing got through: this log line is the only copy of the order, so it
  // stays whole. One channel down while the other worked: say which, and no
  // personal data, since the order itself did arrive.
  if (!out.delivered) console.log("[arpenart order — NOT DELIVERED]\n" + summary);
  else if (out.webhook === false || out.email === false) {
    console.warn(`[arpenart order ${ref}] delivered, but ${out.webhook === false ? "the webhook" : "the email"} failed`);
  }
  // `copied` is reported honestly so the UI only mentions the buyer's email
  // copy when it actually went out
  return reply({ ok: true, delivered: out.delivered, copied: out.copied, ref });
}
