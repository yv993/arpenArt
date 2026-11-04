import { randomUUID } from "node:crypto";
import { fetchRetry, turnstileOn } from "./mail";

// turnstileOn lives in ./mail since 2026-11-01 (the buyer's copy needs it);
// re-exported so `import { turnstileOn } from "@/lib/server/intake"` still works
export { turnstileOn };

// ============================================================================
// THE FRONT DOOR OF EVERY POST ROUTE (readiness #6 and the P3 hardening list,
// 2026-10-31). /api/order, /api/contact and /api/auth each carried their own
// copy of clean(), of the rate limiter and of a bare `await req.json()` — so a
// body of `null` or `{"lines":[null]}` reached code that read fields off it
// and came back as a 500, any site could post to them from a visitor's
// browser, and nothing but a honeypot stood between a script and the buyer's
// copy (which goes to whatever address the form names).
//
// One gate now, in this order, cheapest first:
//   403  an Origin header from another site (browsers always send one on a
//        cross-site POST; a missing header is a server-side client, let in)
//   415  not Content-Type: application/json
//   429  the per-IP limit (in memory, per instance — a brake, not a wall)
//   400  not JSON, or JSON that is not an object (null, an array, a string)
// …and two helpers the routes call later: the honeypot, and Cloudflare
// Turnstile, which is enforced ONLY when BOTH keys are set —
// TURNSTILE_SECRET_KEY and NEXT_PUBLIC_TURNSTILE_SITE_KEY (turnstileOn in
// ./mail). The secret alone checks nothing: no widget renders without the
// site key, so a check would refuse every form.
//
// Plain `Response`, no Next.js imports and no `@/` paths, so the gate can be
// exercised from a plain Node script (imgss/readiness-2026-10-31/fix-backend/).
// ============================================================================

/** A form field as plain text: control characters (which would corrupt a log
 *  line or an email header) out, trimmed, capped. Only strings, numbers and
 *  booleans count — anything else is "", because String() on a crafted
 *  object such as {"toString":1,"valueOf":1} throws, and that was a 500. */
export const clean = (v: unknown, max = 400) =>
  (typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, max);

export const reply = (data: unknown, status = 200, headers?: HeadersInit) =>
  Response.json(data, { status, headers });

export const clientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim() || "local";

const buckets = new Map<string, Map<string, { n: number; until: number }>>();
/** when each bucket was last swept of expired addresses */
const swept = new Map<string, number>();

/** true once `ip` has used up `max` requests to `bucket` inside the window.
 *  One map per route, so a message sent does not count against an order. */
export function limited(bucket: string, ip: string, max = 6, windowMs = 10 * 60_000) {
  let hits = buckets.get(bucket);
  if (!hits) buckets.set(bucket, (hits = new Map()));
  const now = Date.now();
  // A long-lived instance must not keep every address it has ever seen — but
  // at most ONE sweep a minute per bucket (2026-11-01, review SRV-3): with
  // more than 5000 addresses still inside their window the sweep frees
  // nothing, and running it on every request walked the whole map each time,
  // so each request cost more the more addresses had been seen. Between
  // sweeps the map can only grow by the new addresses of that minute.
  if (hits.size > 5000 && now - (swept.get(bucket) ?? 0) > 60_000) {
    swept.set(bucket, now);
    for (const [k, h] of hits) if (now > h.until) hits.delete(k);
  }
  const h = hits.get(ip);
  if (!h || now > h.until) {
    hits.set(ip, { n: 1, until: now + windowMs });
    return false;
  }
  h.n += 1;
  return h.n > max;
}

/** An Origin header naming a host this request was not addressed to. The
 *  allowed hosts are the ones the request itself arrived on (Vercel sets
 *  x-forwarded-host) plus the configured public origin. "null" — a sandboxed
 *  frame, a file:// page — is foreign too. No header at all is not: curl and
 *  server-to-server callers send none, and they are not a CSRF risk. */
export function foreignOrigin(req: Request, site?: string) {
  const o = req.headers.get("origin");
  if (!o) return false;
  let host: string;
  try {
    host = new URL(o).host.toLowerCase();
  } catch {
    return true;
  }
  if (!host) return true;
  const ours = new Set<string>();
  const add = (h: string | null | undefined) => h && ours.add(h.trim().toLowerCase());
  add(req.headers.get("x-forwarded-host")?.split(",")[0]);
  add(req.headers.get("host"));
  try {
    add(new URL(req.url).host);
  } catch {
    /* relative url in a test harness */
  }
  if (site) {
    try {
      add(new URL(site).host);
    } catch {
      /* unset or malformed — the request's own host still counts */
    }
  }
  return !ours.has(host);
}

