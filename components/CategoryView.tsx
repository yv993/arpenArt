"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { add, dram } from "@/lib/cart";
import { flyToCart } from "@/lib/fly";
import { ordering, type Category } from "@/lib/content";
import artworks from "@/lib/artworks.json";
import products from "@/lib/products.json";
import MugPrint from "./MugPrint";
import CardPrint, { type Quad } from "./CardPrint";

type Art = { id: string; src: string; thumb: string; w: number; h: number; avg: string };
type Shot = { id: string; src: string; thumb: string; w: number; h: number; alpha: boolean; avg: string };
const ART = artworks as Art[];
const P = products as Record<string, Shot[]>;

/** Categories that own a BLANK photo of the object, so the chosen illustration
 *  can be shown printed on it. Only the mug has one so far — the others need
 *  the same treatment done to their photograph first (see
 *  scratchpad/blankmug.mjs: mask the print, dilate, diffuse the ceramic in).
 *  `box` is the print area as fractions of the photo, and the artwork is
 *  fitted INSIDE it preserving its own aspect. */
/** An object photographed BLANK, with one printable area on it. */
type ObjectMock = {
  blank: string;
  /** the printable area as fractions of the photo: x, y, w, h */
  box: [number, number, number, number];
  photo: [number, number];
  /** WHICH SURFACE. A mug wraps away from the camera and needs the
   *  sin-projection in MugPrint; a plate faces it and needs none — running the
   *  cylinder warp on a disc would squeeze the sides of a picture that is not
   *  curving away at all. Measured, not assumed: the plate object's bounding
   *  box is 1171x1154, a 1.5% ellipse, i.e. shot essentially head on. */
  kind: "cylinder" | "disc" | "puzzle";
  /** a transparent overlay laid over the print — the puzzle's cut */
  seams?: string;
  /** how much the disc is squashed vertically by the camera's angle */
  squash?: number;
};

/** EVERY PHOTOGRAPH THAT CAN CARRY THE PRINT, not just one.
 *
 *  The mug, the plate and the puzzle each have a single blank photograph, so
 *  one box was enough. The postcards are a whole roll of styled scenes, and
 *  the buyer expects the picture they chose to appear in WHICHEVER of them
 *  they are looking at (client 2026-08-12), with the photograph staying put.
 *  So the print is described per shot — and by four corners rather than a
 *  rectangle, because a card may be square on, rotated on a table, or
 *  receding with real perspective. */
type CardMock = {
  kind: "card";
  photo: [number, number];
  cards: CardShot[];
};

type Mock = ObjectMock | CardMock;

type CardShot = {
  /** index into the category's product photographs */
  at: number;
  /** the card's corners in PHOTO pixels, clockwise from the artwork's
   *  top-left — measured on the photograph, outer edge, never guessed */
  quad: Quad;
  /** the photograph's own pixel size, which the quad is expressed in */
  photo: [number, number];
  /** an RGBA cut-out of whatever lies in FRONT of the card in that
   *  photograph — a petal, a leaf, the lip of a pocket — laid back over the
   *  print so the scene keeps its depth */
  front?: string;
};

/** Every postcard photograph the print can be laid into, with the card's four
 *  corners measured on that photograph. Filled from a per-photo measuring
 *  pass — each quad was confirmed by painting it over the photo and looking
 *  at it, never by arithmetic alone. */
