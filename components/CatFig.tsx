import artworks from "@/lib/artworks.json";
import products from "@/lib/products.json";
import type { Category } from "@/lib/content";

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

export default function CatFig({ cat }: { cat: Category }) {
  const shot = P[cat.media]?.[0];
  // the NEXT photograph of the line, crossfaded in on hover — the card
  // itself answering "what else does it look like". Lines shot once simply
  // have no second layer; nothing is borrowed to fake one.
  const next = P[cat.media]?.[1];

  if (shot) {
    return (
      <figure className="ap-cat__fig" style={{ background: shot.avg }}>
        <img src={shot.thumb} alt="" width={shot.w} height={shot.h} loading="lazy" decoding="async" />
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
