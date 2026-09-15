"use client";

import { useCallback, useEffect, useRef } from "react";
import { socials } from "@/lib/content";

// ============================================================================
// SOCIALS — the DOCK from the reusable collection (feturesss21), ported.
//
// TWO PIECES, BOTH FROM THAT FOLDER:
//   by-function/navigation/magicui--dock.tsx  the magnification: each icon's
//     size is a function of its distance from the pointer along the row, so
//     the whole strip swells around wherever the hand is, macOS-style.
//   best/motion/Magnetic.tsx                  the magnetic pull: the icon
//     eases TOWARD the cursor while it is near and springs back on leave.
//
// PORTED, NOT INSTALLED. Both originals are framer-motion + Tailwind + a
// `cn()` helper + class-variance-authority + lucide — five packages this
// project does not have and will not add for one row of three links (the
// collection's own README says the same: these are source references, fix
// the imports). The maths is the interesting part and it is thirty lines:
// the distance transform is the dock's, the spring is a critically-damped
// lerp on rAF instead of framer's `useSpring`, and the sizes are written to
// CSS custom properties so the paint is pure CSS.
//
// ONE rAF FOR THE WHOLE ROW, not one per icon: three springs each with their
// own loop is three times the work to settle the same frame, and they can
// disagree about when they are done.
//
// THE MOTION LAYER ONLY. Under reduced motion, on a touch screen and with no
// JS the row is a plain, evenly-sized set of links that already works — the
// pointer maths never runs, and nothing about reaching her profiles depends
// on it.
//
// Every tile is a real link. While one still points at the platform rather
// than at Arpine's own profile (`pending` in content.ts), the row says so
// underneath — the link works, and nobody is told it is her account before
// it is.
// ============================================================================

const ICON: Record<string, React.ReactNode> = {
  instagram: (
    <svg viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M 9.9980469 3 C 6.1390469 3 3 6.1419531 3 10.001953 L 3 20.001953 C 3 23.860953 6.1419531 27 10.001953 27 L 20.001953 27 C 23.860953 27 27 23.858047 27 19.998047 L 27 9.9980469 C 27 6.1390469 23.858047 3 19.998047 3 L 9.9980469 3 z M 22 7 C 22.552 7 23 7.448 23 8 C 23 8.552 22.552 9 22 9 C 21.448 9 21 8.552 21 8 C 21 7.448 21.448 7 22 7 z M 15 9 C 18.309 9 21 11.691 21 15 C 21 18.309 18.309 21 15 21 C 11.691 21 9 18.309 9 15 C 9 11.691 11.691 9 15 9 z M 15 11 A 4 4 0 0 0 11 15 A 4 4 0 0 0 15 19 A 4 4 0 0 0 19 15 A 4 4 0 0 0 15 11 z" />
    </svg>
  ),
  // X and Discord left with the client's note (change.pdf p9, 2026-09-15):
  // Telegram and mail take their tiles
  telegram: (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M21.9 4.6 18.9 19c-.2 1-.8 1.3-1.7.8l-4.6-3.4-2.2 2.1c-.3.3-.5.5-1 .5l.3-4.7 8.6-7.8c.4-.3-.1-.5-.6-.2L7.2 13.1 2.6 11.7c-1-.3-1-1 .2-1.5l17.8-6.9c.8-.3 1.5.2 1.3 1.3Z" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1 2.4V17h16V7.4l-8 5.6-8-5.6ZM5.3 7l6.7 4.7L18.7 7H5.3Z" />
    </svg>
  ),
};

/** the dock's own numbers, in this row's proportions */
const SIZE = 44; // at rest — also the 44px touch floor, so it never shrinks below it
const MAX = 62; // directly under the pointer
const REACH = 132; // how far along the row the swell is felt (the dock's `distance`)
const PULL = 0.3; // Magnetic.tsx's `strength`, toward the cursor
const MAX_PULL = 9; // px — the row must not come apart under the hand

