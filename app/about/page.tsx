import type { Metadata } from "next";
import Chrome from "@/components/Chrome";
import AboutView from "@/components/AboutView";
import { about, brand } from "@/lib/content";
import TextFX from "@/components/TextFX";
import { pageMeta, personLd } from "@/lib/seo";

export const metadata: Metadata = pageMeta({ title: "About", description: about.lead, path: "/about" });

export default function Page() {
  return (
    <>
      <Chrome />
      <AboutView />
      {/* The artist, stated once more for machines — nothing invented: the
          locality is the footer's own line («Yerevan, Armenia») and the
          photograph's alt; `sameAs` is her akneye.com artist page, which
          this page no longer PRINTS since the client took the fact list and
          the «Artist page» link under it off it (change 3.pdf p10,
          2026-10-01 — «Հանենք էս սաղ»; her red ellipse includes the link).
          It stays here for machines only, because her note was about what
          the page shows; whether the markup should drop it too — here and
          in the home page's Person — is hers to answer. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "AboutPage",
            name: `About ${brand.artist}`,
            description: about.lead,
            // the same Person, same @id, as the home page's graph (lib/seo.ts)
            mainEntity: personLd(),
          }),
        }}
      />
      {/* splits and reveals the [data-tfx] headings — page-mounted so it
          cannot run before this page hydrates */}
      <TextFX />
    </>
  );
}
