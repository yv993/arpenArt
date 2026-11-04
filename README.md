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
npm run smoke        # status/header/shape checks against a running local server (SMOKE_BASE to change it)
```

CI (`.github/workflows/ci.yml`) runs typecheck, build, `next start` and the smoke on every push
and pull request to `main`. It reports; it does not hold anything back: Vercel deploys the same
push without waiting for it, so a commit that builds but fails the smoke is already live when CI
says so (`docs/LAUNCH-CHECKLIST.md` §4 shows how to make it a Vercel Deployment Check). The smoke
also checks the security headers `next.config.mjs` promises; on `next dev` it skips the two that
are production-only (the CSP and the picture cache) and says so, and CI sets `SMOKE_PROD=1` so
they always run there. Node is pinned to 22 (`.nvmrc`, `engines`).

`build:check` exists because `next build` and `next dev` both own `.next`: building while the
dev server is up replaces the chunks that server is mid-flight serving, and the next click dies
on a missing vendor chunk. `build:check` writes to its own `.next-check` folder instead (the
switch reads the npm script name in `next.config.mjs`, so no cross-env dependency is needed on
Windows), which means a build can verify a change at any time without killing the running site.

## Environment

Copy `.env.example` to `.env.local`. Everything works without it — every variable is optional,
delivery is env-gated, and the site never pretends otherwise. On Vercel the same names go under
**Settings → Environment Variables (Production)**, and every change needs a **redeploy**: the
values are read at build (pages, `NEXT_PUBLIC_*`) as well as at run time (API routes).

| Variable | Secret? | What it does |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | no | The public origin, e.g. `https://www.arpenart.com`. Until this is an https URL, `robots.txt` says `Disallow: /` and the sitemap is empty; it is also the origin of canonicals, social cards, JSON-LD and sign-in links. |
| `RESEND_API_KEY` | **yes** | Turns on email through Resend (orders and messages to Arpine, the buyer's copy, sign-in links). |
| `ORDER_TO_EMAIL` | no | Arpine's inbox — where Resend delivers orders and contact messages, and the reply-to of the buyer's copy. Unset (a webhook-only setup), the copy replies to the shop's public address, `brand.email` in `lib/content.ts`. |
| `MAIL_FROM` | no | The one sender for **all** mail, on a domain verified in Resend, e.g. `ArpenArt <shop@arpenart.com>`. Fallback chain: `MAIL_FROM` → `CONTACT_FROM` → `ArpenArt <onboarding@resend.dev>`. A sender counts as *verified* when it is set and does not contain `@resend.dev` (the onboarding address reaches only the Resend account's owner). |
| `CONTACT_FROM` | no | Legacy name for the sender, still honoured when `MAIL_FROM` is empty. |
| `ORDER_WEBHOOK_URL` | **yes** (the URL is the credential) | Optional HTTPS endpoint that receives each order as JSON. Every post carries an `Idempotency-Key` header; a receiver slower than about 12 seconds gets one retry with the same key, so it should de-duplicate on that header (the same holds for `CONTACT_WEBHOOK_URL`). |
| `CONTACT_WEBHOOK_URL` | **yes** | Optional HTTPS endpoint that receives each contact message as JSON. |
| `WEBHOOK_SECRET` | **yes** | When set, outgoing webhooks carry `X-ArpenArt-Signature: sha256=<hex HMAC-SHA256 of the exact raw body>`. |
| `AUTH_SECRET` | **yes** | At least 16 random characters; signs sign-in links and the `ap_session` cookie. |
| `NEXT_PUBLIC_SIGNIN` | — | **Computed, never set by hand**: `next.config.mjs` sets it at build to `"1"` only when `AUTH_SECRET` has ≥ 16 characters **and** `RESEND_API_KEY` is set **and** the sender is verified; otherwise `"0"`. Server and client both read it; the nav's account icon renders only when it is `"1"` (`/account` stays reachable and says sign-in is off). |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | no | Cloudflare Turnstile site key: the widget renders on the order, contact and sign-in forms only when set. |
| `TURNSTILE_SECRET_KEY` | **yes** | The server enforces the Turnstile check only when this **and** the site key are set (with the secret alone no widget renders, so nothing is enforced). Set both keys or neither. Both are also needed for the buyer's copy of an order (see *Delivery semantics*). |
| `GOOGLE_SITE_VERIFICATION`, `YANDEX_VERIFICATION`, `BING_SITE_VERIFICATION` | no | The verification codes for Search Console, Yandex Webmaster and Bing Webmaster Tools; each emits its meta tag when set. |
| `RESEND_API_BASE` | — | **Test only.** Overrides `https://api.resend.com` so a local mock can stand in. Never set it on Vercel. |

**Delivery semantics.** An order (or message) goes to the webhook **and** to Arpine by Resend
when both are configured — not either/or. `delivered` is true when at least one channel
accepted it. The buyer's copy is sent only when the order was delivered **and** Resend is
configured **and** the sender is verified **and** Turnstile is enforced (both keys): the copy
goes to whatever address the form names, so without the bot check a script could use it to mail
its own text to anyone from the shop's sender. `/api/health`'s `buyerCopy` follows the same rule.
The copy's reply-to is `ORDER_TO_EMAIL`, or the shop's public address when only a webhook is
configured, so the sender address itself needs no inbox. Every outbound call has a timeout per
attempt (8 seconds for Resend and Turnstile, about 12 for a webhook) and one retry on a network
error, a 5xx or a 429, all inside a deadline per request so a route always answers within its
time limit; Resend calls and webhook posts carry an `Idempotency-Key`, and a Resend 409 meaning
"the first attempt is still being processed" is asked once more with the same key
(`lib/server/mail.ts`). With nothing delivered, the routes still accept the submission, write
it to the server log (the only copy — Vercel keeps runtime logs for 1 hour on Hobby, 1 day on
Pro) and return `delivered: false`; the UI then tells the visitor honestly
and offers the artist's email address instead of pretending the message went out. The sign-in
route never logs a working link in production. The order route also never trusts a price from
the browser: the client sends only *which* category, illustration, variant and delivery option,
and the total is recomputed server-side from the catalogue (`app/api/order/route.ts`); a variant
whose price is `null` in `lib/content.ts` is never counted and is marked "Price confirmed by
Arpine". A piece listed in `soldOut` (`lib/content.ts`, empty until Arpine names one) cannot be
added, is left out of the cart's total, and makes `/api/order` refuse the order (422) until the
buyer removes it; `docs/OWNER-HANDBOOK.md` §5 says how to mark and unmark one.

**Checking the setup without sending an order:** `GET /api/health` answers
`{ ok, orders, buyerCopy, contact, signIn, turnstile }` — booleans only, never a value. See
`docs/LAUNCH-CHECKLIST.md` for what each one needs.

## Docs

- `docs/LAUNCH-CHECKLIST.md` — the owner's click-path, in order: mail, domain, Turnstile,
  Vercel plan, monitoring, search consoles, ownership.
- `docs/OWNER-HANDBOOK.md` — where each kind of content lives, what to send the developer to
  change it, how a change goes live, how orders arrive.
- `docs/QUESTIONS-FOR-ARPINE.md` — the decisions and facts only Arpine can give.

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

**The 3D relief map** (`components/ArmeniaMap.tsx`). Armenia in real relief, wearing Arpine's
own painted map since 2026-10-12: elevation is SRTM via AWS terrain tiles baked into
`public/map/height.png`; the surface (`public/map/relief.webp`) and the country's cut
(`public/map/mask.png`) are her painting, fitted to the real border by a six-parameter affine
(`scratchpad/assets-1012-map.cjs` — median edge error about 1.9 km, 9.4 km at the southern tip,
where her outline is shorter than the real one; she painted neither the enclaves nor the
exclave). The town pins are placed from their true coordinates on the same equirectangular
grid, so they land on her provinces. Nothing is fetched at runtime; the production CSP in
`next.config.mjs` is self-only apart from the one street-map tile host.

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

- **Map painting and outline** — Arpine Baroyan's own painted map of Armenia, baked into
  `public/map/relief.webp` and `public/map/mask.png`.
- **Map frame** — [geoBoundaries](https://www.geoboundaries.org/) gbOpen ARM ADM0, used for the
  bounding box the painting and the pins share.
- **Elevation** — SRTM (NASA/USGS, public domain) via AWS terrain tiles, baked into
  `public/map/height.png`.
- **Street map tiles** — [OpenFreeMap](https://openfreemap.org/) — loaded only if the visitor
  opens the map on `/find-in-store` — is the site's only third party by default; Cloudflare
  Turnstile joins it once its site key is set, on the pages with a form. Chosen deliberately over the
  usual defaults: CARTO's basemaps require an Enterprise licence for commercial use, and OSM's
  own raster tiles are volunteer-run with a usage policy that warns commercial services off.
  OpenFreeMap permits commercial use with no key, no registration and no cookies, serves
  everything from one host, and publishes its full stack so the tiles could be self-hosted if
  it ever disappeared. The reasoning is written out in `next.config.mjs`.

All map data is vendored at build time; the deployed site fetches nothing at runtime except
those street-map tiles, on request — and, once the Turnstile site key is set, Cloudflare's check
on the forms (`/privacy` names it from then on).
