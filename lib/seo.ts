// WHAT SEARCH ENGINES AND LINK PREVIEWS ARE TOLD, IN ONE PLACE (2026-10-31,
// readiness #24). Three things kept going stale when each page typed its own:
//   · the site and /shop descriptions named cups, plates, puzzles and
//     hoodies, which have never been buyable — the list is now read from the
//     catalogue, so a line that opens (or closes) in lib/content.ts changes
//     the sentence by itself;
//   · every shared link previewed as the home page: no route set its own
//     og:title / og:description / og:url;
//   · the Organization / Person markup carried a name and little else.
import type { Metadata } from "next";
import { about, brand, categories, socials } from "@/lib/content";
import { origin } from "@/lib/site";
import products from "@/lib/products.json";
// The social card, imported rather than named by its route. A page's
// `openGraph` REPLACES the layout's whole object, and Next only adds the
// file-convention image (app/opengraph-image.jpg) where a route sets no
// openGraph — so a page with its own title lost its picture (Next 15.5
// resolve-metadata: mergeMetadata assigns openGraph wholesale). Imported, the
// file brings its real size and a content-hashed URL, so a new picture is a
// new address and no cache keeps the old one.
import card from "@/app/opengraph-image.jpg";

/** A catalogue name as it reads mid-sentence: "Tote bags" → "tote bags", but
 *  "3D stickers" and "T-Shirts" keep the capitals that are part of the name. */
const midSentence = (name: string) => (/[A-Z]/.test(name.slice(1)) ? name : name.charAt(0).toLowerCase() + name.slice(1));

/** The lines a visitor can buy today, in catalogue order, as prose:
 *  "postcards, scarves, … and tote bags". Only `status: "open"` lines. */
export const openLines = (() => {
  const names = categories.filter((c) => c.status === "open").map((c) => midSentence(c.name));
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names.join("");
})();

export const siteTitle = `${brand.name} — ${brand.tagline}`;
export const siteDescription = `Original illustration by ${brand.artist}, printed and painted onto ${openLines}. Made in Yerevan.`;
export const shopDescription = `${openLines.charAt(0).toUpperCase()}${openLines.slice(1)} carrying ${brand.artist}'s Armenia illustrations.`;

/** og:image for every route — relative, resolved against metadataBase */
export const socialImage = {
  url: card.src,
  width: card.width,
  height: card.height,
  type: "image/jpeg",
  alt: `${brand.name} — illustration by ${brand.artist}`,
};

/** The layout's open-graph defaults; pages spread this and add their own.
 *  No image here: a route that sets no openGraph of its own (cart, account,
 *  the Available Soon pages) gets the file convention's card from Next —
 *  measured, it wins over an image named in the layout — and pageMeta adds
 *  `socialImage` for the routes that do. */
export const ogBase = {
  type: "website" as const,
  siteName: brand.name,
  locale: "en_US",
};

/** One indexable route's title, description, canonical and social card.
 *  `title` is the short page name (the layout's template adds the brand to
 *  <title>); the social title spells the brand out, because og:title takes
 *  no template from a plain-string parent. Twitter's image is filled from
 *  og:image by Next when the twitter object names none. */
export function pageMeta({ title, description, path }: { title?: string; description: string; path: string }): Metadata {
  const social = title ? `${title} — ${brand.name}` : siteTitle;
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: { ...ogBase, images: [socialImage], title: social, description, url: path },
    twitter: { card: "summary_large_image", title: social, description },
  };
}

/** Search-console ownership tags, each only when its env var is set — a meta
 *  tag with an empty content would claim a verification that is not there. */
export function searchVerification(env: Record<string, string | undefined> = process.env): Metadata["verification"] {
  const google = env.GOOGLE_SITE_VERIFICATION?.trim();
  const yandex = env.YANDEX_VERIFICATION?.trim();
  const bing = env.BING_SITE_VERIFICATION?.trim();
  if (!google && !yandex && !bing) return undefined;
  return {
    ...(google ? { google } : {}),
    ...(yandex ? { yandex } : {}),
    ...(bing ? { other: { "msvalidate.01": bing } } : {}),
  };
}

// ---------------------------------------------------------------------------
// STRUCTURED DATA — facts the site already states, nothing else. The phone in
// `brand` is still a placeholder and stays out; the email is hers (change.pdf
// p6 + p9). sameAs lists only profiles that are confirmed hers: a `pending`
// social still points at the platform, and mailto: is not a profile.
// ---------------------------------------------------------------------------
const profiles = socials.filter((s) => !s.pending && /^https:\/\//.test(s.href)).map((s) => s.href);
const portrait = (products as Record<string, Array<{ src: string }>>).about?.[0]?.src;
const yerevan = { "@type": "PostalAddress", addressLocality: "Yerevan", addressCountry: "AM" } as const;

/** The artist, as every page's markup names her — one @id site-wide. */
export function personLd() {
  return {
    "@type": "Person",
    "@id": origin + "/#artist",
    name: brand.artist,
    jobTitle: brand.role,
    url: origin + "/about",
    ...(portrait ? { image: origin + portrait } : {}),
    email: brand.email,
    address: yerevan,
    worksFor: { "@id": origin + "/#org" },
    // her akneye.com artist page (no longer printed on /about — kept for
    // machines, see app/about/page.tsx) and her own profiles
    sameAs: [about.link.href, ...profiles],
  };
}

/** Person + Organization + WebSite in one @graph, for the home page. */
export function siteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      personLd(),
      {
        "@type": "Organization",
        "@id": origin + "/#org",
        name: brand.name,
        url: origin + "/",
        // her lockup, the mark the bar shows (244x256)
        logo: { "@type": "ImageObject", url: origin + "/brand/arpenart-lockup.png", width: 244, height: 256 },
        image: origin + card.src,
        email: brand.email,
        address: yerevan,
        founder: { "@id": origin + "/#artist" },
        ...(profiles.length ? { sameAs: profiles } : {}),
      },
      {
        "@type": "WebSite",
        "@id": origin + "/#site",
        name: brand.name,
        url: origin + "/",
        description: siteDescription,
        inLanguage: "en",
        publisher: { "@id": origin + "/#org" },
      },
    ],
  };
}
