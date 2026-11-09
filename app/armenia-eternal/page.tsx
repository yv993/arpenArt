import type { Metadata } from "next";
import Link from "next/link";
import Chrome from "@/components/Chrome";
import EternalView, { type EternalExtra, type EternalPiece } from "@/components/EternalView";
import { OrderingSteps } from "@/components/CategoryView";
import TextFX from "@/components/TextFX";
import { armeniaEternal, brand, categories, ETERNAL, hrefOf, itemWords } from "@/lib/content";
import products from "@/lib/products.json";
import { origin } from "@/lib/site";
import { pageMeta } from "@/lib/seo";
// her art as the link preview (scripts/eternal.mjs: three of her cards on the
// navy runner) — imported, so its URL carries a content hash and its real size
import og from "./armenia-eternal-og.jpg";

// ============================================================================
// /armenia-eternal — THE COLLECTION'S OWN PAGE (client, change 5.pdf p9 +
// p10, 2026-11-04). Not a /shop/<slug> line: content.ts gives the entry an
// `href`, so the strip, the nav's menu, the home ring, the sitemap and the
// order mail all link here, and /shop/armenia-eternal answers a 308 to it
// (next.config.mjs RETIRED). The page itself is components/EternalView.tsx;
// this file adds what every shop page has around it — the crumb, how
// ordering works, the structured data — and the TextFX runner, last.
// ============================================================================

const cat = categories.find((c) => c.slug === ETERNAL)!;
const PIECES = ((products as unknown as { eternal?: EternalPiece[] }).eternal ?? []) as EternalPiece[];
const EXTRA = ((products as unknown as { eternalExtra?: EternalExtra[] }).eternalExtra ?? []) as EternalExtra[];

export const metadata: Metadata = pageMeta({
  title: armeniaEternal.title,
  description: cat.blurb,
  path: hrefOf(cat),
  image: { url: og.src, width: og.width, height: og.height, type: "image/jpeg", alt: armeniaEternal.alt.og },
});

export default function Page() {
  const url = origin + hrefOf(cat);
  // A COLLECTION, NOT A PRODUCT: CollectionPage with the pieces as an
  // ItemList — name and picture each, and NO Offer while every price is
  // Arpine's to confirm (a Product without one is an invalid item to Google;
  // app/shop/[slug] keeps the same rule). The page belongs to the site and
  // is the artist's work: the same @ids the home page's graph defines.
  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: armeniaEternal.title,
    description: cat.blurb,
    url,
    inLanguage: "en",
    image: origin + og.src,
    isPartOf: { "@id": origin + "/#site" },
    creator: { "@id": origin + "/#artist" },
    publisher: { "@id": origin + "/#org" },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: PIECES.length,
      itemListElement: PIECES.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: `${itemWords(ETERNAL, p.id)} — ${armeniaEternal.title}, ${brand.name}`,
        image: origin + p.src,
      })),
    },
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: origin + "/" },
      { "@type": "ListItem", position: 2, name: "Shop", item: origin + "/shop" },
      { "@type": "ListItem", position: 3, name: cat.name, item: url },
    ],
  };

  return (
    <>
      <Chrome />
      {/* the crumb on the page's own clearance, as on /shop/posters */}
      <div className="ap-ae__top">
        <nav className="ap-crumb" aria-label="Breadcrumb">
          <Link href="/shop">Shop</Link>
          <span aria-hidden>/</span>
          <span aria-current="page">{cat.name}</span>
        </nav>
      </div>

      <EternalView pieces={PIECES} extra={EXTRA} />

      <div className="ap-ae__foot">
        <OrderingSteps />
      </div>

      {/* one tag, two entities — JSON-LD accepts a top-level array */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([collectionLd, breadcrumbLd]) }} />
      {/* splits and reveals the [data-tfx] headings — page-mounted so it
          cannot run before this page hydrates */}
      <TextFX />
    </>
  );
}
