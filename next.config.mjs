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
const TILES = "https://tiles.openfreemap.org";
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
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
  "frame-ancestors 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
      // next reload, not tomorrow. The folders are the ones /public holds;
      // /_next/static keeps Next's own year-long immutable header.
      // `:path+`, NOT `:path*`: two of these folders share their name with a
      // page — /stories and /cart — and `*` also matches the bare folder, so
      // it handed those two HTML pages a day-long cache (tested with Next's
      // own matcher, next/dist/shared/lib/router/utils/path-match): a deploy
      // would not have reached a returning visitor's cart for a day.
      ...(process.env.NODE_ENV === "production"
        ? [
            {
              source: "/(art|products|stories|studio|hero|globe|auth|brand|cart|stockists|map)/:path+",
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
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Content-Security-Policy", value: csp }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