const CARD_SHOTS: CardShot[] = [
  // 0 — upright against the wall, a torn-edge ceramic vessel leaning over the
  // card's lower-left corner. Quad's own ratio came out 1.415 against A6's
  // 1.414, which is a good sign the corners are honest.
  {
    at: 0,
    quad: [
      [533.5, 814.6],
      [914.8, 817],
      [914.8, 1355],
      [532, 1355],
    ],
    photo: [1280, 1600],
    front: "/products/postcards-01-front.png",
  },
  // 1 — on the white podium, very slight keystone. The card's right side is
  // bordered by its own cast shadow: the quad stops short of it deliberately.
  {
    at: 1,
    quad: [
      [431.5, 536],
      [764, 540],
      [757, 1032],
      [428.5, 1028],
    ],
    photo: [1280, 1600],
  },
  // 2 — the stone and tulip scene, ~0.5deg of in-plane rotation. A red petal
  // rides over the bottom-right corner and is cut out to stay in front.
  {
    at: 2,
    quad: [
      [681.7, 940.1],
      [964.1, 942.7],
      [960.9, 1367.4],
      [676.3, 1365],
    ],
    photo: [1280, 1600],
    front: "/products/postcards-03-front.png",
  },
  // 3 — lying flat and rotated, scattered petals. Real perspective.
  {
    at: 3,
    quad: [
      [477.5, 362.8],
      [933.4, 467.6],
      [786.9, 1109.8],
      [332.5, 1009.2],
    ],
    photo: [1280, 1600],
  },
  // 4 — on grass, tilted away from the camera
  {
    at: 4,
    quad: [
      [361.3, 140.8],
      [849.2, 211.9],
      [746.6, 899.6],
      [258.2, 828.5],
    ],
    photo: [1600, 1067],
  },
  // 5 — leaning on the cloth, the strongest perspective in the roll
  {
    at: 5,
    quad: [
      [326, 506],
      [763, 594],
      [577, 1149],
      [83, 1030],
    ],
    photo: [1067, 1600],
  },
  // 6 — beside the kraft envelope, rotated ~7deg. THE CARD IS PHYSICALLY
  // BOWED: its right edge curves inward ~12px at mid-height and its left
  // bulges ~10px, so no straight-edged quad can trace it. The quad below is
  // therefore the smallest one that CONTAINS the card (original artwork
  // exposed nowhere), and the front plate clips the overhang back to the real
  // silhouette — the plate is load-bearing here, not decoration.
  {
    at: 6,
    quad: [
      [349.5, 226],
      [885, 159.75],
      [1013, 899.25],
      [458, 982.75],
    ],
    photo: [1600, 1067],
    front: "/products/postcards-07-front.png",
  },
  // 7 — angled on the blue ground beside the envelope
  {
    at: 7,
    quad: [
      [768.1, 564],
      [1247.4, 722.7],
      [1133.4, 1048.1],
      [638.8, 876.3],
    ],
    photo: [1600, 1275],
  },
  // 8 — tucked into the dungaree pocket: the pocket lip and the denim in
  // front of it are cut out, and the hidden corners are extrapolated from the
  // visible edges so the artwork sits INSIDE the pocket rather than over it
  // The card is a rotated rectangle (~30deg, no real perspective); its lower
  // half is inside the pocket, so the hidden corners are carried down from
  // the measured sides at A6's own ratio rather than invented.
  {
    at: 8,
    quad: [
      [953.1, 238.6],
      [1403.2, 499.2],
      [1038.9, 1137.9],
      [588.7, 877.3],
    ],
    photo: [1600, 1067],
    front: "/products/postcards-09-front.png",
  },
  // 9 — the painting scene; the brush and paint pot cross the card
  {
    at: 9,
    quad: [
      [362.4, 313.1],
      [832.5, 305.1],
      [842, 964.9],
      [376, 971.9],
    ],
    photo: [1600, 1067],
    front: "/products/postcards-10-front.png",
  },
  // 10 — the pair, front card angled to the right
  {
    at: 10,
    quad: [
      [865.1, 258.7],
      [1413.7, 452.6],
      [1283.5, 845.8],
      [729.8, 653.9],
    ],
    photo: [1600, 1067],
  },
];

