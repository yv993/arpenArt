import type { Metadata } from "next";
import Chrome from "@/components/Chrome";
import StoriesView from "@/components/StoriesView";
import TextFX from "@/components/TextFX";
import { brand, stories } from "@/lib/content";

// STUDIO STORIES (client, change.pdf p12, 2026-09-21) — the page the new
// nav word opens. Her heading, her subtitle, her six texts.
export const metadata: Metadata = {
  title: "Studio stories",
  description: stories.copy,
};

export default function Page() {
  return (
    <>
      <Chrome />
      <StoriesView />
      {/* the exhibitions, stated once more for machines — the same dates
          and places as the page, nothing added */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Studio stories",
            description: stories.copy,
            about: { "@type": "Person", name: brand.artist },
            hasPart: stories.entries.map((s) => ({
              "@type": "Article",
              headline: s.title,
              description: s.body[0],
              ...(s.link ? { url: s.link.href } : {}),
            })),
          }),
        }}
      />
      {/* splits and reveals the [data-tfx] headings — page-mounted so it
          cannot run before this page hydrates */}
      <TextFX />
    </>
  );
}
