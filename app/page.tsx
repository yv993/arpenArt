import Chrome from "@/components/Chrome";
import SectionRail from "@/components/SectionRail";
import HomeView from "@/components/HomeView";
import { about, brand } from "@/lib/content";
import TextFX from "@/components/TextFX";

// Structured data wants absolute URLs. Same guard as robots.ts and layout.tsx:
// a real https origin when configured, the dev origin otherwise — harmless,
// because robots.ts keeps crawlers out in that state.
const site = process.env.NEXT_PUBLIC_SITE_URL;
const origin = site && site.startsWith("https://") ? site : "http://localhost:4000";

// Who runs this site, in schema.org terms. Every fact is lifted from
// lib/content.ts — her role, her city, her verifiable artist page — and the
// placeholder email/phone stay OUT: structured data must not present an
// unconfirmed contact as real. The three entities share one @graph so search
// engines read them as one story: the person founded the brand that publishes
// the site.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": origin + "/#artist",
      name: brand.artist,
      jobTitle: brand.role,
      address: { "@type": "PostalAddress", addressLocality: "Yerevan", addressCountry: "AM" },
      sameAs: [about.link.href],
    },
    {
      "@type": "Organization",
      "@id": origin + "/#org",
      name: brand.name,
      founder: { "@id": origin + "/#artist" },
    },
    {
      "@type": "WebSite",
      "@id": origin + "/#site",
      name: brand.name,
      url: origin + "/",
      publisher: { "@id": origin + "/#org" },
    },
  ],
};

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