type Gate = { body: Record<string, unknown>; ip: string; res?: undefined } | { res: Response };

/** The shared gate. Returns either the parsed object body or the response
 *  that ends the request. `busy` is the route's own 429 sentence. */
export async function intake(req: Request, o: { bucket: string; busy: string; site?: string }): Promise<Gate> {
  if (foreignOrigin(req, o.site)) return { res: reply({ ok: false, error: "Forbidden" }, 403) };
  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") {
    return { res: reply({ ok: false, error: "Send the form as JSON (Content-Type: application/json)." }, 415) };
  }
  const ip = clientIp(req);
  if (limited(o.bucket, ip)) return { res: reply({ ok: false, error: o.busy }, 429) };
  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return { res: reply({ ok: false, error: "Bad request" }, 400) };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { res: reply({ ok: false, error: "Bad request" }, 400) };
  }
  return { body: parsed as Record<string, unknown>, ip };
}

/** THE HONEYPOT: a field people never see or fill. "hp" since 2026-10-31 —
 *  "company" was autofill bait, so a real buyer's browser could fill it and
 *  have the order silently dropped. The old name is still read, for tabs
 *  opened before the deploy. */
export const caught = (body: Record<string, unknown>) => !!(clean(body.hp) || clean(body.company));

// ---------------------------------------------------------------------------
// CLOUDFLARE TURNSTILE — the server half. The widget in the form produces a
// one-use token; here it is exchanged with Cloudflare for a yes or no. With
// no TURNSTILE_SECRET_KEY (or no site key) the check is off and every route
// works as before.
// The routes call it AFTER their own field checks pass, so a token is spent
// only on a request that would otherwise be accepted — a typo in the email
// does not cost the buyer a new check.
// ---------------------------------------------------------------------------

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// (turnstileOn — both keys set — is in ./mail and re-exported at the top)

const NO_TOKEN = "Please complete the quick check on the form, then send again.";
const FAILED = "The check did not pass. Please try it once more, then send again.";
const UNREACHABLE = "The check could not be confirmed just now. Please try again in a minute.";

/** `deadline`: the route's (lib/server/mail.ts, TIME) — the check comes
 *  first, so in practice it always gets its full 2 × 8 s.
 *  `action`: the form's own name for its check ("order", "contact",
 *  "signin" — the widget's `action` prop). A token Cloudflare says was made
 *  for ANOTHER form is refused (2026-11-03, peer review #8), so a check
 *  passed on the contact form cannot carry an order. Compared only when
 *  Cloudflare names one: its test keys answer with no action at all (and
 *  hostname "example.com", which is why the hostname is not compared — the
 *  site key's own domain list in Cloudflare already limits where a token
 *  can be made). */
export async function verifyTurnstile(
  token: string,
  ip: string,
  deadline = Infinity,
  action?: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !turnstileOn()) return { ok: true };
  if (!token) return { ok: false, message: NO_TOKEN };
  const form = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "local") form.set("remoteip", ip);
  // lets fetchRetry's second try be answered as the first, instead of as a
  // token that was already redeemed (Cloudflare's own retry mechanism)
  form.set("idempotency_key", randomUUID());
  const r = await fetchRetry(
    SITEVERIFY,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    },
    { deadline },
  );
  if (!r || !r.ok) return { ok: false, message: UNREACHABLE };
  try {
    const data = (await r.json()) as { success?: unknown; action?: unknown };
    if (data.success !== true) return { ok: false, message: FAILED };
    if (action && typeof data.action === "string" && data.action && data.action !== action) {
      return { ok: false, message: FAILED };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}

/** null when the request may go on; otherwise the 403 that ends it, in the
 *  shape old and new forms both read: `error` for a tab older than the
 *  widget, `errors.turnstile` for the line next to the button. */
export async function botCheck(
  body: Record<string, unknown>,
  ip: string,
  deadline = Infinity,
  action?: string,
): Promise<Response | null> {
  if (!turnstileOn()) return null;
  const v = await verifyTurnstile(clean(body.turnstile, 2048), ip, deadline, action);
  if (v.ok) return null;
  return reply({ ok: false, error: v.message, errors: { turnstile: v.message } }, 403);
}
