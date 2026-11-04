"use client";

import { useEffect, useRef, useState } from "react";

// ============================================================================
// CLOUDFLARE TURNSTILE — the bot check on the order, contact and sign-in forms
// (readiness audit 2026-10-31, #6: once mail is on, the buyer's copy would
// otherwise let anyone send text of their choosing to any address from the
// shop's domain).
//
// OFF UNLESS NEXT_PUBLIC_TURNSTILE_SITE_KEY IS SET: then this renders nothing
// and loads nothing, and the forms send no `turnstile` field at all. The
// server checks a token only when BOTH keys are set (lib/server/mail.ts
// turnstileOn), so either key alone checks nothing: the site key alone
// shows a widget whose token nobody reads, the secret alone asks for none.
//
// When it is on: Cloudflare's script is fetched ONCE, and only when the form
// is about to matter — the first focus inside it, or the form coming within
// 400px of the screen — so it never costs a page's first load. The widget is
// "interaction-only": invisible unless Cloudflare needs the visitor to tick
// something. Its token lands in a hidden `turnstile` input the form reads
// with FormData. A token is single-use, so the form bumps `reset` after
// every submit attempt; an expired one is reset here. If the script never
// loads (blocked, offline) the form still submits with an empty token and
// the server decides — a broken bot check must not become a broken shop —
// and the next focus in the form, or the next press on Send, loads it again.
// ============================================================================

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type Api = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string | null | undefined;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Api;
  }
}

let loading: Promise<Api> | null = null;
/** How long the script may take before it counts as failed. A request that
 *  never settled left the check "busy" for good, so every Send waited 15 s
 *  and said "still running" until a reload (verification 2026-11-02). Under
 *  the 15 s a Send waits, so a Send that started the load hears "could not
 *  load", the truth, rather than "still running". */
const LOAD_MS = 12000;
/** the script, once per page — a failed load clears the slot so a later
 *  focus can try again. "Failed" includes a script that arrived but defined
 *  no `turnstile` (a filter that answers with an empty file): that used to
 *  leave the rejected promise cached here, so no retry could ever load it
 *  (review 2026-11-01, CLIENT-1). Settled once: a script that arrives after
 *  its time ran out must not clear a newer attempt's slot. */
function load(): Promise<Api> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<Api>((resolve, reject) => {
    const s = document.createElement("script");
    let settled = false;
    const fail = (why: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(slow);
      loading = null;
      s.remove();
      reject(new Error(why));
    };
    const slow = window.setTimeout(() => fail("turnstile script timed out"), LOAD_MS);
    s.src = SRC;
    s.async = true;
    s.onload = () => {
      if (settled) return;
      if (!window.turnstile) return fail("turnstile missing");
      settled = true;
      window.clearTimeout(slow);
      resolve(window.turnstile);
    };
    s.onerror = () => fail("turnstile script failed");
    document.head.appendChild(s);
  });
  return loading;
}

/** Cloudflare is showing a check that waits for the VISITOR — between its
 *  before- and after-interactive callbacks (`asking` below). Time will not
 *  finish that one; a tick will. */
const asks = (form: HTMLFormElement | null) => !!form?.querySelector(".ap-ts__box[data-asking]");

/** The token to send, read at submit time: undefined when there is no widget
 *  (send no field), otherwise the token — waiting up to `ms` while the script
 *  is loading or a challenge is still running, so a Send is not refused for a
 *  check that was about to pass. 15 s, not 5 (2026-11-01, V-1): on a slow
 *  phone line one challenge took ~21 s, and every early send came back 403.
 *  The button reads "Sending…" meanwhile. Not for a check that asks for a
 *  tick (`asks`): that returns at once, and the form says so (tickWords). Nor
 *  for a form that has left the page meanwhile (the cart emptied while it
 *  waited — the caller then sends nothing, 2026-11-02, NF-1). An empty
 *  string means "no token"; the server decides. */
