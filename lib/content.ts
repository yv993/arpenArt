// ArpenArt — the shop and studio of Arpine Baroyan, illustrator, Armenia.
//
// Biography below is HERS, taken from her artist page; nothing in it is invented.
// Everything marked PLACEHOLDER is a commercial fact only she can supply —
// prices, shipping, contact — and is written so one edit here fixes the whole
// site. No placeholder is ever presented to a visitor as if it were confirmed.

export const brand = {
  name: "ArpenArt",
  artist: "Arpine Baroyan",
  role: "Illustrator & graphic designer",
  place: "Yerevan, Armenia",
  tagline: "Armenia, drawn by hand",
  /** THE FOOTER'S TWO LINES (client, change.pdf p6, 2026-09-15) — verbatim.
   *  `tagline` stays for the metadata; the footer no longer prints it. */
  footer: {
    line: "Drawn in Armenia. Made to be remembered.",
    sub: "Original illustrations inspired by the places, people and stories of Armenia.",
  },
  // HER REAL ADDRESS (change.pdf p6 + p9, 2026-09-15). The placeholder
  // hello@arpenart.am is gone from every page that printed it.
  email: "arpenbaroyan@gmail.com",
  phone: "+374 00 00 00 00",
  // EMPTY UNTIL REAL — every consumer renders these conditionally
  social: [] as Array<{ label: string; href: string }>,
  year: "2026",
};

// ---------------------------------------------------------------------------
// ABOUT — her own words, from the biography she supplied
// ---------------------------------------------------------------------------
export const about = {
  kicker: "(About)",
  title: ["ARPINE", "BAROYAN"],
  lead:
    "Arpine is an artist and illustrator based in Armenia, whose creative journey began with a strong foundation in graphic design. Over the years, her artistic focus has evolved, embracing the world of illustration with a deep connection to both the natural world and the fantastical realms of her imagination.",
  body: [
    "Her journey into the visual arts started during her university years at the Armenian University of Architecture and Construction and TUMO, where she honed her skills in design techniques and developed a unique visual language. Arpine has had two solo exhibitions and is also a member of the Artists' Union in Armenia.",
    "Her diverse skill set includes not only illustration and character design but also graphic design and branding, allowing her to bring a unique perspective to every project she undertakes.",
    "Arpine is also the creative force behind her own growing brand, ArpenArt, where her vision continues to evolve, and her artistic voice resonates across various mediums.",
  ],
  facts: [
    { k: "Based in", v: "Yerevan, Armenia" },
    { k: "Studied at", v: "Armenian University of Architecture & Construction · TUMO" },
    { k: "Solo exhibitions", v: "Two" },
    { k: "Member of", v: "Artists' Union of Armenia" },
  ],
  // her artist page — a real, verifiable link
  link: { label: "Artist page", href: "https://www.akneye.com/artists/arpine-baroyan" },
};

// ---------------------------------------------------------------------------
// SHOP — categories map onto the mockup folders processed into /public/products
// ---------------------------------------------------------------------------
export type Category = {
  slug: string;
  name: string;
  blurb: string;
  /** key in lib/products.json */
  media: string;
  /** Price in Armenian dram.
   *
   *  REAL, confirmed by Arpine: postcards 1,000 (2026-08-12, re-confirmed
   *  2026-08-24 and again on her 2026-09-21 price list), 3D stickers 500
   *  (2026-08-22, re-confirmed 2026-09-21), scarves 8,000 and totes 8,000
   *  (2026-08-24). HER 2026-09-21 PRICE LIST (change.pdf p9, «these are the
   *  correct prices — wherever a section shows one, let it be right») MOVED
   *  three lines: sticker sheets 1,600 → 1,800, keychains 1,000 → 1,500,
   *  magnets 1,600 → 1,500. The same list names five lines the shop does
   *  not carry yet — see `priceList` below.
   *
   *  STILL PLACEHOLDERS, waiting on her figures: hoodies, cups, plates,
   *  puzzles. Every one she has corrected so far moved by a lot and in both
   *  directions — scarves down from 14,000, sticker sheets up from 600 — which
   *  is the standing argument for never inventing one that merely looks right.
   *
   *  The cart and the order endpoint both read this field, and the endpoint
   *  re-prices from it so the browser can never name a price of its own. */
  from: number;
  status: "open" | "soon";
  /** Artwork ids to tile on the card while the line is unphotographed. The
   *  designs are finished even when the garment shoot is not, so this shows
   *  real work instead of an empty box. Delete once photographs land. */
  swatch?: string[];
  /** The one buyer choice besides the illustration — a garment size, a card
   *  format. Only present where the existing copy already supports the split;
   *  a category without one simply renders no picker. */
  variants?: { label: string; options: string[] };
  /** Facts for the trust block under the buy button. Every line here is
   *  either already stated elsewhere on the site or describes the real
   *  process — nothing is a claim only Arpine could verify. Unknown
   *  dimensions and materials are OMITTED, never guessed. */
  spec?: { k: string; v: string }[];
};

/** CATEGORIES WHOSE CART `art` ID NAMES THE CATEGORY'S OWN ITEM, not one of
 *  the 57 illustrations. `art` began life as "which illustration goes on the
 *  postcard/cup/tote", always an artworks.json id — then the 3D stickers, the
 *  keychains and the magnets arrived as FIXED items with their own numbering,
 *  and stored their own ids in the same field. The ids collide: magnet "05"
 *  and illustration "05" are different pictures. Anywhere that renders a cart
 *  line must check here first (found 2026-08-31, when the cart showed a buyer
 *  illustration no. 05 for magnet no. 05 and the order email asked Arpine for
 *  "(illustration 5)" — the wrong product to make). Value = the word that
 *  labels one item of the line. */
export const ownItemWord: Record<string, string> = {
  "3d-stickers": "3D sticker",
  keychains: "Keychain",
  magnets: "Magnet",
  // three fixed designs since 2026-09-15 (scarfDesigns below) — the cart's
  // `art` is the design number, not one of the 57 illustrations
  scarves: "Scarf",
};

// The process rows every open category shares, stated once so the story can
// never drift between pages. These describe the REAL flow only: an order here
// is a request, nothing is charged on the site, and Arpine confirms price and
// postage herself before anything is made or sent (see /terms).
const processSpec: { k: string; v: string }[] = [
  { k: "Production", v: "Made to order — Arpine confirms timing when she confirms your order." },
  { k: "Shipping", v: "Ships from Yerevan, Armenia — postage is confirmed before you pay anything." },
  { k: "Returns", v: "An order here is a request, not a purchase — nothing is made, charged or sent until Arpine confirms it with you." },
];

