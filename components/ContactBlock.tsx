"use client";

import { useState } from "react";
import Link from "next/link";
import { brand, home } from "@/lib/content";
import Socials from "./Socials";

type State = "idle" | "sending" | "sent" | "logged" | "error";

/** the fields a Return can move between: typed ones only — never the consent
 *  box — and never the hidden honeypot (tabIndex -1) */
const TEXT_FIELDS = 'input:not([type="checkbox"]):not([tabindex="-1"]), textarea';

export default function ContactBlock({
  heading = "h2",
}: {
  /** h1 on /contact, where this IS the page; h2 anywhere it is a section */
  heading?: "h1" | "h2";
}) {
  const [state, setState] = useState<State>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const Title = heading;

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
    if (!f.get("consent")) {
      const errs = { consent: "Please tick the box so Arpine may reply to you." };
      setErrors(errs);
      focusFirst(form, errs);
      return;
    }
    setState("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: get("name"),
          email: get("email"),
          message: get("message"),
          company: get("company"),
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
      if (!res.ok || !data.ok) {
        setState("error");
        return;
      }
      setState(data.delivered ? "sent" : "logged");
      form.reset();
    } catch {
      setState("error");
    }
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

        <form className="ap-contact__form" onSubmit={send} onKeyDown={enterNext} noValidate>
          <div className="ap-pot" aria-hidden="true">
            <label htmlFor="c-company">Company</label>
            <input id="c-company" name="company" tabIndex={-1} autoComplete="off" />
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

          {state === "sent" && (
            <p className="ap-contact__ok" role="status">
              {home.contact.ok}
            </p>
          )}
          {(state === "logged" || state === "error") && (
            <p className="ap-contact__warn" role="alert">
              {state === "logged" ? home.contact.logged : home.contact.failed}{" "}
              <a href={`mailto:${brand.email}`}>{brand.email}</a>
            </p>
          )}

          {/* aria-disabled, not disabled: a disabled button drops the focus
              it holds; `send` returns early while a request is in flight */}
          <button className="ap-btn" type="submit" aria-disabled={state === "sending" ? true : undefined}>
            {state === "sending" ? home.contact.sending : home.contact.send}
          </button>
        </form>
      </div>
    </section>
  );
}
