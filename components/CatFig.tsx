import artworks from "@/lib/artworks.json";
import products from "@/lib/products.json";
import { covers, type Category } from "@/lib/content";

type Art = { id: string; src: string; thumb: string; w: number; h: number; avg: string };
type Shot = { id: string; src: string; thumb: string; w: number; h: number; alpha: boolean; avg: string };
const ART = artworks as Art[];
const P = products as Record<string, Shot[]>;

// ============================================================================
// The picture on a category card — shared by the home grid and /shop so the
// two can never drift apart.
//
// A line that has been photographed shows its photograph. A line that has NOT
// showed a grey box reading "Photographs coming", which looks like a broken
// image rather than a decision. It now shows the ARTWORK instead, tiled the way
// she prints it, because that part is real and finished: the designs exist, it
// is only the garment photography that does not. The label stays — this is not
// dressed up as a product shot — but the card is her work rather than a hole.
//
// The alternative was to borrow another line's photographs. That was declined:
// a card headed "Skirts" showing hoodies is a shop telling its buyers something
// untrue, and no amount of styling fixes that.
// ============================================================================

/** THE THUMBS' REAL WIDTHS, read off the files with sharp on 2026-10-07
 *  (imgss/mobile-2026-10-05/implement/P3-home-perf/thumbw.cjs) — not assumed:
 *  they run from 337px (3D stickers) to 700px. A card's picture offers its
 *  thumb and its full file and the browser picks by the card's width and
 *  the screen's density. Before, every card shipped the thumb alone, and on
 *  a phone the 3D stickers card drew a 337px file in a 354px box (soft at
 *  any density, synthesis/v3.json). A thumb missing here simply keeps its
 *  old single source. */
const THUMB_W: Record<string, number> = {
  "/products/tile-hoodies-sm.webp": 700,
  "/products/tile-scarves-sm.webp": 700,
  "/products/tile-postcards-sm.webp": 489,
  "/products/tile-totes-sm.webp": 544,
  "/products/tile-plates-sm.webp": 700,
  "/products/tile-cups-sm.webp": 666,
  "/products/tile-keychains-sm.webp": 583,
  "/products/tile-magnets-sm.webp": 467,
  "/products/tile-puzzles-sm.webp": 700,
  "/products/stickers-01-sm.webp": 553,
  "/products/sticker3d-01-sm.webp": 337,
  "/products/totes-01-sm.webp": 466,
  "/products/mugs-01-sm.webp": 690,
  "/products/plates-01-sm.webp": 700,
  "/products/puzzles-01-sm.webp": 700,
  "/products/postcards-01-sm.webp": 560,
  "/products/scarf-01-sm.webp": 700,
  "/products/apparel-01-sm.webp": 700,
  "/products/keychain-01-sm.webp": 247,
  "/products/magnet-01-sm.webp": 310,
};

/** A MIDDLE RUNG for the open lines whose thumb is short of a 2x phone
 *  (2026-10-05 repair, imgss/mobile-2026-10-05/repair/assets-md-tiles.cjs —
 *  sizes read off the written files). Without it a phone's one-column card
 *  (~686 device px at 390x844, DPR 2) jumped from the thumb to the master:
 *  tile-postcards.webp, 363 KB, was /shop's LCP image at DPR 2 and 3. The
 *  rung is 736px wide — the most a real phone asks for here: 729 on a
 *  414px DPR 2 screen (88vw), 710 on a 430px DPR 3 one under the 55vw said
 *  below — and weighs 218 KB for postcards (totes 44, keychains 92, magnets
 *  85 KB). */
const MID: Record<string, { src: string; w: number }> = {
  "/products/tile-postcards-sm.webp": { src: "/products/tile-postcards-md.webp", w: 736 },
  "/products/tile-totes-sm.webp": { src: "/products/tile-totes-md.webp", w: 736 },
  "/products/tile-keychains-sm.webp": { src: "/products/tile-keychains-md.webp", w: 736 },
  "/products/tile-magnets-sm.webp": { src: "/products/tile-magnets-md.webp", w: 736 },
};

/** THE MOVED LAYER'S OWN QUERY — the /shop strip runs exactly here
 *  (ShopStrip.tsx: DESKTOP and scripting), and it hides this grid. */
const STRIP_MEDIA = "(min-width: 861px) and (prefers-reduced-motion: no-preference) and (scripting: enabled)";
/** a 1x1 transparent GIF, inline: a <source> that costs no request */
const NOTHING = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

