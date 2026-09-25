import type { MetadataRoute } from "next";
import { indexable, origin } from "@/lib/site";

// Indexing stays OFF until the owner configures a real https origin
// (lib/site.ts `indexable`) — otherwise unconfirmed prices and contact
// details could be indexed as if they were final.
export default function robots(): MetadataRoute.Robots {
  if (!indexable) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/cart", "/account"] }],
    sitemap: origin + "/sitemap.xml",
  };
}