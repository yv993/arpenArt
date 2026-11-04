import { readSession, SESSION_COOKIE, signInOn } from "@/lib/server/auth";

// WHO IS SIGNED IN, for the order and contact forms to start filled in — the
// one promise the account page makes (readiness #13, 2026-10-31). Name and
// email only, and only to this visitor's own browser: the session cookie is
// httpOnly, so the page cannot read it itself. {} when signed out or when
// sign-in is off. never cached — a shared cache must not hand one buyer's
// address to the next.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store", Vary: "Cookie" };

/** one cookie's value from the raw header — no next/headers, so the route
 *  can be called outside a Next request too (the fix-backend test) */
function cookie(header: string | null, name: string) {
  for (const part of (header ?? "").split(";")) {
    const at = part.indexOf("=");
    if (at > 0 && part.slice(0, at).trim() === name) {
      try {
        return decodeURIComponent(part.slice(at + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export async function GET(req: Request) {
  if (!signInOn()) return Response.json({}, { headers: NO_STORE });
  const who = readSession(cookie(req.headers.get("cookie"), SESSION_COOKIE));
  return Response.json(who ? { ...(who.name ? { name: who.name } : {}), email: who.email } : {}, {
    headers: NO_STORE,
  });
}
