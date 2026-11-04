import Chrome from "@/components/Chrome";
import SectionRail from "@/components/SectionRail";
import HomeView from "@/components/HomeView";
import TextFX from "@/components/TextFX";
import { pageMeta, siteDescription, siteJsonLd } from "@/lib/seo";
import type { Metadata } from "next";

// the canonical resolves against metadataBase (lib/site.ts) — written on
// every indexable page so a shared or tracked URL always points home; the
// social card carries og:url too (lib/seo.ts pageMeta)
export const metadata: Metadata = pageMeta({ description: siteDescription, path: "/" });

// Who runs this site, in schema.org terms — Person, Organization and WebSite
// in one @graph, so search engines read them as one story: the person founded
// the brand that publishes the site. Built in lib/seo.ts from lib/content.ts
// facts only (her role, city, email, artist page and confirmed Instagram;
// the placeholder phone stays out) with absolute URLs from lib/site.ts.
const jsonLd = siteJsonLd();

export default function Page() {
  return (
    <>
      <Chrome />
      <SectionRail />
      <HomeView />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* splits and reveals the [data-tfx] headings — page-mounted so it
          cannot run before this page hydrates */}
      <TextFX />
    </>
  );
}