const MOCKUPS: Record<string, Mock> = {
  cups: {
    blank: "/products/mugs-blank.webp",
    box: [0.1413, 0.335, 0.4804, 0.4794],
    // MugPrint's cylinder radius is written in these pixels, so the photo's
    // real size has to travel with the box
    photo: [1578, 1600],
    kind: "cylinder",
  },
  plates: {
    blank: "/products/plates-blank.webp",
    // The WELL, found by walking a radial luminance profile out from the
    // plate's alpha centroid (808,790): the well's edge is a shadow groove and
    // shows as a clear dip at r=403 (225 against 236 either side). The ink is
    // held to r=370 so it never runs into that groove.
    //
    // THE BOX IS THE LARGEST SQUARE THAT CIRCLE CONTAINS — side 2r/√2 = 523 —
    // not the circle's bounding box. The whole picture has to show, and any
    // picture fitted inside this square is inside the well whatever its shape,
    // which the bounding box could not promise: a portrait fitted to THAT
    // would have run past the rim top and bottom.
    box: [0.3415, 0.3303, 0.3271, 0.3271],
    photo: [1600, 1600],
    kind: "disc",
    squash: 0.9855, // 1154 / 1171, the plate's own ellipse
  },
  puzzles: {
    // NOTHING TO BLANK. Unlike the mug and the plate, the puzzle's object
    // bounding box and its printed area are the SAME box — the artwork covers
    // the whole board — so the photo itself is only ever the shadow and the
    // card edge, and the picture is drawn over all of it.
    blank: "/products/puzzles-01.webp",
    box: [0.295, 0.1903, 0.4106, 0.6167],
    photo: [1600, 1067],
    kind: "puzzle",
    // The cut, drawn on the grid MEASURED off the photograph: the darkness
    // sums peak at x 133/266/399/530 and y 129/263/394/528, a 5x5 board of
    // 131.4 x 131.6 pieces. Lifting the seams out of the photo instead was
    // tried four ways and cannot work — a seam's contrast depends on what is
    // printed either side of it, so where the illustration goes dark there is
    // no seam in the photograph to find, and any threshold loose enough to
    // catch the faint stretches also catches the picture and ghosts the old
    // artwork over every new one.
    seams: "/products/puzzle-seams.webp",
  },
  postcards: {
    // NO BLANK EXISTS, and none is needed: each card is covered edge to edge,
    // exactly like the puzzle board, and the photograph on screen is
    // whichever shot the buyer is already looking at.
    photo: [1280, 1600],
    kind: "card",
    // OUTER corners, and outer is the word that matters: the first cut took
    // the gradient PEAK on each side, but a peak sits in the MIDDLE of a soft
    // transition, so two pixels of the photographed card stayed visible and
    // read as a dirty border. Every quad below is walked out to the
    // neighbouring material instead, then confirmed by painting it over the
    // photograph and looking at it.
    cards: CARD_SHOTS,
  },
};

/** the print area, as the four custom properties the stylesheet positions from */
const boxVars = (b: [number, number, number, number]) =>
  ({
    "--bx": `${b[0] * 100}%`,
    "--by": `${b[1] * 100}%`,
    "--bw": `${b[2] * 100}%`,
    "--bh": `${b[3] * 100}%`,
  }) as React.CSSProperties;

/** Categories where the buyer picks which illustration goes on the thing. */
const CHOOSES_DESIGN = new Set(["postcards", "stickers", "cups", "plates", "puzzles", "totes"]);


/** The "how ordering works" strip. It lives here but renders on the cart page
 *  too — one component, so the two tellings of the flow can never drift. */
