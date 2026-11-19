import artworks from "./artworks.json";
import products from "./products.json";
import { scarfDesigns, stickerSheets, withheldArt } from "./content";

// ============================================================================
// HOW MANY PIECES A LINE HOLDS, in the words its /shop card prints beside the
// name (Vardan's pick, 2026-11-18). Every number is READ from the roll the
// line's own page renders, never typed, so a card cannot disagree with the
// page it opens. A line missing here (T-Shirts, not on sale) prints no count.
// ============================================================================

const P = products as Record<string, unknown[]>;
const len = (roll: string) => P[roll]?.length ?? 0;

const COUNTS: Record<string, () => [number, string]> = {
  // the postcards offer the series less the two she withdrew from this line
  postcards: () => [artworks.length - (withheldArt.postcards?.length ?? 0), "postcards"],
  scarves: () => [scarfDesigns.designs.length, "designs"],
  bookmarks: () => [len("bookmark"), "bookmarks"],
  "armenia-eternal": () => [len("eternal"), "pieces"],
  posters: () => [len("poster"), "posters"],
  // six sheets: the 18 files in the roll are three photographs of each
  stickers: () => [stickerSheets.sheets.length, "sheets"],
  "3d-stickers": () => [len("sticker3d"), "stickers"],
  keychains: () => [len("keychain"), "keychains"],
  magnets: () => [len("magnet"), "magnets"],
  totes: () => [len("toteBags"), "bags"],
};

/** «55 postcards», or null for a line with no count to state */
export function lineCount(slug: string): string | null {
  const read = COUNTS[slug];
  if (!read) return null;
  const [n, word] = read();
  return n > 0 ? `${n} ${word}` : null;
}
