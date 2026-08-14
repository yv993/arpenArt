import { NextResponse } from "next/server";
import { authReady, linkToken } from "@/lib/server/auth";
import { brand } from "@/lib/content";

// Sign-in intake. Same honesty contract as the order and contact routes: with
// no mail delivery configured it still issues a real link, logs it to the
// server console, and returns delivered:false — the UI then says so out loud
// rather than telling the visitor to check an inbox nothing was sent to.

export const runtime = "nodejs";

const clean = (v: unknown, max = 200) =>
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
  if (!authReady()) {
    return NextResponse.json(
      { ok: false, error: "Sign-in is not switched on yet." },
      { status: 503 },
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Try again shortly." },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  // honeypot — accept, then drop
  if (clean(body.company)) return NextResponse.json({ ok: true, delivered: false });

  const email = clean(body.email, 160).toLowerCase();
  const name = clean(body.name, 120);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json(
      { ok: false, errors: { email: "That email does not look right." } },
      { status: 422 },
    );
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || new URL(req.url).origin;
  const link = `${origin}/account/verify?token=${encodeURIComponent(linkToken(email, name))}`;

  const resend = process.env.RESEND_API_KEY;
  const from = process.env.ORDER_TO_EMAIL;
  let delivered = false;

  if (resend && from) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${brand.name} <${from}>`,
          to: [email],
          subject: `Your ${brand.name} sign-in link`,
          text:
            `Open this link to sign in. It works once and expires in 15 minutes.\n\n${link}\n\n` +
            `If you did not ask for it, nothing has happened — ignore this message.`,
        }),
      });
      delivered = r.ok;
    } catch {
      delivered = false;
    }
  }

  if (!delivered) {
    // the developer's copy, so the flow is testable before mail is wired
    console.log(`[auth] sign-in link for ${email}:\n${link}`);
  }

  // ALWAYS ok:true, and never "no such account": whether an address has been
  // seen before is not something a stranger gets to probe by watching which
  // messages differ.
  return NextResponse.json({ ok: true, delivered });
}
