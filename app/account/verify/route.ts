import { NextResponse } from "next/server";
import { authReady, readLink, sessionCookie, sessionToken } from "@/lib/server/auth";

// The other end of the emailed link. A GET, because that is what a mail
// client will follow — so it does nothing destructive, only exchanges a
// short-lived signed token for the session cookie and sends the visitor to
// their account page.

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const to = (state: string) => NextResponse.redirect(new URL(`/account?s=${state}`, url.origin));

  if (!authReady()) return to("off");

  const found = readLink(url.searchParams.get("token") ?? "");
  // one message for expired, tampered and absent alike — the difference is
  // only useful to someone probing
  if (!found) return to("bad");

  const res = to("in");
  res.cookies.set(sessionCookie(sessionToken(found.email, found.name)));
  return res;
}