export default function CatFig({ cat, eager = false }: { cat: Category; eager?: boolean }) {
  // the client's own tile cover first (content.ts `covers`, 2026-09-15), so
  // the plain grid and the moved strip show the same picture
  const cover = covers[cat.slug];
  const shot = cover ?? P[cat.media]?.[0];
  // the NEXT photograph of the line, crossfaded in on hover — the card
  // itself answering "what else does it look like". Lines shot once simply
  // have no second layer; nothing is borrowed to fake one.
  const next = cover ? P[cat.media]?.[0] : P[cat.media]?.[1];

  if (shot) {
    const tw = THUMB_W[shot.thumb];
    const mid = MID[shot.thumb];
    const srcSet = tw ? [`${shot.thumb} ${tw}w`, mid && `${mid.src} ${mid.w}w`, `${shot.src} ${shot.w}w`].filter(Boolean).join(", ") : undefined;
    // A DENSE PHONE IS ASKED FOR ~2x, NOT 3x (2026-10-05 repair). The one
    // column under 595px is said as 55vw where the screen is 2.5dppx or more
    // (88vw elsewhere — see below), so an iPhone at DPR 3 takes the 736px
    // rung or a 700px thumb — 2.0–2.1x on the 354px card at 390, 1.8–1.9x
    // on the 391px one at 430 (55vw x 3 there is 710) — rather
    // than a 977–1,400px master for a third more sharpness nobody can see at
    // arm's length: at 390x844 DPR 3 the first card fetched tile-postcards
    // .webp (363 KB) as /shop's LCP image, and every scarf card its 1,400px
    // master. `sizes` only picks the file; the card's width is CSS's. A
    // browser that does not know `min-resolution` skips that entry and takes
    // the 88vw one — the old choice.
    const sizes = tw
      ? cat.status === "soon"
        ? "(max-width: 860px) 46vw, 320px"
        : "(max-width: 594px) and (min-resolution: 2.5dppx) 55vw, (max-width: 594px) 88vw, (max-width: 860px) 46vw, 320px"
      : undefined;
    const img = (
      <img
        src={shot.thumb}
        srcSet={srcSet}
        sizes={sizes}
        alt=""
        width={shot.w}
        height={shot.h}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
        decoding="async"
      />
    );
    return (
      <figure className="ap-cat__fig" style={{ background: shot.avg }}>
        {/* EAGER, HIGH PRIORITY for the first card on /shop (2026-10-05
            package): it is that page's LCP on a phone, and it was
            loading="lazy" with no priority — discovered only after layout,
            at "Low", behind the strip's hidden photographs (live LCP 7.9s).
            `sizes` is the card's width: one column under 595px (where the
            grid's auto-fill gives one), two from there to the breakpoint and
            for the paired "soon" cards, ~320px in the desktop grid. The one
            column is said as 88vw, 3% under the real 90.8vw: Chromium takes
            the first candidate dense enough for the screen, and the 700px
            thumbs measure 1.98x on a 2x phone at the exact width — so each
            card fetched its 1,400px file (2-4x the bytes) for 1% of
            sharpness (measured at 390x844, DPR 2). The thumbs that are truly
            short for a 2x screen (postcards 489, magnets 467, 3D stickers
            337 …) still get their full files — or, for four of them, the
            736px rung above (2026-10-05 repair).
            NOT ON THE DESKTOP, WHERE THE STRIP HIDES THIS GRID (2026-10-05
            repair). An eager image is fetched even inside display:none, and
            React hoisted it as <link rel=preload … fetchpriority=high>: at
            1440 /shop downloaded tile-postcards-sm.webp at High ahead of the
            strip's own pictures and Chrome warned on every load that the
            preload went unused. Inside a <picture> React hoists nothing, and
            where the strip runs (its exact query) the source is a 1x1 GIF
            inlined as data — no request, the ShopStrip pattern in reverse.
            Phones, reduced motion and no-JS match nothing and keep the eager
            high-priority card. display: contents so `.ap-cat__fig img` lays
            out exactly as before. */}
        {eager ? (
          <picture style={{ display: "contents" }}>
            <source media={STRIP_MEDIA} srcSet={NOTHING} />
            {img}
          </picture>
        ) : (
          img
        )}
        {next && (
          <img
            className="ap-cat__alt"
            src={next.thumb}
            alt=""
            aria-hidden="true"
            width={next.w}
            height={next.h}
            loading="lazy"
            decoding="async"
          />
        )}
      </figure>
    );
  }

  const tiles = (cat.swatch ?? []).map((id) => ART.find((a) => a.id === id)).filter((a): a is Art => !!a);

  return (
    <figure className="ap-cat__fig is-swatch" style={{ background: "var(--paper-3)" }}>
      {tiles.length > 0 && (
        <div className="ap-swatch" aria-hidden="true">
          {tiles.map((a) => (
            <span key={a.id} style={{ background: a.avg }}>
              <img src={a.thumb} alt="" width={a.w} height={a.h} loading="lazy" decoding="async" />
            </span>
          ))}
        </div>
      )}
      <figcaption className="ap-cat__await">
        <span>{tiles.length > 0 ? "The designs — photographs coming" : "Photographs coming"}</span>
      </figcaption>
    </figure>
  );
}
