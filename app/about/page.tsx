import type { Metadata } from "next";
import Chrome from "@/components/Chrome";
import AboutView from "@/components/AboutView";
import { about, brand } from "@/lib/content";
import TextFX from "@/components/TextFX";

export const metadata: Metadata = {
  title: "About",
  description: about.lead,
  alternates: { canonical: "/about" },
};

export default function Page() {
  return (
    <>
      <Chrome />
      <AboutView />
      {/* The artist, stated once more for machines — nothing invented. Since
          the client took the fact list off this page (change 3.pdf p10,
          2026-10-01 — «Հանենք էս սաղ»; her ellipse includes the «Artist page»
          link) two of these facts are no longer PRINTED here: the locality
          (the biography says "based in Armenia"; Yerevan was the «Based in»
          row) and the akneye.com artist page behind `sameAs`. Both are kept
          for machines only — her note was about what the page shows.
          Whether the markup should drop them too is hers to answer; until
          then they stay, here and in the home page's Person. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "AboutPage",
            name: `About ${brand.artist}`,
            description: about.lead,
            mainEntity: {
              "@type": "Person",
              name: brand.artist,
              jobTitle: brand.role,
              address: { "@type": "PostalAddress", addressLocality: "Yerevan", addressCountry: "AM" },
              sameAs: [about.link.href],
            },
          }),
        }}
      />
      {/* splits and reveals the [data-tfx] headings — page-mounted so it
          cannot run before this page hydrates */}
      <TextFX />
    </>
  );
}