export async function turnstileToken(form: HTMLFormElement, ms = 15000): Promise<string | undefined> {
  const input = form.querySelector<HTMLInputElement>('input[name="turnstile"]');
  if (!input) return undefined;
  const until = Date.now() + ms;
  while (!input.value && input.hasAttribute("data-busy") && !asks(form) && input.isConnected && Date.now() < until) {
    await new Promise((r) => setTimeout(r, 100));
  }
  // the token THIS send carries, so the reset after it spends only this one:
  // a newer token that came while the answer travelled is kept (2026-11-02,
  // CR-2 — it was reset unused, and a whole new challenge started)
  input.setAttribute("data-sent", input.value);
  return input.value;
}

/** THE WORDS INSTEAD OF A SEND while Cloudflare shows a check that waits for
 *  the visitor and no token has come (2026-11-02, CR-1). Sending "" would only
 *  be refused, it spent one of the visitor's tries (the 7th locked them out),
 *  and the refusal then said "still running" beside a box asking to be
 *  ticked. Null when the send may go. The forms follow it with her address
 *  and a full stop, as they do botCheckWords. Only while the check is
 *  running too (`data-busy`): a check that asked and then failed is not
 *  waiting for anyone, and must not hold every Send back (CR3-F1). */
export function tickWords(form: HTMLFormElement, ts: string | undefined, verb = "email"): string | null {
  const busy = !!form.querySelector('input[name="turnstile"]')?.hasAttribute("data-busy");
  return ts === "" && busy && asks(form) ? `Please complete the quick check above, then send again. If it does not work, ${verb}` : null;
}

/** THE WORDS BESIDE SEND WHEN THE BOT CHECK SAID NO (a 403) — one helper for
 *  the order, contact and sign-in forms, each of which follows them with her
 *  address as a mailto link and a full stop. The server's own words ("Please
 *  complete the quick check on the form") are kept for when they are true:
 *  a challenge on screen, or a token Cloudflare refused. Otherwise the page
 *  says what happened, since there was nothing on screen to complete (review
 *  2026-11-01, CLIENT-1; verification 2026-11-02). Read when the answer comes
 *  back, before the form's reset starts a new attempt. */
export function botCheckWords(form: HTMLFormElement | null, said: string, verb = "email"): string {
  const input = form?.querySelector<HTMLInputElement>('input[name="turnstile"]');
  const box = form?.querySelector<HTMLElement>(".ap-ts__box");
  const busy = !!input?.hasAttribute("data-busy");
  // still running when the 15 s wait ran out (slow network, V-1) — out of
  // sight, or the "Verifying…" after a tick. With a check ASKING for the tick
  // the server's words are the right ones (CR-1: this said "wait" beside a
  // box waiting for a tick; CR3-F2: keyed on the box being on screen, it
  // told a visitor who had ticked to complete the check)
  if (busy && !asks(form)) return `The quick check is still running. Wait a few seconds, then send again, or ${verb}`;
  const drawn = !!window.turnstile && !!box?.hasAttribute("data-widget");
  if (!drawn) return `The quick check could not load. Check your connection and send again, or ${verb}`;
  // a token came while this answer travelled: the reset keeps it (CR-2), so
  // the next Send carries it
  if (input?.value && input.value !== input.getAttribute("data-sent")) {
    return `The quick check has just finished. Please send again, or ${verb}`;
  }
  // no token, nothing running, nothing asked: Cloudflare gave the check up
  // (its error callback — a challenge that hung on a slow line, F-FORMS-2);
  // the reset after this answer starts it over
  if (!input?.value && !busy && !asks(form)) return `The quick check did not finish. Please send again, or ${verb}`;
  return `${said} If it keeps happening, ${verb}`;
}

type Phase = "off" | "busy" | "done";

