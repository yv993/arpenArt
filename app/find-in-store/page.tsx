import type { Metadata } from "next";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import Chrome from "@/components/Chrome";
import FindInStore from "@/components/FindInStore";
import { brand, stockistPage, stockists, towns } from "@/lib/content";
import TextFX from "@/components/TextFX";

export const metadata: Metadata = {
  title: "Find in store",
  description: stockistPage.copy,
};

/** WHICH LOGOS ACTUALLY EXIST, read at build time.
 *
 *  The shops' marks arrive one at a time, and a `logo` field that names a file
 *  nobody has sent yet is a broken image on a page about being able to find
 *  things. So the file system is the source of truth: drop `nrani.webp` into
 *  public/stockists/, rebuild, and that card stops being a monogram. No code
 *  edit, and no card can ever point at a picture that is not there.
 *
 *  Safe in a server component — this page is static, so it runs once at build. */
function availableLogos(): string[] {
  try {
    return readdirSync(join(process.cwd(), "public", "stockists"))
      .filter((f) => f.endsWith(".webp"))
      .map((f) => f.replace(/\.webp$/, ""));
  } catch {
    return [];
  }
}

export default function Page() {
  const logos = availableLogos();
  // Structured data is a claim a search engine will repeat, so it carries the
  // SHOP's own address and its door coordinates — the two things Arpine
  // actually confirmed. Nothing here is derived from a guess.
  const byId = new Map(towns.map((t) => [t.id, t]));

  return (
    <>
      <Chrome />
      <div className="ap-sec">
        <div className="ap-sec__head">
          <p className="ap-kicker">{stockistPage.kicker}</p>
          <h1 className="ap-h2" data-tfx="rise">
            {stockistPage.title}
          </h1>
          <p className="ap-lede">{stockistPage.copy}</p>
        </div>

        <FindInStore list={towns} logos={logos} />
      </div>

      {stockists.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              stockists.map((s) => {
                const t = byId.get(s.townId);
                return {
                  "@context": "https://schema.org",
                  "@type": "Store",
                  name: s.shop,
                  address: {
                    "@type": "PostalAddress",
                    streetAddress: s.address,
                    addressLocality: t?.town,
                    addressRegion: t?.region,
                    addressCountry: "AM",
                  },
                  // the DOOR, which is what a "Store" means — not the town
                  // centre the country map pins
                  geo: {
                    "@type": "GeoCoordinates",
                    latitude: s.addressLat,
                    longitude: s.addressLng,
                  },
                  brand: brand.name,
                };
              }),
            ),
          }}
        />
      )}
      {/* splits and reveals the [data-tfx] headings — page-mounted so it
          cannot run before this page hydrates */}
      <TextFX />
    </>
  );
}