export const categories: Category[] = [
  {
    slug: "postcards",
    name: "Postcards",
    // EVERY BLURB BELOW IS HERS, verbatim (client, change.pdf p5, 2026-09-21:
    // «let's change these texts underneath») — the line after the dash in
    // "Postcards — A little piece of Armenia to send."
    blurb: "A little piece of Armenia to send.",
    media: "postcards",
    // Arpine's real price, 2026-08-12, RE-CONFIRMED 2026-08-24: every card
    // is 1,000 dram. Unchanged — it was right the first time.
    from: 1000,
    status: "open",
    // "Sold singly or as a set" is already the blurb's promise — the picker
    // only lets the buyer say which of the two they meant.
    variants: { label: "Format", options: ["Single card", "Full series set"] },
    spec: [
      { k: "Paper", v: "Heavy uncoated card" },
      { k: "Size", v: "A5" },
      ...processSpec,
    ],
  },
  {
    slug: "scarves",
    name: "Scarves",
    blurb: "Stories of Armenia, woven in color.",
    media: "scarves",
    // ARPINE'S REAL PRICE, 2026-08-24 — it replaces a 14,000 placeholder,
    // which was nearly twice what she actually charges.
    from: 8000,
    status: "open",
    // the blurb already names the two cuts; the picker repeats them, no more
    variants: { label: "Style", options: ["Silk square", "Bandana"] },
    spec: [{ k: "Material", v: "Silk" }, ...processSpec],
    // PLACEHOLDER-shaped gap: the square's dimensions are Arpine's to supply —
    // the spec stays silent rather than guessing a number.
  },
  {
    slug: "hoodies",
    // RENAMED (client, change.pdf p8, 2026-09-15): the tile reads "T-Shirts".
    // The slug stays — it is a URL and a cart key, and the page is behind
    // "Available soon" for now anyway.
    name: "T-Shirts",
    blurb: "Wear your favorite Armenian story.",
    media: "apparel",
    from: 18000,
    // AVAILABLE SOON (change.pdf p8): no page yet — a tap opens the small
    // "Available Soon" window instead (components/Soon.tsx). `soon` already
    // 404s the route and keeps it out of the static build.
    status: "soon",
    // garment sizes, not product claims — the one choice a hoodie order
    // cannot be placed without
    variants: { label: "Size", options: ["S", "M", "L", "XL"] },
    spec: [
      { k: "Finish", v: "Painted by hand in Yerevan — no two are identical" },
      ...processSpec,
    ],
    // PLACEHOLDER-shaped gap: fabric composition and a size chart are
    // Arpine's to supply; until then the spec carries no fabric row.
  },
  {
    slug: "cups",
    name: "Cups",
    blurb: "Start your day with a little Armenia.",
    media: "mugs",
    from: 5500,
    status: "soon", // change.pdf p8 — Available Soon window, no page yet
    spec: [{ k: "Care", v: "Glazed and dishwasher-safe" }, ...processSpec],
  },
  {
    slug: "plates",
    name: "Plates",
    blurb: "Armenian stories for your table.",
    media: "plates",
    from: 7500,
    status: "soon", // change.pdf p8 — Available Soon window, no page yet
    // "decorative" is the blurb's own word — no food-safety claim is made
    spec: [{ k: "Use", v: "Decorative" }, ...processSpec],
  },
  {
    slug: "puzzles",
    name: "Puzzles",
    blurb: "Piece together a little Armenia.",
    media: "puzzles",
    from: 8500,
    status: "soon", // change.pdf p8 — Available Soon window, no page yet
    // PLACEHOLDER-shaped gap: piece count and finished size are Arpine's to
    // supply — the spec carries only the process rows rather than a guess.
    spec: [...processSpec],
  },
  {
    slug: "stickers",
    name: "Stickers",
    // SHEETS ONLY (2026-08-19). The line used to also offer a single die-cut
    // of any one of the 57 illustrations, chosen from the picker — that path
    // is gone, so the blurb cannot keep promising it. What she actually
    // delivered is six fixed sheets; the page sells those.
    blurb: "Little illustrations, ready to travel.",
    media: "stickers",
    // ARPINE'S REAL PRICE: 1,600 dram a sheet on 2026-08-24, 1,800 on her
    // 2026-09-21 list («ստիկեր 1800»). Every sheet is the same size and
    // count, so one number covers all six, which is also what keeps
    // /api/order able to re-price a sheet from its own copy of this table.
    from: 1800,
    status: "open",
    spec: [
      { k: "Sheet", v: "158 × 200 mm · 20 stickers" },
      { k: "Finish", v: "Matte and weatherproof" },
      ...processSpec,
    ],
  },
  {
    slug: "3d-stickers",
    name: "3D stickers",
    blurb: "Bring Armenian stories to life.",
    media: "sticker3d",
    // ARPINE'S REAL PRICE, 2026-08-22, re-confirmed 2026-09-21: 500 dram
    // each. It is LOWER than the guess it replaced (900), which is the whole
    // argument for never inventing one: a plausible number would have
    // overcharged for a week.
    from: 500,
    status: "open",
    spec: [
      { k: "Finish", v: "Domed resin over print, on a carded backing" },
      ...processSpec,
    ],
  },
  {
    slug: "keychains",
    name: "Keychains",
    blurb: "Carry a little Armenia with you.",
    media: "keychain",
    // ARPINE'S REAL PRICE: 1,000 dram on 2026-08-31 (the text file with the
    // twenty-four photographs), 1,500 on her 2026-09-21 list («կախազարդ
    // 1500»). The keychain section reads THIS number — nothing there is
    // typed by hand any more.
    from: 1500,
    status: "open",
    spec: [
      { k: "Finish", v: "Clear acrylic case on a split ring" },
      ...processSpec,
    ],
  },
  {
    slug: "magnets",
    name: "Magnets",
    blurb: "Keep a little Armenia close.",
    media: "magnet",
    // ARPINE'S REAL PRICE: 1,600 dram on 2026-08-31 ("price 1600"), 1,500 on
    // her 2026-09-21 list («մագնիս 1500»).
    from: 1500,
    status: "open",
    spec: [
      { k: "Finish", v: "Print in a clear acrylic frame magnet" },
      ...processSpec,
    ],
  },
  {
    slug: "totes",
    name: "Tote bags",
    blurb: "Carry your favorite Armenian stories.",
    media: "totes",
    // ARPINE'S REAL PRICE, 2026-08-24 (it replaces a 6,500 placeholder).
    from: 8000,
    // OPEN AGAIN (client, change.pdf p7, 2026-09-21: «you had the tote bag
    // made, for the 4 designs, with their pictures — bring that back»). It
    // was hidden for six days on her 2026-09-15 note; the four-design gallery
    // and the choose-your-illustration page were never deleted, only gated
    // by this flag, so the page is exactly the one she remembers.
    status: "open",
    // both rows repeat the tote lookbook's caption, word for word
    spec: [
      { k: "Material", v: "Natural cotton" },
      { k: "Printing", v: "Printed in Yerevan" },
      ...processSpec,
    ],
  },
  // SKIRTS REMOVED 2026-08-24 (client: "remove skirts section in shop"). It was
  // the only `status: "soon"` line — a card promising a garment that has never
  // been photographed, standing in with a swatch of the artworks. Its whole
  // apparatus goes with it: it was also the only user of `Category.swatch` and
  // of CatFig's substitution branch, both of which stay in the code because
  // they are the honest answer to "a line whose designs are done and whose
  // photographs are not", and the next line to arrive will need them again.
  // To bring it back: restore this entry. Nothing else was skirts-specific.
];