export default function Turnstile({ action, reset }: { action: string; reset: number }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [token, setToken] = useState("");
  /** off: not started · busy: script loading or challenge running · done: a
   *  token came, or the check gave up (error / script failed) */
  const [phase, setPhaseState] = useState<Phase>("off");
  // the same phase for the reset effect, which must stay keyed on `reset`
  // alone (a re-run on every phase change would reset the widget each time)
  const phaseNow = useRef<Phase>("off");
  const inputEl = useRef<HTMLInputElement>(null);
  const setPhase = (p: Phase) => {
    phaseNow.current = p;
    setPhaseState(p);
    // …and on the input AT ONCE, not only at React's next render: a Send that
    // started the check (the submit listener below) reads it in the same task,
    // and must wait for the token rather than send "" (2026-11-02, F-FORMS-1).
    // React's render then writes the same value.
    const i = inputEl.current;
    if (i && p === "busy") i.setAttribute("data-busy", "");
    else if (i) i.removeAttribute("data-busy");
  };
  // THE TOKEN ON THE INPUT AT ONCE TOO (2026-11-02, CR3-F3). setPhase("done")
  // takes data-busy off in the same task, while React wrote the value only at
  // its next render: a Send polling in between saw "not busy, no token" and
  // sent "" for a token that had already come. So: value first, then phase.
  const put = (t: string) => {
    const i = inputEl.current;
    if (i) i.value = t;
    setToken(t);
  };
  // the mount effect's start(), so a press on Send can call it too — and its
  // afresh(), for the box's place in the flow after a reset
  const startNow = useRef<(() => void) | null>(null);
  const afreshNow = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!SITE_KEY) return;
    const el = box.current;
    const form = el?.closest("form");
    if (!el || !form) return;
    let gone = false;
    let pending = false;
    let io: IntersectionObserver | null = null;
    // IN THE FORM'S FLOW ONLY WHILE CLOUDFLARE SHOWS SOMETHING (2026-11-01,
    // PERF-3 / CLIENT-3). Cloudflare puts a 0px-tall element into the box
    // even when it shows nothing, so the old `:empty { display: none }`
    // stopped matching and the box became a 0px grid item that took a second
    // 14px row-gap: Send moved 14px down for good (/cart, /contact, /account).
    // Now the box is out of the flow (orderflow.css) unless `data-shown`:
    // set as a challenge is about to appear (before-interactive) and while
    // the box has any height at all — a challenge, or the "Success" Cloudflare
    // may leave on screen after it (after-interactive alone would pull that
    // out of the flow, over the button). The ResizeObserver puts it back out
    // once Cloudflare has nothing on screen again.
    // `data-asking`: while a challenge waits for the visitor's tick, as
    // against the "Verifying…" after the tick, which is also on screen
    // (turnstileToken, tickWords and botCheckWords tell the two apart)
    let asking = false;
    const fit = () => {
      if (asking || el.getBoundingClientRect().height > 0) el.setAttribute("data-shown", "");
      else el.removeAttribute("data-shown");
      if (asking) el.setAttribute("data-asking", "");
      else el.removeAttribute("data-asking");
    };
    // a reset starts the check over: a challenge left half-done is no longer
    // "about to appear" — Cloudflare says so again if it shows one
    const afresh = () => {
      asking = false;
      fit();
    };
    afreshNow.current = afresh;
    const ro = "ResizeObserver" in window ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    // focus in the form, or a Send: after a failed load the field the visitor
    // types in is already focused, so a Send by Enter (or an iOS tap, which
    // focuses nothing) was refused once before anything asked again
    // (2026-11-02, F-FORMS-1). This native listener on the form runs before
    // React's own submit handler, which React listens for at the root.
    const listen = () => {
      form.addEventListener("focusin", start);
      form.addEventListener("submit", start);
    };
    const stop = () => {
      io?.disconnect();
      io = null;
      form.removeEventListener("focusin", start);
      form.removeEventListener("submit", start);
    };
    function start() {
      if (gone || pending || widget.current !== null) return;
      pending = true;
      stop();
      setPhase("busy");
      load()
        .then((api) => {
          pending = false;
          if (gone || !el || widget.current !== null) return;
          const id = api.render(el, {
            sitekey: SITE_KEY,
            action,
            appearance: "interaction-only",
            theme: "auto",
            size: "flexible",
            // the token travels in OUR hidden input, under the field name
            // the API routes read; Cloudflare's own would be a second copy
            "response-field": false,
            // expiry is handled below, so there is one path to a new token
            "refresh-expired": "never",
            callback: (t: string) => {
              put(t);
              setPhase("done");
            },
            "expired-callback": () => {
              put("");
              setPhase("busy");
              if (widget.current !== null) api.reset(widget.current);
              afresh();
            },
            "timeout-callback": () => {
              put("");
              if (widget.current !== null) api.reset(widget.current);
              afresh();
            },
            // handled: stop waiting at submit time and let the server
            // decide; returning true keeps Cloudflare from logging it. A
            // challenge that failed is no longer asking for a tick (CR3-F1:
            // Cloudflare's "fail" calls this and never after-interactive, so
            // `asking` stayed and every Send was held back with "Please
            // complete the quick check" beside the failure box). If
            // Cloudflare tries again and asks again, before-interactive
            // says so.
            "error-callback": () => {
              put("");
              setPhase("done");
              afresh();
              return true;
            },
            // a challenge asking for a tick is a check that is running —
            // also when Cloudflare retries one by itself after an error,
            // which had left the phase at "done"
            "before-interactive-callback": () => {
              asking = true;
              fit();
              setPhase("busy");
            },
            "after-interactive-callback": () => {
              asking = false;
              fit();
            },
          });
          // nothing drawn: no token can come, so a Send must not wait for one
          if (id == null) {
            setPhase("done");
            return;
          }
          widget.current = id;
          // what botCheckWords reads: a widget is on this form
          el.setAttribute("data-widget", "");
        })
        .catch(() => {
          pending = false;
          if (gone) return;
          setPhase("done");
          // A FAILED LOAD WAS FINAL (review 2026-11-01, CLIENT-1): stop() had
          // already taken the focus listener away, so after one blocked or
          // offline fetch nothing ever asked again and every Send was refused
          // until a reload, which wiped the typed fields. The next focus in
          // the form tries again — and so does the next Send (the submit
          // listener, before the form reads the token; and the reset below).
          listen();
        });
    }
    startNow.current = start;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && start(), { rootMargin: "400px 0px" });
      io.observe(form);
    }
    listen();
    return () => {
      gone = true;
      startNow.current = null;
      afreshNow.current = null;
      stop();
      ro?.disconnect();
      if (widget.current !== null) {
        window.turnstile?.remove(widget.current);
        widget.current = null;
      }
      el.removeAttribute("data-widget");
      el.removeAttribute("data-shown");
      el.removeAttribute("data-asking");
    };
  }, [action]);

  // tokens are single-use: after every submit attempt, ask for a fresh one
  useEffect(() => {
    if (!reset) return;
    // no widget — the script never arrived, or drew nothing: this press on
    // Send is a second chance to load it. iOS does not focus a tapped button,
    // so on a phone the focus listener alone may never be called (CLIENT-1).
    if (widget.current === null) {
      startNow.current?.();
      return;
    }
    // A TOKEN THAT CAME AFTER THE SEND LEFT IS KEPT (2026-11-02, CR-2). On a
    // slow line the 15 s wait could send "" and the token arrive before the
    // 403 did; resetting it threw away an unspent token and started another
    // ~20 s challenge. Only the token a send carried (data-sent) is spent.
    const inp = inputEl.current;
    if (inp?.value && inp.value !== inp.getAttribute("data-sent")) return;
    // A CHALLENGE STILL RUNNING IS LEFT TO FINISH (2026-11-01, V-1). Reset
    // threw its progress away, so on a slow line a buyer pressing Send again,
    // as the refusal asks, started a new ~20 s challenge every time and got
    // one empty-token 403 after another. After a spent token or an
    // error-callback the phase is "done", and those still reset.
    if (!window.turnstile || phaseNow.current === "busy") return;
    put("");
    setPhase("busy");
    window.turnstile.reset(widget.current);
    afreshNow.current?.();
  }, [reset]);

  if (!SITE_KEY) return null;
  return (
    <div className="ap-ts">
      <div className="ap-ts__box" ref={box} />
      <input ref={inputEl} type="hidden" name="turnstile" value={token} data-busy={phase === "busy" ? "" : undefined} />
    </div>
  );
}

