import type { Metadata } from "next";
import Chrome from "@/components/Chrome";
import StoriesView from "@/components/StoriesView";
import TextFX from "@/components/TextFX";
import { brand, stories } from "@/lib/content";

// STUDIO STORIES (client, change.pdf p12, 2026-09-21) — the page the new
// nav word opens. Her heading, her subtitle, her texts: six then, eleven
// since change 3.pdf p11 (2026-10-01), newest first.
export const metadata: Metadata = {
  title: "Studio stories",
  description: stories.copy,
  alternates: { canonical: "/stories" },
};

export default function Page() {
  return (
    <>
      <Chrome />
      <StoriesView />
      {/* the stories, stated once more for machines — her titles, her
          second lines and her first paragraphs, nothing added. A story's
          outbound link is a `citation`, not its `url`: the Akn page and the
          YouTube playlist are what a story points AT, and since 2026-10-01
          one of them is a playlist, which no reading makes "the article's
          address". The five new stories carry no date property — the dates
          she gave are when things happened, not when a text was published. */}
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
              ...(s.sub ? { alternativeHeadline: s.sub[0] } : {}),
              description: s.body[0],
              ...(s.link ? { citation: s.link.href } : {}),
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
