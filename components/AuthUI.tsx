"use client";

import { useEffect, useRef, useState } from "react";

// ============================================================================
// SIGN IN / CREATE ACCOUNT — the split-screen pattern from the supplied
// component, rebuilt on this project's own stack.
//
// WHAT WAS PORTED: the anatomy. Form column beside a full-bleed picture, one
// panel swapping to the other in place, the toggle line under the button, a
// divider, and the typewriter quote standing at the foot of the picture.
//
// WHAT WAS NOT, and why — the supplied file imports Radix, class-variance-
// authority, clsx, tailwind-merge and lucide, and is written in Tailwind
// classes. This site has nine runtime dependencies, no UI kit and no
// Tailwind; the whole interface is hand-written CSS on a palette measured
// from Arpine's paintings. Five packages plus a CSS framework for one page
// would cost more than the page is worth, so the design is reproduced in
// app/auth.css instead. The typewriter is ~20 lines below.
//
// THE PASSWORD FIELD AND THE GOOGLE BUTTON ARE GONE, and that is the honest
// part rather than a shortcut. This shop has no database: nowhere to store a
// password hash, no user table to look one up in, and no OAuth client. A
// password box that accepts a password and drops it, or a Google button that
// logs to the console, is a working-looking control that cannot work. The
// mechanism here is a signed magic link, which needs no storage at all — see
// lib/server/auth.ts.
// ============================================================================

/** The supplied component's Typewriter, minus the dependency: same props
 *  that mattered (text, speed), same trailing cursor. Reduced motion gets
 *  the finished line immediately — an unstoppable animated sentence is
 *  exactly what that preference is about. */
function Typewriter({ text, speed = 46 }: { text: string; speed?: number }) {
  const [n, setN] = useState(0);
  const still = useRef(false);

  useEffect(() => {
    still.current =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still.current) {
      setN(text.length);
      return;
    }
    setN(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) window.clearInterval(id);
    }, speed);
    return () => window.clearInterval(id);
  }, [text, speed]);

  return (
    <>
      {text.slice(0, n)}
      {!still.current && n < text.length && <span className="ap-auth__caret" aria-hidden="true" />}
    </>
  );
}

type Panel = "in" | "up";

const COPY: Record<Panel, { title: string; sub: string; cta: string; swap: string; swapCta: string; quote: string }> = {
  in: {
    title: "Sign in",
    sub: "Enter your email and we will send you a link. No password to remember.",
    cta: "Email me a link",
    swap: "First time here?",
    swapCta: "Create an account",
    quote: "Welcome back. The pictures have been waiting.",
  },
  up: {
    title: "Create an account",
    sub: "Your name and email, once — so the order form already knows you next time.",
    cta: "Create my account",
    swap: "Already have an account?",
    swapCta: "Sign in",
    quote: "A new chapter, drawn by hand.",
  },
};

export default function AuthUI({ ready, notice }: { ready: boolean; notice?: string }) {
  const [panel, setPanel] = useState<Panel>("in");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ delivered: boolean } | null>(null);
  const [error, setError] = useState("");
  const copy = COPY[panel];

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || !ready) return;
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          name: form.get("name") ?? "",
          company: form.get("company") ?? "",
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        delivered?: boolean;
        error?: string;
        errors?: Record<string, string>;
      };
      if (!res.ok || !data.ok) {
        setError(data.error || data.errors?.email || "That did not go through. Try again.");
      } else {
        setSent({ delivered: !!data.delivered });
      }
    } catch {
      setError("No connection. Try again in a moment.");
    } finally {
      setBusy(false);
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
              <h1 className="ap-auth__title">{sent.delivered ? "Check your email" : "Link created"}</h1>
              <p className="ap-auth__sub">
                {sent.delivered
                  ? "We sent you a link. It works once and expires in fifteen minutes."
                  : "Email delivery is not switched on for this site yet, so the link was written to the server log instead. Nothing was sent to your inbox."}
              </p>
              <button type="button" className="ap-auth__ghost" onClick={() => setSent(null)}>
                Use a different address
              </button>
            </div>
          ) : (
            <>
              <div className="ap-auth__head">
                <h1 className="ap-auth__title">{copy.title}</h1>
                <p className="ap-auth__sub">{copy.sub}</p>
              </div>

              {!ready && (
                <p className="ap-auth__notice" role="status">
                  {notice ?? "Sign-in is not switched on for this site yet."}
                </p>
              )}

              <form onSubmit={onSubmit} className="ap-auth__fields" noValidate={false}>
                {/* the same honeypot markup the contact form uses */}
                <div className="ap-pot" aria-hidden="true">
                  <label htmlFor="a-company">Company</label>
                  <input id="a-company" name="company" tabIndex={-1} autoComplete="off" />
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
                  />
                </label>
                {/* the button stays ENABLED until the request is in flight —
                    a control disabled while the form is merely incomplete
                    gives no reason and cannot be pressed to find out */}
                <button type="submit" className="ap-btn ap-auth__go" disabled={busy || !ready}>
                  {busy ? "Sending…" : copy.cta}
                </button>
                <p className="ap-auth__err" role="alert">
                  {error}
                </p>
              </form>

              <p className="ap-auth__swap">
                {copy.swap}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setPanel(panel === "in" ? "up" : "in");
                    setError("");
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

      {/* THE PICTURE. Her own painting, not a stock interior: the supplied
          design used a furniture photograph because it was a generic
          template, and the whole point of this shop is that the artwork is
          the product. */}
      <div className="ap-auth__art" data-panel={panel}>
        <figure>
          <img
            src={panel === "in" ? "/art/art-08-sm.webp" : "/art/art-21-sm.webp"}
            alt=""
            aria-hidden="true"
            decoding="async"
          />
        </figure>
        <blockquote className="ap-auth__quote">
          <p>
            “<Typewriter key={copy.quote} text={copy.quote} />”
          </p>
          <cite>— Arpine Baroyan</cite>
        </blockquote>
      </div>
    </div>
  );
}
