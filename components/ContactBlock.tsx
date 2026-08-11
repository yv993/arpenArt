"use client";

import { useState } from "react";
import Link from "next/link";
import { brand, home } from "@/lib/content";
import Socials from "./Socials";

type State = "idle" | "sending" | "sent" | "logged" | "error";

export default function ContactBlock({
  heading = "h2",
}: {
  /** h1 on /contact, where this IS the page; h2 anywhere it is a section */
  heading?: "h1" | "h2";
}) {
  const [state, setState] = useState<State>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const Title = heading;

  const send = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state === "sending") return;
    const form = e.currentTarget;
    const f = new FormData(form);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    setState("sending");
    setErrors({});
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: get("name"),
          email: get("email"),
          message: get("message"),
          company: get("company"),
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

        <form className="ap-contact__form" onSubmit={send} noValidate>
          <div className="ap-pot" aria-hidden="true">
            <label htmlFor="c-company">Company</label>
            <input id="c-company" name="company" tabIndex={-1} autoComplete="off" />
          </div>

          <label className="ap-field">
            <span>{home.contact.fields.name}</span>
            <input name="name" required autoComplete="name" aria-invalid={!!errors.name} />
            {errors.name && <em className="ap-contact__warn">{errors.name}</em>}
          </label>
          <label className="ap-field">
            <span>{home.contact.fields.email}</span>
            <input name="email" type="email" required autoComplete="email" aria-invalid={!!errors.email} />
            {errors.email && <em className="ap-contact__warn">{errors.email}</em>}
          </label>
          <label className="ap-field">
            <span>{home.contact.fields.message}</span>
            <textarea name="message" rows={4} required aria-invalid={!!errors.message} />
            {errors.message && <em className="ap-contact__warn">{errors.message}</em>}
          </label>

          <label className="ap-field" style={{ gridAutoFlow: "column", justifyContent: "start", gap: 10, alignItems: "center" }}>
            <input type="checkbox" name="consent" required style={{ width: "auto" }} />
            <span style={{ letterSpacing: 0, textTransform: "none", fontSize: "12.5px" }}>
              {home.contact.consent} — <Link href="/privacy">privacy</Link>
            </span>
          </label>

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

          <button className="ap-btn" type="submit" disabled={state === "sending"}>
            {state === "sending" ? home.contact.sending : home.contact.send}
          </button>
        </form>
      </div>
    </section>
  );
}
