import { createHmac } from "node:crypto";

// ============================================================================
// EVERYTHING THE SHOP SENDS OUT, IN ONE PLACE (readiness #2, #15, 2026-10-31).
//
// Before this file each route carried its own fetch to Resend, and they had
// drifted apart: the order route hard-coded `onboarding@resend.dev` for both
// of its sends, the contact route honoured CONTACT_FROM, and the sign-in route
// sent "From" Arpine's gmail — which Resend refuses outright. And an order went
// to the webhook OR to Arpine's inbox, never both, with the buyer's copy sent
// even when Arpine's had failed.
//
// The rules now, for every route:
//   · ONE SENDER — MAIL_FROM, else the legacy CONTACT_FROM, else Resend's
//     onboarding address (which delivers only to the Resend account's owner).
//   · BOTH CHANNELS when both are configured; "delivered" means at least one
//     of them answered 2xx — never more than that.
//   · THE BUYER'S COPY only after a delivery, only from a verified sender
//     (onboarding@resend.dev can never reach a stranger's inbox, so trying
//     would only report a failure the buyer cannot act on) — and only while
//     Turnstile is enforced (2026-11-01, review SRV-1). The copy goes to
//     whatever address the form names and carries the typed delivery address,
//     so without the bot check a script could make the shop mail its own text
//     to anyone, from the shop's verified sender: an open relay.
//   · EVERY CALL has a timeout and one retry (network error, 5xx, 429), and
//     every Resend call an Idempotency-Key, so the retry cannot send twice.
//   · EVERY ROUTE HAS A DEADLINE (2026-11-01): each attempt's timeout is cut
//     to the time the request has left, and an attempt that would start too
//     late is skipped — see TIME below for the arithmetic.
//
// No Next.js imports and no `@/` paths on purpose: the delivery rules can be
// exercised by a plain Node script against a local mock server
// (imgss/readiness-2026-10-31/fix-backend/), without the internet.
// ============================================================================

const RESEND = "https://api.resend.com";
const ONBOARDING = "ArpenArt <onboarding@resend.dev>";

/** The one sender for every message: the order to Arpine, the buyer's copy,
 *  the contact form and the sign-in link. */
export const mailFrom = () => process.env.MAIL_FROM || process.env.CONTACT_FROM || ONBOARDING;

/** A sender on a domain verified in Resend — i.e. one that is set and is not
 *  Resend's shared onboarding address. Only such a sender can reach a buyer. */
export const senderVerified = () => {
  const set = process.env.MAIL_FROM || process.env.CONTACT_FROM || "";
  return !!set && !set.includes("@resend.dev");
};

export const resendOn = () => !!process.env.RESEND_API_KEY;

/** CLOUDFLARE TURNSTILE IS ENFORCED when the secret is set — and the site key
 *  too: without the site key the forms render no widget, so a check on the
 *  secret alone would turn away every order and message while /api/health
 *  reported turnstile:false. It lives here, not in intake.ts, since
 *  2026-11-01 (review SRV-1): the buyer's copy depends on it, and intake.ts
 *  already imports from this file, so the reverse import would be a cycle.
 *  intake.ts re-exports it. (`process.env.NEXT_PUBLIC_…` written out
 *  literally so the build inlines it.) */
export const turnstileOn = () => !!process.env.TURNSTILE_SECRET_KEY && !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** What is switched on, as booleans only — for /api/health. Never a value.
 *  `buyerCopy` is the same rule deliver() applies, so health never promises
 *  a copy that would not be sent. */
export function mailStatus() {
  const resendToArpine = resendOn() && !!process.env.ORDER_TO_EMAIL;
  return {
    orders: !!process.env.ORDER_WEBHOOK_URL || resendToArpine,
    buyerCopy: resendOn() && senderVerified() && turnstileOn(),
    contact: !!process.env.CONTACT_WEBHOOK_URL || resendToArpine,
  };
}

