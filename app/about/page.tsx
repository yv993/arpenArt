import type { Metadata } from "next";
import Chrome from "@/components/Chrome";
import AboutView from "@/components/AboutView";
import { about, brand } from "@/lib/content";

export const metadata: Metadata = {
  title: "About",
  description: about.lead,
};

export default function Page() {
  return (
    <>
      <Chrome />
      <AboutView />
      {/* the artist, stated once more for machines — same facts as the page,
          nothing invented */}
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
    </>
  );
}
