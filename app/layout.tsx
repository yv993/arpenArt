import type { Metadata, Viewport } from "next";
import { Fraunces, Karla, Montserrat } from "next/font/google";
import { brand } from "@/lib/content";
import { indexable, origin } from "@/lib/site";
import Foot from "@/components/Foot";
import "./globals.css";

// Social cards need absolute URLs, so metadata gets a base — the public
// origin decided in lib/site.ts (it used to be guessed here, and on Vercel
// the guess was localhost: the live og:image pointed at a dev server).

const description =
  "Original illustration by Arpine Baroyan, printed and painted onto postcards, scarves, hoodies, cups, plates, puzzles and stickers. Made in Yerevan.";

// Fraunces carries the hand-made warmth of the gouache without being twee;
// Karla keeps the shop information plain and legible underneath it.
const display = Fraunces({
  subsets: ["latin"],
  variable: "--f-display",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});
const body = Karla({
  subsets: ["latin"],
  variable: "--f-body",
  display: "swap",
});
// The client's reference sets section titles in a GEOMETRIC sans — round
// bowls, even strokes — which neither Fraunces (the display serif) nor Karla
// (a grotesque with narrow, quirky bowls) can stand in for. next/font
// self-hosts it, so this adds a file to the build, not a request to Google.
const ui = Montserrat({
  subsets: ["latin"],
  variable: "--f-ui",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title: {
    default: `${brand.name} — ${brand.tagline}`,
    template: `%s — ${brand.name}`,
  },
  description,
  applicationName: brand.name,
  authors: [{ name: brand.artist }],
  // off until the owner configures a real domain (lib/site.ts `indexable`)
  robots: { index: indexable, follow: indexable },
  // The shop sells through shared links, so the link preview IS the shopfront.
  // No image URL is written here on purpose: Next wires app/opengraph-image.jpg
  // into og:image (and Twitter falls back to it) with correct absolute URLs.
  // (A JPEG since 2026-09-22: the same card was a 356 KB PNG, 137 KB now —
  // messaging apps fetch it on every share.)
  openGraph: {
    type: "website",
    siteName: brand.name,
    title: `${brand.name} — ${brand.tagline}`,
    description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${brand.name} — ${brand.tagline}`,
    description,
  },
};

export const viewport: Viewport = {
  // --paper, so the browser chrome blends into the page instead of framing it
  themeColor: "#fcf2e6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // No `js` class script here on purpose: writing one would change <html>
  // between the server render and hydration. The stylesheet gates its pinned
  // sections on `@media (scripting: enabled)` instead, which costs nothing and
  // fails in the safe direction — no scripting, no pin, plain vertical page.
  //
  // THE THEME SCRIPT IS THE ONE EXCEPTION, and it is a different shape. It
  // writes an ATTRIBUTE (data-theme) that React never renders, rather than
  // mutating the className React owns — which is exactly what made the `js`
  // class a hydration mismatch. It runs before the first paint, so a visitor
  // who chose the night theme never sees a cream flash on the way in, and it
  // is a no-op for everyone else: with nothing stored, the OS answers through
  // `prefers-color-scheme` in CSS alone. suppressHydrationWarning covers the
  // attribute the server could not have known about.
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${ui.variable}`}
      suppressHydrationWarning
    >
      <body>
        {/* THE FOOTER'S CURTAIN STATE IS SET HERE TOO, before the first paint.
            FootReveal used to be the only writer of html[data-footfx], from a
            layout effect — so every page painted the footer in flow at the
            document's end, then hydration fixed it under <main> at the
            bottom of the viewport. The Layout Instability API counts that
            arrival (an element ending inside the viewport it was not in): the
            2026-09-22 audit read it as 0.45 of the home's 0.51 CLS and 0.28 on
            /account, though nobody sees it — it sits behind main. Written
            here under FootReveal's own gate (lib/textfx FX_MEDIA), the footer
            is fixed from the first frame; the effect still measures --foot-h
            and drives the reveal. suppressHydrationWarning above covers the
            attribute the server could not have known about. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('ap-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}" +
              "try{if(matchMedia('(min-width: 861px) and (prefers-reduced-motion: no-preference)').matches)document.documentElement.setAttribute('data-footfx','')}catch(e){}",
          }}
        />
        <a className="ap-skip" href="#main">
          Skip to content
        </a>
        <main id="main">{children}</main>
        {/* The footer lives OUTSIDE main on purpose: the motion reveal fixes
            it beneath the page and lets main (opaque, z-raised) lift off it
            like a curtain. Inside main, a fixed footer could never sit
            behind main's own background — stacking contexts forbid it. */}
        <Foot />
        {/* The TextFX runner is mounted by EVERY PAGE, not here: loading.tsx
            makes each route a Suspense boundary, and a layout effect fires
            before that boundary hydrates — the runner would split headings
            React had not yet claimed (the hydration mismatch of 2026-08-11).
            An effect inside the page's own tree cannot run that early. */}
      </body>
    </html>
  );
}
