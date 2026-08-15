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
  x: (
    <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M459.37 151.716c.325 4.548.325 9.097.325 13.645 0 138.72-105.583 298.558-298.558 298.558-59.452 0-114.68-17.219-161.137-47.106 8.447.974 16.568 1.299 25.34 1.299 49.055 0 94.213-16.568 130.274-44.832-46.132-.975-84.792-31.188-98.112-72.772 6.498.974 12.995 1.624 19.818 1.624 9.421 0 18.843-1.3 27.614-3.573-48.081-9.747-84.143-51.98-84.143-102.985v-1.299c13.969 7.797 30.214 12.67 47.431 13.319-28.264-18.843-46.781-51.005-46.781-87.391 0-19.492 5.197-37.36 14.294-52.954 51.655 63.675 129.3 105.258 216.365 109.807-1.624-7.797-2.599-15.918-2.599-24.04 0-57.828 46.782-104.934 104.934-104.934 30.213 0 57.502 12.67 76.67 33.137 23.715-4.548 46.456-13.32 66.599-25.34-7.798 24.366-24.366 44.833-46.132 57.827 21.117-2.273 41.584-8.122 60.426-16.243-14.292 20.791-32.161 39.308-52.628 54.253z" />
    </svg>
  ),
  discord: (
    <svg viewBox="0 0 640 512" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M524.531,69.836a1.5,1.5,0,0,0-.764-.7A485.065,485.065,0,0,0,404.081,32.03a1.816,1.816,0,0,0-1.923.91,337.461,337.461,0,0,0-14.9,30.6,447.848,447.848,0,0,0-134.426,0,309.541,309.541,0,0,0-15.135-30.6,1.89,1.89,0,0,0-1.924-.91A483.689,483.689,0,0,0,116.085,69.137a1.712,1.712,0,0,0-.788.676C39.068,183.651,18.186,294.69,28.43,404.354a2.016,2.016,0,0,0,.765,1.375A487.666,487.666,0,0,0,176.02,479.918a1.9,1.9,0,0,0,2.063-.676A348.2,348.2,0,0,0,208.12,430.4a1.86,1.86,0,0,0-1.019-2.588,321.173,321.173,0,0,1-45.868-21.853,1.885,1.885,0,0,1-.185-3.126c3.082-2.309,6.166-4.711,9.109-7.137a1.819,1.819,0,0,1,1.9-.256c96.229,43.917,200.41,43.917,295.5,0a1.812,1.812,0,0,1,1.924.233c2.944,2.426,6.027,4.851,9.132,7.16a1.884,1.884,0,0,1-.162,3.126,301.407,301.407,0,0,1-45.89,21.83,1.875,1.875,0,0,0-1,2.611,391.055,391.055,0,0,0,30.014,48.815,1.864,1.864,0,0,0,2.063.7A486.048,486.048,0,0,0,610.7,405.729a1.882,1.882,0,0,0,.765-1.352C623.729,277.594,590.933,167.465,524.531,69.836ZM222.491,337.58c-28.972,0-52.844-26.587-52.844-59.239S193.056,219.1,222.491,219.1c29.665,0,53.306,26.82,52.843,59.239C275.334,310.993,251.924,337.58,222.491,337.58Zm195.38,0c-28.971,0-52.843-26.587-52.843-59.239S388.437,219.1,417.871,219.1c29.667,0,53.307,26.82,52.844,59.239C470.715,310.993,447.538,337.58,417.871,337.58Z" />
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
            target="_blank"
            rel="noopener noreferrer"
            aria-label={
              s.pending
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
