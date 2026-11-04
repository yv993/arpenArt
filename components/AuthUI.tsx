"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { brand } from "@/lib/content";
import Turnstile, { botCheckWords, tickWords, turnstileToken } from "./Turnstile";

// ============================================================================
// SIGN IN / CREATE ACCOUNT — one centred column of text and two fields.
//
// IT WAS A SPLIT SCREEN until 2026-10-12: the form beside a full-bleed column
// with her films (Dream 17 / Dream 21, 2026-09-15) and a typewritten quote at
// their foot. The client took that column away (change 4.pdf p17: «արի հանենք
// սա / սա էլ բերենք կենտրոն, թող մենակ տեքստերը լինի էս էջում» — let's remove
// this, bring this to the centre, let only the texts be on this page). So the
// films, their posters, the quotes and the typewriter are gone with it; what
// is left is the form column, centred on the page (app/auth.css). The two
// films are kept under imgss/redesign-2026-10-12/verify/pages/old/auth/.
//
// THE PASSWORD FIELD AND THE GOOGLE BUTTON ARE NOT HERE, and that is the
// honest part rather than a shortcut. This shop has no database: nowhere to
// store a password hash, no user table to look one up in, and no OAuth
// client. A password box that accepts a password and drops it, or a Google
// button that logs to the console, is a working-looking control that cannot
// work. The mechanism here is a signed magic link, which needs no storage at
// all — see lib/server/auth.ts.
// ============================================================================

type Panel = "in" | "up";

const COPY: Record<Panel, { title: string; sub: string; cta: string; swap: string; swapCta: string }> = {
  in: {
    title: "Sign in",
    sub: "Enter your email and we will send you a link. No password to remember.",
    cta: "Email me a link",
    swap: "First time here?",
    swapCta: "Create an account",
  },
  up: {
    title: "Create an account",
    sub: "Your name and email, once — so the order form already knows you next time.",
    cta: "Create my account",
    swap: "Already have an account?",
    swapCta: "Sign in",
  },
};

