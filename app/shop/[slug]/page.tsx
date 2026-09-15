import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Chrome from "@/components/Chrome";
import Link from "next/link";
import CategoryView, { CategorySpec, OrderingSteps } from "@/components/CategoryView";
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
import StickerFolders from "@/components/StickerFolders";
import StickerSurfer from "@/components/StickerSurfer";
import ToteGallery, { type ToteShot } from "@/components/ToteGallery";
import ScarfDesigns from "@/components/ScarfDesigns";
import KeychainSection from "@/components/keychains/KeychainSection";
import MagnetFridge from "@/components/MagnetFridge";
import type { Keychain } from "@/types/keychain";
import { brand, categories, keychainWall, lookbooks, morphs, overtures } from "@/lib/content";
import products from "@/lib/products.json";
import artworks from "@/lib/artworks.json";
import TextFX from "@/components/TextFX";

type Art = { id: string; src: string; thumb: string; w: number; h: number; avg: string };
const ART = artworks as Art[];

type Shot = { id: string; src: string; thumb: string; w: number; h: number; alpha: boolean; avg: string };
const P = products as Record<string, Shot[]>;

// The rest angles repeat on a cycle rather than being random: this array is
// built on the server and again in the browser, and Math.random() would give
// the two runs different numbers and hydrate a mismatch. Eight values are
// enough that twenty-four keychains do not visibly repeat, and being derived
// from the index they are identical on both sides every time.
const LEANS = [-2.4, 1.6, -1.1, 2.8, -3.2, 0.9, 2.1, -1.8];
const keychains: Keychain[] = (P.keychain ?? []).map((s, i) => ({
  id: s.id,
  // NUMBERED, not named — the same rule the 57 illustrations follow. See the
  // note in types/keychain.ts: place names were tried and could not be
  // verified for 22 of the 24, and a wrong story on her product is worse
  // than no story.
  title: `Keychain no. ${s.id}`,
  src: s.src,
  thumb: s.thumb,
  w: s.w,
  h: s.h,
  avg: s.avg,
  lean: LEANS[i % LEANS.length],
}));

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
      {/* STICKERS DO NOT USE THE CATEGORY VIEW ANY MORE (client 2026-08-19:
          "remove this part, only … 3 sticker in folder must stay, also add
          price and user must can buy them"). That view is built to sell ONE
          object with any one of the 57 illustrations printed on it, and this
          line is now six fixed sheets — so its big hero, its shot strip and
          its 57-illustration picker were all asking a question that no longer
          has an answer here. The folders are the product; the buying moved
          into them. What is deliberately KEPT is the scaffolding that is not
          about choosing: the breadcrumb, the heading, the price floor, how
          ordering works, and the spec rows that carry the returns wording. */}
      {cat.slug === "stickers" ? (
        <>
          <div className="ap-cv">
            <nav className="ap-crumb" aria-label="Breadcrumb">
              <Link href="/shop">Shop</Link>
              <span aria-hidden>/</span>
              <span aria-current="page">{cat.name}</span>
            </nav>
          </div>

          {/* THE FOLDERS CARRY THE PAGE'S H1. An earlier cut put "Stickers"
              above them and left "Six sheets of twenty" as an h2 underneath —
              two headings, twenty pixels apart, saying the same thing, and
              the blurb repeating the section copy under both. The category is
              already named by the breadcrumb, the tab title and the JSON-LD,
              so the page says it once, in the words that carry the most. */}
          <StickerFolders shots={P.stickers ?? []} slug={cat.slug} price={cat.from} heading="h1" />

          <div className="ap-cv">
            <div className="ap-sheets__foot">
              <OrderingSteps />
              <CategorySpec cat={cat} />
            </div>
          </div>
        </>
      ) : cat.slug === "3d-stickers" ? (
        /* Same shape as the sheets: the lane IS the product presentation, so
           CategoryView's hero and picker would only ask the question the lane
           already answers. The scaffolding that is not about choosing stays. */
        <>
          <div className="ap-cv">
            <nav className="ap-crumb" aria-label="Breadcrumb">
              <Link href="/shop">Shop</Link>
              <span aria-hidden>/</span>
              <span aria-current="page">{cat.name}</span>
            </nav>
          </div>

          <StickerSurfer shots={P.sticker3d ?? []} slug={cat.slug} price={cat.from} heading="h1" />

          <div className="ap-cv">
            <div className="ap-sheets__foot">
              <OrderingSteps />
              <CategorySpec cat={cat} />
            </div>
          </div>
        </>
      ) : cat.slug === "magnets" ? (
        /* The fourth bespoke line: thirty-five fixed magnets, staged on the
           client's own fridge render, every one opening big in the shared
           lightbox. Same scaffolding as the sheets, the lane and the wall. */
        <>
          <div className="ap-cv">
            <nav className="ap-crumb" aria-label="Breadcrumb">
              <Link href="/shop">Shop</Link>
              <span aria-hidden>/</span>
              <span aria-current="page">{cat.name}</span>
            </nav>
          </div>

          <MagnetFridge shots={P.magnet ?? []} slug={cat.slug} price={cat.from} heading="h1" />

          <div className="ap-cv">
            <div className="ap-sheets__foot">
              <OrderingSteps />
              <CategorySpec cat={cat} />
            </div>
          </div>
        </>
      ) : cat.slug === "scarves" ? (
        /* THREE FIXED DESIGNS since the client's 2026-09-15 drop (change.pdf
           p10): the print, its photographs and her words per design, each with
           its own buy button. Same scaffolding as the sheets and the wall —
           breadcrumb, the section carrying the h1, then how ordering works
           and the spec rows. The generic view's roll and 57-picker asked a
           question this line no longer has. */
        <>
          <div className="ap-cv">
            <nav className="ap-crumb" aria-label="Breadcrumb">
              <Link href="/shop">Shop</Link>
              <span aria-hidden>/</span>
              <span aria-current="page">{cat.name}</span>
            </nav>
          </div>

          <ScarfDesigns cat={cat} heading="h1" />

          <div className="ap-cv">
            <div className="ap-sheets__foot">
              <OrderingSteps />
              <CategorySpec cat={cat} />
            </div>
          </div>
        </>
      ) : cat.slug === "keychains" ? (
        /* The third line whose presentation IS the product: twenty-four fixed
           objects, each a finished thing, so there is nothing for the 57-
           illustration picker to ask. Same scaffolding as the sheets and the
           lane — breadcrumb, then the wall carrying the h1, then how ordering
           works and the spec rows. */
        <>
          <div className="ap-cv">
            <nav className="ap-crumb" aria-label="Breadcrumb">
              <Link href="/shop">Shop</Link>
              <span aria-hidden>/</span>
              <span aria-current="page">{cat.name}</span>
            </nav>
          </div>

          <KeychainSection items={keychains} wall={keychainWall} heading="h1" />

          <div className="ap-cv">
            <div className="ap-sheets__foot">
              <OrderingSteps />
              <CategorySpec cat={cat} />
            </div>
          </div>
        </>
      ) : (
        <>
          {/* HER FOUR TOTE DESIGNS, above the buy panel (client 2026-08-24,
              pointing at shadcnblocks' gallery1). It is the page's entrance,
              which is why it sits before CategoryView rather than after: the
              photographs are what make somebody want the thing the panel
              sells. */}
          {cat.slug === "totes" && (
            <ToteGallery shots={(products as unknown as { toteBags?: ToteShot[] }).toteBags ?? []} />
          )}
          <CategoryView cat={cat} demoted={opens || !!morph} />
        </>
      )}
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
      {/* splits and reveals the [data-tfx] headings — page-mounted so it
          cannot run before this page hydrates */}
      <TextFX />
    </>
  );
}
