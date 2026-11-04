import { signInOn } from "@/lib/server/auth";
import { mailStatus, turnstileOn } from "@/lib/server/mail";

// WHAT IS SWITCHED ON, as booleans (readiness #1/#16, 2026-10-31). After
// changing environment variables on Vercel and redeploying, Vardan can open
// this address and see whether orders, the buyer's copy, the contact form,
// sign-in and the bot check are configured — without sending a real order.
// Booleans only: never a value, an address or a key.
//
// `buyerCopy` needs the bot check too since 2026-11-01 (lib/server/mail.ts,
// review SRV-1): with mail set up but Turnstile not yet, expect
// orders:true, buyerCopy:false, turnstile:false. Both flags read the same
// functions the routes use, so this page cannot disagree with what they do.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      ok: true,
      ...mailStatus(),
      // the routes' own switch (2026-11-03, peer review #6): the build flag
      // alone said "on" with AUTH_SECRET missing at run time
      signIn: signInOn(),
      turnstile: turnstileOn(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
