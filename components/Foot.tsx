import Link from "next/link";
import { brand, home } from "@/lib/content";
import FootReveal from "./FootReveal";

export default function Foot() {
  return (
    <footer className="ap-foot ap-dark">
      {/* the inner wrapper is what the motion reveal parallaxes — the footer
          itself stays fixed under the page while this rises into place */}
      <div className="ap-foot__in">
        {/* the closing line deciphers out of Armenian letters on every page */}
        <p className="ap-foot__big" data-tfx="decipher">
          {brand.tagline}
        </p>
        <p>
          <a href={`mailto:${brand.email}`}>{brand.email}</a>
        </p>
        <div className="ap-foot__row">
          <span>
            {brand.name} · {brand.artist} · {brand.place} · {brand.year}
          </span>
          <span className="ap-foot__links">
            {home.footer.legal.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
            <a href="#main">{home.footer.toTop} ↑</a>
          </span>
        </div>
      </div>
      <FootReveal />
    </footer>
  );
}
