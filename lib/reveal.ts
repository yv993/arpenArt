"use client";

import { useEffect, type RefObject } from "react";

// ============================================================================
// THE ENTRANCES — every picture of a page appears once, as it comes into view
// (Vardan's picks, 2026-11-17, from eleven shown to him as live demos):
//   /armenia-eternal   iris      a circle opens from the picture's centre
//   /shop/bookmarks    flip      the card arrives on its back and turns over
//   /shop/posters      curtain   the print is uncovered from the bottom up
//   /shop/stickers     dropped   the sheet falls in, turned, and settles
//   /shop/magnets      zoom      the magnet grows in from 88% as it fades up
// The LOOK of each lives in app/reveal.css, scoped by the page's own class;
// this hook only says WHEN: it marks each waiting picture data-reveal="",
// flips it to "open" as it scrolls in, then removes the attribute so the
// picture is exactly what it was before (its hover, its turn, its shadow,
// its focus ring).
//
// THE RULES, the same on every page:
//   · full motion only — reduced motion, and the no-JS page, never hide a thing
//     (only this hook ever sets data-reveal);
//   · a picture already on screen when the page wakes is not touched here:
//     hiding it to show it again would blink. It takes the same entrance as
//     a CSS animation from the first paint instead (app/reveal.css, «what is
//     on screen when the page opens»), which this hook switches off on the
//     pictures it does take;
//   · pictures that arrive together go one after another, top to bottom then
//     left to right, `step` apart up to `max`;
//   · a picture is WATCHED through its parent (measured 2026-11-17 in Chrome:
//     an observer counts the target's own clip, so a picture shut to a point
//     reports ratio 0 forever) — and that also works in a phone's sideways
//     rail, where a card counts as arriving when it is swiped in;
//   · a hidden picture (display: none, size 0 — the other layer of a page) is
//     not touched, so a layout that changes later never finds one shut;
//   · paper never waits for a scroll (beforeprint opens everything).
// ============================================================================

export type RevealOptions = {
  /** the look's length in seconds (app/reveal.css), for the clean-up */
  duration: number;
  /** the beat between pictures arriving together */
  step?: number;
  /** the latest any picture of one arrival may start */
  max?: number;
  /** re-run when this changes — a page whose pictures appear only after a
   *  state change (the sticker folders' live layer) passes that state */
  key?: unknown;
};

export function useReveal(root: RefObject<HTMLElement | null>, selector: string, opts: RevealOptions) {
  const { duration, step = 0.1, max = 0.7, key } = opts;
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const shut = Array.from(el.querySelectorAll<HTMLElement>(selector)).filter((t) => {
      if ("revealed" in t.dataset) return false;
      const r = t.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      return !(r.top < vh && r.bottom > 0 && r.left < vw && r.right > 0);
    });
    if (!shut.length) return;

    const timers: number[] = [];
    // done for good: the look's attribute goes, and data-revealed stays, so
    // the page-load animation (app/reveal.css) never starts on it again
    const done = (t: HTMLElement) => {
      t.dataset.revealed = "";
      t.removeAttribute("data-reveal");
      t.style.removeProperty("--rv-delay");
    };
    const pictureOf = new Map<Element, HTMLElement[]>();
    shut.forEach((t) => {
      const p = t.parentElement ?? t;
      pictureOf.set(p, [...(pictureOf.get(p) ?? []), t]);
    });
    const io = new IntersectionObserver(
      (entries) => {
        const arriving = entries
          .filter((e) => e.isIntersecting)
          .flatMap((e) => {
            io.unobserve(e.target);
            return pictureOf.get(e.target) ?? [];
          });
        // the order the eye reads them in
        arriving.sort((a, b) => {
          const ra = a.getBoundingClientRect();
          const rb = b.getBoundingClientRect();
          return Math.abs(ra.top - rb.top) > 24 ? ra.top - rb.top : ra.left - rb.left;
        });
        arriving.forEach((t, i) => {
          const delay = Math.min(i * step, max);
          t.style.setProperty("--rv-delay", `${delay}s`);
          t.dataset.reveal = "open";
          // the open state is final on a timer, not on transitionend: the
          // flip's transition runs on a child, and a background tab may
          // never deliver the event
          timers.push(window.setTimeout(() => done(t), (delay + duration + 0.3) * 1000));
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
    );
    shut.forEach((t) => {
      t.dataset.reveal = "";
    });
    pictureOf.forEach((_, p) => io.observe(p));
    const print = () => shut.forEach(done);
    window.addEventListener("beforeprint", print);
    return () => {
      io.disconnect();
      timers.forEach((n) => window.clearTimeout(n));
      window.removeEventListener("beforeprint", print);
      // one that has arrived is done; one still waiting goes back to how
      // the page drew it, so a re-run (React's dev double effect, the
      // stickers' live layer) takes it again. Measured 2026-11-17: marking
      // the waiting ones done here left a dev page with nothing to reveal.
      shut.forEach((t) => {
        if (t.dataset.reveal === "open") done(t);
        else {
          t.removeAttribute("data-reveal");
          t.style.removeProperty("--rv-delay");
        }
      });
    };
  }, [root, selector, duration, step, max, key]);
}