// ---------------------------------------------------------------------------
// TIME (2026-11-01). Every route that sends runs under Vercel's maxDuration
// (60 s on all three). Per attempt, each outbound call has its own timeout:
//
//   Turnstile siteverify   8 s  + 0.4 s pause + 8 s                = 16.4 s
//   webhook               12 s  + 0.4 s pause + 12 s               = 24.4 s
//   Resend                 8 s  + 0.4 s pause + 8 s
//                          + 1.5 s + 8 s after a 409 "still busy"  = 25.9 s
//
// (The webhook got 12 s instead of 8: a Google Apps Script web app — the
// Sheet the docs suggest — can take longer than 8 s on a cold start, and a
// timed-out post that the receiver did process becomes a second post. Every
// webhook post carries an Idempotency-Key header for exactly that case.)
//
// An order runs them as: siteverify, then webhook ‖ Resend-to-Arpine side by
// side, then the buyer's copy = 16.4 + max(24.4, 25.9) + 25.9 = 68.2 s, which
// is past 60. So rather than ever smaller constants, the route passes down a
// DEADLINE: maxDuration minus a 10 s margin (body parsing, the reply, the
// time an abort takes to land) = 50 s from the request's start. Each attempt's
// timeout is cut to what is left, an attempt (or a pause before one) that
// would leave less than MIN_TRY is not started, and the request is over by
// 50 s whatever the constants say. Arpine's channels always get their full
// worst case (16.4 + 25.9 = 42.3 s); only the buyer's copy, last in line, can
// be cut short (with today's numbers it still gets at least 7.7 s, but may
// lose its retries) — then `copied` says false and the page does not claim a
// copy. /api/contact and /api/auth do siteverify +
// one round (42.3 s) and pass the same deadline, so a later change to these
// numbers cannot push them past their limit either.
// ---------------------------------------------------------------------------

/** an attempt is not started with less than this left: one cut to a few
 *  hundred milliseconds could only add a failure, not a chance */
const MIN_TRY = 1000;
/** see TIME above */
const WEBHOOK_TIMEOUT = 12_000;
/** Resend's "a request with this key is still in progress" — wait this
 *  long, then ask once more with the same key */
const BUSY_PAUSE = 1500;

/** The deadline (a Date.now() value) for a request that started now under a
 *  route's `maxDuration` in seconds: that limit less a 10 s margin. */
export const deadlineOf = (maxDurationS: number) => Date.now() + maxDurationS * 1000 - 10_000;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** let go of a body nobody reads, so the socket is freed now and not at GC */
const drain = async (r: Response) => {
  try {
    await r.body?.cancel();
  } catch {
    /* already consumed or closed */
  }
};

export type Limits = {
  /** per attempt, before the deadline cuts it (default 8 s) */
  timeoutMs?: number;
  /** a Date.now() value the whole call must end by (default: none) */
  deadline?: number;
  /** 2 (default) = one retry; 1 = a single attempt */
  tries?: number;
};

/** A POST that gives up after `timeoutMs` and tries ONCE more on a network
 *  error (a timeout included), a 5xx or a 429. Any other answer — 2xx or a
 *  4xx that a second try would only repeat — is returned as it is. null means
 *  nothing answered at all, or no time was left to ask. The body must be a
 *  string so it can be resent. With a `deadline`, every attempt's timeout is
 *  cut to the time left, and a retry that would start with less than MIN_TRY
 *  left is not made: the answer in hand (a 5xx) is returned instead. */
export async function fetchRetry(
  url: string,
  init: RequestInit & { body: string },
  { timeoutMs = 8000, deadline = Infinity, tries = 2 }: Limits = {},
): Promise<Response | null> {
  const room = (pause: number) => deadline - Date.now() - pause >= MIN_TRY;
  for (let attempt = 0; attempt < tries; attempt++) {
    const last = attempt === tries - 1;
    const left = deadline - Date.now();
    if (left < MIN_TRY) return null;
    try {
      const r = await fetch(url, { ...init, signal: AbortSignal.timeout(Math.min(timeoutMs, left)) });
      // Resend's limit is a few requests a second, and an order sends two
      const pause = r.status === 429 ? 1000 : 400;
      if (!last && (r.status >= 500 || r.status === 429) && room(pause)) {
        await drain(r);
        await wait(pause);
        continue;
      }
      return r;
    } catch {
      if (last || !room(400)) return null;
      await wait(400);
    }
  }
  return null;
}

/** the `name` of a JSON error body ("" when there is none) — reads the body */
const errorName = async (r: Response) => {
  try {
    const j = (await r.json()) as { name?: unknown } | null;
    return typeof j?.name === "string" ? j.name : "";
  } catch {
    return "";
  }
};

export type Mail = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
};

