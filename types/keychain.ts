// ============================================================================
// KEYCHAIN — the data one hanging keychain renders from.
//
// The brief that asked for this section named the fields as
// `{ id, title, price, imageSrc, hookColor }` and priced them $20–$25. Three
// of those five changed on contact with the real shop, and the reasons are
// worth keeping next to the type:
//
//   · PRICE IS NOT PER ITEM. Every keychain is 1,000 ֏ — her own figure, from
//     the text file that came with the photographs ("price 1000 amd"). One
//     number lives in `categories` in lib/content.ts, where /api/order can
//     re-price from it; a `price` on each object would be a second copy of a
//     fact, free to drift, and the server would ignore it anyway.
//
//   · TITLE IS A NUMBER, not a place. The brief's examples ("Khor Virap View
//     Keychain") came from a mock-up, and this shop does not name pictures it
//     cannot verify — her 57 artworks are "Illustration no. 02" for exactly
//     that reason. I tried to recover real names by matching each keychain
//     photograph against those artworks; only 2 of 24 matched confidently
//     enough to trust, so all 24 are numbered. Hand over a list of names and
//     `title` below becomes the place to put them.
//
//   · HOOKCOLOR IS NOT A COLOUR. The peg is drawn from the page's own tokens
//     so it stays right in both themes; what actually varies per keychain is
//     how far along the rail it hangs and how it settles, which is `lean`.
//
// `avg` is measured from the photograph itself (scripts wrote it into
// products.json) and tints the light this keychain throws on the wall, so the
// glow under each one belongs to that picture rather than to a global accent.
// ============================================================================

export type Keychain = {
  /** "01" … "24" — the id in products.json, and what the cart stores */
  id: string;
  /** what the buyer reads. Numbered until she supplies names. */
  title: string;
  /** the cut-out photograph: transparent PNG-alpha WebP, ring included */
  src: string;
  /** the same frame at half size, for the plain layer and the wall's thumbs */
  thumb: string;
  /** intrinsic size of `src`, so the browser reserves the space (no CLS) */
  w: number;
  h: number;
  /** average colour of the photograph — tints this keychain's pool of light */
  avg: string;
  /** the rest angle in degrees, so a rail of them does not hang like a ruler */
  lean: number;
};

/** What a keychain page/section needs beyond the items themselves. */
export type KeychainWall = {
  kicker: string;
  title: string;
  /** her paragraphs, verbatim */
  copy: string[];
  /** the hint under the rail — what the pointer can do here */
  cue: string;
  /** the pill that appears on the keychain you are holding */
  grab: string;
  add: string;
  added: string;
};