// Every entry here is a PAGE. "Gallery" was removed (client 2026-08-06): it
// was the one anchor among them, `/#gallery`, pointing part-way down the home
// page's scroll story — so it behaved unlike its neighbours and, pressed from
// another route, dropped you mid-story with the sections above it unread. The
// gallery section itself is untouched; it is still on the home page, still
// named by the section rail, and now reached the way the rest of that page is,
// by scrolling.
export const nav = [
  { label: "Shop", href: "/shop" },
  { label: "Find in store", href: "/find-in-store" },
  // NEW (client, change.pdf p12, 2026-09-21: «we are adding a new section
  // … a place in this row», circling the bar)
  { label: "Stories", href: "/stories" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

/** HER PRICE LIST, 2026-09-21 (change.pdf p9), for the lines the shop does
 *  not carry yet — the ones she underlined in red with «I will send the
 *  materials soon». Bookmarks were on the list without an underline and
 *  without a product anywhere, so they wait here too. The globe already
 *  shows three of these (her Drive set includes the bracelets, the brooches
 *  and the beaded pendant), and reads their prices from here; when a line
 *  arrives it becomes a `categories` entry and leaves this table. */
export const priceList: Record<string, { name: string; hy: string; from: number }> = {
  brooches: { name: "Stone brooches", hy: "Քարե բրոշ", from: 2500 },
  bracelets: { name: "Wooden bracelets", hy: "Թևնոց", from: 2000 },
  notebooks: { name: "Notebooks", hy: "Նոթատետր", from: 2500 },
  bookmarks: { name: "Bookmarks", hy: "Էջանշան", from: 500 },
  pendants: { name: "Beaded pendants", hy: "Հուլունքով կախազարդ", from: 4000 },
};

/** THE GLOBE'S SEVENTEEN (client, change.pdf p3, 2026-09-21: «the pictures
 *  are far too many — put ONLY the pictures of this folder, remove the
 *  rest»). One card per file in her Drive folder, in her order; the files
 *  are in lib/globe.json (sizes and colours read off them, never typed).
 *  A card names the line it shows: a `slug` for a line the shop carries
 *  (open or Available Soon), or a `list` key for one that exists only on
 *  her price list so far. */
export const globe: { id: string; slug?: string; list?: keyof typeof priceList }[] = [
  { id: "01", slug: "magnets" },
  { id: "02", slug: "magnets" },
  { id: "03", slug: "keychains" },
  { id: "04", slug: "scarves" },
  { id: "05", slug: "cups" },
  { id: "06", slug: "keychains" },
  { id: "07", list: "bracelets" },
  { id: "08", list: "brooches" },
  { id: "09", slug: "hoodies" },
  { id: "10", list: "pendants" },
  { id: "11", slug: "postcards" },
  { id: "12", slug: "hoodies" },
  { id: "13", slug: "stickers" },
  { id: "14", slug: "stickers" },
  { id: "15", slug: "puzzles" },
  { id: "16", slug: "keychains" },
  // THREE magnets, not one: 01 Tsitsernakaberd, 02 the café by the Opera,
  // 17 Republic Square. A whole-image comparison called 17 a duplicate of
  // 01 (the shared white card dominates the pixels); the magnets themselves
  // — the centre 30% — differ by 28–33/255. Compare the product, not the card.
  { id: "17", slug: "magnets" },
];

/** THE RIBBON'S WORDS (client, change.pdf p2, 2026-09-15) — verbatim, her
 *  middle dots drawn by the ribbon's own ::after. It used to recite the
 *  tagline, the count of illustrations and the open lines. */
export const ribbon = ["WEAR IT", "STICK IT", "COLLECT IT", "GIFT IT", "CARRY ARMENIA WITH YOU"];

/** The small window a not-yet-open line opens INSTEAD of a page (client,
 *  change.pdf p8: «let a small window open on top and say Available Soon»).
 *  A notice, not a product claim. */
export const soon = {
  tile: "Available soon",
  title: "Available Soon",
  copy: "This line is being prepared and will open here soon.",
  close: "Close",
};

/** THE TILE COVERS (client drop, 2026-09-15 — change.pdf p8: «change the main
 *  pictures here»). Nine of the eleven lines came with one; stickers and 3D
 *  stickers keep their first photograph. Sizes and averages were read off the
 *  files by scratchpad/redesign-assets.cjs, never typed. */
export const covers: Record<string, { src: string; thumb: string; w: number; h: number; avg: string }> = {
  hoodies: { src: "/products/tile-hoodies.webp", thumb: "/products/tile-hoodies-sm.webp", w: 1400, h: 933, avg: "#5f5e65" },
  scarves: { src: "/products/tile-scarves.webp", thumb: "/products/tile-scarves-sm.webp", w: 1400, h: 1400, avg: "#8a867e" },
  postcards: { src: "/products/tile-postcards.webp", thumb: "/products/tile-postcards-sm.webp", w: 977, h: 1400, avg: "#a38d7b" },
  totes: { src: "/products/tile-totes.webp", thumb: "/products/tile-totes-sm.webp", w: 1089, h: 1400, avg: "#636247" },
  plates: { src: "/products/tile-plates.webp", thumb: "/products/tile-plates-sm.webp", w: 1254, h: 1254, avg: "#b4a193" },
  cups: { src: "/products/tile-cups.webp", thumb: "/products/tile-cups-sm.webp", w: 1223, h: 1286, avg: "#a38f7f" },
  keychains: { src: "/products/tile-keychains.webp", thumb: "/products/tile-keychains-sm.webp", w: 1145, h: 1374, avg: "#b29d8e" },
  magnets: { src: "/products/tile-magnets.webp", thumb: "/products/tile-magnets-sm.webp", w: 933, h: 1400, avg: "#bbb4ae" },
  puzzles: { src: "/products/tile-puzzles.webp", thumb: "/products/tile-puzzles-sm.webp", w: 1400, h: 933, avg: "#ac989d" },
};

/** THE RING'S FIVE (change.pdf p5: «replace the t-shirt, the scarf, the
 *  postcard, the bag, the plate — the rest stay»). Four of her mockups are
 *  delivered as PNG cut-outs with their OWN alpha, and that alpha is used
 *  as-is: the first pass ran a near-white flood fill over them too, which
 *  ate every white region touching the transparent ground — the white
 *  postcard inside the envelope went, leaving its QR code and stamps
 *  floating (Vardan 2026-09-15: «change first envelope, it must be the
 *  second image»). The plate is the one opaque file; it is keyed as a disc. */
export const ring: Record<string, { tex: string; w: number; h: number }> = {
  hoodies: { tex: "/products/ring-tshirt.webp", w: 645, h: 700 },
  scarves: { tex: "/products/ring-scarf.webp", w: 700, h: 539 },
  postcards: { tex: "/products/ring-postcard.webp", w: 700, h: 602 },
  totes: { tex: "/products/ring-tote.webp", w: 419, h: 700 },
  // the plate is keyed as a DISC (centre + radius from its own silhouette),
  // not by near-white flood fill — that ate the white rim and left a crescent
  // (Vardan 2026-09-15, «must be the image I provided»)
  plates: { tex: "/products/ring-plate.webp", w: 700, h: 700 },
};

// ---------------------------------------------------------------------------
// HOW ORDERING WORKS — shown on every category page and again above the order
// form. One copy of the truth: this is the REAL flow and nothing else. The
// site takes requests, not payments, and Arpine confirms the total herself.
// ---------------------------------------------------------------------------
export const ordering = {
  title: "How ordering works",
  steps: [
    { k: "Choose", v: "Pick what you like and send the order request — nothing is charged on this site." },
    { k: "Confirm", v: "Arpine replies herself with the final total, postage to your address included." },
    { k: "Pay", v: "You pay only after her confirmation — then the order is made and posted from Yerevan." },
  ],
};

// ---------------------------------------------------------------------------
// DELIVERY — the two ways an order can reach a buyer. Both are things Arpine
// can genuinely do from Yerevan; no courier partner or delivery window is
// promised here, because none is agreed yet. She confirms postage per order.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// SOCIALS — the card on /contact.
//
// Every tile is a working link. `pending: true` means the href still points at
// the PLATFORM rather than at Arpine's own profile — the card says so plainly
// underneath, so nobody is told these are her accounts before they are.
//
// TO FINISH (one edit per line, nothing else to change): replace `href` with
// her profile URL and delete the `pending` flag. When no line is pending the
// note under the card disappears by itself. Confirm the platforms too — the
// three below are the ones the card was handed with, and Discord is unusual
// for an art shop; if she uses Facebook or Telegram instead, add the icon in
// components/Socials.tsx and change `icon` here.
// ---------------------------------------------------------------------------
// THE THREE ARE HERS NOW (client, change.pdf p9, 2026-09-15): «I have no page
// other than Instagram — keep Instagram and add Telegram and mail instead of
// the other two». Instagram is the handle printed on her own postcard
// mockup's stamp (@arpen_art); mail is the address she gave. Telegram is the
// one still PENDING — no handle arrived — so it keeps the platform href and
// the note under the card stays until it does.
export const socials: Array<{
  label: string;
  href: string;
  icon: "instagram" | "telegram" | "mail";
  pending?: boolean;
}> = [
  { label: "Instagram", href: "https://www.instagram.com/arpen_art/", icon: "instagram" },
  { label: "Telegram", href: "https://t.me/", icon: "telegram", pending: true },
  { label: "Email", href: `mailto:${brand.email}`, icon: "mail" },
];

export const delivery = {
  label: "How should it reach you?",
  /** shown under the choices — the one promise the site can keep */
  note: "Delivery is added to the total above. Arpine confirms availability and the final figure by reply; nothing is charged on this page.",
  // -------------------------------------------------------------------------
  // PLACEHOLDER RATES — every `price` below is a stand-in, exactly like the
  // product prices. Arpine must confirm them with whoever she posts through
  // before launch, and may rename a service to the carrier she actually uses
  // (the labels are deliberately generic so the site never claims a courier
  // relationship she has not agreed). `eta` is her own estimate, not a promise
  // by a carrier — the copy says so.
  //
  // The server re-prices delivery from THIS table on every order (see
  // app/api/order/route.ts); the browser never gets to name a price.
  // -------------------------------------------------------------------------
  options: [
    {
      id: "pickup",
      label: "Collect in Yerevan",
      eta: "Arrange a time when she confirms",
      price: 0,
      address: false,
    },
    {
      id: "yerevan",
      label: "Courier in Yerevan",
      eta: "1–2 days",
      price: 1500,
      address: true,
    },
    {
      id: "armenia",
      label: "Post within Armenia",
      eta: "2–5 days",
      price: 2500,
      address: true,
    },
    {
      id: "world",
      label: "International post",
      eta: "10–20 days, customs not included",
      price: 9000,
      address: true,
    },
  ],
};

export type DeliveryOption = (typeof delivery.options)[number];

// ---------------------------------------------------------------------------
// STOCKISTS — where the work can be found in person.
//
// THESE ARE REAL AND CONFIRMED. Arpine sent this list on 2026-08-18: seven
// shops in three towns, with the addresses as she writes them, in Armenian.
// The long stand-in period is over — the `placeholder` machinery that used to
// warn people off travelling is gone with it, because there is nothing left to
// warn about.
//
// ONE THING IS STILL NOT HERS, and it is flagged rather than hidden: the
// COORDINATES. She gave addresses, not pins. Every lat/lng below was geocoded
// afterwards against OpenStreetMap (Nominatim + Overpass, cross-checked
// against the shops' own listings), and `approx: true` marks a pin the survey
// could not put on the doorway. The address is always the thing to trust;
// where a pin is approximate the card says so, beside the map, rather than
// quietly drawing a false precision.
//
// THREE ARE FLAGGED, and each for its own reason — worth keeping, because the
// obvious "fix" for each is to ask her rather than to search harder:
//   note-mote-northern-6  6/2 is the registered address of the Tashir Street
//                         underground gallery, which runs ~400 m under
//                         Northern Avenue with seven entrances. The shop is
//                         inside it; neither Note Mote nor Tashir is mapped.
//                         ±40 m. ASK WHICH ENTRANCE.
//   nrani                 the building tagged 7/8 is mapped as a different
//                         business, but it is 14 m from the Mimino statue,
//                         which is exactly where Nrani is described as being.
//                         Same commercial cluster, ±30 m.
//   crafts-of-armenia     Marzpetuni 10 is a multi-unit tourist compound and
//                         two mapped features 49 m apart both claim the
//                         number. This is the northern one (the Noyan Aygi
//                         courtyard). NEEDS HER CONFIRMATION.
// The other four are exact building matches and are not flagged.
//
// SHAPE: this list is SHOPS, not towns. It used to be one row per town, which
// stopped being true the moment Yerevan came back with three. Towns are
// derived from it below (`towns`), so adding a shop to a town that already
// exists needs nothing but a new entry here.
//
// TO FINISH: `lines` (which pieces each shop actually carries), phone and
// opening hours — none of which she has sent, so none of which are invented.
// Each renders only when filled.
// ---------------------------------------------------------------------------
export type Stockist = {
  /** unique per SHOP — two Note Motes share a name and a logo, not an id */
  id: string;
  shop: string;
  /** which town group this sits under; matches a `Town.id` */
  townId: string;
  /** the address AS SHE SENT IT. This is the authoritative one: it is what a
   *  taxi driver in Yerevan reads. */
  addressAm: string;
  /** transliteration, for everyone who cannot read the line above */
  address: string;
  /** where the DOOR is. Separate from the town centre on purpose: the country
   *  map marks the town, this marks the shop. */
  addressLat: number;
  addressLng: number;
  /** TRUE when the geocoder could only reach the STREET, not the building.
   *  The address is still exact — this is about the pin, and it is printed
   *  beside the map rather than left for someone to discover on the pavement. */
  approx?: boolean;
  /** file in public/stockists/ (see the README there). Absent → the card sets
   *  the shop's initials as a monogram, which is a designed state and not a
   *  missing image. */
  logo?: string;
  /** the mark is drawn for a DARK ground, so the chip goes dark rather than
   *  the mark being recoloured — that would be editing someone else's brand */
  logoDark?: boolean;
  phone?: string;
  hours?: string;
  /** category slugs the shop carries. EMPTY until she says; the row hides. */
  lines: string[];
};

export type Town = {
  id: string;
  town: string;
  /** the province, printed under the town name — "Dilijan" means more with
   *  "Tavush" beside it to anyone placing it on a map */
  region: string;
  /** the TOWN CENTRE. This is what the 3D country map pins. */
  lat: number;
  lng: number;
  shops: Stockist[];
};

export const stockists: Stockist[] = [
  // --- YEREVAN -------------------------------------------------------------
  // MADE BY ARMENIA FIRST (client, change.pdf p7, 2026-09-15): «in the
  // addresses, let the first shop be Made by Armenia». The list renders in
  // this order.
  {
    id: "made-by-armenia",
    shop: "Made by Armenia",
    townId: "yerevan",
    addressAm: "Արամի փողոց 42/1",
    address: "42/1 Arami Street, 0002",
    addressLat: 40.180748,
    addressLng: 44.512319,
    logo: "made-by-armenia",
    lines: [],
  },
  {
    id: "note-mote-northern-6",
    shop: "Note Mote",
    townId: "yerevan",
    addressAm: "Հյուսիսային պողոտա 6/2",
    address: "6/2 Northern Avenue",
    addressLat: 40.183498,
    addressLng: 44.514526,
    approx: true,
    logo: "note-mote",
    lines: [],
  },
  {
    id: "note-mote-northern-10",
    shop: "Note Mote",
    townId: "yerevan",
    addressAm: "Հյուսիսային պողոտա 10, 3/1 տարածք",
    address: "10 Northern Avenue, unit 3/1",
    addressLat: 40.182033,
    addressLng: 44.514485,
    logo: "note-mote",
    lines: [],
  },

  // --- DILIJAN (Tavush) ----------------------------------------------------
  {
    id: "anyutis",
    shop: "Anyut Is",
    townId: "dilijan",
    addressAm: "Մյասնիկյան 30/3",
    address: "30/3 Myasnikyan Street",
    addressLat: 40.738609,
    addressLng: 44.867841,
    // NOT logoDark: the Anyutis mark is black line-work on white. It was
    // flagged dark from the name alone, before the file arrived — which would
    // have painted black on black. Look at a mark before deciding its ground.
    logo: "anyutis",
    lines: [],
  },
  {
    id: "tic-dilijan",
    shop: "Dilijan Tourist Information Center",
    townId: "dilijan",
    addressAm: "Մաքսիմ Գորկու փող. 15/2",
    address: "15/2 Maxim Gorky Street",
    addressLat: 40.739310,
    addressLng: 44.862473,
    logo: "tic-dilijan",
    lines: [],
  },
  {
    id: "nrani",
    shop: "Nrani",
    townId: "dilijan",
    addressAm: "Մ. Գորկի փողոց 7/8",
    address: "7/8 M. Gorky Street",
    addressLat: 40.740403,
    addressLng: 44.865264,
    approx: true,
    logo: "nrani",
    lines: [],
  },

  // --- GARNI (Kotayk) ------------------------------------------------------
  {
    id: "crafts-of-armenia",
    shop: "Crafts of Armenia",
    townId: "garni",
    addressAm: "Գ. Մարզպետունի 10",
    address: "10 G. Marzpetuni Street",
    addressLat: 40.115046,
    addressLng: 44.730148,
    approx: true,
    logo: "crafts-of-armenia",
    logoDark: true,
    lines: [],
  },
];

/** The towns, in the order they are listed. Coordinates are the town CENTRE —
 *  public geography, and what the 3D map pins. */
const TOWN_META: Omit<Town, "shops">[] = [
  { id: "yerevan", town: "Yerevan", region: "Yerevan", lat: 40.177711, lng: 44.512623 },
  { id: "dilijan", town: "Dilijan", region: "Tavush", lat: 40.741713, lng: 44.872221 },
  { id: "garni", town: "Garni", region: "Kotayk", lat: 40.117484, lng: 44.734059 },
];

/** Towns WITH shops, derived. A town nobody stocks simply does not appear —
 *  there is no "coming soon" state any more, because there is nothing to
 *  promise: she is in seven shops and the page can just say so. */
export const towns: Town[] = TOWN_META.map((t) => ({
  ...t,
  shops: stockists.filter((s) => s.townId === t.id),
})).filter((t) => t.shops.length > 0);

export const stockistPage = {
  kicker: "(In person)",
  // HER WORDS (client, change.pdf p7, 2026-09-15) — verbatim
  title: "FIND ARPEN ART IN PERSON",
  copy:
    "Want to see and feel the work in person? Arpen Art pieces are available in selected shops across Armenia. Find your favorite illustrations, gifts and keepsakes — and take a little piece of Armenia with you.",
  /** The one-line summary above the list. Counts are computed, never typed:
   *  a hand-written "seven shops" is a number that goes stale the first time
   *  she is stocked somewhere new. */
  count: (shops: number, towns: number) =>
    `Stocked in ${shops} shop${shops === 1 ? "" : "s"} across ${towns} town${towns === 1 ? "" : "s"}.`,
  /** printed beside the map when the PIN — not the address — is a street-level
   *  estimate. The address above it is exactly what the shop gave us. */
  approx: "Pin placed from the street, not the doorway — check the address above on arrival.",
  /** the same caveat, short enough for a map pin */
  pinApprox: "Approximate — see the address",

  // --- the street map (components/TownStreet.tsx) -------------------------
  mapShow: "Show the street map",
  mapHide: "Hide the street map",
  mapLoading: "Loading the street map",
  /** a grey rectangle under an address is worse than no map */
  mapFail: "The street map could not load. The link below opens it in OpenStreetMap instead.",
  /** ATTRIBUTION IS A LICENCE CONDITION of the tile service, and it is printed
   *  as text because maplibre's own control is focusable and the map host is
   *  aria-hidden. Do not delete it without putting that control back. */
  mapCredit: "OpenFreeMap · © OpenMapTiles · map data from OpenStreetMap contributors",
  mapLarger: "Open a larger map",

  // --- getting there ------------------------------------------------------
  /** The map's own controls. They live OUTSIDE the aria-hidden canvas host —
   *  see LocationCard — so they are real buttons a keyboard can reach, which
   *  is also the only zooming this map has: the wheel is deliberately not
   *  taken, or the map would trap a reader inside a six-item list. */
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  recentre: "Back to the pin",
  /** Every shop in this list is confirmed, so the door is always what the
   *  outbound links point at. The old "directions to the TOWN" fallback is
   *  gone with the stand-in addresses that needed it. */
  directions: "Directions to the door",
  copyAddress: "Copy the address",
  copied: "Copied",
  copyFail: "Could not copy — select the address above instead.",

  // --- nearest to me ------------------------------------------------------
  near: "Find the nearest town",
  nearAsking: "Looking…",
  nearAgain: "Locate me again",
  /** straight-line, and it says so: a road distance would be a claim this
   *  site cannot make without a routing service */
  nearNote: "Distances are straight-line, not by road.",
  nearDenied: "The browser did not share a location. Pick the town you know instead.",
  nearNone: "This browser cannot share a location here. Pick the town you know instead.",
  nearestTag: "nearest to you",
  cue: "Drag to turn the map · choose a town",
  /** There is no closed-card caption. The card's caption slot collapses to
   *  max-height 0 when shut, so anything put there is invisible but still in
   *  the accessibility tree — and a hint saying "open the street map" would be
   *  read out to exactly the phone and no-JS visitors who have no control to
   *  open it with. They get the OSM link instead. */
  /** open data must say where it came from */
  credit: "Outline: geoBoundaries (ADM0/ADM1) · Lake Sevan: Natural Earth. Simplified for drawing.",
};

// ---------------------------------------------------------------------------
// HOME — the scroll story
// ---------------------------------------------------------------------------
export const home = {
  hero: {
    src: "/hero/hero.webp",
    alt:
      "An illustrated young woman with long dark hair smiling beneath a bright sun, against rolling yellow hills and snow-capped mountains",
    // the client's own hero line (2026-08-12), replacing "ARMENIA, / DRAWN
    // BY HAND". Two lines, and the break is theirs: the verb alone, then the
    // phrase it lands on.
    line1: "ILLUSTRATING",
    line2: "THE SOUL OF ARMENIA",
    sub: "Original illustration by Arpine Baroyan — on paper, silk, cotton and clay.",
    cta: "See the shop",
    hint: "Scroll",
  },
  strip: {
    kicker: "(The series)",
    // Arpine's own header for the series (Header - Text.txt, 2026-08-12).
    // TWO LINES, and the break is hers (change.pdf p2, 2026-09-21: «write it
    // in 2 lines, move ARMENIA up to the line»): the verb phrase, then the
    // country.
    title: ["A JOURNEY THROUGH", "ARMENIA"],
    copy:
      "A collection of over 50 illustrations inspired by Armenia’s cities, landscapes, traditions and everyday moments. Each piece tells a unique story — capturing the spirit, colors and memories of Armenia.",
    /** What a picked picture says. STILL only facts we have: its number and
     *  the series. The artworks have no titles yet — see the note at the top
     *  of this file — so nothing here invents one. */
    pickLine: "The Armenia series",
    pickBody:
      "One of the fifty-seven original illustrations, painted in Yerevan. Every piece in the shop is printed, painted or glazed from one of them.",
    pickCta: "See them in the shop",
  },
  // The sphere turned from the 57 illustrations to the SHOP (client
  // 2026-08-06), so the copy had to follow: "every picture in the series" was
  // describing what is no longer up there.
  gallery: {
    kicker: "(Gallery)",
    // HER WORDS (client, change.pdf p3, 2026-09-15) — verbatim. The old lead
    // carried the "drag to spin" instruction; that now lives only in the
    // canvas's accessible name.
    title: "THE WORLD OF ARPEN ART",
    copy: "Discover Arpen Art’s collection of illustrated goods, where Armenian places, stories and everyday moments become things you can wear, collect, gift and keep.",
    fallback: "Browse the shop",
    /** Said under the buy button rather than discovered on the next page.
     *  EVERY open category needs a choice before it can go in a basket —
     *  six of them need an illustration, and postcards, scarves and hoodies
     *  need a format, style or size — so there is no product on this site
     *  that can honestly be added in one click from here. The button opens
     *  the piece with its picker instead, which is what a variable product
     *  does in any serious shop. */
    buyNote: "You choose the illustration and the options on the product itself.",
    /** under a globe card whose line is not in the shop yet — a fact about
     *  the catalogue, not a promise about a date */
    soonNote: "This line is being prepared; its price is from Arpine's list.",
  },
  shopIntro: {
    kicker: "(Shop)",
    title: ["THE PICTURES", "COME OFF", "THE PAGE"],
    copy:
      "Each illustration is printed, painted or glazed onto something you can actually use — a card to send, a scarf to wear, a mug for the morning.",
  },
  // -------------------------------------------------------------------------
  // FROM THE STUDIO — the strip above the footer. It is BUILT to hold short
  // films from Arpine's Instagram; each panel takes an optional `video`, and
  // the moment one has a src it plays there instead of the still.
  //
  // No film exists yet, and none is invented: the panels show the photographs
  // the shop already uses, of the same pieces, and `pending` says so out loud.
  // Fill in `video` per panel and the note removes itself.
  // -------------------------------------------------------------------------
  studio: {
    kicker: "(In motion)",
    // HER WORDS (client, change.pdf p4, 2026-09-15) — verbatim
    title: "ILLUSTRATIONS IN MOTION",
    copy: "The illustrations come to life — short films inspired by Armenia, created by Arpen Art",
    /** Shown only while no panel has a film. All five have one now, so this
     *  never renders; it stays for the next piece added without one. */
    pending: "Films are still to come; these are photographs of the same pieces.",
    panels: [
      {
        id: "mountains",
        title: "Above the mountains",
        line: "A balloon drifting over the range",
        video: "/studio/studio-mountains.mp4",
        poster: "/studio/studio-mountains.webp",
        w: 540,
        h: 960,
      },
      {
        id: "sheep",
        title: "The sheep",
        line: "A carful on the mountain road",
        video: "/studio/studio-sheep.mp4",
        poster: "/studio/studio-sheep.webp",
        w: 540,
        h: 960,
      },
      {
        id: "opera",
        title: "At the opera",
        line: "Kites over the opera house",
        video: "/studio/studio-opera.mp4",
        poster: "/studio/studio-opera.webp",
        w: 540,
        h: 960,
      },
      {
        id: "night",
        title: "Over the city",
        line: "A swing above the night streets",
        video: "/studio/studio-night.mp4",
        poster: "/studio/studio-night.webp",
        w: 540,
        h: 960,
      },
      {
        id: "moon",
        title: "Under the moon",
        line: "A full moon over the city",
        video: "/studio/studio-moon.mp4",
        poster: "/studio/studio-moon.webp",
        w: 540,
        h: 960,
      },
      // Three more from the client's own drop (2026-08-11). The folder held
      // nine reels; five were already here and three of the remaining six turn
      // out to be the same films (the moon, the swing, the balloon) under
      // different working filenames — checked frame by frame rather than by
      // name, or the strip would have shown the same animation twice.
      {
        id: "monument",
        title: "Mother Armenia",
        line: "The statue above the eternal flame",
        video: "/studio/studio-monument.mp4",
        poster: "/studio/studio-monument.webp",
        w: 540,
        h: 960,
      },
      {
        id: "sofa",
        title: "An evening in",
        line: "Two on a sofa, controllers in hand",
        video: "/studio/studio-sofa.mp4",
        poster: "/studio/studio-sofa.webp",
        w: 540,
        h: 960,
      },
      {
        id: "window",
        title: "At the window",
        line: "Apples on the table, mountains beyond",
        video: "/studio/studio-window.mp4",
        poster: "/studio/studio-window.webp",
        w: 540,
        h: 960,
      },
      // SEVEN MORE from the client's 2026-09-15 drop (change.pdf p4: "add the
      // animations from this folder"). Eight arrived; one — the balloon over
      // the range — is the film already above as `mountains` (same 18.667 s
      // to the frame, same composition), so it is not shown twice. Titles and
      // lines describe the frame, nothing more, as with the eight before.
      { id: "pomegranates", title: "Two pomegranates", line: "Arm in arm, on a blue ground", video: "/studio/film-01.mp4", poster: "/studio/film-01.webp", w: 540, h: 960 },
      { id: "square", title: "Coffee at the square", line: "A cup at the window, the Government House beyond", video: "/studio/film-03.mp4", poster: "/studio/film-03.webp", w: 540, h: 960 },
      { id: "lanterns", title: "Under the lanterns", line: "Paper lanterns over a night terrace", video: "/studio/film-04.mp4", poster: "/studio/film-04.webp", w: 540, h: 960 },
      { id: "cascade", title: "A glass at the Cascade", line: "Wine at the window, the Cascade below", video: "/studio/film-05.mp4", poster: "/studio/film-05.webp", w: 540, h: 960 },
      { id: "chapel", title: "In the chapel window", line: "Two in a bell tower over the hills", video: "/studio/film-06.mp4", poster: "/studio/film-06.webp", w: 540, h: 960 },
      { id: "wave", title: "The wave", line: "A cup raised to a wave on the rocks", video: "/studio/film-07.mp4", poster: "/studio/film-07.webp", w: 540, h: 960 },
      { id: "hill", title: "The church on the hill", line: "Red hair in the wind below a hilltop church", video: "/studio/film-08.mp4", poster: "/studio/film-08.webp", w: 540, h: 960 },
    ] as Array<{
      id: string;
      /** Titles and lines DESCRIBE THE FRAME and nothing more. These are her
       *  own animations, from the client's own drop, and no story, occasion or
       *  meaning is attached to them here that is not visibly in the picture. */
      title: string;
      line: string;
      /** self-hosted, so the home page still contacts nobody */
      video?: string;
      poster?: string;
      /** The film's real pixel size. The open panel is BUILT from this — its
       *  width is whatever carries this shape at the strip's height — so a
       *  landscape film added later widens its own frame instead of being
       *  letterboxed into a vertical one. */
      w?: number;
      h?: number;
      /** the older form: a still from lib/products.json. Either works. */
      media?: string;
      shot?: number;
    }>,
  },
  contact: {
    kicker: "(Contact)",
    title: "COMMISSIONS & WHOLESALE",
    // HER WORDS (client, change.pdf p9, 2026-09-15) — verbatim
    copy:
      "For commissions, wholesale enquiries, collaborations or questions about an order — send a message and Arpine will get back to you personally.",
    send: "Send",
    sending: "Sending…",
    ok: "Thank you — your message is on its way.",
    logged:
      "Your message was received but email delivery is not configured yet. Please also reach out directly:",
    failed: "That did not send. Please try again, or reach out directly:",
    fields: { name: "Name", email: "Email", message: "What can Arpine help with?" },
    consent: "I agree to be contacted about this enquiry",
  },
  footer: {
    toTop: "To top",
    legal: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
};

// ---------------------------------------------------------------------------
// LOOKBOOKS — the scroll showcase under a product, for the categories that
// have been photographed properly. A category with no entry here simply does
// not get one; nothing else on its page changes.
//
// `order` is the reading order of lib/products.json ids, and it is not
// arbitrary: the first photograph becomes the plate at the centre of the zoom
// and the third lands in the one tall slot, so a portrait shot belongs there.
// ---------------------------------------------------------------------------
export type Lookbook = {
  kicker: string;
  title: string;
  copy: string;
  /** one short line, shown midway through the zoom — keep it factual */
  caption: string;
  alt: string;
  order: string[];
};

/** Categories that open with the drifting-columns overture before the counter.
 *  Add a slug here once its photography exists — nothing else changes. */
export const overtures: Record<string, { kicker: string }> = {
  hoodies: { kicker: "(Worn)" },
};

/** Categories that open with the scroll-morph hero (scatter → line → ring →
 *  arc). Uses the ARTWORK, so it needs no product photography at all. */
export const morphs: Record<string, { intro: string[]; cue: string; title: string; copy: string }> = {
  postcards: {
    // HER WORDS (client, change.pdf p15, 2026-09-15) — verbatim; the break
    // into two lines is hers too (change.pdf p10, 2026-09-21)
    intro: ["SEND", "A LITTLE ARMENIA"],
    cue: "Scroll",
    title: "Postcards",
    copy: "Illustrated postcards inspired by Armenia — its cities, landscapes, people and everyday moments. A little piece of home, ready to travel wherever you send it.",
  },
};

// ---------------------------------------------------------------------------
// SCARVES — three fixed designs (client drop, 2026-09-15: twelve photographs
// and four text files). Every word below is hers, transcribed from those
// files unedited: `Scarf.txt` is the section, `1.txt` and `3.txt` carry a
// title and a paragraph, `2.txt` carries a PARAGRAPH ONLY — so the second
// design is numbered, the way everything untitled on this site is, rather
// than given a name she did not write. `shots` are ids in products.json's
// scarves roll, flat print first, then the wall, the rail, the worn/folded one.
// ---------------------------------------------------------------------------
export const scarfDesigns = {
  kicker: "(On silk)",
  title: "A Little Armenia to Take With You",
  copy:
    "Each scarf brings together a different story from Armenia — its mountains, cities, people, memories and dreams. Wear it as a colorful reminder of a place that stays close to the heart.",
  add: "Add to cart",
  added: "Added to your cart.",
  designs: [
    {
      id: "01",
      name: "Armenia in Every Detail",
      copy: "A colorful journey through Armenia, bringing together its landscapes, landmarks, people and stories in one illustrated piece. From Mount Ararat and Yerevan to iconic symbols of Armenian culture, every detail carries a little piece of the country.",
      shots: ["01", "02", "03", "04"],
    },
    {
      id: "02",
      name: "Scarf no. 02",
      untitled: true,
      copy: "A joyful portrait of Armenia under its bright golden sun. Surrounded by colorful mountains and landscapes, a familiar Arpen Art character celebrates the warmth, beauty and vibrant spirit of the country.",
      shots: ["05", "06", "07", "08"],
    },
    {
      id: "03",
      name: "A Journey Above Armenia",
      copy: "A dreamlike journey through the Armenian highlands, where colorful mountains meet the open sky. Mount Ararat rises in the distance as a symbol of home, while the hot-air balloon brings a sense of freedom, adventure and wonder.",
      shots: ["09", "10", "11", "12"],
    },
  ] as Array<{ id: string; name: string; untitled?: boolean; copy: string; shots: string[] }>,
};

// ---------------------------------------------------------------------------
// STICKER SHEETS — the folders on /shop/stickers.
//
// Arpine's 2026-08-19 drop is six SHEETS, each delivered as three pictures:
// the flat print file and two mockup photographs. The page shows them as six
// folders side by side — hover fans a folder's three pictures, opening it
// spreads them out to look through (StickerFolders.tsx).
//
// The names are ORDINALS, not titles: the sheets arrived numbered 1–6 and
// nothing else, and this site does not invent titles the artist has not
// given (same rule as the artworks). The spec line is read off her own print
// filenames — "158x200 x 20" — so it is a fact, not a guess.
// `shots` are ids in products.json's stickers roll, print first.
// ---------------------------------------------------------------------------
export const stickerSheets = {
  kicker: "(The sheets)",
  // HER WORDS, 2026-08-23. She also named what the six sheets ARE, which
  // nothing here had said: a set is "a group of illustrations connected by a
  // common story, place, feeling or idea" — they are themed, not six
  // arbitrary twenties. The size and count she left out are not lost; they
  // are the spec row on every folder and in the category's spec table.
  title: "STICKER COLLECTION",
  copy: [
    "A collection of stories, one sticker at a time.",
    "Each sticker set brings together a group of illustrations connected by a common story, place, feeling or idea. Inspired by Armenia, its culture, landscapes and everyday moments, every set is designed to tell a little story wherever you take it.",
    "Use them to personalize your notebooks, laptops, phones, water bottles, travel gear, packaging and more — or simply collect your favorite pieces of Armenia.",
  ],
  spec: "158 × 200 mm · 20 stickers",
  /** the label on each folder's own buy button */
  add: "Add this sheet",
  added: "Added to your cart.",
  /** shown once a folder is open, on the live layer only */
  hint: "Drag a picture down, press Escape, or press the folder again to close it.",
  sheets: [
    { id: "1", name: "Sheet 01", shots: ["01", "02", "03"] },
    { id: "2", name: "Sheet 02", shots: ["04", "05", "06"] },
    { id: "3", name: "Sheet 03", shots: ["07", "08", "09"] },
    { id: "4", name: "Sheet 04", shots: ["10", "11", "12"] },
    { id: "5", name: "Sheet 05", shots: ["13", "14", "15"] },
    { id: "6", name: "Sheet 06", shots: ["16", "17", "18"] },
  ],
};

// ---------------------------------------------------------------------------
// 3D STICKERS — the lane on /shop/3d-stickers.
//
// 48 designs, flown past on a receding diagonal as the page is scrolled, and
// the lane NEVER ENDS: after the forty-eighth comes the first again (client
// 2026-08-22, "scroll must not finish but start circle from first after
// reached last"). Click one and it comes to the middle, big, with its price
// and a way to buy it.
//
// No titles again: the designs arrived numbered and nothing else, so a card
// says "No. 07" and the series, exactly as the artworks do.
// ---------------------------------------------------------------------------
// HER WORDS, 2026-08-31 — the heading and the paragraph are transcribed from
// the text file that arrived with the twenty-four photographs, unedited. The
// cue and the pill are mine: they are instructions for the pointer, not claims
// about the product, which is the only kind of copy this file writes for her.
export const keychainWall = {
  kicker: "(On your keys)",
  title: "Little Stories to Carry",
  copy: [
    "Small illustrations, big memories. Each Arpen Art keychain brings a little piece of Armenia with you — from familiar Yerevan scenes to colorful places and stories inspired by Armenian culture.",
  ],
  cue: "Drag a keychain to turn it",
  grab: "Drag to rotate",
  add: "Add to cart",
  added: "Added to your cart.",
};

// HER WORDS, 2026-08-31 — title and paragraph from the text file in the magnet
// drop, unedited. The cue is mine (an instruction, not a claim).
export const magnetFridge = {
  kicker: "(On the fridge)",
  title: "Little Pieces of Armenia",
  copy: [
    "Bring a little piece of Armenia to your home. Each Arpen Art magnet features an original illustration inspired by Armenian places, landscapes, culture and everyday moments — a small keepsake to remember Armenia by.",
  ],
  cue: "Click a magnet to see it up close",
  all: "The whole set",
  add: "Add to cart",
  added: "Added to your cart.",
  /** under a reserved door slot's name — a design announced but not yet
   *  delivered as artwork; the frame is empty on purpose */
  soon: "coming",
};

export const stickers3d = {
  kicker: "(Domed)",
  // HER WORDS, 2026-08-23 — heading and body both. What was here before was
  // mine ("Forty-eight, on a loop") and it described the LANE; hers describes
  // the product, which is what a shop page is for. The instruction the old
  // lede carried lives in `cue`, bottom-right, where it belongs.
  title: "3D STICKERS",
  copy: [
    "Bring a little piece of Armenia to life. Playful 3D illustrations inspired by Armenia, its places, culture and everyday moments — made to add a little personality wherever you stick them.",
  ],
  cue: "Scroll to surf · click to open",
  /** shown on the opened card */
  open: { series: "The Armenia series", add: "Add to cart", close: "Close", added: "Added to your cart." },
};

// ---------------------------------------------------------------------------
// TOTE BAGS — the four designs, shown the way the client asked for
// (2026-08-24, pointing at shadcnblocks' "gallery1"): a row of cards where
// hovering one expands it and shrinks the rest.
//
// Heading and copy are HERS, from tote bag.txt, verbatim.
//
// No invented names again: the bags arrived as four numbered folders, so a
// card says "No. 01" and the series, exactly as the artworks and the 3D
// stickers do. The badges are not decoration either — both are lifted from
// the category's own spec rows, so they cannot start claiming something the
// product page does not.
// ---------------------------------------------------------------------------
export const toteBags = {
  kicker: "(Tote bags)",
  title: "A LITTLE ARMENIA, WHEREVER YOU GO",
  copy: [
    "Inspired by Armenia’s cities, landscapes and stories, these illustrated tote bags turn everyday essentials into wearable memories.",
    "Carry the colors and spirit of Armenia with you.",
  ],
  badges: ["Natural cotton", "Printed in Yerevan"],
  /** said once under the row, and only where a pointer can act on it */
  cue: "Hover a bag to see it carried",
  series: "The Armenia series",
};

// ---------------------------------------------------------------------------
// STUDIO STORIES — /stories (client, change.pdf p12, 2026-09-21: «we are
// adding a new section», a Drive folder of texts, photographs and two
// television features).
//
// EVERY WORD BELOW IS HERS, transcribed from the six text files unedited —
// headings, date lines, paragraphs, the closing lines. Two things in them
// are hers to reconcile, not mine to fix, so they stand as written:
//   · the 2022 file is headed "A JOURNEY THROUGH ILLUSIONS" and its own
//     paragraph calls the show “A Journey Through Illustrations”;
//   · the Dilijan file is dated 07.07.2025 while the poster in the same
//     folder says 07 June.
// The photographs are placed by what is IN them (the poster, the Union's
// building, the framed drawings behind her, the trees), and the two films
// by their own lower-thirds — the Union's vice-president speaks in one, the
// Narekatsi Art Institute in the other. Where a work could not be tied to a
// show it is not forced into one.
// ---------------------------------------------------------------------------
export type Story = {
  id: string;
  /** her date line, verbatim */
  when: string;
  title: string;
  /** her paragraphs, in order; the last one is her closing line */
  body: string[];
  /** ids in lib/stories.json — the first is the card's lead picture */
  photos: string[];
  /** a television feature, self-hosted; sound stays on, so it plays on a press */
  film?: { src: string; poster: string; label: string };
  /** the full interview, in the language it was given */
  more?: { label: string; lang: string; paragraphs: string[]; credit: string };
  link?: { label: string; href: string };
};

export const stories = {
  kicker: "(Studio stories)",
  title: "STUDIO STORIES",
  copy: "Exhibitions, interviews, collaborations and stories from Arpen Art.",
  watch: "Watch the feature",
  entries: [
    {
      id: "dilijan-2025",
      when: "07.07.2025 · DILIJAN · RESTART BOUTIQUE HOTEL",
      title: "A PLACE FULL OF MEMORIES",
      body: [
        "In July 2025, I presented a selection of my illustrations at Restart Boutique Hotel in Dilijan, bringing together works created at different moments of my artistic journey.",
        "The location made this exhibition especially meaningful to me. Dilijan has always held a special place in my heart — a place connected to warm memories, familiar landscapes and moments I continue to carry with me.",
        "It felt natural to bring my work back to a place that has inspired so many feelings and memories over the years.",
        "A collection of illustrations, shown in a place that feels a little like home.",
      ],
      // the poster ("Beyond the Hidden Border — Exhibition by Arpine
      // Baroyan, RestArt Boutique Hotel Dilijan"), the DREAM piece and its
      // two other views, two of the graphic drawings, and Dilijan itself
      photos: ["31", "36", "34", "35", "37", "26", "28"],
    },
    {
      id: "media-m-2025",
      when: "07.03.2025 · MEDIA M",
      title: "IN CONVERSATION WITH ARPINE",
      body: [
        "An interview about illustration, Armenian culture and the stories behind Arpen Art. In conversation with Media M, Arpine shares her creative journey, the ideas behind her work, and her vision for bringing Armenian stories into contemporary illustration.",
        "Read the full interview below.",
      ],
      photos: ["27"],
      more: {
        label: "Read the full interview (in Armenian)",
        lang: "hy",
        paragraphs: [
          "Նկարչուհի Արփինե Բարոյանի հերոսները խոսում են «հոգու լեզվով»։ Նրանք ստեղծագործ են, երազկոտ, սիրում են բնությունն ու գույների աշխարհը։ Media M.am-ի հետ զրույցում երիտասարդ նկարչուհին խոսել է իր նկարների, նախընտրած ժանրի և ցուցահանդեսների մասին։",
          "— Բարև Ձեզ։ Արփինե, քանի՞ տարեկանից եք սկսել նկարել։ Որտե՞ղ եք սովորել։",
          "—Բարև Ձեզ։ Նկարել սկսել եմ մանկուց։ Դպրոցում իմ սիրելի առարկան նկարչությունն էր։ Հիշում եմ՝ հորեղբորս նվիրած առաջին մատիտները և թղթերը օրս վերածել էին տոնի։ Այդ ժամանակ էլ որոշեցի, որ կդառնամ նկարչուհի կամ գիտնական։ Արվեստի դպրոցում սովորելուց և կիսատ թողնելուց հետո տարիներ անց՝ եղբորս խորհրդով կրկին վերադարձա նկարչությանը։",
          "Սովորել եմ Ճարտարապետության և շինարարության Հայաստանի ազգային համալսարանի դիզայնի ֆակուլտետում։ Ուզում եմ նշել նաև Թումո ստեղծարար տեխնոլոգիաների կենտրոնի մասին։ Այն ինձ լայն հնարավորություններ տվեց՝ փորձարկելու տարբեր տեխնիկաներ, սովորելու համակարգչային ծրագրեր, լուսանկարչություն, կինոարվեստ և անիմացիա։",
          "Սակայն, անկախ նրանից, թե որտեղ ենք սովորում, կարծում եմ, որ իրական առաջընթաց լինում է այն դեպքում, երբ ամեն օր աշխատում ենք մեր հմտությունների զարգացման վրա։",
          "—Ձեր աշխատանքներում գերակշռում են երևանյան թեմատիկայով նկարները։ Ինչպե՞ս է ծնվել գաղափարը։ Ովքե՞ր են Ձեր հերոսները։",
          "—Ապրելով Երևանում՝ չեմ կարող չնկարել այն։ Ուզում եմ, որ մեր քաղաքն ունենա տարբերվող իլյուստրացիաներ։ Իմ հերոսները մարդիկ են, ովքեր իրենց արվեստով կարողանում են խոսել հոգու լեզվով։",
          "Մարդիկ են, որ ունեն իրենց ճանապարհը գտնելու և դրանով քայլելու համարձակություն։ Նրանք ստեղծագործ են, հետևողական իրենց գաղափարների մեջ։",
          "—2023 թվականից համարվում եք Նկարիչների միության անդամ։ Պարտավորեցնո՞ղ է։",
          "—Այո, անկեղծ ասած՝ պարտավորեցնող է։ Երբ մտածում եմ, որ միության անդամներից շատերը մեծ փորձ ունեցող նկարիչներ են, ովքեր ունեն կայուն ոճ և տարիների փորձ, հասկանում եմ, որ ես դեռ փնտրտուքների ու փորձարկումների փուլում եմ։ Միության ամենամյա ցուցահանդեսներին ձգտում եմ պատրաստվել լրջորեն՝ ներկայացնելով հետաքրքիր ու ինքնատիպ աշխատանքներ։",
          "—Ձեր ստեղծագործություններում ունեք Վահան Տերյանին և «Գոշավանք» վանական համալիրին նվիրված աշխատանքներ։ Ինչպե՞ս ծնվեց գաղափարը։ Արդյո՞ք այն կլինի շարունակական։",
          "—Վահան Տերյանին նվիրված աշխատանքը պատվեր էր՝ ստեղծված «Ձմռան գիշեր» բանաստեղծության հիման վրա։ Երաժշտությունը գրել է Գեղամ Մարգարյանը, որի հետ արդեն մեկ տարի է աշխատում ենք իր տարբեր երգերի անիմացիաների վրա։",
          "«Գոշավանք» թվային աշխատանքը մի փոքր անձնական է։ Գոշավանքը գտնվում է Դիլիջանում՝ մի վայրում, որն առանձնահատուկ է ինձ համար։ Վանքը ոչ միայն հայկական ճարտարապետության գոհարներից է, այլև մի վայր է, որտեղից ժամանակին տարածվել է դպրություն ու արվեստ։ Այն եղել է հսկա մշակութային օջախ, ինչը շատ ոգևորիչ է։ Ամեն անգամ այնտեղ լինելով ես նորովի եմ բացահայտում վանքի կախարդական մթնոլորտը, քարերի պատմությունը։",
          "Հայկական մշակութային ժառանգությունն ինձ համար անսպառ թեմա է։ Անշուշտ, հայկական թեմատիկայով պատկերներ դեռ կլինեն իմ ստեղծագործական էջերում։",
          "—Խոսենք, Ձեր «Գարնանային սալոն 2024» և «Ծառապատում» ցուցահանդեսների մասին։ Ի՞նչ եք փորձել փոխանցել նկարների միջոցով։ Ինչու՞ «Ծառապատում»։",
          "— «Գարնանային սալոն» ցուցահանդեսին ներկայացրել եմ «Ծառապատում» շարքի նկարներից, որից հետո կազմակերպվեց անհատական ցուցահանդես նույն անվամբ։",
          "Այս շարքում գերակշռում էին բնության պատկերները՝ հատկապես ծառերը։ Վերջին շրջանում ծառահատումները շատացել են։ Իմ նկարներում ծառերը հիմնականում ներկայացված են անտերև ու մռայլ՝ ասես նեղացած մարդկանցից։ Այնուամենայնիվ, կա հույս, որ զանգվածային ծառահատումները կնվազեն, և կտնկվեն նոր «կյանքեր»։",
          "Ցուցահանդեսը նպատակ ուներ սթափեցնել մարդկանց՝ հիշեցնելու բնության ու ծառերի պահպանության կարևորության մասին։ «Ծառապատում» անվանումը կարող ենք բացատրել երկու ձևով․ առաջինը՝ որպես ծառերի մասին պատմություններ, երկրորդը՝ որպես ծառերի տնկում։",
        ],
        credit: "Հարցազրույցը՝ media_m.am",
      },
    },
    {
      id: "tsarapatum-2024",
      when: "29.07.2024 · YEREVAN · NAREKATSI ART INSTITUTE",
      title: "TSARAPATUM — STORIES OF TREES",
      body: [
        "In July 2024, I presented my solo exhibition “Tsarapatum” at the Narekatsi Art Institute in Yerevan.",
        "The entire series was dedicated to trees — their forms, rhythms and quiet presence. For me, trees became more than a subject to draw. They became symbols of growth, memory, roots, time and connection.",
        "The title “Tsarapatum” was deeply symbolic, reflecting the idea of looking at life through the language of trees — grounded in one place, yet constantly reaching, changing and growing.",
        "This exhibition was a personal exploration of nature and emotion, bringing together a series of works connected by one simple but powerful image: the tree.",
        "A story about roots, growth and everything that quietly lives within us.",
      ],
      // the opening with the musicians, the sheep among the trees, the tree
      // on wine-red
      photos: ["39", "32", "33"],
      film: {
        src: "/stories/film-tsarapatum.mp4",
        poster: "/stories/film-tsarapatum.webp",
        label: "Television feature on the Tsarapatum exhibition, Narekatsi Art Institute, 2024 — in Armenian",
      },
    },
    {
      id: "artists-union-2023",
      when: "05.12.2023 · YEREVAN, ARMENIA",
      title: "A NEW CHAPTER IN MY ARTISTIC JOURNEY",
      body: [
        "In December 2023, I became a member of the Artists’ Union of Armenia — an institution with a long history at the heart of Armenia’s artistic life.",
        "Established in 1932, the Artists’ Union has brought together generations of Armenian artists and continues to support artistic development, exhibitions, cultural exchange and the professional community.",
        "Becoming a member was a meaningful step in my own artistic journey — a connection to the wider community of Armenian artists and to a tradition that continues to evolve with every new generation.",
        "Proud to be part of it since December 5, 2023.",
      ],
      // the Union's building on Abovyan Street, from the square and at the door
      photos: ["20", "18"],
    },
    {
      id: "first-solo-2022",
      when: "22.10.2022 · YEREVAN · ARTISTS’ UNION OF ARMENIA",
      title: "A JOURNEY THROUGH ILLUSIONS",
      body: [
        "In October 2022, I presented my first solo exhibition in Yerevan at the Artists’ Union of Armenia.",
        "Titled “A Journey Through Illustrations,” the exhibition brought together works from different moments of my creative journey — a collection of images, ideas and stories that marked an important beginning for me as an artist.",
        "This exhibition holds a very special place in my story. It was my first solo show, the first time I presented my work as a complete artistic journey, and a moment that gave me the confidence to continue exploring illustration as my own visual language.",
        "The beginning of a journey that continues to this day.",
      ],
      // her beside the framed drawings, and two of the drawings themselves
      photos: ["25", "19", "30"],
      film: {
        src: "/stories/film-union.mp4",
        poster: "/stories/film-union.webp",
        label: "Television feature “Arpine Baroyan’s mysterious world”, at the Artists’ Union of Armenia — in Armenian",
      },
    },
    {
      id: "akn-eye",
      when: "AKN EYE · ARTIST PAGE",
      title: "ARPINE ON AKN EYE",
      body: [
        "Arpine is an artist and illustrator based in Armenia, whose creative journey began with a strong foundation in graphic design. Over the years, her artistic focus has evolved, embracing the world of illustration with a deep connection to both the natural world and the fantastical realms of her imagination.",
        "Her journey into the visual arts started during her university years at the Armenian University of Architecture and Construction and TUMO, where she honed her skills in design techniques and developed a unique visual language. Arpine has had two solo exhibitions and is also a member of the Artists' Union in Armenia.",
        "Her diverse skill set includes not only illustration and character design but also graphic design and branding, allowing her to bring a unique perspective to every project she undertakes.",
        "Arpine is also the creative force behind her own growing brand, ArpenArt, where her vision continues to evolve, and her artistic voice resonates across various mediums.",
      ],
      // the sculpted faces and the cat — character work, which is what this
      // page of hers is about
      photos: ["24", "29"],
      link: { label: "See the page on akneye.com", href: "https://www.akneye.com/artists/arpine-baroyan" },
    },
  ] satisfies Story[],
};

export const lookbooks: Record<string, Lookbook> = {
  totes: {
    kicker: "(Carried)",
    title: "THE WHOLE SERIES, OVER ONE SHOULDER",
    copy:
      "Natural cotton, the stamp grid printed large enough to read across a street. Photographed around Yerevan and up in the mountains.",
    caption: "Natural cotton · printed in Yerevan",
    alt: "Natural cotton tote printed with Arpine Baroyan's Armenia stamp grid, carried outdoors",
    order: ["03", "04", "01", "08", "07", "02", "09", "05", "06"],
  },
};
