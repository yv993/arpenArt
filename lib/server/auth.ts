import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";

// ============================================================================
// SIGN IN WITHOUT A DATABASE.
//
// This shop has no user table and no orders table — it takes requests and
// Arpine confirms them herself (see `ordering` in lib/content.ts). So the
// account here is deliberately the smallest true thing: PROOF THAT AN EMAIL
// ADDRESS BELONGS TO WHOEVER IS HOLDING THE BROWSER, and nothing more. It
// saves the buyer typing their details into every order form; it does not
// claim to remember their orders, because there is nowhere to remember them.
//
// PASSWORDS ARE NOT AN OPTION HERE, and that is a design fact rather than a
// shortcut: storing a password requires a database to store it in, and a
// site that has none can only either invent one or accept passwords and
// throw them away. A magic link needs neither — an HMAC signature over the
// address, with an expiry, verified with the same secret that wrote it.
//
// EVERY TOKEN AND COOKIE IS SIGNED WITH AUTH_SECRET. Unset, the whole
// feature refuses to run rather than falling back to a guessable key: an
// unsigned session cookie is one a visitor can write themselves.
// ============================================================================

/** 15 minutes: long enough to switch to a mail app, short enough that a link
 *  left in an inbox is not a standing key. */
const LINK_TTL = 15 * 60_000;
/** 30 days, matching the "so you do not retype it" purpose. */
const SESSION_TTL = 30 * 24 * 60 * 60_000;

export const SESSION_COOKIE = "ap_session";

/** Configured or not. Everything that can leak a half-working sign-in is
 *  gated on this — the page renders an honest notice instead. */
export const authReady = () => (process.env.AUTH_SECRET ?? "").length >= 16;

const secret = () => {
  const s = process.env.AUTH_SECRET ?? "";
  if (s.length < 16) throw new Error("AUTH_SECRET missing or too short");
  return s;
};

const b64u = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64u = (s: string) => Buffer.from(s, "base64url").toString("utf8");
const mac = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

/** constant-time compare that cannot throw on length mismatch */
function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

/** `payload.signature`, where payload is base64url JSON. One shape for both
 *  the emailed link and the session cookie; only `k` and the TTL differ. */
function sign(data: Record<string, unknown>, ttl: number) {
  const body = b64u(JSON.stringify({ ...data, exp: Date.now() + ttl }));
  return `${body}.${mac(body)}`;
}

function open(token: string): Record<string, unknown> | null {
  const [body, sig] = String(token ?? "").split(".");
  if (!body || !sig) return null;
  if (!same(sig, mac(body))) return null;
  try {
    const data = JSON.parse(unb64u(body)) as Record<string, unknown>;
    if (typeof data.exp !== "number" || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

/** THE EMAILED LINK. `k: "link"` is carried so a session cookie can never be
 *  replayed as a sign-in token or the reverse — same secret, different job. */
export const linkToken = (email: string, name?: string) =>
  sign({ k: "link", email, name: name || undefined, jti: randomUUID() }, LINK_TTL);

export function readLink(token: string): { email: string; name?: string } | null {
  const d = open(token);
  if (!d || d.k !== "link" || typeof d.email !== "string") return null;
  return { email: d.email, name: typeof d.name === "string" ? d.name : undefined };
}

export const sessionToken = (email: string, name?: string) =>
  sign({ k: "sess", email, name: name || undefined }, SESSION_TTL);

export function readSession(token: string | undefined): { email: string; name?: string } | null {
  if (!token) return null;
  const d = open(token);
  if (!d || d.k !== "sess" || typeof d.email !== "string") return null;
  return { email: d.email, name: typeof d.name === "string" ? d.name : undefined };
}

export const sessionCookie = (value: string, maxAge = SESSION_TTL / 1000) => ({
  name: SESSION_COOKIE,
  value,
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge,
  // Secure in production only: a dev server on plain http would otherwise
  // set a cookie the browser refuses to send back, and the sign-in would
  // appear to succeed and then do nothing.
  secure: process.env.NODE_ENV === "production",
});
