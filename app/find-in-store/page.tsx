import type { Metadata } from "next";
import Chrome from "@/components/Chrome";
import FindInStore from "@/components/FindInStore";
import { brand, stockistPage, stockists } from "@/lib/content";

export const metadata: Metadata = {
  title: "Find in store",
  description: stockistPage.copy,
};

export default function Page() {
  // Structured data is emitted ONLY for shops she has confirmed. A stockist
  // in schema.org is a claim a search engine will repeat, and an unconfirmed
  // one would send somebody to a door that is not there.
  const confirmed = stockists.filter((s) => s.shop.trim().length > 0);

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

        <FindInStore list={stockists} />
      </div>

      {confirmed.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              confirmed.map((s) => ({
                "@context": "https://schema.org",
                "@type": "Store",
                name: s.shop,
                address: { "@type": "PostalAddress", streetAddress: s.address, addressLocality: s.town, addressCountry: "AM" },
                geo: { "@type": "GeoCoordinates", latitude: s.lat, longitude: s.lng },
                brand: brand.name,
              })),
            ),
          }}
        />
      )}
    </>
  );
}
