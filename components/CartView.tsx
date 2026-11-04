"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { brand, categories, delivery, home, ownItemMedia, ownItemWord, scarfDesigns, stickerSheets } from "@/lib/content";
import {
  clear,
  dram,
  hasUnpriced,
  lineSoldOut,
  lineSum,
  read,
  remove,
  restore,
  setQty,
  soldOutLines,
  subscribe,
  total,
  unitOf,
  type Line,
} from "@/lib/cart";
import { OrderingSteps } from "@/components/CategoryView";
import Turnstile, { botCheckWords, tickWords, turnstileToken } from "@/components/Turnstile";
import { lineWords, soldOutNamed, soldOutSay } from "@/lib/lineWords";
import artworks from "@/lib/artworks.json";
import products from "@/lib/products.json";

type Art = { id: string; thumb: string; w: number; h: number; avg: string };
type Shot = { id: string; thumb: string; w: number; h: number; avg: string };
const ART = artworks as Art[];
const P = products as Record<string, Shot[]>;

/** sent: delivered to Arpine · logged: NOT delivered, cart kept · handed:
 *  the buyer sent it from their own mail and emptied the cart themselves */
type State = "idle" | "sending" | "sent" | "logged" | "handed" | "error";

/** the fields a Return can move between: typed ones only — never a radio or
 *  the consent box — and never the hidden honeypot (tabIndex -1) */
const TEXT_FIELDS = 'input:not([type="radio"]):not([type="checkbox"]):not([tabindex="-1"]), textarea';

/** the word a line with no price on the site wears (lib/cart.ts unitOf) */
const TBC = "Price confirmed by Arpine";
/** the sentence under a total that leaves such lines out */
const notIncluded = (labels: string[]) =>
  `Not included in the total: ${labels.join("; ")} — Arpine confirms ${labels.length > 1 ? "those prices" : "that price"} when she replies.`;
// THE ONE SENTENCE for a cart that still holds sold-out pieces (readiness
// #25) and the words for a line both come from lib/lineWords.ts, which
// /api/order imports too — so its 422 errors.lines is word for word this.

/** the same rule as /api/order and /api/contact */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const SIGNIN = process.env.NEXT_PUBLIC_SIGNIN === "1";

/** what was ordered, frozen at the moment of sending */
type Receipt = {
  /** sum null = price confirmed by Arpine, never in a total */
  lines: { label: string; qty: number; sum: number | null }[];
  goods: number;
  shipLabel: string;
  shipPrice: number;
  /** the labels of the lines left out of `goods` */
  unpriced: string[];
  /** only for the fallback email the buyer sends themselves */
  who: string[];
  /** the buyer's own address — in the copied text, which may travel by any
   *  messenger (an email already carries it as its sender) */
  email: string;
};

/** what the buyer typed, so "Back to the cart" brings the form back filled —
 *  and Undo, or a cart refilled from another tab (see `formAt`) */
const FIELDS = ["name", "email", "phone", "address", "city", "postcode", "country", "note"] as const;
/** `consent`: the box as the buyer left it, when the form left the page
 *  (`formAt`). Absent on the not-sent screen's draft (and an older stored
 *  one), where the buyer had ticked it to get there. */
type Words = Record<(typeof FIELDS)[number], string>;
type Draft = Words & { consent?: boolean };

/** THE NOT-SENT SCREEN SURVIVES A RELOAD (readiness audit 2026-10-31, #3).
 *  A phone that leaves for its mail app may come back to a reloaded tab; the
 *  cart is kept either way, but the reference and the written-out order would
 *  be gone. Per tab (sessionStorage), and only while the cart still holds
 *  exactly the lines that were ordered — `sig` — so a changed cart never
 *  wears an old receipt. */
const PENDING = "arpenart.notsent.v1";
/** `ship`: the delivery chosen (2026-11-01, CLIENT-2) — without it, coming
 *  back to the cart from a restored screen silently switched "Post within
 *  Armenia" to the Yerevan courier and LOWERED the total. Optional: a tab
 *  may hold one stored before it existed. */
/** `emptied`: the cart went empty while the not-sent screen stood (see the
 *  [state, lines] effect) — only then is an empty cart a reason to bring the
 *  screen back on a reload (2026-11-03, V7R-5 / V8R-3). */
type Pending = { ref: string; receipt: Receipt; draft: Draft; sig: string; ship?: string; emptied?: boolean };
const sigOf = (lines: Line[]) => JSON.stringify(lines.map((l) => [l.cat, l.art ?? "", l.variant ?? "", l.qty]));
/** the lines a sig was taken from — null when it cannot be read */
const linesOf = (sig: string): [string, string, string, number][] | null => {
  try {
    const v = JSON.parse(sig) as unknown;
    return Array.isArray(v) &&
      v.every((t) => Array.isArray(t) && t.length === 4 && t.slice(0, 3).every((s) => typeof s === "string") && Number.isFinite(t[3]))
      ? (v as [string, string, string, number][])
      : null;
  } catch {
    return null;
  }
};
/** the server named sold-out pieces that had already left the cart while
 *  its answer travelled: the order still did not go (2026-11-02, NF-2) */
const soldGone = (n: number) =>
  n > 1
    ? "The sold-out pieces are out of your cart now. Please send again."
    : "The sold-out piece is out of your cart now. Please send again.";
const forget = () => {
  try {
    window.sessionStorage.removeItem(PENDING);
  } catch {}
};

/** the order in words — the fallback email's body and the copied text */
function orderText(r: Receipt, ref: string, withEmail: boolean) {
  return [
    ...(ref ? [`Order reference: ${ref}`, ""] : []),
    ...r.lines.map((l) => `${l.qty} × ${l.label} — ${l.sum === null ? "price confirmed by Arpine" : dram(l.sum)}`),
    `Delivery — ${r.shipLabel}: ${r.shipPrice ? dram(r.shipPrice) : "Free"}`,
    `Total: ${dram(r.goods + r.shipPrice)}`,
    ...(r.unpriced.length ? [notIncluded(r.unpriced)] : []),
    "",
    ...r.who,
    ...(withEmail && r.email ? [`Email: ${r.email}`] : []),
  ].join("\n");
}

