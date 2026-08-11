"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { add, dram } from "@/lib/cart";
import { flyToCart } from "@/lib/fly";
import { ordering, type Category } from "@/lib/content";
import artworks from "@/lib/artworks.json";
import products from "@/lib/products.json";
import MugPrint from "./MugPrint";

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
type Mock = {
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
                    ...(mock && shot === 0 ? { "--mock-ar": `${mock.photo[0]} / ${mock.photo[1]}` } : null),
                  } as React.CSSProperties
                }
                data-mock={mock && shot === 0 ? "" : undefined}
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
                  src={mock && shot === 0 ? mock.blank : hero.src}
                  srcSet={mock && shot === 0 ? undefined : `${hero.thumb} ${heroSmW}w, ${hero.src} ${hero.w}w`}
                  sizes="(max-width: 860px) 92vw, 50vw"
                  alt={`${cat.name} by ${"Arpine Baroyan"}`}
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
                {mock && shot === 0 && chosenArt &&
                  (mock.kind === "cylinder" ? (
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
                  ) : (
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
                  ))}
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
