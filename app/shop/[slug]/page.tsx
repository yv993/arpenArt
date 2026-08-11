import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Chrome from "@/components/Chrome";
import CategoryView from "@/components/CategoryView";
// One route serves eight product pages, so GSAP + ScrollTrigger ride along on
// all of them even though only the photographed ones render a lookbook —
// /shop/[slug] went from 110 kB to 159 kB First Load. next/dynamic was tried
// and measured: both /shop/postcards and /shop/totes still fetched a
// byte-identical set of 16 scripts, because the App Router preloads a route's
// whole client manifest either way. Left as a plain import rather than keep an
// optimisation that does not optimise. It also matters less than it looks:
// the home page loads GSAP already, so it is warm for anyone arriving there
// first, and the remaining categories get lookbooks as their photography lands.
import Lookbook from "@/components/Lookbook";
import Overture from "@/components/Overture";
import MorphHero from "@/components/MorphHero";
import { brand, categories, lookbooks, morphs, overtures } from "@/lib/content";
import products from "@/lib/products.json";
import artworks from "@/lib/artworks.json";

type Art = { id: string; src: string; thumb: string; w: number; h: number; avg: string };
const ART = artworks as Art[];

type Shot = { id: string; src: string; thumb: string; w: number; h: number; alpha: boolean; avg: string };
const P = products as Record<string, Shot[]>;

export const dynamicParams = false; // unknown slugs are a real 404, not a soft one

// Structured data wants absolute URLs. Same guard as robots.ts and layout.tsx:
// a real https origin when configured, the dev origin otherwise — harmless,
// because robots.ts keeps crawlers out in that state.
const site = process.env.NEXT_PUBLIC_SITE_URL;
const origin = site && site.startsWith("https://") ? site : "http://localhost:4000";

export function generateStaticParams() {
  return categories.filter((c) => c.status === "open").map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cat = categories.find((c) => c.slug === slug);
  if (!cat) return {};
  return { title: cat.name, description: cat.blurb };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cat = categories.find((c) => c.slug === slug);
  if (!cat || cat.status !== "open") notFound();

  // A lookbook only appears where the photography exists and content.ts names
  // a reading order for it. Any id in that order which is not in the manifest
  // drops out rather than rendering a hole.
  const book = lookbooks[cat.slug];
  const shots = book
    ? book.order.map((id) => P[cat.media]?.find((s) => s.id === id)).filter((s): s is Shot => !!s)
    : [];

  // The overture opens the page instead of the buy panel. Six is the floor:
  // below that the three columns cannot fill a screen without repeating.
  const ovt = overtures[cat.slug];
  const ovtShots = P[cat.media] ?? [];
  const opens = !!ovt && ovtShots.length >= 6;

  // The morph hero draws on the ARTWORK, not product photography — 20 cards
  // sampled evenly across the whole series, not the first twenty. (A stride of
  // 3 across 57 gives 19, and a 19-card ring built for 20 has a gap in it.)
  const morph = morphs[cat.slug];
  const morphDeck = morph
    ? Array.from({ length: 20 }, (_, i) => ART[Math.round((i * (ART.length - 1)) / 19)])
    : [];

  // The first product shot doubles as the Product image; the price is the same
  // placeholder figure the page itself shows (flagged in content.ts for the
  // client), so the markup never claims more than the screen does. Availability
  // can be a plain InStock: this route 404s any category that is not open.
  const firstShot = P[cat.media]?.[0];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${cat.name} — ${brand.name}`,
    description: cat.blurb,
    brand: { "@type": "Brand", name: brand.name },
    creator: { "@type": "Person", name: brand.artist },
    ...(firstShot ? { image: origin + firstShot.src } : {}),
    offers: {
      "@type": "Offer",
      price: cat.from,
      priceCurrency: "AMD",
      availability: "https://schema.org/InStock",
    },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: origin + "/" },
      { "@type": "ListItem", position: 2, name: "Shop", item: origin + "/shop" },
      { "@type": "ListItem", position: 3, name: cat.name, item: origin + "/shop/" + cat.slug },
    ],
  };

  return (
    <>
      <Chrome />
      {opens && (
        <Overture
          shots={ovtShots}
          name={cat.name}
          kicker={ovt.kicker}
          from={`${cat.from.toLocaleString()} ֏`}
        />
      )}
      {morph && (
        <MorphHero items={morphDeck} intro={morph.intro} cue={morph.cue} title={morph.title} copy={morph.copy} />
      )}
      <CategoryView cat={cat} demoted={opens || !!morph} />
      {book && shots.length >= 7 && (
        <Lookbook
          shots={shots}
          kicker={book.kicker}
          title={book.title}
          copy={book.copy}
          caption={book.caption}
          alt={book.alt}
        />
      )}
      {/* one tag, two entities — JSON-LD accepts a top-level array */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([jsonLd, breadcrumbLd]) }}
      />
    </>
  );
}
