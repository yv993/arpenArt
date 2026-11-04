// THE ARTWORKS' SMALL THUMBS (2026-10-31, readiness #18).
//
// Every artwork's -sm thumb (420px wide; 298–299 for nos. 23, 25 and 34) now
// has a 240px -xs sibling, written by imgss/readiness-2026-10-31/
// fix-performance/assets.cjs from the same masters (webp q80, the -sm
// policy). Two places draw these pictures far smaller than 420px and paid for
// it on a slow phone, where every one of them shares the pipe with the page's
// LCP picture: the postcards fan (64px cards) and the 57-tile illustration
// picker (52–60px tiles) — about 2 MB of -sm thumbs fetched for tiles that
// never need more than ~180 device pixels.
//
// Listed, not assumed: an artwork added later without running the script
// simply keeps its -sm alone (no srcset), never a 404.
const XS = new Set([
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15",
  "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30",
  "31", "32", "33", "34", "35", "36", "38", "39", "40", "41", "42", "43", "44", "45", "46",
  "47", "48", "49", "50", "51", "52", "53", "54", "55", "56", "57", "58",
]);
/** the -sm files that are not 420px wide, read off the files with sharp */
const SM_W: Record<string, number> = { "23": 299, "25": 299, "34": 298 };

/** `srcSet` offering the 240px -xs beside the -sm thumb, or undefined when
 *  this thumb has no -xs (the caller then keeps its plain `src`) */
export function artThumbSet(thumb: string): string | undefined {
  const m = /^\/art\/art-(\d+)-sm\.webp$/.exec(thumb);
  if (!m || !XS.has(m[1])) return undefined;
  return `/art/art-${m[1]}-xs.webp 240w, ${thumb} ${SM_W[m[1]] ?? 420}w`;
}
