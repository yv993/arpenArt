import type { MetadataRoute } from "next";
import { categories } from "@/lib/content";

// Same guard as robots.ts: until a real https origin is configured, an empty
// sitemap beats one full of localhost URLs that a crawler could be handed.
const base = process.env.NEXT_PUBLIC_SITE_URL;

export default function sitemap(): MetadataRoute.Sitemap {
  if (!base || !base.startsWith("https://")) return [];
  const now = new Date();
  return [
    { url: base + "/", lastModified: now, priority: 1 },
    { url: base + "/shop", lastModified: now, priority: 0.9 },
    { url: base + "/find-in-store", lastModified: now, priority: 0.7 },
    { url: base + "/about", lastModified: now, priority: 0.6 },
    { url: base + "/contact", lastModified: now, priority: 0.6 },
    ...categories
      .filter((c) => c.status === "open")
      .map((c) => ({ url: base + "/shop/" + c.slug, lastModified: now, priority: 0.7 })),
    { url: base + "/privacy", lastModified: now, priority: 0.2 },
    { url: base + "/terms", lastModified: now, priority: 0.2 },
  ];
}