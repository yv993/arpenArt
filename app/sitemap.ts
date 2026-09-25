import type { MetadataRoute } from "next";
import { categories } from "@/lib/content";
import { indexable, origin as base } from "@/lib/site";

// Same switch as robots.ts: until the owner opens indexing, an empty sitemap
// beats one that hands a crawler pages robots.txt tells it to skip.
export default function sitemap(): MetadataRoute.Sitemap {
  if (!indexable) return [];
  const now = new Date();
  return [
    { url: base + "/", lastModified: now, priority: 1 },
    { url: base + "/shop", lastModified: now, priority: 0.9 },
    { url: base + "/find-in-store", lastModified: now, priority: 0.7 },
    { url: base + "/stories", lastModified: now, priority: 0.6 },
    { url: base + "/about", lastModified: now, priority: 0.6 },
    { url: base + "/contact", lastModified: now, priority: 0.6 },
    ...categories
      .filter((c) => c.status === "open")
      .map((c) => ({ url: base + "/shop/" + c.slug, lastModified: now, priority: 0.7 })),
    { url: base + "/privacy", lastModified: now, priority: 0.2 },
    { url: base + "/terms", lastModified: now, priority: 0.2 },
  ];
}