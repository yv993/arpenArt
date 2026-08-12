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
  // PLACEHOLDER — swap for the real shop contacts before launch
  email: "hello@arpenart.am",
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
  /** Price in Armenian dram. Postcards carry Arpine's REAL price (1,000 —
   *  client 2026-08-12); every other category is still a PLACEHOLDER waiting
   *  on her figures. The cart and the order endpoint both read this field,
   *  and the endpoint re-prices from it so the browser can never name a
   *  price of its own. */
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
    blurb: "The full Armenia series, printed on heavy uncoated card. Sold singly or as a set.",
    media: "postcards",
    // Arpine's real price, 2026-08-12: every card is 1,000 dram.
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
    blurb: "Silk squares and bandanas, the illustrations redrawn to wrap and fold.",
    media: "scarves",
    from: 14000,
    status: "open",
    // the blurb already names the two cuts; the picker repeats them, no more
    variants: { label: "Style", options: ["Silk square", "Bandana"] },
    spec: [{ k: "Material", v: "Silk" }, ...processSpec],
    // PLACEHOLDER-shaped gap: the square's dimensions are Arpine's to supply —
    // the spec stays silent rather than guessing a number.
  },
  {
    slug: "hoodies",
    name: "Painted hoodies",
    blurb: "Hand-finished hoodies and tees — each one painted, so no two are identical.",
    media: "apparel",
    from: 18000,
    status: "open",
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
    blurb: "Yerevan on a mug, glazed and dishwasher-safe.",
    media: "mugs",
    from: 5500,
    status: "open",
    spec: [{ k: "Care", v: "Glazed and dishwasher-safe" }, ...processSpec],
  },
  {
    slug: "plates",
    name: "Plates",
    blurb: "Decorative plates carrying the Opera House and other landmarks.",
    media: "plates",
    from: 7500,
    status: "open",
    // "decorative" is the blurb's own word — no food-safety claim is made
    spec: [{ k: "Use", v: "Decorative" }, ...processSpec],
  },
  {
    slug: "puzzles",
    name: "Puzzles",
    blurb: "Ararat and the wildflower fields, cut into a puzzle worth an evening.",
    media: "puzzles",
    from: 8500,
    status: "open",
    // PLACEHOLDER-shaped gap: piece count and finished size are Arpine's to
    // supply — the spec carries only the process rows rather than a guess.
    spec: [...processSpec],
  },
  {
    slug: "stickers",
    name: "Stickers",
    blurb: "Sticker sheets and single die-cuts, matte and weatherproof.",
    media: "stickers",
    from: 600,
    status: "open",
    spec: [{ k: "Finish", v: "Matte and weatherproof" }, ...processSpec],
  },
  {
    slug: "totes",
    name: "Tote bags",
    blurb: "Cotton totes carrying the stamp grid of the whole Armenia series.",
    media: "totes",
    from: 6500,
    status: "open",
    // both rows repeat the tote lookbook's caption, word for word
    spec: [
      { k: "Material", v: "Natural cotton" },
      { k: "Printing", v: "Printed in Yerevan" },
      ...processSpec,
    ],
  },
  {
    slug: "skirts",
    name: "Skirts",
    blurb:
      "Painted skirts — the newest line. The designs are finished; the garments are being photographed.",
    media: "skirts",
    from: 0,
    status: "soon",
    swatch: ["05", "25", "13", "42", "54", "50"],
  },
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
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

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
export const socials: Array<{
  label: string;
  href: string;
  icon: "instagram" | "x" | "discord";
  pending?: boolean;
}> = [
  { label: "Instagram", href: "https://www.instagram.com/", icon: "instagram", pending: true },
  { label: "X", href: "https://x.com/", icon: "x", pending: true },
  { label: "Discord", href: "https://discord.com/", icon: "discord", pending: true },
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
// WHAT IS REAL HERE: the coordinates. Those are the actual positions of the
// towns, which is public geography and safe to draw.
//
// WHAT IS NOT: `shop` and `address` are EMPTY, on purpose. A stockist list is
// the one place on a site where an invention costs a real person a real
// journey, so nothing is named until Arpine confirms it. A town with no shop
// yet renders as "being arranged" and its pin is hollow.
//
// TO FINISH: fill `shop`, `address` and `lines` for each confirmed stockist,
// and delete any town she is not in. The notice at the top of the page
// disappears by itself once every listed town has a shop name.
// ---------------------------------------------------------------------------
export type Stockist = {
  id: string;
  town: string;
  /** empty until she confirms who carries it there */
  shop: string;
  /** street address, printed under the town on /find-in-store */
  address: string;
  /** TRUE while `address` is only a stand-in. It drives a warning on the
   *  address line itself and in the street map's pin label. Delete the field
   *  when the real address lands and every warning removes itself. */
  placeholder?: boolean;
  /** where the DOOR is — the street map centres and pins this. Separate from
   *  lat/lng on purpose: those are the TOWN CENTRE, which is what the country
   *  map's pins mark and what the outbound link falls back to while no shop
   *  is confirmed. */
  addressLat?: number;
  addressLng?: number;
  phone?: string;
  hours?: string;
  /** category slugs the shop carries */
  lines: string[];
  lat: number;
  lng: number;
};

// PLACEHOLDER ADDRESSES, at the client's request (2026-08-06: "next i give
// real locations, now find random street address for all cities").
//
// They are NOT random. Every street below is a real, central, commercial
// street in that town, researched and then independently re-checked against
// OpenStreetMap by a second pass that was told to try to disprove it —
// because a made-up street name on a stockist page costs someone a real bus
// ride. The building numbers sit inside each street's real range. What is
// invented is only the pairing: no shop at any of these addresses has agreed
// to carry her work, and `placeholder: true` says so everywhere it shows.
//
// `shop` stays EMPTY. A street can be checked; a business that has not agreed
// to stock her cannot be invented at all.
//
// TO FINISH: replace `address` + `addressLat/Lng`, fill `shop`, and delete
// `placeholder`. Nothing else needs touching.
export const stockists: Stockist[] = [
  {
    id: "yerevan",
    town: "Yerevan",
    shop: "",
    address: "10 Abovyan Street, Kentron",
    placeholder: true,
    // the BUILDING centroid, not the street centreline 15 m away — the pin is
    // supposed to be the door
    addressLat: 40.18082,
    addressLng: 44.51573,
    phone: "",
    hours: "",
    lines: [],
    lat: 40.1792,
    lng: 44.4991,
  },
  {
    id: "gyumri",
    town: "Gyumri",
    shop: "",
    address: "240 Abovyan Street",
    placeholder: true,
    addressLat: 40.7864,
    addressLng: 43.8403,
    phone: "",
    hours: "",
    lines: [],
    lat: 40.7894,
    lng: 43.8475,
  },
  {
    id: "vanadzor",
    town: "Vanadzor",
    shop: "",
    address: "30 Tigran Mets Avenue",
    placeholder: true,
    addressLat: 40.8099,
    addressLng: 44.4888,
    phone: "",
    hours: "",
    lines: [],
    lat: 40.8128,
    lng: 44.4883,
  },
  {
    id: "dilijan",
    town: "Dilijan",
    shop: "",
    address: "12 Sharambeyan Street",
    placeholder: true,
    addressLat: 40.7397,
    addressLng: 44.8688,
    phone: "",
    hours: "",
    lines: [],
    lat: 40.7408,
    lng: 44.8636,
  },
  {
    id: "sevan",
    town: "Sevan",
    shop: "",
    address: "161 Nairyan Street",
    placeholder: true,
    addressLat: 40.54848,
    addressLng: 44.95898,
    phone: "",
    hours: "",
    lines: [],
    lat: 40.5486,
    lng: 44.9422,
  },
  {
    id: "ejmiatsin",
    town: "Vagharshapat",
    shop: "",
    address: "6 Mesrop Mashtots Street",
    placeholder: true,
    addressLat: 40.16405,
    addressLng: 44.29533,
    phone: "",
    hours: "",
    lines: [],
    lat: 40.1667,
    lng: 44.2919,
  },
];

export const stockistPage = {
  kicker: "(In person)",
  title: "FIND IT IN A SHOP",
  copy:
    "The series travels beyond this site: printed, painted and glazed pieces sit on shelves around Armenia. Confirmed shops are listed here with their address — the map marks the town.",
  /** shown while any town has no confirmed shop, so nobody sets off to look */
  pending:
    "Arpine is placing the work with shops now. The addresses below are examples on real streets, standing in until each shop is confirmed — please do not travel to one yet. The shop here posts anywhere in the meantime.",
  empty: "No shop confirmed in this town yet.",
  /** printed on the address line itself, in the accent that means "not yet" */
  addressPlaceholder: "example address, not confirmed",
  /** the same warning, short enough for a map pin */
  pinPlaceholder: "Example address — not confirmed",

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
  /** Where the door is, once she has confirmed one. Same rule as the outbound
   *  link: routing a stranger to an unconfirmed doorstep is the one thing this
   *  page must never do, so an unconfirmed town gets directions to the TOWN,
   *  which is all the country map ever claimed. */
  directions: "Directions to the door",
  directionsTown: "Directions to the town",
  /** The caveat travels WITH the text — someone pasting a stand-in address
   *  into a taxi app has left this page and its warnings behind. */
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
  /** Where the outbound link goes while nothing is confirmed. It opens on
   *  openstreetmap.org, where this page's "not confirmed" warning does not
   *  follow — so it may only ever offer what the country map already claims:
   *  the town. */
  townMap: "Open the town in a map",
  /** the address line's own pending state, so the row is never blank */
  noAddress: "To follow, once the shop is confirmed",
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
    // Arpine's own header for the series (Header - Text.txt, 2026-08-12)
    title: "A JOURNEY THROUGH ARMENIA",
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
    title: "EVERYTHING IN THE SHOP",
    copy: "Drag to spin it — or use the arrow keys. Every piece she sells, orbiting at once. Click one to bring it forward.",
    fallback: "Browse the shop",
    /** Said under the buy button rather than discovered on the next page.
     *  EVERY open category needs a choice before it can go in a basket —
     *  six of them need an illustration, and postcards, scarves and hoodies
     *  need a format, style or size — so there is no product on this site
     *  that can honestly be added in one click from here. The button opens
     *  the piece with its picker instead, which is what a variable product
     *  does in any serious shop. */
    buyNote: "You choose the illustration and the options on the product itself.",
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
    title: "FROM THE STUDIO",
    copy: "The same illustrations, set moving — short films by Arpine.",
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
    copy:
      "For a commission, a stockist enquiry, or a question about an order — send a message and Arpine will reply herself.",
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
export const morphs: Record<string, { intro: string; cue: string; title: string; copy: string }> = {
  postcards: {
    intro: "One country, ready to send.",
    cue: "Scroll",
    title: "Postcards",
    copy: "All fifty-seven illustrations of the Armenia series, as cards. Choose the ones to send below.",
  },
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