export default function CartView() {
  const [lines, setLines] = useState<Line[]>([]);
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<State>("idle");
  const [ref, setRef] = useState("");
  // the API's 422 shape: { errors: { field: message } } — same as /api/contact
  const [errors, setErrors] = useState<Record<string, string>>({});
  // true only when the server says the buyer's copy actually went out; the
  // done screen never claims an email that was not sent
  const [copied, setCopied] = useState(false);
  // THE ENDING HAD FORGOTTEN THE ORDER (UX laws M4 + M7, 2026-09-15). A
  // successful send calls clear(), so by the time "Order received" rendered
  // the cart was empty and the screen named nothing that had been bought.
  // Worst in the honest fallback — no email transport configured — which
  // told the buyer to "also send it directly" to Arpine, from a page that
  // had just wiped what they would need to write. The receipt is taken
  // BEFORE clear(), so the ending shows what was chosen and the fallback
  // email arrives already written.
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const doneHeading = useRef<HTMLHeadingElement>(null);
  // the form's words while the not-sent screen stands — see Draft
  const [draft, setDraft] = useState<Draft | null>(null);
  // the not-sent order's lines (its sig), so "I've sent it" takes out only
  // those — see sentIt
  const [orderSig, setOrderSig] = useState("");
  // the copy buttons' polite announcement, and the readonly box shown when
  // the browser refuses the clipboard
  const [said, setSaid] = useState("");
  const [showText, setShowText] = useState(false);
  const copyBox = useRef<HTMLTextAreaElement>(null);
  const addrRef = useRef<HTMLSpanElement>(null);
  // bumped after every send attempt — a bot-check token is single-use
  const [tsReset, setTsReset] = useState(0);
  // the signed-in visitor's name and email, for empty fields (contract 6)
  const [me, setMe] = useState<{ name?: string; email?: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // THE WORDS OUTLIVE THE FORM (2026-11-03, TS4-2 + CR4-F3). The form leaves
  // the page with the cart's last line — Remove, "−" at one, or another tab
  // emptying the cart — and what was typed went with it: Undo brought the
  // line back to an empty form. Its words become the draft as it goes, so it
  // comes back filled. Not when an order has just gone (`leaving`): the sent
  // path sets its own draft (none, or the not-sent screen's).
  const leaving = useRef(false);
  const formAt = useCallback((f: HTMLFormElement | null) => {
    formRef.current = f;
    if (!f) return;
    return () => {
      formRef.current = null;
      if (leaving.current) {
        leaving.current = false;
        return;
      }
      const d = new FormData(f);
      // THE BOX TOO (2026-11-03, V6-CART-1): the draft once meant "back from
      // the not-sent screen", where the box had been ticked, so the box was
      // drawn ticked whenever there was one — and this draft brought it back
      // ticked after Undo, and an order went with a consent never given
      setDraft({
        ...(Object.fromEntries(FIELDS.map((k) => [k, String(d.get(k) ?? "").trim()])) as Words),
        consent: d.get("consent") !== null,
      });
    };
  }, []);
  // "Back to the cart" puts the keyboard on the cart's heading
  const backFocus = useRef(false);
  // which delivery service — decides the charge AND whether an address is
  // asked for. Defaults to the Yerevan courier: she works there, and an
  // address is what most orders need anyway.
  const [shipId, setShipId] = useState("yerevan");
  const ship = delivery.options.find((o) => o.id === shipId) ?? delivery.options[0];

  // A REMOVAL CAN BE TAKEN BACK (2026-10-05). "−" at a quantity of one, and
  // Remove, deleted a line silently and for good — the only way back was
  // the shop — and the pressed button vanished with its row, so focus fell
  // to <body> (measured at 390x844: activeElement BODY after both). UX laws,
  // D5 vs correctness: act at once only where the act is reversible. So the
  // line goes at once, one persistent polite status line names it, and
  // Undo puts the identical stored line back in its old place for 6 s.
  const [gone, setGone] = useState<{ line: Line; at: number; label: string } | null>(null);
  const lapse = useRef<number | undefined>(undefined);
  const arm = () => {
    window.clearTimeout(lapse.current);
    lapse.current = window.setTimeout(() => setGone(null), 6000);
  };
  useEffect(() => () => window.clearTimeout(lapse.current), []);
  // …and the keyboard lands somewhere real once the list has re-rendered:
  // the first control of the row now at that index (the next row, or the
  // last one when the last was removed), or the heading when none is left
  const focusRow = useRef<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const sync = () => setLines(read());
    sync();
    // an undelivered order from this tab, before a reload — see PENDING
    try {
      const raw = window.sessionStorage.getItem(PENDING);
      const kept = raw ? (JSON.parse(raw) as Pending) : null;
      // …or while the cart is EMPTY, if it went empty under that very screen
      // (2026-11-03, V7R-5): the screen then says the order "is written out
      // below", and a reload threw that away — the phone-to-mail-app case
      // this is for. Not any empty cart (V8R-3): a screen the buyer walked
      // away from, its cart emptied later elsewhere, came back on every
      // visit. "I've sent it" then takes nothing out (takeOut finds no line).
      if (kept && kept.receipt && (kept.sig === sigOf(read()) || (read().length === 0 && kept.emptied === true))) {
        setRef(kept.ref);
        setReceipt(kept.receipt);
        setDraft(kept.draft);
        setOrderSig(kept.sig);
        // the delivery the order was sent with, while it is still offered
        if (kept.ship && delivery.options.some((o) => o.id === kept.ship)) setShipId(kept.ship);
        setState("logged");
      } else if (raw) forget();
    } catch {}
    setMounted(true);
    return subscribe(sync);
  }, []);

  // A SEND THAT WENT BEFORE THE PAGE WAS RUNNING came back from /api/early
  // with #not-sent (2026-11-03, V6-CART-2). The form is drawn only after
  // mount, so this needs a script that stopped after drawing it — but then
  // the emptied form must not pass for a sent order (ContactBlock.tsx has
  // the reasons), and the fragment leaves the address.
  // The line is said only with a cart to send (V7-CART-2: on an empty cart it
  // waited, and turned up beside a line added later), and brought into view
  // once the form draws it (V7-CART-3: it sat 2,000 px down the page).
  const toNote = useRef(false);
  const noteRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (window.location.hash !== "#not-sent") return;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (!read().length) return;
    toNote.current = true;
    setErrors({ turnstile: "Your order was not sent, because the page was still loading. Please fill in the form again and send, or email" });
  }, []);

  // the not-sent screen notes it when the cart goes empty under it — in
  // flight, or while it stands — so a reload brings it back (see `emptied`)
  useEffect(() => {
    if (state !== "logged" || lines.length) return;
    try {
      const raw = window.sessionStorage.getItem(PENDING);
      const kept = raw ? (JSON.parse(raw) as Pending) : null;
      if (kept && !kept.emptied) window.sessionStorage.setItem(PENDING, JSON.stringify({ ...kept, emptied: true }));
    } catch {}
  }, [state, lines]);

  // ONE fetch, and only where sign-in is switched on: who is signed in.
  // Anything but a clean answer leaves the form as it was.
  useEffect(() => {
    if (!SIGNIN) return;
    const ac = new AbortController();
    fetch("/api/auth/me", { cache: "no-store", signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: unknown) => {
        if (!d || typeof d !== "object") return;
        const { name, email } = d as { name?: unknown; email?: unknown };
        setMe({ name: typeof name === "string" ? name : undefined, email: typeof email === "string" ? email : undefined });
      })
      .catch(() => {});
    return () => ac.abort();
  }, []);
  // …filled into name and email only while they are EMPTY — never over what
  // the buyer typed — whenever the form is on screen
  const formShown = mounted && lines.length > 0 && state !== "sent" && state !== "logged" && state !== "handed";
  useEffect(() => {
    const f = formRef.current;
    if (!f || !me) return;
    for (const k of ["name", "email"] as const) {
      const el = f.elements.namedItem(k);
      const v = me[k];
      if (el instanceof HTMLInputElement && !el.value && v) el.value = v;
    }
  }, [me, formShown]);

  useEffect(() => {
    const at = focusRow.current;
    if (at === null) return;
    focusRow.current = null;
    const rows = listRef.current?.querySelectorAll<HTMLElement>(".ap-cart__row");
    const row = rows?.length ? rows[Math.min(at, rows.length - 1)] : null;
    (row?.querySelector<HTMLElement>("button") ?? headRef.current)?.focus();
  }, [lines]);

  /** the goods alone; delivery is added on top of this, never hidden in it.
   *  A line whose price Arpine confirms (unitOf → null) is not in it. */
  const goods = total(lines);
  const unpricedNow = hasUnpriced(lines);
  // sold-out lines (lib/content.ts `soldOut` — empty unless Arpine names
  // one): flagged on the line, out of the total (lib/cart.ts), and the order
  // cannot go until they are removed
  const outNow = soldOutLines(lines);
  const nameOf = (slug: string) => categories.find((c) => c.slug === slug)?.name ?? slug;
  /** One line, in words. The receipt, the fallback email and the buttons'
   *  accessible names all say it the same way — the Remove buttons used to be
   *  named by CATEGORY alone, so two keychains in a cart read to a screen
   *  reader as two identical "Remove Keychains". */
  // the rule itself lives in lib/lineWords.ts, shared with /api/order
  const lineLabel = (l: Line) => lineWords(l);

  // the ending is a new screen, so put the reader on its heading — otherwise a
  // screen reader stays on a Send button that no longer exists
  useEffect(() => {
    if (state === "sent" || state === "logged" || state === "handed") doneHeading.current?.focus();
    else if (state === "idle" && backFocus.current) {
      backFocus.current = false;
      headRef.current?.focus();
    }
  }, [state]);
  // `art` is TWO different id spaces — see ownItemWord in content.ts. For a
  // fixed-item line (magnet, keychain, 3D sticker) it names the category's own
  // product photo; only for the choose-an-illustration lines does it name one
  // of the 57 artworks. Resolving artworks first showed a buyer illustration
  // no. 05 — a different picture — for magnet no. 05.
  const thumbOf = (l: Line) => {
    const media = categories.find((c) => c.slug === l.cat)?.media ?? "";
    // …and a fixed item's pictures are not always the category's own roll:
    // the four tote bags (2026-10-01) live in `toteBags`, while the totes'
    // roll is nine lookbook photographs that share the ids 01–09 by accident
    // — ownItemMedia says where to look. No entry means the roll, as before.
    const own = P[ownItemMedia[l.cat] ?? media];
    if (ownItemWord[l.cat]) {
      // THE SCARVES' ROLL IS TWELVE PHOTOGRAPHS, FOUR PER DESIGN, and a scarf
      // line's `art` is the DESIGN number, 01–03 — so "Scarf no. 02" wore roll
      // photograph 02, design 01 on a wall (found 2026-10-01 while checking
      // every place the girl-and-sun print is pictured, change 3.pdf p8). The
      // design's first shot is its flat print, read from the ONE list the page
      // itself draws from (content.ts `scarfDesigns`): the first fix copied
      // those three rows into the manifest under their own key, which nothing
      // kept in step with the roll (reviewer, 2026-10-01).
      const id = l.cat === "scarves" ? scarfDesigns.designs.find((d) => d.id === l.art)?.shots[0] : l.art;
      return (id && own?.find((s) => s.id === id)?.thumb) || own?.[0]?.thumb;
    }
    // A STICKER SHEET HAS NO `art` — the sheet itself travels in `variant`
    // ("Sheet 03", StickerFolders' buy), so every sheet fell through to the
    // roll's first photograph: Sheet 03 in the cart wore Sheet 01's print
    // (verifier, 2026-10-05). The sheet's own print is the first of its
    // shots in content.ts `stickerSheets`, the list the page draws from.
    if (l.cat === "stickers") {
      const print = stickerSheets.sheets.find((s) => s.name === l.variant)?.shots[0];
      const thumb = print && P[media]?.find((s) => s.id === print)?.thumb;
      if (thumb) return thumb;
    }
    return (l.art ? ART.find((a) => a.id === l.art)?.thumb : undefined) ?? P[media]?.[0]?.thumb;
  };

  // put the keyboard where the fix is — the first field the server rejected,
  // in the order they appear in the form
  const focusFirst = (form: HTMLFormElement, errs: Record<string, string>) => {
    const first = ["name", "email", "phone", "ship", "address", "city", "country", "consent"].find((k) => errs[k]);
    if (!first) {
      // no field to fix, only the cart itself (sold-out pieces, or a cart
      // emptied in another tab): the line beside Send — rendered by this
      // very update, so it is focused once it exists (the effect below)
      if (errs.lines) toLines.current = true;
      return;
    }
    const el = form.querySelector<HTMLElement>(`[name="${first}"]`);
    if (el) bring(el);
  };
  const bring = (el: HTMLElement) => {
    // focus() alone left Name 470px ABOVE the screen at 1440x900 (measured
    // 2026-10-31): the form rides in the sticky side column, taller than the
    // window, and the browser's own scroll misjudges a sticky box. So the
    // field is brought into view by hand, re-checked over a few frames
    // while the column settles — clear of the fixed nav at the top.
    el.focus({ preventScroll: true });
    let n = 0;
    const show = () => {
      const r = el.getBoundingClientRect();
      if (r.top < 110 || r.bottom > window.innerHeight - 24) window.scrollBy({ top: r.top - window.innerHeight / 3, behavior: "instant" });
      if (++n < 3) requestAnimationFrame(show);
    };
    show();
  };
  // the cart's own line beside Send (`errors.lines`), focused once rendered
  const toLines = useRef(false);
  const linesErr = useRef<HTMLParagraphElement>(null);
  // THE FLAG WAITS FOR THE LINE (2026-11-03, V7-CART-1): "Your cart changed…"
  // is said while the cart is empty — there is no form, so no line to focus —
  // and the flag was spent on that render; when another tab refilled the cart
  // the line appeared and nothing focused it. It is spent only once the line
  // is there, and the form coming back (formShown) looks again. Send clears it.
  useEffect(() => {
    if (!toLines.current || !errors.lines || !linesErr.current) return;
    toLines.current = false;
    bring(linesErr.current);
  }, [errors, formShown]);
  // the not-sent line (#not-sent, above) the same way, once the form is drawn
  useEffect(() => {
    if (!toNote.current || !errors.turnstile || !noteRef.current) return;
    toNote.current = false;
    bring(noteRef.current);
  }, [errors, formShown]);
  // …and the sold-out sentence follows the cart, the way a field stops saying
  // it is wrong while it is being fixed (`unflag`): it names only the sold-out
  // lines still in it, and goes once none is left. Sold out is this page's
  // own list (lineSoldOut) — or, in a tab older than that list, the lines the
  // server's sentence named, which that tab cannot see as sold out
  // (2026-11-02: removing one of two kept "them" and the gone line; in an
  // old tab, any change to another line wiped the server's sentence).
  // THE LIST IS KEPT APART FROM THE SENTENCE (`sold`, 2026-11-02, NF-3): the
  // sentence shrinks as lines go, and was then the only list left, so an
  // Undo did not bring the line back into it. Null until a sentence names
  // sold-out lines; cleared by the next Send.
  const sold = useRef<{ named: string[]; match: boolean; sig: string } | null>(null);
  // …and a line is matched by the server's spelling of it too: /api/order
  // drops an illustration number it cannot use (a sticker sheet's, or one it
  // does not know), so it may name "Stickers (Sheet 03)" where this tab says
  // "Stickers — Illustration no. 05 (Sheet 03)". Unmatched, any change to the
  // cart wiped the sentence while that piece was still in it (2026-11-03,
  // CART4-N1 + CR4-F2). The sentence names the line as this cart shows it.
  const labelsOf = (l: Line) => [lineLabel(l), lineWords({ cat: l.cat, variant: l.variant })];
  const soldLeft = (ls: Line[], named: string[]) =>
    Array.from(
      new Set(ls.filter((l) => lineSoldOut(l) || labelsOf(l).some((n) => named.includes(n))).map(lineLabel)),
    );
  useEffect(() => {
    const s = sold.current;
    if (!s) return;
    if (!s.match) {
      // WORDS THIS TAB CANNOT MATCH to its own lines (CR3-F4 — a label the
      // server now says another way): rewriting them by this tab's labels
      // deleted them the moment they came, and Send seemed to do nothing.
      // They stay as the server said them, until the cart changes.
      const now = sigOf(lines);
      if (!s.sig) s.sig = now;
      else if (now !== s.sig && errors.lines) {
        sold.current = null;
        setErrors(({ lines: _gone, ...rest }) => rest);
      }
      return;
    }
    const left = soldLeft(lines, s.named);
    // the "out of your cart now" words stay while no sold-out line is back
    const want = left.length ? soldOutSay(left) : errors.lines === soldGone(s.named.length) ? errors.lines : undefined;
    if (want === errors.lines) return;
    setErrors(({ lines: _gone, ...rest }) => (want ? { ...rest, lines: want } : rest));
  }, [lines, errors.lines]);

  // EVERY PROBLEM IN ONE PASS (readiness audit 2026-10-31, P3). The form
  // checked only the consent box, then sent, so the server's verdict came
  // back one step late and the buyer fixed the fields one round at a time.
  // These are the server's own rules and words (app/api/order/route.ts);
  // the server still decides.
  const check = (get: (k: string) => string, consent: boolean) => {
    const errs: Record<string, string> = {};
    if (get("name").length < 2) errs.name = "Please give a name.";
    if (!EMAIL.test(get("email"))) errs.email = "That email does not look right.";
    if (get("phone").replace(/\D/g, "").length < 6) errs.phone = "Please give a phone number Arpine can reach you on.";
    if (ship.address) {
      if (get("address").length < 4) errs.address = "Please give the street address.";
      if (get("city").length < 2) errs.city = "Please give the city or town.";
      if (get("country").length < 2) errs.country = "Please give the country.";
    }
    if (!consent) errs.consent = "Please tick the box so Arpine may reply to you.";
    // a sold-out piece cannot be ordered: the server would refuse it with
    // these same words, so the buyer hears it now, with everything else
    if (outNow.length) errs.lines = soldOutSay(outNow.map(lineLabel));
    return errs;
  };
  // a field the buyer is fixing stops saying it is wrong
  const unflag = (e: React.FormEvent<HTMLFormElement>) => {
    const n = (e.target as HTMLInputElement).name;
    if (n && errors[n]) setErrors(({ [n]: _gone, ...rest }) => rest);
  };

  /** take a line out — see `gone`. `l` is the stored object itself, so Undo
   *  writes back exactly the bytes that were there. */
  const drop = (l: Line, at: number) => {
    setGone({ line: l, at, label: lineLabel(l) });
    focusRow.current = at;
    remove(l.cat, l.art, l.variant);
    arm();
  };
  const undo = () => {
    if (!gone) return;
    window.clearTimeout(lapse.current);
    // Undo's own rule wins: the keyboard goes to the restored row. A "Your
    // cart changed…" line waiting for a form (toLines) still shows and is
    // announced, but no longer pulls the page 1,200 px away from the row
    // (2026-11-03, V8R-1)
    toLines.current = false;
    focusRow.current = gone.at;
    restore(gone.line, gone.at);
    setGone(null);
  };
  // A HELD KEY MUST NOT EMPTY THE CART (2026-10-12). After a removal the
  // keyboard lands on the next row's first control, which is that row's "−"
  // (the effect above). Enter held on "−" therefore went on: this line down
  // to nothing, then the next, then the next, in a tenth of a second — and
  // Undo holds only the last one. A repeated keydown is not a second
  // decision, so the two controls that can take a line away ignore it;
  // "+" still repeats, and a fresh press works as it always did.
  const oncePerPress = (e: React.KeyboardEvent) => {
    if (e.repeat && e.key === "Enter") e.preventDefault();
  };

  // RETURN MEANS "NEXT" ON A PHONE (2026-10-05). Return in Name submitted the
  // whole order — the form is noValidate, so it went straight to the consent
  // check and the page jumped 973px down to that error (measured at 390x844;
  // UX laws D3: a phone keyboard's return in a form means the next field,
  // and D6). Every single-line field but the last says enterKeyHint="next",
  // so the key is labelled for it, and here it does what it says. Under a
  // coarse pointer only: a desktop keyboard keeps implicit submission
  // exactly as it was. The twin is in ContactBlock.tsx.
  const enterNext = (e: React.KeyboardEvent<HTMLFormElement>) => {
    const t = e.target;
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    if (!(t instanceof HTMLInputElement) || t.enterKeyHint !== "next") return;
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const fields = [...e.currentTarget.querySelectorAll<HTMLElement>(TEXT_FIELDS)];
    const next = fields[fields.indexOf(t) + 1];
    if (!next) return;
    e.preventDefault();
    next.focus();
  };

  const send = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state === "sending" || !lines.length) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    setErrors({});
    sold.current = null;
    toLines.current = false;
    toNote.current = false;
    // the form is noValidate (so one voice speaks: these are the server's
    // own messages), which means `required` does nothing — see `check`
    const errs = check(get, !!f.get("consent"));
    if (Object.keys(errs).length) {
      // this page's own sold-out sentence follows the cart too (the effect)
      if (errs.lines) sold.current = { named: outNow.map(lineLabel), match: true, sig: "" };
      setErrors(errs);
      focusFirst(form, errs);
      return;
    }
    setState("sending");
    let tried = false;
    try {
      // undefined when the bot check is off — then no field is sent at all
      const ts = await turnstileToken(form);
      // THE FORM HAS GONE (2026-11-02, NF-1): the cart was emptied while the
      // bot check was awaited, so the Send that started this is no longer on
      // the page. Nothing goes — it went 15 s later carrying whatever the
      // cart held by then, even a line added in another tab after the form
      // had gone, under the name typed before.
      // …and it says so (2026-11-03, CR4-F3): a cart refilled meanwhile came
      // back to a form that looked untouched. The typed words came back with
      // it (`formAt`); this line waits beside Send until the next one.
      if (!form.isConnected) {
        // focused once the refilled form draws it (V6-CART-4: it was left on <body>)
        toLines.current = true;
        setErrors({ lines: "Your cart changed before the order could go, so nothing was sent. Please check it and send again." });
        setState("idle");
        return;
      }
      // a check on screen waiting for the buyer's tick: say so, send nothing
      // (no try spent, no reset — the challenge stays)
      const tick = tickWords(form, ts);
      if (tick) {
        setErrors({ turnstile: tick });
        setState("idle");
        return;
      }
      // THE CART AS IT IS NOW, not as it was when Send was pressed
      // (2026-11-02, CR-3): the wait for the bot check can last 15 s, and a
      // line removed meanwhile still went out. The request, the receipt and
      // what leaves the cart afterwards are all this one list — and an empty
      // one sends nothing (it only spent a try on "Your cart is empty").
      const sent = read();
      if (!sent.length) {
        setState("idle");
        return;
      }
      tried = ts !== undefined;
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: get("name"),
          email: get("email"),
          phone: get("phone"),
          note: get("note"),
          // the honeypot, renamed from "company" (autofill filled it)
          hp: get("hp"),
          ...(ts !== undefined ? { turnstile: ts } : {}),
          // the consent box is ticked to get here; the server records it
          // but does not require it, so a tab older than this never fails
          consent: true,
          // the delivery half: only the CHOICE travels, never its price —
          // the server looks that up, exactly as it does for the products.
          // An address is sent only when one was asked for, so a collection
          // order carries no stale fields.
          ship: shipId,
          ...(ship.address
            ? {
                address: get("address"),
                city: get("city"),
                postcode: get("postcode"),
                country: get("country"),
              }
            : {}),
          // the server re-prices from its own copy of the catalogue; this is
          // only what the buyer chose, never what it should cost
          lines: sent.map((l) => ({ cat: l.cat, art: l.art, variant: l.variant, qty: l.qty })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        delivered?: boolean;
        copied?: boolean;
        ref?: string;
        errors?: Record<string, string>;
      };
      if (res.status === 422 && data.errors) {
        const errs = { ...data.errors };
        const named = errs.lines ? soldOutNamed(errs.lines) : null;
        if (named) {
          // SAID AGAINST THE CART AS IT IS ON ARRIVAL (2026-11-02, NF-2): a
          // line removed while the answer travelled was named for one frame,
          // in an alert, and then wiped — the keyboard fell to the page and
          // nothing said the order had not gone. Labels this tab says the
          // same way follow the cart; others stay as said (CR3-F4).
          const own = new Set([...sent, ...read()].flatMap(labelsOf));
          const match = named.every((n) => own.has(n));
          sold.current = { named, match, sig: "" };
          if (match) {
            const left = soldLeft(read(), named);
            errs.lines = left.length ? soldOutSay(left) : soldGone(named.length);
          }
        }
        setErrors(errs);
        setState("idle");
        focusFirst(form, errs);
        return;
      }
      // the bot check said no: its words go next to the button — or, with no
      // check on the page to complete, what happened (Turnstile.tsx)
      if (res.status === 403 && data.errors?.turnstile) {
        setErrors({ turnstile: botCheckWords(form, data.errors.turnstile) });
        setState("idle");
        return;
      }
      // TOO MANY TRIES (2026-11-03, peer review #7): the server's 429 fell
      // through to "That did not send. Please try again", the one thing that
      // cannot work for the next few minutes. Its limit is 6 sends from one
      // connection per 10 minutes (lib/server/intake.ts `limited`).
      if (res.status === 429) {
        setErrors({ turnstile: "Too many tries from this connection. Please wait up to ten minutes, then send again, or email" });
        setState("idle");
        return;
      }
      if (!res.ok || !data.ok) {
        setState("error");
        return;
      }
      const orderRef = data.ref ?? "";
      setRef(orderRef);
      setCopied(!!data.copied);
      // frozen at the moment of sending — see `receipt` above
      const frozen: Receipt = {
        lines: sent.map((l) => ({ label: lineLabel(l), qty: l.qty, sum: lineSum(l) })),
        goods: total(sent),
        shipLabel: ship.label,
        shipPrice: ship.price,
        unpriced: sent.filter((l) => unitOf(l) === null).map(lineLabel),
        who: [
          get("name"),
          get("phone") ? `Phone: ${get("phone")}` : "",
          ship.address
            ? [get("address"), [get("postcode"), get("city")].filter(Boolean).join(" "), get("country")].filter(Boolean).join(", ")
            : "",
          get("note") ? `Note: ${get("note")}` : "",
        ].filter(Boolean),
        email: get("email"),
      };
      setReceipt(frozen);
      setSaid("");
      setShowText(false);
      // nothing left to take back once the order has gone either way
      window.clearTimeout(lapse.current);
      setGone(null);
      // the form goes with this answer, and its words are not a draft (formAt);
      // only while it is still on the page, or the flag would wait for another
      leaving.current = !!formRef.current;
      if (data.delivered) {
        setState("sent");
        setDraft(null);
        forget();
        // only the order leaves the cart (2026-11-02, CR-4): this was clear(),
        // which also wiped a line added in another tab while it travelled
        takeOut(sigOf(sent));
        form.reset();
        return;
      }
      // NOT DELIVERED (readiness audit 2026-10-31, #3). This used to say
      // "Order received" and clear() the cart, while the order existed only
      // as a line in short-lived server logs — every order was lost the
      // moment the buyer closed the tab. Now nothing is emptied: the cart
      // and the typed words stay until the buyer says it has gone.
      const kept: Draft = Object.fromEntries(FIELDS.map((k) => [k, get(k)])) as Words;
      setDraft(kept);
      setOrderSig(sigOf(sent));
      setState("logged");
      try {
        window.sessionStorage.setItem(
          PENDING,
          JSON.stringify({ ref: orderRef, receipt: frozen, draft: kept, sig: sigOf(sent), ship: shipId } satisfies Pending),
        );
      } catch {}
    } catch {
      setState("error");
    } finally {
      // a token is spent once it has been sent — ask for a fresh one
      if (tried) setTsReset((n) => n + 1);
    }
  };

  /** Copy words to the clipboard, saying so politely. When the browser
   *  refuses (no permission, an old engine, a non-secure origin), the order
   *  appears in a readonly box, selected, for Ctrl+C or a long-press — and
   *  the older copy command is tried on it. */
  const copy = async (text: string, what: string, from: "order" | "address") => {
    setSaid("");
    try {
      await navigator.clipboard.writeText(text);
      setSaid(`${what} copied.`);
      return;
    } catch {}
    // the order: the readonly box (always rendered, hidden until needed);
    // the address: its own visible words
    if (from === "order") {
      const box = copyBox.current;
      if (box) {
        box.hidden = false;
        box.focus();
        box.select();
      }
      setShowText(true);
    } else {
      const el = addrRef.current;
      const sel = window.getSelection();
      if (el && sel) {
        const r = document.createRange();
        r.selectNodeContents(el);
        sel.removeAllRanges();
        sel.addRange(r);
      }
    }
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {}
    setSaid(ok ? `${what} copied.` : "Selected — press Ctrl+C (or long-press and choose Copy) to copy it.");
  };
  /** back to the cart from the not-sent screen: the lines were never
   *  cleared, and the form comes back with what was typed (`draft`) */
  const backToCart = () => {
    forget();
    // the keyboard goes to the heading; a #not-sent note set behind the
    // not-sent screen (a crafted link) does not take it (V8R-4)
    toNote.current = false;
    backFocus.current = true;
    setSaid("");
    setShowText(false);
    setState("idle");
  };
  /** Take one order out of the cart — ONLY that order (2026-11-01, review):
   *  each of its lines is taken down by the quantity it was ordered in, and
   *  goes at nothing; anything else (added in another tab, or while the order
   *  travelled) stays. An unreadable sig empties the cart, as clear() did. */
  function takeOut(sig: string) {
    const held = linesOf(sig);
    if (!held) {
      clear();
      return;
    }
    for (const [cat, art, variant, qty] of held) {
      const now = read().find((l) => l.cat === cat && (l.art ?? "") === art && (l.variant ?? "") === variant);
      if (!now) continue;
      if (now.qty > qty) setQty(cat, art || undefined, now.qty - qty, variant || undefined);
      else remove(cat, art || undefined, variant || undefined);
    }
  }
  /** The buyer sent it from their own mail: only now does the order leave
   *  the cart. This was clear(), which also threw away lines added in
   *  another tab while this screen stood (the sig is checked only when the
   *  page opens). */
  const sentIt = () => {
    forget();
    setDraft(null);
    takeOut(orderSig);
    setState("handed");
  };

  // The head is static — no cart data in it — so it renders in every state,
  // including the pre-mount shell. The TextFX runner scans the page before
  // the localStorage read resolves; if the heading waited for `mounted`, the
  // runner would find nothing and the cart title would never get its flip.
  const head = (
    <div className="ap-sec__head">
      <p className="ap-kicker">(Cart)</p>
      {/* rise, not flip — same reason as the gallery title in HomeView.tsx
          (2026-09-15): the per-letter 3D turn tears the first glyph and
          overlaps the rest mid-entrance; this was the only other flip */}
      {/* tabIndex -1: where focus goes when the last line is removed */}
      <h1 className="ap-h2" data-tfx="rise" ref={headRef} tabIndex={-1}>
        YOUR SELECTION
      </h1>
    </div>
  );

  if (!mounted)
    return (
      <div className="ap-sec ap-cart" aria-busy="true">
        {head}
      </div>
    );

  if (state === "sent" || state === "logged" || state === "handed") {
    const notSent = state === "logged";
    // the fallback email, written out: the buyer should only have to press Send
    const mailto = `mailto:${brand.email}?subject=${encodeURIComponent(`ArpenArt order${ref ? ` ${ref}` : ""}`)}&body=${encodeURIComponent(receipt ? orderText(receipt, ref, false) : "")}`;
    // …and the same words for any other way of sending (a messenger, a
    // webmail tab): those carry no sender, so the buyer's email goes in
    const asText = receipt ? orderText(receipt, ref, true) : "";

    return (
      <div className="ap-sec ap-cart">
        <div className="ap-cart__done">
          {/* only a DELIVERED order may say it was received */}
          <h1 className="ap-h2" ref={doneHeading} tabIndex={-1}>
            {notSent ? "Not sent yet" : state === "handed" ? "Thank you" : "Order received"}
          </h1>
          {ref && (
            <p className="ap-cart__ref">
              Reference <strong>{ref}</strong>
            </p>
          )}
          {state === "sent" && (
            <p>
              Arpine has your request and will reply to confirm the total and postage.
              {copied && " A copy was sent to your email."}
              {/* only the order left the cart (takeOut): a line added while
                  it travelled, in another tab, is still there */}
              {lines.length > 0 && " What you added since is still in your cart."}
            </p>
          )}
          {notSent && (
            <>
              {/* "your cart is kept" only while it holds the ORDER's lines: a
                  cart emptied while the order travelled is not (V6-CART-5),
                  nor one holding only a line added since (V7-CART-5) */}
              <p>
                {(linesOf(orderSig) ?? []).some(([cat, art, variant]) =>
                  lines.some((l) => l.cat === cat && (l.art ?? "") === art && (l.variant ?? "") === variant),
                )
                  ? "This order has not reached Arpine yet — the site could not send it — so your cart is kept: email it to her with the button below, or copy it and send it to her address."
                  : "This order has not reached Arpine yet — the site could not send it. It is written out below: email it to her with the button below, or copy it and send it to her address."}
              </p>
              {/* her address as words, for a desktop where mailto opens nothing */}
              <p className="ap-of__addr">
                <span ref={addrRef}>{brand.email}</span>
                <button type="button" className="ap-of__quiet" onClick={() => copy(brand.email, "Address", "address")}>
                  Copy address
                </button>
              </p>
            </>
          )}
          {state === "handed" && (
            <p>
              {/* only the order left the cart (sentIt): lines added since, in
                  another tab, are still there and must not be called gone */}
              {lines.length ? "This order is out of your cart; what you added since is still there." : "Your cart is empty now."}{" "}
              When your email reaches Arpine, she will reply to confirm the total and postage.
            </p>
          )}

          {receipt && (
            <div className="ap-cart__receipt">
              <ul>
                {receipt.lines.map((l) => (
                  <li key={l.label}>
                    <span>
                      {l.qty} × {l.label}
                    </span>
                    <span className={l.sum === null ? "ap-of__tbc" : undefined}>{l.sum === null ? TBC : dram(l.sum)}</span>
                  </li>
                ))}
              </ul>
              <dl className="ap-cart__sums">
                <div>
                  <dt>Delivery — {receipt.shipLabel}</dt>
                  <dd>{receipt.shipPrice ? dram(receipt.shipPrice) : "Free"}</dd>
                </div>
                <div className="ap-cart__sums-total">
                  <dt>Total</dt>
                  <dd>{dram(receipt.goods + receipt.shipPrice)}</dd>
                </div>
              </dl>
              {receipt.unpriced.length > 0 && <p className="ap-cart__note">{notIncluded(receipt.unpriced)}</p>}
            </div>
          )}

          {/* a piece in this order sold out since it was written (a restored
              screen, after a deploy): the same sentence the cart gives */}
          {notSent && outNow.length > 0 && <p className="ap-cart__err">{soldOutSay(outNow.map(lineLabel))}</p>}

          {/* exactly one primary: in the fallback the email IS the order */}
          {notSent ? (
            <>
              <div className="ap-cart__doneActs">
                <a className="ap-btn" href={mailto}>
                  Email this order to Arpine
                </a>
                <button type="button" className="ap-btn is-ghost" onClick={() => copy(asText, "Order", "order")}>
                  Copy the order
                </button>
              </div>
              {/* shown only when the browser refuses the clipboard — see copy */}
              <textarea
                ref={copyBox}
                className="ap-of__text"
                readOnly
                hidden={!showText}
                value={asText}
                rows={8}
                aria-label="The order, as text"
              />
              <p className="ap-of__said" role="status">
                {said}
              </p>
              <div className="ap-of__after">
                <button type="button" className="ap-of__quiet" onClick={backToCart}>
                  Back to the cart
                </button>
                <p>
                  Already sent it?{" "}
                  <button type="button" className="ap-of__quiet" onClick={sentIt}>
                    I’ve sent it — take it out of my cart
                  </button>
                </p>
              </div>
            </>
          ) : (
            <Link className="ap-btn" href="/shop">
              Back to the shop
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="ap-sec ap-cart">
      {head}

      {/* the removal's status line — always in the page, empty at rest: a
          live region has to exist before its words change to be heard. It
          sits before the list in reading order, so from the row that
          received focus the Undo is a Shift+Tab or two away. */}
      <div className="ap-cart__undo" role="status" onFocus={() => window.clearTimeout(lapse.current)} onBlur={arm}>
        {gone && (
          <p className="ap-dark">
            <span>Removed: {gone.label}.</span>
            <button type="button" onClick={undo}>
              Undo
            </button>
          </p>
        )}
      </div>

      {!lines.length ? (
        <div className="ap-cart__empty">
          <p>Nothing chosen yet.</p>
          <Link className="ap-btn" href="/shop">
            Go to the shop
          </Link>
        </div>
      ) : (
        <div className="ap-cart__grid">
          <ul className="ap-cart__list" ref={listRef}>
            {lines.map((l, i) => {
              const t = thumbOf(l);
              // null: a price the site does not know (the postcards' full
              // series set) — named as such, never shown as a number
              const u = unitOf(l);
              // sold out: said in words on the line (the flag, the sum), its
              // "+" off; "−" and Remove still work — taking it out is the fix
              const out = lineSoldOut(l);
              return (
                <li className="ap-cart__row" key={l.cat + (l.art ?? "") + (l.variant ?? "")} data-out={out || undefined}>
                  {/* data-cat: a line whose photograph is not centred on its
                      object can say where to crop (the totes do, in shop.css) */}
                  <figure className="ap-cart__fig" data-cat={l.cat}>
                    {t && <img src={t} alt="" width={120} height={160} loading="lazy" />}
                  </figure>
                  <div className="ap-cart__what">
                    {/* in the heading, so a screen reader moving by headings
                        hears "Magnets, Sold out" before anything else */}
                    <h2>
                      {nameOf(l.cat)}
                      {out && (
                        <>
                          {" "}
                          <span className="ap-of__flag">Sold out</span>
                        </>
                      )}
                    </h2>
                    {l.art && <p>{ownItemWord[l.cat] ?? "Illustration"} no. {l.art}</p>}
                    {l.variant && <p>{l.variant}</p>}
                    <p className="ap-cart__unit">{u === null ? TBC : `${dram(u)} each`}</p>
                  </div>
                  <div className="ap-cart__qty">
                    {/* at one, "−" removes the line — the same act as Remove,
                        so it goes through the same undoable path */}
                    <button
                      type="button"
                      aria-label={`One fewer: ${lineLabel(l)}`}
                      onKeyDown={oncePerPress}
                      onClick={() => (l.qty > 1 ? setQty(l.cat, l.art, l.qty - 1, l.variant) : drop(l, i))}
                    >
                      −
                    </button>
                    <span aria-live="polite">{l.qty}</span>
                    <button
                      type="button"
                      aria-label={`One more: ${lineLabel(l)}`}
                      disabled={out}
                      onClick={() => setQty(l.cat, l.art, l.qty + 1, l.variant)}
                    >
                      +
                    </button>
                  </div>
                  <p className={out ? "ap-cart__sum ap-of__out" : u === null ? "ap-cart__sum ap-of__tbc" : "ap-cart__sum"}>
                    {out ? "Sold out" : u === null ? TBC : dram(u * l.qty)}
                  </p>
                  <button
                    type="button"
                    className="ap-cart__rm"
                    onKeyDown={oncePerPress}
                    onClick={() => drop(l, i)}
                    aria-label={`Remove ${lineLabel(l)}`}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>

          {/* the strip and the form share one column so they stick together */}
          <div className="ap-cart__side">
            <OrderingSteps />

            {/* method="post" to /api/early (2026-11-02): a Send pressed before
                the page's script has started does the browser's own submit,
                and with no method that was a GET — the buyer's name, email,
                phone and address went into the address bar, the history and
                the server logs. A POST to the page itself gets a 405 on
                Vercel, so it goes to a route that sends the buyer straight
                back here (app/api/early/route.ts). This form renders only
                after mount, so here it only keeps step with the contact and
                sign-in forms, which the server renders. */}
            <form
              className="ap-cart__form"
              ref={formAt}
              method="post"
              action="/api/early?to=/cart"
              onSubmit={send}
              onKeyDown={enterNext}
              onInput={unflag}
              noValidate
            >
              {/* the sum, itemised, so the delivery charge is never a
                  surprise sitting inside one number */}
              <dl className="ap-cart__sums">
                <div>
                  <dt>Items</dt>
                  <dd>{dram(goods)}</dd>
                </div>
                <div>
                  <dt>Delivery — {ship.label}</dt>
                  <dd>{ship.price ? dram(ship.price) : "Free"}</dd>
                </div>
                <div className="ap-cart__sums-total">
                  <dt>Total</dt>
                  <dd>{dram(goods + ship.price)}</dd>
                </div>
              </dl>
              {/* a total without a line's price must say so where it is read */}
              {unpricedNow && (
                <p className="ap-cart__note ap-of__tbcNote">
                  {notIncluded(lines.filter((l) => !lineSoldOut(l) && unitOf(l) === null).map(lineLabel))}
                </p>
              )}
              <p className="ap-cart__note">{delivery.note}</p>

              {/* the honeypot: "Company" invited autofill to fill it, and a
                  filled one silently drops the order — so a name and a label
                  no browser fills */}
              <div className="ap-pot" aria-hidden="true">
                <label htmlFor="ap-hp">Leave this field empty</label>
                <input id="ap-hp" name="hp" tabIndex={-1} autoComplete="off" />
              </div>

              <label className="ap-field">
                <span>Name</span>
                <input
                  name="name"
                  required
                  autoComplete="name"
                  enterKeyHint="next"
                  defaultValue={draft?.name}
                  aria-invalid={!!errors.name}
                />
                {errors.name && <em className="ap-contact__warn">{errors.name}</em>}
              </label>
              <label className="ap-field">
                <span>Email</span>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  enterKeyHint="next"
                  defaultValue={draft?.email}
                  aria-invalid={!!errors.email}
                />
                {errors.email && <em className="ap-contact__warn">{errors.email}</em>}
              </label>
              <label className="ap-field">
                <span>Phone</span>
                <input
                  name="phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="+374 …"
                  // the last single-line field when no address is asked for
                  enterKeyHint={ship.address ? "next" : undefined}
                  defaultValue={draft?.phone}
                  aria-invalid={!!errors.phone}
                />
                {errors.phone && <em className="ap-contact__warn">{errors.phone}</em>}
              </label>

              {/* how it reaches them — the address block only exists for the
                  branch that needs one, so a Yerevan pickup is two clicks */}
              <fieldset className="ap-field ap-ship">
                <legend>{delivery.label}</legend>
                {delivery.options.map((o) => (
                  <label key={o.id} className="ap-ship__opt">
                    <input
                      type="radio"
                      name="ship"
                      value={o.id}
                      checked={shipId === o.id}
                      onChange={() => setShipId(o.id)}
                    />
                    <span>
                      <strong>{o.label}</strong>
                      <em>{o.eta}</em>
                    </span>
                    <b className="ap-ship__price">{o.price ? dram(o.price) : "Free"}</b>
                  </label>
                ))}
                {/* the server's 422 can name `ship` (an option id a tab older
                    than a delivery change still sends); without this line the
                    form went quiet with nothing said (integration 2026-11-01) */}
                {errors.ship && <em className="ap-contact__warn">{errors.ship}</em>}
              </fieldset>

              {ship.address && (
                <>
                  <label className="ap-field">
                    <span>Address</span>
                    <input
                      name="address"
                      required
                      autoComplete="street-address"
                      enterKeyHint="next"
                      defaultValue={draft?.address}
                      aria-invalid={!!errors.address}
                    />
                    {errors.address && <em className="ap-contact__warn">{errors.address}</em>}
                  </label>
                  <div className="ap-cart__pair">
                    <label className="ap-field">
                      <span>City</span>
                      <input
                        name="city"
                        required
                        autoComplete="address-level2"
                        enterKeyHint="next"
                        defaultValue={draft?.city}
                        aria-invalid={!!errors.city}
                      />
                      {errors.city && <em className="ap-contact__warn">{errors.city}</em>}
                    </label>
                    <label className="ap-field">
                      <span>Postal code</span>
                      <input name="postcode" autoComplete="postal-code" enterKeyHint="next" defaultValue={draft?.postcode} />
                    </label>
                  </div>
                  <label className="ap-field">
                    <span>Country</span>
                    {/* `||`, not `??` (2026-11-01, CLIENT-2): a draft from a
                        collection order holds country "" — no address was
                        asked — and Courier then opened with Country empty.
                        A draft with an address asked always has a country
                        (it passed `check`), so `||` never overrides one. */}
                    <input
                      name="country"
                      required
                      defaultValue={draft?.country || "Armenia"}
                      autoComplete="country-name"
                      aria-invalid={!!errors.country}
                    />
                    {errors.country && <em className="ap-contact__warn">{errors.country}</em>}
                  </label>
                </>
              )}

              <label className="ap-field">
                <span>Anything to add?</span>
                <textarea name="note" rows={3} defaultValue={draft?.note} />
              </label>

              <label className="ap-field ap-consent">
                {/* the error sits outside the label, so it is tied to the box
                    by id — otherwise a screen reader heard only "invalid" */}
                <input
                  type="checkbox"
                  name="consent"
                  required
                  // as the buyer left it: ticked before the not-sent screen
                  // (that draft has no `consent`), or whatever it was when
                  // the form last left the page (formAt) — never ticked for
                  // them (2026-11-03, V6-CART-1)
                  defaultChecked={draft ? draft.consent !== false : false}
                  aria-invalid={!!errors.consent}
                  aria-describedby={errors.consent ? "ap-consent-err" : undefined}
                />
                {/* A NEW TAB FOR THE SMALL PRINT (2026-10-05): in the same tab,
                    coming back from /privacy re-mounted this form empty — the
                    name, phone and address typed so far were gone (UX laws
                    D1, M4). The words on the page are unchanged. The terms
                    joined on 2026-10-31 (readiness #10): an order is made
                    under them, so the box that sends one names them too. */}
                <span>
                  {home.contact.consentOrder} —{" "}
                  <Link href="/privacy" target="_blank" rel="noopener">
                    privacy<span className="ap-sr"> (opens in a new tab)</span>
                  </Link>{" "}
                  and{" "}
                  <Link href="/terms" target="_blank" rel="noopener">
                    terms<span className="ap-sr"> (opens in a new tab)</span>
                  </Link>
                </span>
              </label>
              {errors.consent && (
                <em id="ap-consent-err" className="ap-contact__warn">
                  {errors.consent}
                </em>
              )}

              {/* the bot check — nothing at all unless its site key is set */}
              <Turnstile action="order" reset={tsReset} />

              {/* the cart itself: sold-out pieces still in it (said here
                  before sending, and by the server's 422 if this tab is older
                  than the change), or the server's "cart is empty" — possible
                  when another tab cleared the cart between render and submit.
                  tabIndex -1: focused like a field error (focusFirst) */}
              {errors.lines && (
                <p className="ap-cart__err" role="alert" tabIndex={-1} ref={linesErr}>
                  {errors.lines}
                </p>
              )}
              {state === "error" && (
                <p className="ap-cart__err" role="alert">
                  That did not send. Please try again, or email{" "}
                  <a href={`mailto:${brand.email}`}>{brand.email}</a>.
                </p>
              )}
              {errors.turnstile && (
                <p className="ap-cart__err" role="alert" tabIndex={-1} ref={noteRef}>
                  {errors.turnstile} <a href={`mailto:${brand.email}`}>{brand.email}</a>.
                </p>
              )}

              {/* aria-disabled, not disabled (2026-10-05): a disabled button
                  drops the focus it holds, so a buyer who pressed Send was
                  left on <body> when the error line arrived. `send` already
                  returns early while a request is in flight. */}
              <button className="ap-btn" type="submit" aria-disabled={state === "sending" ? true : undefined}>
                {state === "sending" ? "Sending…" : "Send this order"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
