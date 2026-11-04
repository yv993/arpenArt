// The CSP lists exactly what this site uses and nothing more: almost
// everything is self-hosted (fonts via next/font, images from /public), and
// nothing may frame us. 'unsafe-inline' stays in script-src because Next boots
// hydration (and our JSON-LD) from inline scripts, and in style-src because
// next/font and global-error.tsx inline their CSS. It ships ONLY in
// production: the dev runtime needs eval for react-refresh, and a header that
// breaks the dev server gets deleted, not obeyed.
//
// THE ONE THIRD PARTY: /find-in-store can draw a street map with maplibre-gl,
// and it is the only thing on this site that talks to anyone else. It is
// behind a button, so nobody who does not ask for it is ever exposed.
//
// The tiles come from OPENFREEMAP, and the choice of provider was the whole
// decision. CARTO's basemaps — maplibre's usual default and what the supplied
// component shipped with — require a CARTO Enterprise licence for commercial
// use, and this site sells her work; their CDN serves anonymously, but that is
// a fact about their nginx, not a licence. OSM's own raster tiles were
// rejected too: the OSMF usage policy warns commercial services that access
// may be withdrawn, and they run on donated volunteer hardware. OpenFreeMap
// has no request limit, no API key, no registration and no cookies, permits
// commercial use, and publishes its whole production stack — so if it ever
// disappears the same tiles can be self-hosted without touching this code.
//
// One host serves everything: style, glyphs, sprites, vector tiles and the
// Natural Earth raster underlay. (CARTO would have needed six — its style,
// sprite/glyph and FOUR round-robin tile shards — which is the kind of detail
// that ships a blank grey square with no error a visitor could interpret.)
//
// worker-src must be spelled out. It falls back to script-src, and maplibre
// spawns its tile-decoding worker from a blob: URL, so without this the map
// dies on construction.
//
// THE BOT CHECK (2026-10-31): the three forms can show Cloudflare Turnstile
// when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set. Cloudflare's CSP page asks for
// exactly two things — its host in script-src (api.js) and in frame-src (the
// widget is an iframe) — and connect-src only in "pre-clearance" mode, which
// this site does not use. frame-src is new here: until now frames fell back to
// child-src, and nothing on the site embeds a frame of its own.
const TILES = "https://tiles.openfreemap.org";
const TURNSTILE = "https://challenges.cloudflare.com";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${TURNSTILE}`,
  "style-src 'self' 'unsafe-inline'",
  // the sprite sheet and the Natural Earth underlay are images
  `img-src 'self' data: blob: ${TILES}`,
  "media-src 'self'",
  "font-src 'self'",
  // style.json, TileJSON, .pbf tiles and the glyph ranges
  `connect-src 'self' ${TILES}`,
  "worker-src 'self' blob:",
  // older engines never learned worker-src and read child-src instead
  "child-src 'self' blob:",
  `frame-src 'self' ${TURNSTILE}`,
  "frame-ancestors 'none'",
].join("; ");

// SIGN-IN IS ON ONLY WHEN IT CAN ACTUALLY DELIVER A LINK (2026-10-31). The
// account icon, the form prefill and /api/auth all read one flag, decided here
// once per build: a session key long enough to sign with, a Resend key, and a
// sender on a verified domain — onboarding@resend.dev can only ever mail the
// Resend account's owner, so a buyer would wait for a link that never comes.
// Only "1"/"0" leaves this file, never a value. It is computed at build, so a
// change to those variables on Vercel needs a redeploy, like every NEXT_PUBLIC_
// value; and it overrides anything set by hand under the same name.
const sender = process.env.MAIL_FROM || process.env.CONTACT_FROM || "";
const signIn =
  (process.env.AUTH_SECRET ?? "").length >= 16 &&
  !!process.env.RESEND_API_KEY &&
  !!sender &&
  !sender.includes("@resend.dev");

// THE OWN-DOMAIN REDIRECT, DORMANT UNTIL THE DOMAIN IS CONFIGURED. Once
// NEXT_PUBLIC_SITE_URL names her domain, every other host this production
// build answers on should hand visitors (and crawlers) to it, so the shop has
// one address. Read the same way lib/site.ts reads it: only an https value
// counts. VERCEL_PROJECT_PRODUCTION_URL is, per Vercel's docs, the SHORTEST
// production custom domain — the vercel.app name only while no custom domain
// is attached at all — and it is set on preview builds too. Hence:
//  - nothing at all while it is still a *.vercel.app name: no custom domain is
//    attached to this project yet, so the configured host cannot be served by
//    it, and redirecting there would send every visitor to a dead address;
//  - its host (with the domain attached, e.g. the bare apex when www is
//    primary) redirects to the configured origin;
//  - on the PRODUCTION build only (VERCEL_ENV), the vercel.app names of the
//    deployment redirect too — which the line above cannot cover, because
//    with a custom domain attached that variable no longer holds the
//    vercel.app name. Preview builds never get this rule, and the configured
//    host is never matched (no loop).
// Today NEXT_PUBLIC_SITE_URL is unset, so redirects() returns nothing.
const configured = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
const urlOrNull = (v) => {
  try {
    return new URL(v);
  } catch {
    return null;
  }
};
const site = configured.startsWith("https://") ? urlOrNull(configured) : null;
// a bare host per Vercel's docs ("my-site.com"); a scheme is tolerated anyway
const prodRaw = (process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "").replace(/^https?:\/\//i, "");
const prodHost = prodRaw ? (urlOrNull(`https://${prodRaw}`)?.hostname ?? "") : "";
// has.value is a regex (anchored by Next and by Vercel), so a host's dots are escaped
const literal = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const redirectHosts = [];
// THE FOLDERS /public HOLDS, in ONE place (2026-11-01), because two rules
// below must agree on them: the day-long picture cache, and the own-domain
// redirect, which must leave them alone. Checked against `ls public`:
// art brand cart globe hero map products puzzle stockists stories studio.
// A new folder in /public goes here too — or its pictures get no cache, and
// an open tab on the old address is redirected away from them. ("auth" was
// on the old list; no such folder exists, so it is gone, and a page called
// /auth would redirect like any other.)
const PUBLIC_DIRS = "art|brand|cart|globe|hero|map|products|puzzle|stockists|stories|studio";
if (site && prodHost && prodHost !== site.hostname && !prodHost.endsWith(".vercel.app")) {
  redirectHosts.push(literal(prodHost));
  if (process.env.VERCEL_ENV === "production" && !site.hostname.endsWith(".vercel.app")) {
    redirectHosts.push("[a-z0-9-]+\\.vercel\\.app");
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // no "X-Powered-By: Next.js" — it tells a scanner which advisories to try
  poweredByHeader: false,
  env: { NEXT_PUBLIC_SIGNIN: signIn ? "1" : "0" },
  // A BUILD MUST NOT KILL THE RUNNING DEV SERVER. `next build` and `next dev`
  // both own `.next`, so building just to check a change while the dev server
  // is up replaces the chunks that server is mid-flight serving, and the next
  // click dies on "Cannot find module ./vendor-chunks/gsap.js" — a broken site
  // with nothing wrong in the source, and only `rm -rf .next` plus a restart
  // brings it back.
  //
  // `npm run build:check` lands in its own folder instead, so the check can be
  // run at any time. It reads the npm script name rather than an env var
  // because `DIST=x next build` is a shell-ism cmd.exe does not understand,
  // and this project is not adding cross-env to its three dependencies.
  // `npm run build` is unchanged and still writes `.next`, which is what a
  // deploy expects.
  distDir: process.env.npm_lifecycle_event === "build:check" ? ".next-check" : ".next",
  images: {
    // everything is self-hosted; no remote patterns on purpose
    formats: ["image/avif", "image/webp"],
  },
  // the source drop lives inside the project folder — keep it out of the build
  outputFileTracingExcludes: {
    "*": ["./imgss/**/*"],
  },
  async redirects() {
    if (!site) return [];
    // PAGES REDIRECT; WHAT AN OPEN PAGE FETCHES DOES NOT (2026-11-01). A tab
    // opened on the old host before the cutover keeps asking THAT host for
    // things, and its own CSP ('self' = the old host) blocks any answer that
    // comes from another origin. So three kinds of path answer on every host
    // this deployment serves:
    //  - /api/*: the order a tab POSTs to its own host would become a
    //    cross-origin POST that fails its CORS preflight (and the route's
    //    Origin check), and the order would be lost;
    //  - /_next/*: a lazy chunk (the puzzle) and the Cloud's HEAD probe of it.
    //    Redirected, the chunk failed AND the probe failed, so the cloud told
    //    an online buyer they were offline and never reloaded. Answered here,
    //    a chunk the new deploy dropped 404s, the probe answers, the page
    //    reloads once — and that reload is a page, so it lands on the new
    //    address;
    //  - the picture folders (PUBLIC_DIRS): every lazy picture not yet loaded
    //    (on /stories, all of them below the fold) broke instead of loading.
    // The trailing "/" in the lookahead keeps the /stories and /cart PAGES
    // redirecting; only the files under those folders stay. The root-level
    // files — favicon, icons, OG image, manifest, robots.txt, sitemap.xml —
    // come from app/, not /public, and keep redirecting: an open tab asked
    // for them when it loaded, and crawlers and link previews should see one
    // address. What does NOT cross over is anything kept per origin: the
    // puzzle re-open note and its reload guard (sessionStorage), so that
    // reload lands on the new home page without reopening the puzzle; and
    // the cart (localStorage) and the sign-in cookie, which is why
    // docs/LAUNCH-CHECKLIST.md §2 says to warn Arpine and pick a quiet hour.
    return redirectHosts.map((host) => ({
      source: `/:path((?!api/|_next/|(?:${PUBLIC_DIRS})/).*)`,
      has: [{ type: "host", value: host }],
      destination: `${site.origin}/:path`,
      permanent: true,
    }));
  },
  async headers() {
    return [
      // HER PICTURES AND FILMS MAY BE KEPT FOR A DAY (2026-10-05). /public is
      // served with `public, max-age=0, must-revalidate` by default, so a
      // returning phone asked again for every image and film on every page
      // (measured on the live site). A day fresh, then a week of serving the
      // copy it has while it checks in the background. NOT `immutable`, and
      // not a year: these names are not hashed, and the client replaces
      // pictures under the same name — a changed photograph reaches everyone
      // within a day, and the next visit after that. Production only, like
      // the CSP: on the dev server a picture swapped on disk must show on the
      // next reload, not tomorrow. The folders are the ones /public holds
      // (PUBLIC_DIRS, shared with the redirect above so the two lists cannot
      // drift apart); /_next/static keeps Next's own year-long immutable header.
      // `:path+`, NOT `:path*`: two of these folders share their name with a
      // page — /stories and /cart — and `*` also matches the bare folder, so
      // it handed those two HTML pages a day-long cache (tested with Next's
      // own matcher, next/dist/shared/lib/router/utils/path-match): a deploy
      // would not have reached a returning visitor's cart for a day.
      // /puzzle (2026-10-29) is asked for by `?v=` (lib/puzzles.json), so a
      // replaced piece can never meet yesterday's board in this cache.
      ...(process.env.NODE_ENV === "production"
        ? [
            {
              source: `/(${PUBLIC_DIRS})/:path+`,
              headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
            },
          ]
        : []),
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // belt (header) and braces (frame-ancestors in the CSP): the site
          // has no business inside anyone's iframe
          { key: "X-Frame-Options", value: "DENY" },
          // `geolocation=(self)`, not `()`: /find-in-store offers "find the
          // nearest town", and with the empty allowlist the browser refused
          // the call before the permission prompt could even appear — the
          // button was dead and said so in the console, not on screen. Only
          // THIS origin may ask; camera and microphone stay shut to everyone,
          // and the coordinates are used to sort six numbers in the browser
          // and are never sent anywhere.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          // a window this site opens, or that opens it, gets no handle on the
          // other. Nothing here relies on window.opener (the /privacy links
          // already open with rel="noopener"), and the Turnstile widget is an
          // iframe, which COOP does not touch. On in dev too: it breaks nothing
          // there, and the smoke test checks it on either server.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Content-Security-Policy", value: csp }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
