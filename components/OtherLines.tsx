import Link from "next/link";
import { categories, covers, hrefOf, soon } from "@/lib/content";
import { SoonLink } from "./Soon";
import products from "@/lib/products.json";

const P = products as Record<string, { thumb: string }[]>;

/** THE OTHER LINES, so a line's page does not end at a dead stop (Vardan's
 *  pick, 2026-11-18). Each tile is her own cover photograph, or the line's
 *  first photograph where it has no cover; no prices. A line not open yet
 *  opens the Available Soon window, as it does everywhere else. */
export default function OtherLines({ except }: { except: string }) {
  return (
    <section className="ap-more" aria-labelledby="ap-more-title">
      <h2 className="ap-more__title" id="ap-more-title">
        Other lines
      </h2>
      <ul className="ap-more__row">
        {categories
          .filter((c) => c.slug !== except)
          .map((c) => {
            const thumb = covers[c.slug]?.thumb ?? P[c.media]?.[0]?.thumb;
            const open = c.status === "open";
            const face = (
              <>
                {thumb && <img src={thumb} alt="" width={200} height={200} loading="lazy" decoding="async" />}
                <span className="ap-more__name">
                  <span>
                    {c.name}
                    {!open && <em>{soon.tile}</em>}
                  </span>
                  {open && <i aria-hidden="true">→</i>}
                </span>
              </>
            );
            return (
              <li key={c.slug}>
                {open ? (
                  <Link href={hrefOf(c)}>{face}</Link>
                ) : (
                  <SoonLink name={c.name}>{face}</SoonLink>
                )}
              </li>
            );
          })}
      </ul>
    </section>
  );
}
