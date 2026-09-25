// THE PUBLIC ORIGIN, DECIDED ONCE.
//
// Five files used to derive it separately, each with the same guard: a real
// https NEXT_PUBLIC_SITE_URL, otherwise the dev origin. That guard did two
// jobs at once — "where do absolute URLs point" and "may this be indexed" —
// and on Vercel, where the variable was never set, the first job failed in
// public: the live page's og:image and twitter:image were
// `http://localhost:4000/opengraph-image.png` (measured on arpen-art.vercel.app,
// 2026-09-22), so every link shared on WhatsApp, Telegram or Instagram showed
// no picture, and the site-wide JSON-LD named a localhost organisation.
//
// The two jobs are split now:
//   `origin`    — the best-known public address: the configured one, else the
//                 production URL Vercel sets on every build, else dev. Social
//                 cards, JSON-LD and sign-in links resolve against it.
//   `indexable` — the owner's explicit switch, still NEXT_PUBLIC_SITE_URL as
//                 an https address: only then do robots.txt and the sitemap
//                 open, so nothing changes about search until Arpine's own
//                 domain is configured.
const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const indexable = !!configured && configured.startsWith("https://");
export const origin = indexable ? (configured as string) : vercel ? `https://${vercel}` : "http://localhost:4000";
