import type { Metadata } from "next";
import Chrome from "@/components/Chrome";
import ContactBlock from "@/components/ContactBlock";
import { brand, home } from "@/lib/content";

export const metadata: Metadata = {
  title: "Contact",
  description: home.contact.copy,
};

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
            mainEntity: {
              "@type": "Person",
              name: brand.artist,
              email: brand.email,
              address: { "@type": "PostalAddress", addressLocality: "Yerevan", addressCountry: "AM" },
            },
          }),
        }}
      />
    </>
  );
}