/** One message through Resend, from the shared sender. true only on a 2xx.
 *  `key` becomes the Idempotency-Key: the retry inside fetchRetry, or a
 *  second press that reaches the same key, cannot deliver the mail twice.
 *
 *  A 409 (2026-11-01, Resend's idempotency docs:
 *  https://resend.com/docs/dashboard/emails/idempotency-keys and
 *  https://resend.com/docs/api-reference/errors): `concurrent_idempotent_
 *  requests` means the first attempt with this key is STILL being processed
 *  — typically one that timed out here but reached Resend — and that it is
 *  safe to retry later. So: wait BUSY_PAUSE, ask once more with the same key,
 *  and take that answer (a 200 there is the first attempt's own result, not a
 *  second mail). Reading it as a failure used to log NOT DELIVERED for an
 *  order Arpine did get, and invite the buyer to send it again. Any other
 *  409 (`invalid_idempotent_request`: same key, different body) is a failure. */
export async function sendMail(m: Mail, key: string, deadline = Infinity): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !m.to) return false;
  const base = (process.env.RESEND_API_BASE || RESEND).replace(/\/+$/, "");
  const init = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": key.slice(0, 256),
    },
    body: JSON.stringify({
      from: mailFrom(),
      to: [m.to],
      subject: m.subject,
      text: m.text,
      ...(m.replyTo ? { reply_to: m.replyTo } : {}),
    }),
  };
  let r = await fetchRetry(`${base}/emails`, init, { deadline });
  if (r?.status === 409) {
    const busy = (await errorName(r)) === "concurrent_idempotent_requests";
    if (!busy || deadline - Date.now() - BUSY_PAUSE < MIN_TRY) return false;
    await wait(BUSY_PAUSE);
    r = await fetchRetry(`${base}/emails`, init, { deadline, tries: 1 });
  }
  if (!r) return false;
  await drain(r);
  return r.ok;
}

/** "sha256=<hex HMAC-SHA256 of the exact raw body>" — what a receiver
 *  recomputes with the same WEBHOOK_SECRET to know the post came from here. */
export const signBody = (raw: string, secret: string) =>
  "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");

/** One JSON post to an owner-configured webhook. The body is serialised once
 *  and that exact string is both signed and sent, so the signature always
 *  matches what arrives. true only on a 2xx. A receiver slower than
 *  WEBHOOK_TIMEOUT can get the same post twice (the retry); both carry the
 *  same Idempotency-Key, which is what it should de-duplicate on. */
export async function postWebhook(url: string, payload: unknown, key: string, deadline = Infinity): Promise<boolean> {
  const raw = JSON.stringify(payload);
  const headers: Record<string, string> = { "Content-Type": "application/json", "Idempotency-Key": key };
  const secret = process.env.WEBHOOK_SECRET;
  if (secret) headers["X-ArpenArt-Signature"] = signBody(raw, secret);
  const r = await fetchRetry(url, { method: "POST", headers, body: raw }, { timeoutMs: WEBHOOK_TIMEOUT, deadline });
  if (!r) return false;
  await drain(r);
  return r.ok;
}

export type Outcome = {
  /** at least one channel answered 2xx */
  delivered: boolean;
  /** the sender's own copy answered 2xx */
  copied: boolean;
  /** per channel: true/false when tried, null when not configured */
  webhook: boolean | null;
  email: boolean | null;
};

/** THE DELIVERY RULE for an order or a message. The webhook and Arpine's
 *  email go out side by side (neither waits on the other, and neither
 *  replaces the other); the copy to whoever filled in the form follows only
 *  once one of them got through, only from a verified sender, and only while
 *  Turnstile is enforced (see the header — the same rule as mailStatus()).
 *  `key` is per request, e.g. "order-AR-7K2QF-1a2b3c4d" — it becomes
 *  "<key>-webhook", "<key>-arpine" and "<key>-buyer". `deadline`: see TIME. */
export async function deliver(o: {
  key: string;
  webhook?: { url: string | undefined; payload: unknown };
  owner?: Mail;
  copy?: Mail;
  deadline?: number;
}): Promise<Outcome> {
  const deadline = o.deadline ?? Infinity;
  const [webhook, email] = await Promise.all([
    o.webhook?.url ? postWebhook(o.webhook.url, o.webhook.payload, `${o.key}-webhook`, deadline) : null,
    o.owner?.to && resendOn() ? sendMail(o.owner, `${o.key}-arpine`, deadline) : null,
  ]);
  const delivered = webhook === true || email === true;
  const copied =
    delivered && !!o.copy && resendOn() && senderVerified() && turnstileOn()
      ? await sendMail(o.copy, `${o.key}-buyer`, deadline)
      : false;
  return { delivered, copied, webhook, email };
}
