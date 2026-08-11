import { NextResponse } from "next/server";
import { categories, delivery } from "@/lib/content";

// Zero-dependency order intake.
//
// It NEVER trusts a price from the browser: the client sends only which
// category and which illustration, and the total is recomputed here from the
// server's own copy of the catalogue. It also never claims delivery it did not
// achieve — with no RESEND_API_KEY or ORDER_WEBHOOK_URL configured it returns
// delivered:false and the UI says so plainly.

export const runtime = "nodejs";

type In = { cat?: unknown; art?: unknown; variant?: unknown; qty?: unknown };

// strip control characters that would corrupt a log line or an email header
const clean = (v: unknown, max = 400) =>
  String(v ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, max);

const hits = new Map<string, { n: number; until: number }>();
function limited(ip: string) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now > h.until) {
    hits.set(ip, { n: 1, until: now + 10 * 60_000 });
    return false;
  }
  h.n += 1;
  return h.n > 6;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) {
    return NextResponse.json({ ok: false, error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  // honeypot — accept, then quietly drop
  if (clean(body.company)) return NextResponse.json({ ok: true, delivered: false, ref: "" });

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

  const raw = Array.isArray(body.lines) ? (body.lines as In[]) : [];
  const lines = raw
    .map((l) => {
      const cat = categories.find((c) => c.slug === clean(l.cat, 40) && c.status === "open");
      const qty = Math.max(1, Math.min(99, Math.floor(Number(l.qty) || 0)));
      if (!cat) return null;
      return {
        slug: cat.slug,
        name: cat.name,
        art: clean(l.art, 8) || null,
        // a size or format label — free text through the same wringer as
        // everything else (control chars out, trimmed, capped), never priced:
        // the artist confirms what it costs either way
        variant: clean(l.variant, 60) || null,
        qty,
        unit: cat.from,
      };
    })
    .filter(Boolean) as Array<{
    slug: string;
    name: string;
    art: string | null;
    variant: string | null;
    qty: number;
    unit: number;
  }>;

  if (!lines.length) errors.lines = "Your cart is empty.";
  if (Object.keys(errors).length) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  const goods = lines.reduce((n, l) => n + l.unit * l.qty, 0);
  // ship is proven non-null above: a missing one is a 422 before this point
  const post = ship!.price;
  const total = goods + post;
  const ref = "AR-" + Math.random().toString(36).slice(2, 7).toUpperCase();

  // one rendering of the lines, used by both the artist's and the buyer's copy
  const lineText = lines.map(
    (l) =>
      `  ${l.qty} x ${l.name}${l.variant ? ` [${l.variant}]` : ""}${
        l.art ? ` (illustration ${l.art})` : ""
      } — ${l.unit * l.qty} AMD`,
  );

  // the delivery half, rendered once for both copies
  const shipText = [
    `Delivery: ${ship!.label} — ${post ? post + " AMD" : "free"} (${ship!.eta})`,
    ...(ship!.address
      ? [`  ${address}`, `  ${[postcode, city].filter(Boolean).join(" ")}`, `  ${country}`]
      : []),
  ];

  const money = [`Items: ${goods} AMD`, `Delivery: ${post} AMD`, `TOTAL: ${total} AMD`];

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

  const webhook = process.env.ORDER_WEBHOOK_URL;
  const resend = process.env.RESEND_API_KEY;
  const to = process.env.ORDER_TO_EMAIL;
  let delivered = false;
  let copied = false;

  try {
    if (webhook) {
      const r = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ref,
          name,
          email,
          phone,
          note,
          lines,
          goods,
          delivery: { id: ship!.id, label: ship!.label, price: post },
          total,
          ...(ship!.address ? { address, city, postcode, country } : {}),
        }),
      });
      delivered = r.ok;
    } else if (resend && to) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "ArpenArt <onboarding@resend.dev>",
          to: [to],
          reply_to: email,
          subject: `Order ${ref} — ${name}`,
          text: summary,
        }),
      });
      delivered = r.ok;
    }
  } catch {
    delivered = false;
  }

  // The buyer's copy is a courtesy on top of the order, so it gets its own
  // try/catch: a failure here must never sink the request itself. It needs
  // the artist's address for reply-to, hence the same resend+to gate. The
  // wording repeats the site's one promise — nothing is charged yet.
  if (resend && to) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "ArpenArt <onboarding@resend.dev>",
          to: [email],
          reply_to: to,
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
        }),
      });
      copied = r.ok;
    } catch {
      copied = false;
    }
  }

  if (!delivered) console.log("[arpenart order — NOT DELIVERED]\n" + summary);
  // `copied` is reported honestly so the UI only mentions the buyer's email
  // copy when it actually went out
  return NextResponse.json({ ok: true, delivered, copied, ref });
}
