"use client";

import { useEffect } from "react";
import { brand } from "@/lib/content";

// Boundary of last resort: this replaces the ROOT layout when even that
// throws, so per the Next docs it must render its own <html> and <body> and
// cannot import the global stylesheet. The <style> block below hardcodes the
// two colours that make the page ours — --paper #fcf2e6 and --ink #232834 —
// and a system font stack, because next/font is gone along with the layout.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="ap-crash">
        <style>{`
          .ap-crash {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-content: center;
            gap: 18px;
            text-align: center;
            padding: 24px;
            background: #fcf2e6;
            color: #232834;
            font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
          }
          .ap-crash h1 {
            margin: 0;
            font-size: clamp(28px, 6vw, 44px);
            letter-spacing: 0.04em;
          }
          .ap-crash p {
            margin: 0;
            font-size: 16px;
            line-height: 1.5;
          }
          .ap-crash a {
            color: inherit;
          }
          .ap-crash button {
            justify-self: center;
            min-height: 48px;
            padding: 13px 26px;
            border: 0;
            border-radius: 999px;
            background: #232834;
            color: #fcf2e6;
            font: inherit;
            font-size: 12.5px;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            cursor: pointer;
          }
        `}</style>
        <h1>SOMETHING BROKE</h1>
        <p>The whole page failed to load. Trying again usually clears it.</p>
        <button type="button" onClick={reset}>
          Try again
        </button>
        <p>
          Still broken? Write to <a href={`mailto:${brand.email}`}>{brand.email}</a>.
        </p>
      </body>
    </html>
  );
}
