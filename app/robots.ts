import type { MetadataRoute } from "next";

// Indexing stays OFF until a real https origin is configured — otherwise the
// placeholder prices and contact details could be indexed as if they were real.
const site = process.env.NEXT_PUBLIC_SITE_URL;

export default function robots(): MetadataRoute.Robots {
  if (!site || !site.startsWith("https://")) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/cart"] }],
    sitemap: site + "/sitemap.xml",
  };
}