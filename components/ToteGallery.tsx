import { toteBags } from "@/lib/content";

// ============================================================================
// TOTE GALLERY — the four designs in a row; the one you point at opens and the
// others give way.
//
// The anatomy is shadcnblocks' "gallery1", which the client sent (2026-08-24):
// a static row of cards, the active one expanding to about 60% while the rest
// shrink, rounded corners, a dark plate with a gradient fade at the foot
// carrying badges and a title, and a stack on small screens with the
// expand/shrink dropped.
//
// TWO DEPARTURES, both because the original is a React component and this does
// not need to be one:
//
// 1. NO JAVASCRIPT. gallery1 drives the expansion from React state; here it is
//    two CSS rules — the ROW being hovered shrinks every card, and the card
//    being hovered grows. `:focus-within` gives the keyboard the same thing.
//    So this is a server component, ships nothing, and a card still opens if
//    the page's JS never arrives. (ShopStrip does the same trick with GSAP
//    because it also has to drive veils and a lightbox from an index; there is
//    nothing here that needs to know which card is open.)
//
// 2. THE EXPANSION REVEALS THE SECOND PHOTOGRAPH. Every design came with two:
//    the bag held up against the mountains, where the printed grid can be
//    read, and the same bag carried. Collapsed, a card is narrow and the
//    product shot is what survives the crop; opened, it cross-fades to the
//    carried one. Both of her photographs get used, and the reveal says
//    something rather than just being bigger.
// ============================================================================

export type ToteShot = {
  id: string;
  src: string;
  thumb: string;
  worn: string;
  wornThumb: string;
  w: number;
  h: number;
  avg: string;
};

export default function ToteGallery({ shots, heading = "h2" }: { shots: ToteShot[]; heading?: "h1" | "h2" }) {
  if (!shots.length) return null;
  // the gallery opens /shop/totes, so there it carries the page's h1 and the
  // buy panel under it steps down to h2 (the audit read h2 → h1 → h2)
  const H = heading;

  return (
    <section className="ap-tg" aria-label={toteBags.title}>
      <div className="ap-tg__head">
        <p className="ap-kicker">{toteBags.kicker}</p>
        <H className="ap-h2" data-tfx="rise">
          {toteBags.title}
        </H>
        {toteBags.copy.map((t) => (
          <p className="ap-lede" key={t}>
            {t}
          </p>
        ))}
      </div>

      <ul className="ap-tg__row">
        {shots.map((s, i) => (
          <li className="ap-tg__card" key={s.id} style={{ background: s.avg }}>
            {/* A card is a real control so it can be reached by keyboard —
                `:focus-within` opens it exactly as hover does. It opens a
                picture rather than navigating: the buy panel is further down
                this same page, so sending anyone away from it would be
                taking them backwards. */}
            <button type="button" aria-label={`Tote bag no. ${s.id} — see it carried`}>
              <span className="ap-tg__shots">
                <img
                  className="ap-tg__hold"
                  src={s.thumb}
                  srcSet={`${s.thumb} 700w, ${s.src} 1400w`}
                  sizes="(max-width: 860px) 100vw, 60vw"
                  alt={`Tote bag no. ${s.id}, printed with Arpine Baroyan's Armenia stamp grid`}
                  width={s.w}
                  height={s.h}
                  loading={i < 2 ? undefined : "lazy"}
                  decoding="async"
                />
                {/* the reveal. alt="" on purpose: it is the SAME bag, and a
                    screen reader gains nothing from hearing it described twice */}
                <img
                  className="ap-tg__worn"
                  src={s.wornThumb}
                  srcSet={`${s.wornThumb} 700w, ${s.worn} 1400w`}
                  sizes="(max-width: 860px) 100vw, 60vw"
                  alt=""
                  width={s.w}
                  height={s.h}
                  loading="lazy"
                  decoding="async"
                  aria-hidden="true"
                />
              </span>

              <span className="ap-tg__say">
                <span className="ap-tg__badges">
                  {toteBags.badges.map((b) => (
                    <span key={b}>{b}</span>
                  ))}
                </span>
                <strong>No. {s.id}</strong>
                <em>{toteBags.series}</em>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="ap-tg__cue" aria-hidden>
        {toteBags.cue}
      </p>
    </section>
  );
}
