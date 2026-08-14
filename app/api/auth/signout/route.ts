import { NextResponse } from "next/server";
import { sessionCookie } from "@/lib/server/auth";

// POST, not GET: signing out changes state, and a GET would let any image
// tag on any page log this visitor out.

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie("", 0));
  return res;
}
