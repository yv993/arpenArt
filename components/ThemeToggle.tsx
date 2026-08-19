"use client";

import { useCallback, useEffect, useState } from "react";

// ============================================================================
// LIGHT / NIGHT
//
// The site follows the operating system on its own — that part is pure CSS
// (`prefers-color-scheme` in globals.css) and costs nothing. This button only
// exists for the visitor who wants the OTHER one, and it writes a single
// attribute, `data-theme`, which the stylesheet already answers to.
//
// WHY THE MARKUP IS IDENTICAL ON BOTH RENDERS: the server cannot know the
// choice, so it renders the neutral state and the real one is set in an
// effect, after hydration. Nothing here is read from localStorage or
// matchMedia during render — that is the whole trick, and it is why this can
// be added to a layout that documents (correctly) that writing to <html>
// between the server render and hydration is what broke the `js` class.
// The pre-paint script in layout.tsx does the same write BEFORE React exists,
// which is why there is no flash; <html suppressHydrationWarning> covers the
// attribute React never rendered.
// ============================================================================

type Theme = "light" | "dark";
const KEY = "ap-theme";

export default function ThemeToggle() {
  /** null until mounted — the server has no opinion and must not fake one */
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const set = document.documentElement.dataset.theme as Theme | undefined;
    setTheme(set ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  }, []);

  /** Follow the OS while the visitor has not chosen — someone who never
   *  touches this button should still get their machine's setting when it
   *  changes at sunset. Once they choose, the choice wins until they clear it. */
  useEffect(() => {
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (localStorage.getItem(KEY)) return;
      setTheme(m.matches ? "dark" : "light");
    };
    m.addEventListener("change", onChange);
    return () => m.removeEventListener("change", onChange);
  }, []);

  const flip = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // private mode: the page still flips, it just will not be remembered
      }
      return next;
    });
  }, []);

  const dark = theme === "dark";

  return (
    <button
      type="button"
      className="ap-nav__theme"
      onClick={flip}
      // Named for what it DOES, not for what it currently is: "Dark theme,
      // pressed" is a state a screen reader can act on, where a label that
      // flips between "light" and "dark" leaves you guessing which one the
      // press will give you.
      aria-label="Dark theme"
      aria-pressed={theme === null ? undefined : dark}
      title={dark ? "Switch to the light theme" : "Switch to the night theme"}
    >
      {/* One icon, drawn as a disc with a bite taken out of it: the mask slides
          across on the flip, so the sun becomes the moon in place rather than
          two icons swapping and nudging the bar's width. */}
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
        <defs>
          <mask id="ap-moon">
            <rect width="24" height="24" fill="#fff" />
            <circle cx={dark ? 15.5 : 26} cy={dark ? 7.5 : 0} r="7" fill="#000" />
          </mask>
        </defs>
        <circle cx="12" cy="12" r={dark ? 7.4 : 4.6} fill="currentColor" mask="url(#ap-moon)" />
        {/* the rays retract to nothing in the night state */}
        <g
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          style={{ opacity: dark ? 0 : 1, transition: "opacity .25s var(--ease)" }}
        >
          <path d="M12 1.6v2.2M12 20.2v2.2M1.6 12h2.2M20.2 12h2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M19.4 4.6l-1.6 1.6M6.2 17.8l-1.6 1.6" />
        </g>
      </svg>
    </button>
  );
}
