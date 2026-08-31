import type { Metadata } from "next";
import Link from "next/link";
import Chrome from "@/components/Chrome";
import CatFig from "@/components/CatFig";
import ShopStrip, { type StripCat } from "@/components/ShopStrip";
import { categories } from "@/lib/content";
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
    return {
      slug: c.slug,
      name: c.name,
      from: c.from,
      status: c.status,
      blurb: c.blurb,
      photo: first
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
          <h1 className="ap-h2" data-tfx="focus">
            EVERYTHING THE PICTURES LAND ON
          </h1>
          <p className="ap-lede">
            {/* the count comes from the catalogue itself — "Nine lines" sat
                here, hand-typed, while the grid below grew to eleven */}
            {["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen"][categories.length] ?? categories.length}{" "}
            lines, all carrying the same Armenia series. Choose the object, then choose the piece
            that goes on it.
          </p>
        </div>
        {/* the moved layer: hover one panel and it takes the room. The grid
            below is the same categories and stays the whole page on phones,
            under reduced motion and without JS. */}
        <ShopStrip cats={strip} />

        <ul className="ap-cats">
          {categories.map((c) => (
            <li className="ap-cat" key={c.slug} data-soon={c.status === "soon" || undefined}>
              <Link href={c.status === "open" ? `/shop/${c.slug}` : "/shop"} aria-label={c.name}>
                <CatFig cat={c} />
                <div className="ap-cat__row">
                  <h2>{c.name}</h2>
                  {c.status === "open" ? (
                    <span className="ap-cat__from">from {c.from.toLocaleString()} ֏</span>
                  ) : (
                    <span className="ap-cat__from is-soon">Soon</span>
                  )}
                </div>
                <p className="ap-cat__blurb">{c.blurb}</p>
              </Link>
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