export function OrderingSteps() {
  return (
    <section className="ap-how">
      <h2 className="ap-how__title">{ordering.title}</h2>
      <ol className="ap-how__steps">
        {ordering.steps.map((s) => (
          <li key={s.k}>
            <strong>{s.k}</strong>
            <span>{s.v}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function CategoryView({
  cat,
  demoted = false,
}: {
  cat: Category;
  /** true when an <Overture> above already carries the page's h1 — two h1s on
   *  one page is legal HTML and a bad outline */
  demoted?: boolean;
}) {
  const shots = useMemo(() => P[cat.media] ?? [], [cat.media]);
  const [shot, setShot] = useState(0);
  const [art, setArt] = useState<string | null>(null);
  // default to the first option so a variant category can never be added
  // without one — the buyer changes it, they never have to find it
  const [variant, setVariant] = useState<string | undefined>(cat.variants?.options[0]);
  const [added, setAdded] = useState(false);
  /** set when Add was pressed before an illustration was chosen */
  const [need, setNeed] = useState(false);

  const picks = CHOOSES_DESIGN.has(cat.slug);
  /** A LIVE MOCKUP. Where a blank photo of the object exists, choosing an
   *  illustration prints it onto the thing rather than only ticking a box —
   *  which is the question a buyer is actually asking. The print area is a
   *  measured fraction of the photo (coloured-pixel bounding box on the
   *  original: 223,536 758x767 of 1578x1600), so it holds at any size. */
  const mock = MOCKUPS[cat.slug];
  const chosenArt = art ? ART.find((a) => a.id === art) : undefined;
  const hero = shots[shot];
  /** Which product shot carries the mockup. Mugs, plates and puzzles are
   *  photographed blank as shot 0; the postcard mockup is a styled scene
   *  further along the roll, so the index is part of the table. */
  /** The photograph on screen, when it is one the print can be laid into.
   *  Looked up per shot rather than pinned to one, so the buyer's choice
   *  follows them through the whole roll instead of yanking them to a fixed
   *  photograph (client 2026-08-12: "it must stay"). */
  const cardShot = mock?.kind === "card" ? mock.cards.find((c) => c.at === shot) : undefined;
  const onMock = !!mock && (mock.kind === "card" ? !!cardShot : shot === 0);
  // Every product shot's `thumb` is its -sm.webp sibling, resized to fit a
  // 700px box (verified against all 61 files in the manifest), so the width
  // descriptor below is derived from real pixels, not guessed.
  const heroSmW = hero ? Math.floor((hero.w / Math.max(hero.w, hero.h)) * 700) : 0;

  // the photograph the flight throws — the one the buyer is looking at
  const heroImg = useRef<HTMLImageElement | null>(null);
  const pickBox = useRef<HTMLDivElement | null>(null);

  const onAdd = () => {
    if (cat.status !== "open") return;
    // The button used to be DISABLED until an illustration was chosen, which
    // read as "add to cart is broken" on all six categories that carry the
    // picker. It is live now: pressing it with nothing chosen takes you to
    // the choice and says so, instead of doing nothing at all. No default
    // selection either — the artwork IS the product, so choosing one for
    // the buyer silently would be worse than asking.
    if (picks && !art) {
      setNeed(true);
      const box = pickBox.current;
      box?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "center",
      });
      box?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
      window.setTimeout(() => setNeed(false), 3000);
      return;
    }
    add(cat.slug, art ?? undefined, 1, variant);
    flyToCart(heroImg.current);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2600);
  };

  return (
    <div className="ap-cv">
      <nav className="ap-crumb" aria-label="Breadcrumb">
        <Link href="/shop">Shop</Link>
        <span aria-hidden>/</span>
        <span aria-current="page">{cat.name}</span>
      </nav>

      <div className="ap-cv__grid">
        {/* ---- media ---- */}
        <div className="ap-cv__media">
          {hero ? (
            <>
              <figure
                className="ap-cv__hero"
                style={
                  {
                    background: hero.avg,
                    // PER SHOT, not per category: this roll mixes portrait
                    // 1280x1600 scenes with landscape 1600x1067 ones, and a
                    // single ratio letterboxes the odd ones — which silently
                    // moves every measured corner, so the prints came out
                    // oversized and mis-angled until this was per shot.
                    ...(onMock
                      ? {
                          "--mock-ar": cardShot
                            ? `${cardShot.photo[0]} / ${cardShot.photo[1]}`
                            : `${mock.photo[0]} / ${mock.photo[1]}`,
                        }
                      : null),
                  } as React.CSSProperties
                }
                data-mock={onMock ? "" : undefined}
              >
                {/* srcSet lets a phone take the 700px -sm file instead of the
                    full master; sizes mirrors the real layout — one column
                    under 860px, a bit over half the viewport above it */}
                <img
                  ref={heroImg}
                  // ON THE FIRST SHOT OF A MOCKUP CATEGORY the photo is swapped
                  // for a BLANK one — the stock photo already carries a printed
                  // design, and laying a second illustration over it would just
                  // stack two pictures. The other shots are left alone: they are
                  // photographs of real pieces, not previews.
                  // THE CARD KIND KEEPS THE PHOTOGRAPH IT IS LOOKING AT. Only
                  // the blank-object kinds swap the shot for their unprinted
                  // photograph; a postcard scene IS the photograph, and the
                  // print goes into it.
                  src={onMock && mock.kind !== "card" ? mock.blank : hero.src}
                  srcSet={
                    onMock && mock.kind !== "card"
                      ? undefined
                      : `${hero.thumb} ${heroSmW}w, ${hero.src} ${hero.w}w`
                  }
                  sizes="(max-width: 860px) 92vw, 50vw"
                  alt={
                    onMock && chosenArt
                      ? `${cat.name} — illustration no. ${chosenArt.id} by Arpine Baroyan`
                      : `${cat.name} by ${"Arpine Baroyan"}`
                  }
                  width={hero.w}
                  height={hero.h}
                  decoding="async"
                />
                {/* THE CHOSEN ILLUSTRATION, PRINTED. Positioned in percentages
                    of the photo, from the print area measured on the original
                    (a coloured-pixel bounding box at 223,536 758x767 of
                    1578x1600), so it lands on the mug at any rendered size.
                    `multiply` seats it into the ceramic's own shading instead
                    of floating a rectangle on top of it. */}
                {onMock && chosenArt &&
                  (mock.kind === "card" && cardShot ? (
                    // THE CARD'S FOUR MEASURED CORNERS, not a rectangle: in
                    // this roll a card may stand square on, lie rotated on a
                    // table, or recede with real perspective, and CardPrint
                    // maps the artwork onto whichever it is. Anything nearer
                    // the camera than the card — a petal across a corner —
                    // is laid back on top so the scene keeps its depth.
                    <CardPrint
                      src={chosenArt.src}
                      quad={cardShot.quad}
                      photo={cardShot.photo}
                      occluder={cardShot.front}
                    />
                  ) : mock.kind === "cylinder" ? (
                    <MugPrint src={chosenArt.thumb} box={mock.box} photo={mock.photo} />
                  ) : mock.kind === "puzzle" ? (
                    // THE BOARD IS SQUARE AND THE ILLUSTRATIONS ARE PORTRAIT,
                    // so `cover` — the centre of the picture is what gets cut
                    // into pieces, which is what the buyer is choosing.
                    <>
                      <img
                        className="ap-cv__print ap-cv__print--puzzle"
                        src={chosenArt.src}
                        alt=""
                        aria-hidden="true"
                        decoding="async"
                        style={boxVars(mock.box)}
                      />
                      <img
                        className="ap-cv__print ap-cv__seams"
                        src={mock.seams}
                        alt=""
                        aria-hidden="true"
                        decoding="async"
                        style={boxVars(mock.box)}
                      />
                    </>
                  ) : mock.kind === "disc" ? (
                    // A DISC NEEDS NO CANVAS. The plate faces the camera, so
                    // there is nothing to project — the work is a round crop
                    // (`cover`, so a portrait illustration FILLS the well
                    // rather than sitting in it as a rectangle) and the tiny
                    // ellipse the camera angle gives.
                    <img
                      className="ap-cv__print ap-cv__print--disc"
                      src={chosenArt.src}
                      alt=""
                      aria-hidden="true"
                      decoding="async"
                      style={
                        {
                          "--bx": `${mock.box[0] * 100}%`,
                          "--by": `${mock.box[1] * 100}%`,
                          "--bw": `${mock.box[2] * 100}%`,
                          "--bh": `${mock.box[3] * 100}%`,
                          "--squash": mock.squash ?? 1,
                        } as React.CSSProperties
                      }
                    />
                  ) : null)}
              </figure>
              {shots.length > 1 && (
                <ul className="ap-cv__thumbs">
                  {shots.map((s, i) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        aria-label={`View ${i + 1} of ${shots.length}`}
                        aria-pressed={i === shot}
                        className={i === shot ? "on" : ""}
                        onClick={() => setShot(i)}
                        style={{ background: s.avg }}
                      >
                        <img src={s.thumb} alt="" width={s.w} height={s.h} loading="lazy" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className="ap-cv__await">
              <p>Photographs of this line are being shot now.</p>
            </div>
          )}
        </div>

        {/* ---- buy ---- */}
        <div className="ap-cv__say">
          {demoted ? (
            <h2 className="ap-h2" data-tfx="rise">
              {cat.name}
            </h2>
          ) : (
            <h1 className="ap-h2" data-tfx="rise">
              {cat.name}
            </h1>
          )}
          <p className="ap-lede">{cat.blurb}</p>

          {cat.status === "open" ? (
            <p className="ap-cv__price">
              from <strong>{dram(cat.from)}</strong>
            </p>
          ) : (
            <p className="ap-cv__price is-soon">Coming soon</p>
          )}

          {picks && cat.status === "open" && (
            <div className="ap-pick" ref={pickBox} data-need={need || undefined}>
              <p className="ap-pick__lab" id="ap-pick-lab">
                {/* the requirement is stated here from the start, not only
                    after a press that seemed to do nothing */}
                {art ? `Choose an illustration — no. ${art}` : "Choose an illustration — required"}
              </p>
              {/* plain buttons with aria-pressed, the same grammar as the shot
                  thumbnails above — listbox/option needs arrow-key management
                  this grid never had, so claiming the role only misled AT */}
              <ul className="ap-pick__grid" aria-labelledby="ap-pick-lab">
                {ART.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      aria-pressed={art === a.id}
                      aria-label={`Illustration number ${a.id}`}
                      className={art === a.id ? "on" : ""}
                      // THE PHOTOGRAPH STAYS PUT (client 2026-08-12: "it must
                      // stay"). An earlier cut jumped to the one shot that
                      // carried the mockup, which yanked the frame out from
                      // under whoever was looking at another scene. Every
                      // usable photograph now carries the print instead, so
                      // the choice simply appears wherever the buyer already is.
                      onClick={() => setArt(a.id)}
                      style={{ background: a.avg }}
                    >
                      <img src={a.thumb} alt="" width={a.w} height={a.h} loading="lazy" decoding="async" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {cat.variants && cat.status === "open" && (
            <div className="ap-var" role="group" aria-labelledby="ap-var-lab">
              <p className="ap-pick__lab" id="ap-var-lab">
                {cat.variants.label}
                {variant ? ` — ${variant}` : ""}
              </p>
              <div className="ap-var__row">
                {cat.variants.options.map((o) => (
                  <button
                    key={o}
                    type="button"
                    aria-pressed={variant === o}
                    className={variant === o ? "on" : ""}
                    onClick={() => setVariant(o)}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="ap-cv__act">
            <button
              type="button"
              className="ap-btn"
              onClick={onAdd}
              disabled={cat.status !== "open"}
              aria-describedby={picks && cat.status === "open" && !art ? "ap-pick-lab" : undefined}
            >
              {cat.status === "open" ? "Add to cart" : "Not yet available"}
            </button>
            {picks && cat.status === "open" && !art && (
              <p className="ap-cv__hint" role={need ? "alert" : undefined}>
                {need ? "Choose one of the 57 illustrations above, then add it." : "Pick an illustration first."}
              </p>
            )}
            <p className="ap-cv__added" role="status">
              {added ? "Added to your cart." : ""}
            </p>
          </div>

          {cat.status === "open" && <OrderingSteps />}

          <dl className="ap-cv__spec">
            <div>
              <dt>Made by</dt>
              <dd>Arpine Baroyan, in Yerevan</dd>
            </div>
            <div>
              <dt>Artwork</dt>
              <dd>Original illustration from the Armenia series</dd>
            </div>
            {/* the per-category facts from content.ts — each one either
                already stated elsewhere on the site or a process truth */}
            {cat.spec?.map((s) => (
              <div key={s.k}>
                <dt>{s.k}</dt>
                <dd>{s.v}</dd>
              </div>
            ))}
            <div>
              <dt>Prices</dt>
              <dd>Shown before shipping. Final figures confirmed on the order.</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
