# ArpenArt

E-commerce site for [Arpine Baroyan](https://www.akneye.com/artists/arpine-baroyan), an Armenian
illustrator. Her paintings are sold as prints on physical objects — postcards, scarves, hoodies,
cups, plates, puzzles, stickers, tote bags and skirts — with ordering, a cart, and a
find-in-store page for the Yerevan shops that carry her work.

Built on **Next.js 15 (App Router) + React 19 + TypeScript (strict)**, with a deliberately tiny
dependency budget. The complete runtime dependency list:

| Package | Why it is here |
| --- | --- |
| `three`, `@react-three/fiber`, `@react-three/drei` | the 3D relief map of Armenia and the particle-sphere gallery |
| `gsap` | scroll and text choreography |
| `lenis` | smooth scrolling on the motion layer |
| `maplibre-gl` | the street map on `/find-in-store` (loaded only behind a button) |

That is the whole list — no UI kit, no CSS framework, no form library, no analytics. Keeping it
this small is a design constraint, not an accident: every feature below is hand-built against it.

## Getting started

```bash
npm install
npm run dev          # dev server on http://localhost:4000
npm run typecheck    # tsc --noEmit
npm run build        # production build into .next
npm run build:check  # production build into .next-check (safe while dev is running)
npm run start        # serve the production build on port 4000
```

`build:check` exists because `next build` and `next dev` both own `.next`: building while the
dev server is up replaces the chunks that server is mid-flight serving, and the next click dies
on a missing vendor chunk. `build:check` writes to its own `.next-check` folder instead (the
switch reads the npm script name in `next.config.mjs`, so no cross-env dependency is needed on
Windows), which means a build can verify a change at any time without killing the running site.

## Environment

Copy `.env.example` to `.env.local`. Everything works without it — delivery is env-gated, and
the site never pretends otherwise:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | The public origin. Until this is an https URL, `robots.txt` blocks all indexing. |
| `ORDER_WEBHOOK_URL` | Where `/api/order` delivers order submissions. |
| `CONTACT_WEBHOOK_URL` | Where `/api/contact` delivers enquiries. |
| `RESEND_API_KEY` + `ORDER_TO_EMAIL` | Email delivery for orders as an alternative/parallel channel. |

With no delivery configured, both API routes still accept the submission, log it to the server
console, and return `delivered: false` — the UI then tells the visitor honestly and offers the
artist's email address instead of pretending the message went out. The order route also never
trusts a price from the browser: the client sends only *which* category, illustration and
delivery option, and the total is recomputed server-side from the catalogue
(`app/api/order/route.ts`).

## Notable engineering

**The measured palette** (`app/globals.css`). Every colour token was *measured* from the
artist's 57 illustrations: pixels binned into a 5-bit histogram, then weighted k-means in
CIELAB across the whole collection. Terracotta holds 32.4% of her saturated pixels, marigold
30.5%, indigo 23.7%; `--paper` is the one invented token (she paints edge to edge, so there is
no ground to measure — it is her own warm-cream hue re-lit to L\*96). A measured contrast rule
follows: her accents cannot carry body text on paper, so body copy is ink or indigo only, with
darkened `-ink` variants for coloured labels that must pass 4.5:1.

**The two-layer honesty contract.** Every animation on the site — GSAP scroll choreography,
Lenis, the text effects — lives behind one shared gate:
`(min-width: 861px) and (prefers-reduced-motion: no-preference)` (exported as `FX_MEDIA` in
`lib/textfx.ts`; CSS layers add `(scripting: enabled)`). The server-rendered HTML is a complete,
honest static page: phones, no-JS visitors, crawlers, screen readers and anyone preferring
reduced motion get that page as-is, not a broken half of the animated one.

**The 3D relief map** (`components/ArmeniaMap.tsx`). Armenia in real relief: the outline (with
enclave holes and the exclave) comes from geoBoundaries, elevation from SRTM via AWS terrain
tiles baked into `public/map/height.png`, and the surface from Landsat imagery baked into
`public/map/relief.webp` — the lake, forests and bare volcanic west are photographed, not
drawn. All three rasters were reprojected at bake time onto one equirectangular grid over the
same bbox the vector border uses (pasted unprojected, Lake Sevan would slide kilometres against
the border). Nothing is fetched at runtime; the production CSP in `next.config.mjs` is
self-only apart from the one street-map tile host.

**Live product mockups** (`components/CardPrint.tsx`, `components/MugPrint.tsx`). The chosen
illustration is printed *into* the product photographs in the browser. Cards: each card's four
corners were measured off the photograph and the artwork is mapped onto them by a homography —
solved in the figure's current pixels and re-solved on resize, because a homography is not
scale-invariant. Mugs: the artwork is drawn through an actual cylinder projection
(per-destination-column inverse sampling, `θ = asin(x / R)`, with a measured radius and a
double "bow" for the above-eye-level camera), so the print bunches toward the silhouette like
ink on a mug rather than floating like a sticker.

**Text FX system** (`lib/textfx.ts` + `components/TextFX.tsx`). A shared vocabulary of four
entrance logics assigned by meaning — *rise* for openers, *flip* for the commerce voice,
*decipher* (letters settling out of Armenian letterforms) for anything naming the Armenia
series, *focus* for the shop index. Splitting into per-character spans happens once after
hydration and only in the motion layer; the server HTML keeps the real text, and the full
sentence moves to `aria-label` so a screen reader never hears the alphabet soup.

## Data provenance

- **Armenia outline** — [geoBoundaries](https://www.geoboundaries.org/) gbOpen ARM ADM0
  (simplified), enclaves and exclave preserved.
- **Elevation** — SRTM (NASA/USGS, public domain) via AWS terrain tiles, baked into
  `public/map/height.png`.
- **Surface imagery** — Landsat WELD (NASA GIBS, public domain), baked into
  `public/map/relief.webp`.
- **Street map tiles** — [OpenFreeMap](https://openfreemap.org/), the site's only third party,
  loaded only if the visitor opens the map on `/find-in-store`. Chosen deliberately over the
  usual defaults: CARTO's basemaps require an Enterprise licence for commercial use, and OSM's
  own raster tiles are volunteer-run with a usage policy that warns commercial services off.
  OpenFreeMap permits commercial use with no key, no registration and no cookies, serves
  everything from one host, and publishes its full stack so the tiles could be self-hosted if
  it ever disappeared. The reasoning is written out in `next.config.mjs`.

All map data is vendored at build time; the deployed site fetches nothing at runtime except
those street-map tiles, on request.
