import { NextResponse } from "next/server";
import { sessionCookie } from "@/lib/server/auth";
import { foreignOrigin } from "@/lib/server/intake";
import { origin as site } from "@/lib/site";

// POST, not GET: signing out changes state, and a GET would let any image
// tag on any page log this visitor out. A POST from another site's page is
// refused for the same reason (2026-10-31). No Content-Type check: the
// button posts no body at all.

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (foreignOrigin(req, site)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie("", 0));
  return res;
}
