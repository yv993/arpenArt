import { randomBytes } from "node:crypto";
import { origin as site } from "@/lib/site";
import { botCheck, caught, clean, intake, reply } from "@/lib/server/intake";
import { deadlineOf, deliver } from "@/lib/server/mail";

// Zero-dependency contact intake. Same honesty contract as the order route:
// with no delivery configured it returns delivered:false and the UI offers the
// artist's email instead of pretending the message went out.
//
// THE SENDER (client, change 4.pdf p16, 2026-10-12: «էս էջը աշխատելու ա՞ … իմ
// մեյլին նամակ կգա՞» — will a letter reach my mail?) is now the shop's one
// sender, MAIL_FROM, shared with the order and sign-in mail (readiness #2,
// 2026-10-31); CONTACT_FROM is still honoured as its fallback. Resend's
// onboarding@resend.dev delivers ONLY to the Resend account's own address, so
// reaching arpenbaroyan@gmail.com from an account that is not hers needs a
// sender on a domain verified in Resend — see lib/server/mail.ts.

export const runtime = "nodejs";
// Worst case: siteverify 16.4 s + (webhook 24.4 ‖ Resend 25.9) = 42.3 s, under
// the 50 s deadline this limit gives (60 s less a 10 s margin). The deadline
// is passed down anyway, so a later change to those timeouts cannot push the
// route past its limit (lib/server/mail.ts, TIME).
export const maxDuration = 60;

export async function POST(req: Request) {
  const deadline = deadlineOf(maxDuration);
  const gate = await intake(req, { bucket: "contact", busy: "Too many messages. Try again shortly.", site });
  if (gate.res) return gate.res;
  const { body, ip } = gate;

  // honeypot — accept, then drop
  if (caught(body)) return reply({ ok: true, delivered: false });

  const name = clean(body.name, 120);
  const email = clean(body.email, 160);
  const message = clean(body.message, 2000);

  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = "Please give a name.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = "That email does not look right.";
  if (message.length < 8) errors.message = "A sentence or two is enough.";
  // the consent box, checked here too (2026-10-05): the form sends
  // `consent: true` only once it is ticked, and before this date the route
  // never asked — an unticked message from any client was accepted. The
  // sentence is the form's own, so either check reads the same.
  if (body.consent !== true) errors.consent = "Please tick the box so Arpine may reply to you.";
  if (Object.keys(errors).length) return reply({ ok: false, errors }, 422);

  const blocked = await botCheck(body, ip, deadline, "contact");
  if (blocked) return blocked;

  const text = `ArpenArt enquiry\n\n${name} <${email}>\n\n${message}`;
  const to = process.env.ORDER_TO_EMAIL;
  // webhook AND email when both are set; no copy to the sender — a contact
  // form that mails whatever was typed to any address is a spam relay
  const out = await deliver({
    key: `contact-${randomBytes(6).toString("hex")}`,
    deadline,
    webhook: { url: process.env.CONTACT_WEBHOOK_URL, payload: { name, email, message } },
    owner: to ? { to, replyTo: email, subject: `Enquiry from ${name}`, text } : undefined,
  });

  if (!out.delivered) console.log("[arpenart contact — NOT DELIVERED]\n" + text);
  else if (out.webhook === false || out.email === false) {
    console.warn(`[arpenart contact] delivered, but ${out.webhook === false ? "the webhook" : "the email"} failed`);
  }
  return reply({ ok: true, delivered: out.delivered });
}
