import type { Metadata } from "next";
import Chrome from "@/components/Chrome";
import ContactBlock from "@/components/ContactBlock";
import { brand, home } from "@/lib/content";
import TextFX from "@/components/TextFX";
import { pageMeta, personLd } from "@/lib/seo";

export const metadata: Metadata = pageMeta({ title: "Contact", description: home.contact.copy, path: "/contact" });

export default function Page() {
  return (
    <>
      <Chrome />
      <ContactBlock heading="h1" />
      {/* the one contact fact the site actually has — the address is the
          city, because there is no public shopfront to name */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ContactPage",
            name: `Contact ${brand.artist}`,
            description: home.contact.copy,
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
