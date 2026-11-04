"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { brand, home } from "@/lib/content";
import Socials from "./Socials";
import Turnstile, { botCheckWords, tickWords, turnstileToken } from "./Turnstile";

type State = "idle" | "sending" | "sent" | "logged" | "error";

/** the fields a Return can move between: typed ones only — never the consent
 *  box — and never the hidden honeypot (tabIndex -1) */
const TEXT_FIELDS = 'input:not([type="checkbox"]):not([tabindex="-1"]), textarea';

/** the same rule as /api/contact */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const SIGNIN = process.env.NEXT_PUBLIC_SIGNIN === "1";

export default function ContactBlock({
  heading = "h2",
}: {
  /** h1 on /contact, where this IS the page; h2 anywhere it is a section */
  heading?: "h1" | "h2";
}) {
  const [state, setState] = useState<State>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** what was typed, kept when the site could not deliver it — see `send` */
  const [kept, setKept] = useState<{ name: string; email: string; message: string } | null>(null);
  // bumped after every send attempt — a bot-check token is single-use
  const [tsReset, setTsReset] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const Title = heading;

  // A SEND BEFORE THE SCRIPT HAD STARTED (2026-11-03, NF-E1/CR4-F1): the
  // browser's own submit went to /api/early, which reads nothing and sends
  // the visitor back here with #not-sent. The form came back empty, which
  // looks just like a message that went. So it says it did not, beside Send,
  // and the fragment leaves the address.
  const noteRef = useRef<HTMLParagraphElement>(null);
  const toNote = useRef(false);
  useEffect(() => {
    if (window.location.hash !== "#not-sent") return;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    toNote.current = true;
    setErrors({ turnstile: "Your message was not sent, because the page was still loading. Please type it again and send, or write to" });
  }, []);
  // the page opened at its top, and the words are under the form
  useEffect(() => {
    if (!toNote.current || !noteRef.current) return;
    toNote.current = false;
    noteRef.current.scrollIntoView({ block: "center" });
  }, [errors]);

  // SIGNED IN, THE NAME AND EMAIL ARE ALREADY THERE (contract 6) — one
  // fetch, only where sign-in is on, and only into fields still empty
  useEffect(() => {
    if (!SIGNIN) return;
    const ac = new AbortController();
    fetch("/api/auth/me", { cache: "no-store", signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: unknown) => {
        const f = formRef.current;
        if (!f || !d || typeof d !== "object") return;
        for (const k of ["name", "email"] as const) {
          const v = (d as Record<string, unknown>)[k];
          const el = f.elements.namedItem(k);
          if (el instanceof HTMLInputElement && !el.value && typeof v === "string" && v) el.value = v;
        }
      })
      .catch(() => {});
    return () => ac.abort();
  }, []);

  /** her address with the visitor's message prefilled, for the mail app —
   *  the same subject the route itself sends under, so her inbox reads the
   *  same either way */
  const mailtoWith = (k: { name: string; email: string; message: string }) =>
    `mailto:${brand.email}?subject=${encodeURIComponent(`Enquiry from ${k.name}`)}&body=${encodeURIComponent(`${k.message}\n\n${k.name} <${k.email}>`)}`;

  // put the keyboard where the fix is — the first field rejected, in the
  // order they appear in the form (the cart's focusFirst, CartView.tsx)
  const focusFirst = (form: HTMLFormElement, errs: Record<string, string>) => {
    const first = ["name", "email", "message", "consent"].find((k) => errs[k]);
    if (!first) return;
    (form.querySelector(`[name="${first}"]`) as HTMLElement | null)?.focus();
  };

  const send = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state === "sending") return;
    const form = e.currentTarget;
    const f = new FormData(form);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    setErrors({});
    // CONSENT WAS NEVER READ (2026-10-05). The form is noValidate — so the
    // server's messages are the one voice — which means `required` on the
    // box does nothing, and an unticked Send went out regardless (measured:
    // the request fired with no consent in it, and the route did not ask).
    // Enforced here first, as the cart does, and again by the route.
    // EVERY FIELD AT ONCE since 2026-10-31 (readiness P3): consent alone was
    // checked here, so the other problems came back one round late. The
    // route's own rules and words (app/api/contact/route.ts); it decides.
    const errs: Record<string, string> = {};
    if (get("name").length < 2) errs.name = "Please give a name.";
    if (!EMAIL.test(get("email"))) errs.email = "That email does not look right.";
    if (get("message").length < 8) errs.message = "A sentence or two is enough.";
    if (!f.get("consent")) errs.consent = "Please tick the box so Arpine may reply to you.";
    if (Object.keys(errs).length) {
      setErrors(errs);
      focusFirst(form, errs);
      return;
    }
    setState("sending");
    let tried = false;
    try {
      // undefined when the bot check is off — then no field is sent
      const ts = await turnstileToken(form);
      // the visitor left the page while the check was awaited: nothing goes
      // (CartView's guard, 2026-11-03, TS4-1) — it sent "" to a page nobody
      // saw, and spent one of their tries
      if (!form.isConnected) return;
      // a check on screen waiting for a tick: say so, send nothing (CartView)
      const tick = tickWords(form, ts, "write to");
      if (tick) {
        setErrors({ turnstile: tick });
        setState("idle");
        return;
      }
      tried = ts !== undefined;
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: get("name"),
          email: get("email"),
          message: get("message"),
          // the honeypot, renamed from "company" (autofill filled it)
          hp: get("hp"),
          ...(ts !== undefined ? { turnstile: ts } : {}),
          consent: true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        delivered?: boolean;
        errors?: Record<string, string>;
      };
      if (res.status === 422 && data.errors) {
        setErrors(data.errors);
        setState("idle");
        // after a 422 the focus sat on <body> and nothing was announced
        focusFirst(form, data.errors);
        return;
      }
      // the bot check said no: its words go next to the button — or, with no
      // check on the page to complete, what happened (Turnstile.tsx)
      if (res.status === 403 && data.errors?.turnstile) {
        setErrors({ turnstile: botCheckWords(form, data.errors.turnstile, "write to") });
        setState("idle");
        return;
      }
      // too many tries: wait, rather than "try again" (CartView, 2026-11-03)
      if (res.status === 429) {
        setErrors({ turnstile: "Too many tries from this connection. Please wait up to ten minutes, then send again, or write to" });
        setState("idle");
        return;
      }
      if (!res.ok || !data.ok) {
        setState("error");
        return;
      }
      if (data.delivered) {
        setState("sent");
        form.reset();
        return;
      }
      // NOT DELIVERED (client, change 4.pdf p16, 2026-10-12: «իմ մեյլին նամակ
      // կգա՞» — will a letter reach my mail?). The route only logged it (no
      // webhook or Resend configured), so the page must not pretend: the
      // typed message stays in the form, and the line under it carries the
      // same text into the visitor's own mail app, addressed to her. The
      // form.reset() this branch used to share with success wiped the one
      // copy the visitor had.
      setKept({ name: get("name"), email: get("email"), message: get("message") });
      setState("logged");
    } catch {
      setState("error");
    } finally {
      // a token is spent once it has been sent — ask for a fresh one
      if (tried) setTsReset((n) => n + 1);
    }
  };

  // a field being fixed stops saying it is wrong
  const unflag = (e: React.FormEvent<HTMLFormElement>) => {
    const n = (e.target as HTMLInputElement).name;
    if (n && errors[n]) setErrors(({ [n]: _gone, ...rest }) => rest);
  };

  // Return in Name means "next", not "send", on a phone — the cart's
  // enterNext (CartView.tsx), which has the measurements; desktop keyboards
  // keep implicit submission
  const enterNext = (e: React.KeyboardEvent<HTMLFormElement>) => {
    const t = e.target;
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    if (!(t instanceof HTMLInputElement) || t.enterKeyHint !== "next") return;
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const fields = [...e.currentTarget.querySelectorAll<HTMLElement>(TEXT_FIELDS)];
    const next = fields[fields.indexOf(t) + 1];
    if (!next) return;
    e.preventDefault();
    next.focus();
  };

  // an error <em> sits inside its field's label, so each field is NAMED by
  // its label text alone (aria-labelledby) and the error is its DESCRIPTION —
  // read once, after the name, instead of being folded into it
  const err = (k: string) =>
    errors[k] ? { "aria-describedby": `c-${k}-err`, "aria-invalid": true as const } : { "aria-invalid": false as const };

  return (
    <section className="ap-sec" id="contact">
      <div className="ap-contact__grid">
        <div className="ap-sec__head" style={{ marginBottom: 0 }}>
          <p className="ap-kicker">{home.contact.kicker}</p>
          <Title className="ap-h2" data-tfx="focus">
            {home.contact.title}
          </Title>
          <p className="ap-lede">{home.contact.copy}</p>
          <p>
            <a className="ap-about__link" href={`mailto:${brand.email}`}>
              {brand.email}
            </a>
          </p>
          {/* the other way to reach her — hover (or tab into) the card */}
          <Socials />
        </div>

        {/* method="post" to /api/early: a Send before the script starts must
            not put the message in the address bar, and lands back here —
            see app/api/early/route.ts */}
        <form
          className="ap-contact__form"
          ref={formRef}
          method="post"
          action="/api/early?to=/contact"
          onSubmit={send}
          onKeyDown={enterNext}
          onInput={unflag}
          noValidate
        >
          {/* the honeypot — "Company" invited autofill; see CartView.tsx */}
          <div className="ap-pot" aria-hidden="true">
            <label htmlFor="c-hp">Leave this field empty</label>
            <input id="c-hp" name="hp" tabIndex={-1} autoComplete="off" />
          </div>

          <label className="ap-field">
            <span id="c-name-lab">{home.contact.fields.name}</span>
            <input name="name" required autoComplete="name" enterKeyHint="next" aria-labelledby="c-name-lab" {...err("name")} />
            {errors.name && (
              <em id="c-name-err" className="ap-contact__warn">
                {errors.name}
              </em>
            )}
          </label>
          <label className="ap-field">
            <span id="c-email-lab">{home.contact.fields.email}</span>
            <input name="email" type="email" required autoComplete="email" aria-labelledby="c-email-lab" {...err("email")} />
            {errors.email && (
              <em id="c-email-err" className="ap-contact__warn">
                {errors.email}
              </em>
            )}
          </label>
          <label className="ap-field">
            <span id="c-message-lab">{home.contact.fields.message}</span>
            <textarea name="message" rows={4} required aria-labelledby="c-message-lab" {...err("message")} />
            {errors.message && (
              <em id="c-message-err" className="ap-contact__warn">
                {errors.message}
              </em>
            )}
          </label>

          {/* .ap-consent, the cart's own consent row, instead of the inline
              styles this used to carry: the same layout on a desktop, and the
              inline `width: auto` no longer out-ranks the touch rule that
              draws the box at 22px (it measured 13px here, 22px on /cart) */}
          <label className="ap-field ap-consent">
            <input type="checkbox" name="consent" required {...err("consent")} />
            {/* a new tab, so the message typed so far survives reading it —
                the cart's link, CartView.tsx */}
            <span>
              {home.contact.consent} —{" "}
              <Link href="/privacy" target="_blank" rel="noopener">
                privacy<span className="ap-sr"> (opens in a new tab)</span>
              </Link>
            </span>
          </label>
          {errors.consent && (
            <em id="c-consent-err" className="ap-contact__warn">
              {errors.consent}
            </em>
          )}

          {/* the bot check — nothing at all unless its site key is set */}
          <Turnstile action="contact" reset={tsReset} />
          {errors.turnstile && (
            <p className="ap-contact__warn" role="alert" ref={noteRef}>
              {errors.turnstile} <a href={`mailto:${brand.email}`}>{brand.email}</a>.
            </p>
          )}

          {state === "sent" && (
            <p className="ap-contact__ok" role="status">
              {home.contact.ok}
            </p>
          )}
          {(state === "logged" || state === "error") && (
            <p className="ap-contact__warn" role="alert">
              {state === "logged" ? home.contact.logged : home.contact.failed}{" "}
              <a href={`mailto:${brand.email}`}>{brand.email}</a>
              {/* the message, prefilled, so no enquiry is lost (p16) */}
              {state === "logged" && kept && (
                <>
                  {" — "}
                  <a href={mailtoWith(kept)}>{home.contact.mailApp}</a>
                </>
              )}
            </p>
          )}

          {/* aria-disabled, not disabled: a disabled button drops the focus
              it holds; `send` returns early while a request is in flight */}
          <button className="ap-btn" type="submit" aria-disabled={state === "sending" ? true : undefined}>
            {state === "sending" ? home.contact.sending : home.contact.send}
          </button>
          {/* with no script at all, Send only comes back to an empty form
              (/api/early), so the page says so before anyone types */}
          <noscript>
            <p className="ap-contact__warn">
              This form needs JavaScript to send. Please write to{" "}
              <a href={`mailto:${brand.email}`}>{brand.email}</a> instead.
            </p>
          </noscript>
        </form>
      </div>
    </section>
  );
}
