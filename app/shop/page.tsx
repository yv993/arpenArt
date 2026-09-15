import type { Metadata } from "next";
import Link from "next/link";
import Chrome from "@/components/Chrome";
import CatFig from "@/components/CatFig";
import ShopStrip, { type StripCat } from "@/components/ShopStrip";
import { categories, covers, soon } from "@/lib/content";
import { SoonLink } from "@/components/Soon";
import products from "@/lib/products.json";
import artworks from "@/lib/artworks.json";
import TextFX from "@/components/TextFX";

type Shot = { id: string; src: string; thumb: string; w: number; h: number; alpha: boolean; avg: string };
type Art = { id: string; src: string; thumb: string; w: number; h: number; avg: string };
const P = products as Record<string, Shot[]>;
const ART = artworks as Art[];

// BUILT FROM THE CATALOGUE, not typed: a hand-written list here sat at eight
// lines while the grid below rendered eleven — every category added after it
// was silently missing from the shop's own search snippet.
export const metadata: Metadata = {
  title: "Shop",
  description:
    categories.map((c) => c.name.toLowerCase()).join(", ").replace(/, ([^,]+)$/, " and $1") +
    " carrying Arpine Baroyan's Armenia illustrations.",
};

export default function ShopPage() {
  // One panel per category. A line still waiting on its shoot has no
  // photograph, so it borrows the first artwork of its swatch — the same
  // substitution CatFig makes, so the two layers never disagree.
  const strip: StripCat[] = categories.map((c) => {
    const shots = P[c.media] ?? [];
    const swatch = c.swatch?.length ? ART.find((a) => a.id === c.swatch![0]) : undefined;
    const first = shots[0] ?? swatch;
    // the client's own tile cover first (content.ts `covers`, 2026-09-15),
    // then the line's first photograph, then the swatch
    const cover = covers[c.slug];
    return {
      slug: c.slug,
      name: c.name,
      from: c.from,
      status: c.status,
      blurb: c.blurb,
      photo: cover
        ? { src: cover.src, w: cover.w, h: cover.h, avg: cover.avg }
        : first
          ? { src: first.src, w: first.w, h: first.h, avg: first.avg }
          : { src: "/hero/hero.webp", w: 1427, h: 1102, avg: "#d8b06a" },
      shots: shots.map((s) => ({ src: s.src, w: s.w, h: s.h, avg: s.avg })),
    };
  });

  return (
    <>
      <Chrome />
      <div className="ap-sec ap-shop">
        <div className="ap-sec__head">
          <p className="ap-kicker">(Shop)</p>
          {/* HER WORDS (client, change.pdf p8, 2026-09-15) — verbatim */}
          <h1 className="ap-h2" data-tfx="focus">
            ONE ILLUSTRATION. MANY WAYS TO TAKE IT WITH YOU
          </h1>
          <p className="ap-lede">
            Your favorite Arpen Art illustrations appear across a growing collection of objects — made to
            wear, use, collect, gift and keep.
          </p>
        </div>
        {/* the moved layer: hover one panel and it takes the room. The grid
            below is the same categories and stays the whole page on phones,
            under reduced motion and without JS. */}
        <ShopStrip cats={strip} />

        <ul className="ap-cats">
          {categories.map((c) => (
            <li className="ap-cat" key={c.slug} data-soon={c.status === "soon" || undefined}>
              {/* no price under the name (change.pdf p8); a closed line opens
                  the Available Soon window, not a page */}
              {c.status === "open" ? (
                <Link href={`/shop/${c.slug}`} aria-label={c.name}>
                  <CatFig cat={c} />
                  <div className="ap-cat__row">
                    <h2>{c.name}</h2>
                  </div>
                  <p className="ap-cat__blurb">{c.blurb}</p>
                </Link>
              ) : (
                <SoonLink name={c.name} aria-label={`${c.name} — ${soon.tile}`}>
                  <CatFig cat={c} />
                  <div className="ap-cat__row">
                    <h2>{c.name}</h2>
                    <span className="ap-cat__from is-soon">{soon.tile}</span>
                  </div>
                  <p className="ap-cat__blurb">{c.blurb}</p>
                </SoonLink>
              )}
            </li>
          ))}
        </ul>
      </div>
      {/* splits and reveals the [data-tfx] headings — page-mounted so it
          cannot run before this page hydrates */}
      <TextFX />
    </>
  );
}
