import { NextResponse } from "next/server";

// Zero-dependency contact intake. Same honesty contract as the order route:
// with no delivery configured it returns delivered:false and the UI offers the
// artist's email instead of pretending the message went out.

export const runtime = "nodejs";

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
    return NextResponse.json({ ok: false, error: "Too many messages. Try again shortly." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  // honeypot — accept, then drop
  if (clean(body.company)) return NextResponse.json({ ok: true, delivered: false });

  const name = clean(body.name, 120);
  const email = clean(body.email, 160);
  const message = clean(body.message, 2000);

  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = "Please give a name.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = "That email does not look right.";
  if (message.length < 8) errors.message = "A sentence or two is enough.";
  if (Object.keys(errors).length) return NextResponse.json({ ok: false, errors }, { status: 422 });

  const text = `ArpenArt enquiry\n\n${name} <${email}>\n\n${message}`;
  const webhook = process.env.CONTACT_WEBHOOK_URL;
  const resend = process.env.RESEND_API_KEY;
  const to = process.env.ORDER_TO_EMAIL;
  let delivered = false;

  try {
    if (webhook) {
      const r = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
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
          subject: `Enquiry from ${name}`,
          text,
        }),
      });
      delivered = r.ok;
    }
  } catch {
    delivered = false;
  }

  if (!delivered) console.log("[arpenart contact — NOT DELIVERED]\n" + text);
  return NextResponse.json({ ok: true, delivered });
}
