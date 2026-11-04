import { randomBytes } from "node:crypto";
import { linkToken, signInOn } from "@/lib/server/auth";
import { botCheck, caught, clean, intake, reply } from "@/lib/server/intake";
import { deadlineOf, sendMail } from "@/lib/server/mail";
import { origin as site } from "@/lib/site";
import { brand } from "@/lib/content";

// Sign-in intake. Same honesty contract as the order and contact routes:
// delivered is true only when Resend accepted the mail.
//
// It runs only when sign-in can work end to end — signInOn(): a signing
// secret AND mail that can reach a stranger (readiness #13, 2026-10-31).
// Before, it would issue links with no mail set up at all, and the mail it
// did try was sent "From" Arpine's gmail, which Resend refuses. It now uses
// the shop's one sender (lib/server/mail.ts), and a link that could not be
// mailed is printed to the console in development only: in production a
// working link in a log is a key anyone with log access could use.

export const runtime = "nodejs";
// Worst case: siteverify 16.4 s + the mail 25.9 s (with Resend's 409 "still
// busy" retry) = 42.3 s, under the 50 s deadline this limit gives; the
// deadline is passed down all the same (lib/server/mail.ts, TIME).
export const maxDuration = 60;

export async function POST(req: Request) {
  const deadline = deadlineOf(maxDuration);
  if (!signInOn()) {
    return reply({ ok: false, error: "Sign-in is not switched on yet." }, 503);
  }

  const gate = await intake(req, { bucket: "auth", busy: "Too many attempts. Try again shortly.", site });
  if (gate.res) return gate.res;
  const { body, ip } = gate;

  // honeypot — accept, then drop
  if (caught(body)) return reply({ ok: true, delivered: false });

  const email = clean(body.email, 160).toLowerCase();
  const name = clean(body.name, 120);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return reply({ ok: false, errors: { email: "That email does not look right." } }, 422);
  }

  const blocked = await botCheck(body, ip, deadline, "signin");
  if (blocked) return blocked;

  // THE SITE'S ONE PUBLIC ADDRESS (lib/site.ts), which that file says sign-in
  // links use (2026-11-03, peer review #5). This built its own: the variable,
  // else the host the request came in on — so with the variable unset the
  // mail pointed at whatever address took the request (a preview URL), and
  // off Vercel at whatever Host header a stranger sent, a link to their site
  // carrying a real sign-in token.
  const link = `${site}/account/verify?token=${encodeURIComponent(linkToken(email, name))}`;

  // The link can be opened again until it expires (no database to remember
  // a used one), so the mail says only what is true: it expires.
  const delivered = await sendMail(
    {
      to: email,
      subject: `Your ${brand.name} sign-in link`,
      text:
        `Open this link to sign in. It expires in 15 minutes.\n\n${link}\n\n` +
        `If you did not ask for it, nothing has happened — ignore this message.`,
    },
    `signin-${randomBytes(6).toString("hex")}`,
    deadline,
  );

  if (!delivered) {
    if (process.env.NODE_ENV === "production") console.log("[auth] a sign-in mail was not delivered");
    // the developer's copy, so the flow is testable before mail is wired
    else console.log(`[auth] sign-in link for ${email}:\n${link}`);
  }

  // ALWAYS ok:true, and never "no such account": whether an address has been
  // seen before is not something a stranger gets to probe by watching which
  // messages differ.
  return reply({ ok: true, delivered });
}