export default function Socials() {
  const row = useRef<HTMLDivElement | null>(null);
  /** [current, target] per icon, for size and for x-offset */
  const state = useRef<Array<{ s: number; ts: number; x: number; tx: number }>>([]);
  const raf = useRef(0);
  const live = useRef(false);

  const settle = useCallback(() => {
    raf.current = 0;
    const el = row.current;
    if (!el) return;
    const icons = el.querySelectorAll<HTMLElement>(".ap-soc__link");
    let moving = false;
    icons.forEach((icon, i) => {
      const st = state.current[i];
      if (!st) return;
      // a critically-damped lerp: framer's useSpring without framer
      st.s += (st.ts - st.s) * 0.22;
      st.x += (st.tx - st.x) * 0.22;
      if (Math.abs(st.ts - st.s) > 0.2 || Math.abs(st.tx - st.x) > 0.2) moving = true;
      icon.style.setProperty("--s", `${st.s.toFixed(2)}px`);
      icon.style.setProperty("--x", `${st.x.toFixed(2)}px`);
    });
    if (moving) raf.current = requestAnimationFrame(settle);
  }, []);

  const aim = useCallback(
    (clientX: number | null) => {
      const el = row.current;
      if (!el) return;
      const icons = el.querySelectorAll<HTMLElement>(".ap-soc__link");
      icons.forEach((icon, i) => {
        state.current[i] ??= { s: SIZE, ts: SIZE, x: 0, tx: 0 };
        const st = state.current[i];
        if (clientX === null) {
          st.ts = SIZE;
          st.tx = 0;
          return;
        }
        const r = icon.getBoundingClientRect();
        // THE DOCK'S TRANSFORM: distance from the pointer to this icon's
        // centre, mapped [-REACH, 0, REACH] -> [SIZE, MAX, SIZE]
        const d = clientX - (r.left + r.width / 2);
        const t = Math.max(0, 1 - Math.abs(d) / REACH);
        st.ts = SIZE + (MAX - SIZE) * t;
        // MAGNETIC.TSX: lean toward the cursor, hardest when nearest
        st.tx = Math.max(-MAX_PULL, Math.min(MAX_PULL, d * PULL * t));
      });
      if (!raf.current) raf.current = requestAnimationFrame(settle);
    },
    [settle],
  );

  useEffect(() => {
    // FINE POINTERS WITH MOTION ALLOWED, and nothing else. A touch screen has
    // no hover to drive this and would only get icons that jump on tap.
    live.current =
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
    const el = row.current;
    if (!el || !live.current) return;
    el.dataset.dock = "";
    const move = (e: PointerEvent) => aim(e.clientX);
    const leave = () => aim(null);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = 0;
      delete el.dataset.dock;
    };
  }, [aim]);

  const pending = socials.some((s) => s.pending);

  return (
    <div className="ap-soc__wrap">
      <div className="ap-soc" ref={row}>
        {socials.map((s) => (
          <a
            key={s.label}
            className="ap-soc__link"
            href={s.href}
            // a mailto: opens the mail app, not a tab — the new-tab pair and
            // the "opens in a new tab" promise are only true of the platforms
            {...(s.href.startsWith("mailto:") ? {} : { target: "_blank", rel: "noopener noreferrer" })}
            aria-label={
              s.href.startsWith("mailto:")
                ? `${s.label} — write to ${s.href.slice(7)}`
                : s.pending
                  ? `${s.label} — opens ${s.label} in a new tab; Arpine's own profile is not linked yet`
                  : `${s.label} — opens in a new tab`
            }
          >
            {ICON[s.icon]}
            {/* the dock's label, shown on hover and on keyboard focus —
                the icons alone are a guessing game for anyone who does not
                recognise a glyph */}
            <span className="ap-soc__tip" aria-hidden="true">
              {s.label}
            </span>
          </a>
        ))}
      </div>

      {/* said once, plainly: the tiles open the platforms until her own
          profiles are linked. Drops away by itself once none are pending. */}
      {pending && (
        <p className="ap-soc__soon">These open the platforms — Arpine&rsquo;s own profiles are being linked next.</p>
      )}
    </div>
  );
}
