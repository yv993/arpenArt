import type { MetadataRoute } from "next";
import { brand } from "@/lib/content";

// Web app manifest. `display: "browser"` is deliberate — this is a shop, not
// an app, and pretending otherwise (standalone, no URL bar) would only make
// the checkout flow feel stranded. The manifest still earns its keep: a pinned
// shortcut gets the right name, the right icons and the paper colour instead
// of browser defaults.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.name,
    short_name: brand.name,
    description:
      "Original illustration by Arpine Baroyan, printed and painted onto postcards, scarves, hoodies, cups, plates, puzzles and stickers. Made in Yerevan.",
    start_url: "/",
    display: "browser",
    // both are --paper: the splash/tile should look like the page it opens
    background_color: "#fcf2e6",
    theme_color: "#fcf2e6",
    // app/icon.png and app/apple-icon.png are Next metadata file conventions,
    // served at exactly these paths — no copies in /public needed. Both carry
    // Arpine's moon-face mark (client files, 2026-08-11) on a paper ground —
    // the ink line would vanish on a dark tab strip without it.
    icons: [
      { src: "/icon.png", type: "image/png", sizes: "512x512" },
      { src: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
  };
}