export default function AuthUI({ ready, notice }: { ready: boolean; notice?: string }) {
  const [panel, setPanel] = useState<Panel>("in");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ delivered: boolean } | null>(null);
  const [error, setError] = useState("");
  // the bot check said no — its own line, with her address to fall back on
  const [botSays, setBotSays] = useState("");
  // bumped after every attempt — a bot-check token is single-use
  const [tsReset, setTsReset] = useState(0);
  // what was typed, so going back from the confirmation brings it back: the
  // form unmounts behind that screen, and going back used to mean typing the
  // address again (review 2026-11-01); the keyboard lands in it
  const [typed, setTyped] = useState({ email: "", name: "" });
  // a link was sent in this visit — the page's notice (an expired link) no
  // longer applies
  const [asked, setAsked] = useState(false);
  // …and it is read against the LIVE address too (2026-11-03, V7-SIGNIN-1):
  // Back after a client-side link restores the page as first rendered, for
  // ?s=bad, with `asked` new again — while the address, cleaned below, says
  // /account. Next keeps this in step with history.replaceState.
  const live = useSearchParams().get("s");
  const emailRef = useRef<HTMLInputElement>(null);
  const back = useRef(false);
  useEffect(() => {
    if (sent || !back.current) return;
    back.current = false;
    emailRef.current?.focus();
  }, [sent]);
  const copy = COPY[panel];
  // a Send before the script had started came back as #not-sent from
  // /api/early, to an empty form — say that no link went (2026-11-03,
  // ContactBlock.tsx has the reasons)
  useEffect(() => {
    if (window.location.hash !== "#not-sent") return;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (ready) setBotSays("No link was sent, because the page was still loading. Please enter your email again, or write to");
  }, [ready]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || !ready) return;
    const el = e.currentTarget;
    const form = new FormData(el);
    setTyped({ email: String(form.get("email") ?? ""), name: String(form.get("name") ?? "") });
    setBusy(true);
    setError("");
    setBotSays("");
    let tried = false;
    try {
      // undefined when the bot check is off — then no field is sent
      const ts = await turnstileToken(el);
      // the visitor left the page while the check was awaited: nothing goes
      // (CartView's guard, 2026-11-03, TS4-1)
      if (!el.isConnected) return;
      // a check on screen waiting for a tick: say so, send nothing (CartView)
      const tick = tickWords(el, ts, "write to");
      if (tick) {
        setBotSays(tick);
        return;
      }
      tried = ts !== undefined;
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          name: form.get("name") ?? "",
          // the honeypot, renamed from "company" (autofill filled it)
          hp: form.get("hp") ?? "",
          ...(ts !== undefined ? { turnstile: ts } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        delivered?: boolean;
        error?: string;
        errors?: Record<string, string>;
      };
      if (res.status === 403 && data.errors?.turnstile) {
        // the check's words — or, with no check on the page, what happened
        setBotSays(botCheckWords(el, data.errors.turnstile, "write to"));
      } else if (res.status === 429) {
        // wait, rather than the server's "try again shortly" (2026-11-03,
        // FORMS6-2 — the cart's and contact form's words)
        setBotSays("Too many tries from this connection. Please wait up to ten minutes, then send again, or write to");
      } else if (!res.ok || !data.ok) {
        setError(data.error || data.errors?.email || "That did not go through. Try again.");
      } else {
        setSent({ delivered: !!data.delivered });
        // a fresh link is on its way: the expired-link note (?s=bad) is done
        // with, here and in the address (2026-11-03, N1 — it came back with
        // "Use a different address")
        setAsked(true);
        if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
      }
    } catch {
      setError("No connection. Try again in a moment.");
    } finally {
      setBusy(false);
      if (tried) setTsReset((n) => n + 1);
    }
  };

  return (
    <div className="ap-auth">
      <div className="ap-auth__form">
        <div className="ap-auth__box">
          {sent ? (
            // THE HONEST CONFIRMATION. `delivered` comes from the route and
            // is false whenever no mail service is configured — telling a
            // visitor to check an inbox nothing was sent to is the one thing
            // this screen must not do.
            <div className="ap-auth__done" role="status">
              {/* not delivered: sign-in is only on when mail is set up, so this
                  is a mail that failed — and production never logs the link
                  (app/api/auth/route.ts), so "written to the server log" would
                  be untrue there (integration pass 2026-11-01) */}
              <h1 className="ap-auth__title">{sent.delivered ? "Check your email" : "Link not sent"}</h1>
              <p className="ap-auth__sub">
                {sent.delivered
                  ? // not "works once": the link signs in again until it expires
                    "We sent you a link. It expires in fifteen minutes."
                  : "The email with your link could not be sent just now, so nothing reached your inbox. Please try again in a few minutes."}
              </p>
              {/* not delivered: the sentence asks for another try, so the
                  button says so (it read "Use a different address"); both
                  go back to the form with the address still in it */}
              <button
                type="button"
                className="ap-auth__ghost"
                onClick={() => {
                  back.current = true;
                  setSent(null);
                }}
              >
                {sent.delivered ? "Use a different address" : "Try again"}
              </button>
            </div>
          ) : (
            <>
              <div className="ap-auth__head">
                <h1 className="ap-auth__title">{copy.title}</h1>
                <p className="ap-auth__sub">{copy.sub}</p>
              </div>

              {/* sign-in off, or a notice from the page (an expired link)
                  while it is on — see app/account/page.tsx */}
              {(!ready || (notice && !asked && live === "bad")) && (
                <p className="ap-auth__notice" role="status">
                  {notice ?? "Sign-in is not switched on for this site yet."}
                </p>
              )}

              {/* method="post" to /api/early: a Send before the script starts
                  must not put the address in the address bar, and lands back
                  here — see app/api/early/route.ts */}
              <form
                onSubmit={onSubmit}
                className="ap-auth__fields"
                method="post"
                action="/api/early?to=/account"
                noValidate={false}
              >
                {/* the same honeypot markup the contact form uses */}
                <div className="ap-pot" aria-hidden="true">
                  <label htmlFor="a-hp">Leave this field empty</label>
                  <input id="a-hp" name="hp" tabIndex={-1} autoComplete="off" />
                </div>

                {panel === "up" && (
                  <label className="ap-field">
                    <span>Your name</span>
                    <input
                      name="name"
                      type="text"
                      autoComplete="name"
                      placeholder="Anahit Grigoryan"
                      required
                      disabled={!ready}
                      defaultValue={typed.name}
                    />
                  </label>
                )}
                <label className="ap-field">
                  <span>Email</span>
                  <input
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    required
                    disabled={!ready}
                    defaultValue={typed.email}
                    ref={emailRef}
                  />
                </label>
                {/* the button stays ENABLED until the request is in flight —
                    a control disabled while the form is merely incomplete
                    gives no reason and cannot be pressed to find out */}
                {/* the bot check — nothing unless its site key is set, and
                    nothing while sign-in itself is off */}
                {ready && <Turnstile action="signin" reset={tsReset} />}
                <button type="submit" className="ap-btn ap-auth__go" disabled={busy || !ready}>
                  {busy ? "Sending…" : copy.cta}
                </button>
                {/* with no script, the button only comes back to an empty
                    form (/api/early) — see ContactBlock.tsx. Right under the
                    button, above the always-present message row (FORMS6-3) */}
                {ready && (
                  <noscript>
                    <p className="ap-auth__err">Signing in needs JavaScript. Please turn it on and try again.</p>
                  </noscript>
                )}
                <p className="ap-auth__err" role="alert">
                  {botSays ? (
                    <>
                      {botSays} <a href={`mailto:${brand.email}`}>{brand.email}</a>.
                    </>
                  ) : (
                    error
                  )}
                </p>
              </form>

              <p className="ap-auth__swap">
                {copy.swap}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setPanel(panel === "in" ? "up" : "in");
                    setError("");
                    setBotSays("");
                  }}
                >
                  {copy.swapCta}
                </button>
              </p>

              <p className="ap-auth__rule">
                <span>What an account does here</span>
              </p>
              <p className="ap-auth__small">
                It remembers your name and email so the order form is already filled in. Orders
                themselves are confirmed by Arpine over email, exactly as they are without one — and
                nothing about this site needs an account to buy.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
