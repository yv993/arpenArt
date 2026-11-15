"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { armeniaEternal as T, ETERNAL, eternalKinds, isSoldOut, priceTbc, type EternalKind } from "@/lib/content";
import { add, dram, priceText, unitOf } from "@/lib/cart";
import { flyToCart } from "@/lib/fly";
import { FX_MEDIA } from "@/lib/textfx";
import FlipCard from "./FlipCard";
import PhotoLightbox from "./PhotoLightbox";

// ============================================================================
// ARMENIA ETERNAL — /armenia-eternal (client, change 5.pdf p9 + p10,
// 2026-11-04: «շատ կարևոր ա, որ էս բաժինը սիրուն սարքենք» — it is very
// important to make this section beautiful; «դու կարաս ազատ
// ստեղծագործես, ոնց լինի, կարևորը նույն ֆոնտեր, գույների մեջ լինի» — create
// freely, what matters is that it stays in the same fonts and colours).
//
// A PAGE LIKE A MANUSCRIPT LEAF, in the site's own type and colour: her
// title large in the display face beside her A6 card no. 01 (which carries
// her own «Armenia Eternal» lettering), her bird — cut from her runner — as
// the ornament between the parts, her two paragraphs in a centred column
// opening on a painted initial, then her pieces, grouped the way her Drive
// folders group them, and her closing line at the foot like a colophon.
// Every sentence on the page is hers (content.ts `armeniaEternal`); group
// names, numbers and buttons are the interface's.
//
// THE GROUPS. Square and A6 postcards are double-sided, so each card turns
// over to its own back (FlipCard: a resting mouse previews, a click, tap or
// key keeps it turned). The scarves stand beside her photograph of one worn,
// each print opening large in the shared lightbox. The runners are 1:5.5, so
// each card shows the top of its strip and opens the whole length in a
// window (the totes' window shell). Rows on a desktop; on a phone each group
// is a rail that swipes sideways, snapping card by card (eternal.css).
//
// THE CART. One own-item line, `armenia-eternal`: `art` is the piece id
// (sq03), `variant` its kind (Square postcard), both set here — the buyer
// never chooses the kind. Every kind is unpriced today («Price confirmed by
// Arpine», content.ts `priceTbc`), so the line stays out of every total; the
// price shown per group is read the cart's way (lib/cart.ts unitOf), so when
// she prices a kind the page, the cart and /api/order follow together.
//
// MOTION. The h1 rises through the shared TextFX runner (the page mounts it
// last). The paragraphs marked data-rise lift in as they come into view, on
// the moved layer only (FX_MEDIA: desktop, full motion) — the same gate as
// the title, so the plain layer, phones and reduced motion read a page that
// simply stands.
// ============================================================================

export type EternalFace = { src: string; thumb: string; w: number; h: number; thumbW?: number; avg: string };
export type EternalPiece = EternalFace & {
  id: string;
  kind: EternalKind;
  back?: EternalFace;
  strip?: { src: string; sm: string; w: number; h: number; smW: number };
};
export type EternalExtra = { id: string; src: string; thumb?: string; w: number; h: number; thumbW?: number; avg?: string };

const KINDS: EternalKind[] = ["sq", "a6", "sc", "ru"];
/** the printed piece's ratio — the faces are cut to it */
const RATIO: Record<"sq" | "a6", string> = { sq: "1 / 1", a6: "621 / 875" };
/** a card's width: four across the desktop column, most of the phone's width
 *  in a rail — the -sm (320 / 360 px) at 1x, the master at 2x */
const SIZES: Record<EternalKind, string> = {
  sq: "(max-width: 860px) 66vw, 260px",
  a6: "(max-width: 860px) 60vw, 260px",
  sc: "(max-width: 860px) 70vw, 300px",
  ru: "(max-width: 860px) 40vw, 240px",
};
const STRIP_SIZES = "(max-width: 600px) 72vw, 360px";

const set = (f: { src: string; thumb: string; w: number; thumbW?: number }) =>
  f.thumbW ? `${f.thumb} ${f.thumbW}w, ${f.src} ${f.w}w` : undefined;
const nameOf = (p: Pick<EternalPiece, "kind" | "id">) => `${eternalKinds[p.kind].one} no. ${p.id.slice(2)}`;

export default function EternalView({
  pieces,
  extra,
}: {
  pieces: EternalPiece[];
  extra: EternalExtra[];
}) {
  const root = useRef<HTMLElement | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const addedTimer = useRef(0);
  /** the scarf print open large (an index into the scarves), or none */
  const [big, setBig] = useState<number | null>(null);
  const bigOpener = useRef<HTMLElement | null>(null);
  /** the runner open whole, or none */
  const [strip, setStrip] = useState<EternalPiece | null>(null);
  const stripOpener = useRef<HTMLElement | null>(null);
  const stripBox = useRef<HTMLDivElement | null>(null);
  const stripClose = useRef<HTMLButtonElement | null>(null);
  /** whether the press in flight BEGAN on the veil (the totes' rule) */
  const veilPress = useRef(false);

  const bird = extra.find((e) => e.id === "bird");
  const worn = extra.find((e) => e.id === "worn");
  const table = extra.find((e) => e.id === "table");
  const of = (k: EternalKind) => pieces.filter((p) => p.kind === k);
  const scarves = of("sc");
  const hero = pieces.find((p) => p.id === "a601");
  const heroBack = pieces.find((p) => p.id === "sq01");

  useEffect(() => () => window.clearTimeout(addedTimer.current), []);

  // ---- the paragraphs lift in (the moved layer only) --------------------------
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add(FX_MEDIA, () => {
      el.querySelectorAll<HTMLElement>("[data-rise]").forEach((n, i) => {
        // a paragraph already on screen when this runs stays where it is:
        // hiding it now to lift it in would take away words being read (at
        // 1440x900 her first paragraph's top line shows under the bird).
        // The subtitle is the exception — it rises with the title, whose
        // letters the TextFX runner hides at this same moment.
        if (!n.classList.contains("ap-ae__sub") && n.getBoundingClientRect().top < window.innerHeight) return;
        gsap.from(n, {
          y: 26,
          autoAlpha: 0,
          duration: 0.9,
          // the subtitle follows the title's own rise by a beat
          delay: n.classList.contains("ap-ae__sub") ? 0.35 : i % 2 ? 0.08 : 0,
          ease: "power3.out",
          scrollTrigger: { trigger: n, start: "top 90%", toggleActions: "play none none none" },
        });
      });
    });
    return () => mm.revert();
  }, []);

  // ---- her two paragraphs show once the fonts are in (eternal.css: the
  // painted initial re-wraps three lines when its face arrives) -------------
  useEffect(() => {
    const folio = root.current?.querySelector<HTMLElement>(".ap-ae__folio");
    if (!folio) return;
    let live = true;
    const show = () => {
      if (live) folio.dataset.set = "";
    };
    (document.fonts?.ready ?? Promise.resolve()).then(show, show);
    return () => {
      live = false;
    };
  }, []);

  // ---- a rail brings the piece the keyboard reaches into view ------------------
  // Measured at 390: Tab onto the next piece of a rail, whose edge already
  // showed, did not scroll it in — the browser counts a partly visible
  // element as seen, so the piece and its focus ring sat 70% off the screen.
  // Keyboard focus only (:focus-visible): a tap on the peeking piece turns
  // it and leaves the rail where the finger put it.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onFocus = (e: FocusEvent) => {
      const t = e.target as HTMLElement;
      const rail = t.closest<HTMLElement>(".ap-ae__rail");
      const li = t.closest<HTMLElement>(".ap-ae__rail > li");
      if (!rail || !li || rail.scrollWidth <= rail.clientWidth + 1) return;
      // an engine that does not know :focus-visible throws on the selector;
      // there every focus counts as the keyboard's
      let keyboard = true;
      try {
        keyboard = t.matches(":focus-visible");
      } catch {}
      if (!keyboard) return;
      const r = rail.getBoundingClientRect();
      const l = li.getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(rail).scrollPaddingLeft) || 0;
      if (l.left >= r.left + pad - 1 && l.right <= r.right + 1) return;
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      rail.scrollTo({ left: rail.scrollLeft + (l.left - r.left - pad), behavior: calm ? "auto" : "smooth" });
    };
    el.addEventListener("focusin", onFocus);
    return () => el.removeEventListener("focusin", onFocus);
  }, []);

  const buy = (p: EternalPiece, from?: HTMLElement | null) => {
    // add() refuses a sold-out piece (lib/cart.ts) — no flight, no "Added"
    if (!add(ETERNAL, p.id, 1, eternalKinds[p.kind].one)) return;
    flyToCart(from ?? null);
    setAdded(p.id);
    // supersede, never stack (the magnets' rule)
    window.clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => setAdded((a) => (a === p.id ? null : a)), 2600);
  };
  /** the picture of this piece that is on screen, for the flight */
  const faceOf = (btn: HTMLElement) => {
    const li = btn.closest("li");
    const flip = li?.querySelector<HTMLElement>(".ap-flip");
    if (flip) return flip.querySelector<HTMLImageElement>(flip.hasAttribute("data-back") ? ".ap-flip__face--back" : ".ap-flip__face--front");
    return li?.querySelector<HTMLImageElement>("img") ?? null;
  };

  // ---- the runner's window: the totes' open-once work -------------------------
  const closeStrip = useCallback(() => {
    setStrip(null);
    stripOpener.current?.focus?.();
  }, []);
  useEffect(() => {
    if (!strip) return;
    stripClose.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeStrip();
        return;
      }
      if (e.key !== "Tab" || !stripBox.current) return;
      const stops = Array.from(
        stripBox.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'),
      );
      if (!stops.length) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const at = document.activeElement;
      const outside = !stripBox.current.contains(at);
      if (e.shiftKey ? at === first || outside : at === last || outside) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [strip, closeStrip]);

  /** the price a group says once for all its pieces: today «Price confirmed
   *  by Arpine» for every kind */
  const priceLine = (k: EternalKind) => {
    const n = unitOf({ cat: ETERNAL, variant: eternalKinds[k].one });
    return n === null ? (
      priceTbc
    ) : (
      <>
        <strong>{dram(n)}</strong> {T.each}
      </>
    );
  };

  /** a piece's number and its button, under its picture */
  const buyRow = (p: EternalPiece) => {
    const sold = isSoldOut(ETERNAL, p.id, eternalKinds[p.kind].one);
    const name = nameOf(p);
    return (
      <div className="ap-ae__buy">
        <p className="ap-ae__no">{T.item(p.id.slice(2))}</p>
        {/* the piece rides in the button's NAME after the visible words, as on
            the magnets and bookmarks: seventeen «Add to cart» in a screen
            reader's list of buttons must be told apart */}
        <button
          type="button"
          className="ap-btn is-ghost ap-ae__add"
          onClick={(e) => buy(p, faceOf(e.currentTarget))}
          disabled={sold}
          data-sold={sold || undefined}
        >
          {sold ? "Sold out" : T.add}
          <span className="ap-sr">: {name}</span>
        </button>
        <p className="ap-ae__added" role="status">
          {added === p.id ? T.added : ""}
        </p>
      </div>
    );
  };

  const ornament = (cls = "") =>
    bird ? (
      <div className={`ap-ae__orn${cls}`} aria-hidden="true">
        <span />
        <img src={bird.src} alt="" width={bird.w} height={bird.h} loading="lazy" decoding="async" />
        <span />
      </div>
    ) : null;

  return (
    <article className="ap-ae" ref={root} aria-labelledby="ap-ae-title">
      {/* ---- the title, and her card beside it ------------------------------ */}
      <header className="ap-ae__hero">
        <div className="ap-ae__say">
          <h1 className="ap-ae__title" id="ap-ae-title" data-tfx="rise">
            {T.title}
          </h1>
          <p className="ap-ae__sub" data-rise>
            {T.sub}
          </p>
        </div>
        {hero && (
          <figure className="ap-ae__fig">
            {/* her square card no. 01 behind, her A6 card no. 01 in front:
                the two forms of the postcards, laid down like a still life.
                The A6 card's alt names it; the square is decoration here —
                both are in their groups below with their own names */}
            {heroBack && (
              <img
                className="ap-ae__card ap-ae__card--sq"
                src={heroBack.thumb}
                srcSet={set(heroBack)}
                sizes="(max-width: 860px) 40vw, 220px"
                alt=""
                width={heroBack.w}
                height={heroBack.h}
                decoding="async"
                style={{ background: heroBack.avg }}
              />
            )}
            <img
              className="ap-ae__card ap-ae__card--a6"
              src={hero.thumb}
              srcSet={set(hero)}
              sizes="(max-width: 860px) 52vw, 290px"
              alt={`${nameOf(hero)} from Armenia Eternal, by Arpine Baroyan`}
              width={hero.w}
              height={hero.h}
              fetchPriority="high"
              decoding="async"
              style={{ background: hero.avg }}
            />
          </figure>
        )}
      </header>

      {ornament()}

      {/* ---- her two paragraphs, a manuscript column ----------------------- */}
      <div className="ap-ae__folio">
        {T.body.map((p) => (
          <p key={p.slice(0, 24)} data-rise>
            {p}
          </p>
        ))}
      </div>

      {/* her sentence on the forms, which the groups below answer */}
      <p className="ap-ae__forms" data-rise>
        {T.forms}
      </p>

      {/* ---- the pieces, by her folders ----------------------------------------- */}
      {KINDS.map((k) => {
        const list = of(k);
        if (!list.length) return null;
        const scene = k === "sc" ? worn : k === "ru" ? table : undefined;
        const sceneAlt = k === "sc" ? T.alt.worn : T.alt.table;
        return (
          <section className="ap-ae__group" data-kind={k} key={k} aria-labelledby={`ap-ae-g-${k}`}>
            <div className="ap-ae__ghead">
              <h2 className="ap-ae__gtitle" id={`ap-ae-g-${k}`}>
                {eternalKinds[k].many}
              </h2>
              <p className="ap-ae__gprice">{priceLine(k)}</p>
            </div>

            <div className="ap-ae__gbody">
              {scene && (
                <figure className={`ap-ae__scene ap-ae__scene--${k}`} style={{ background: scene.avg }}>
                  <img
                    src={scene.thumb ?? scene.src}
                    srcSet={scene.thumb && scene.thumbW ? `${scene.thumb} ${scene.thumbW}w, ${scene.src} ${scene.w}w` : undefined}
                    sizes={k === "sc" ? "(max-width: 860px) 88vw, 420px" : "(max-width: 860px) 88vw, 560px"}
                    alt={sceneAlt}
                    width={scene.w}
                    height={scene.h}
                    loading="lazy"
                    decoding="async"
                  />
                </figure>
              )}

              <ul className="ap-ae__rail">
                {list.map((p, i) => {
                  const name = nameOf(p);
                  if ((k === "sq" || k === "a6") && p.back) {
                    return (
                      <li key={p.id}>
                        <FlipCard
                          front={{ src: p.thumb, srcSet: set(p), w: p.w, h: p.h, alt: `${name}, the front` }}
                          back={{ src: p.back.thumb, srcSet: set(p.back), w: p.back.w, h: p.back.h, alt: `${name}, the back` }}
                          ratio={RATIO[k]}
                          sizes={SIZES[k]}
                          avg={p.avg}
                          name={`${name}: ${T.turn}`}
                          className="ap-ae__flip"
                        />
                        {buyRow(p)}
                      </li>
                    );
                  }
                  if (k === "sc") {
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="ap-ae__open ap-ae__open--sc"
                          aria-haspopup="dialog"
                          aria-label={`${name} — ${T.larger}`}
                          onClick={(e) => {
                            bigOpener.current = e.currentTarget;
                            setBig(i);
                          }}
                          style={{ background: p.avg }}
                        >
                          <img
                            src={p.thumb}
                            srcSet={set(p)}
                            sizes={SIZES.sc}
                            alt={`${name} from Armenia Eternal, by Arpine Baroyan`}
                            width={p.w}
                            height={p.h}
                            loading="lazy"
                            decoding="async"
                          />
                        </button>
                        {buyRow(p)}
                      </li>
                    );
                  }
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="ap-ae__open ap-ae__open--ru"
                        aria-haspopup="dialog"
                        aria-label={`${name} — ${T.whole.toLowerCase()}`}
                        onClick={(e) => {
                          stripOpener.current = e.currentTarget;
                          setAdded(null);
                          setStrip(p);
                        }}
                        style={{ background: p.avg }}
                      >
                        <img
                          src={p.thumb}
                          srcSet={set(p)}
                          sizes={SIZES.ru}
                          alt={`${name} from Armenia Eternal, by Arpine Baroyan: the top of the runner`}
                          width={p.w}
                          height={p.h}
                          loading="lazy"
                          decoding="async"
                        />
                        <span className="ap-ae__whole" aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <path d="M12 3v18M7 8l5-5 5 5M7 16l5 5 5-5" />
                          </svg>
                          {T.whole}
                        </span>
                      </button>
                      {buyRow(p)}
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        );
      })}

      {ornament(" ap-ae__orn--end")}
      <p className="ap-ae__close" data-rise>
        {T.close}
      </p>

      {/* ---- a scarf's print, large: the shared lightbox ------------------------ */}
      {big !== null && scarves[big] && (
        <PhotoLightbox
          shots={scarves.map((s) => ({ id: s.id, src: s.src, w: s.w, h: s.h }))}
          i={big}
          onIndex={(n) => setBig(n)}
          onClose={() => setBig(null)}
          opener={bigOpener.current}
          label={`${nameOf(scarves[big])} — ${T.title}`}
          alt={(n) => `${nameOf(scarves[n])} from Armenia Eternal, by Arpine Baroyan`}
          footer={(() => {
            const p = scarves[big];
            const sold = isSoldOut(ETERNAL, p.id, eternalKinds.sc.one);
            return (
              <button
                type="button"
                className="ap-btn"
                onClick={() => {
                  if (!sold) buy(p, document.querySelector<HTMLImageElement>(".ap-xg__stage img"));
                }}
                data-sold={sold || undefined}
                aria-disabled={sold || undefined}
              >
                {sold ? "Sold out" : added === p.id ? T.added : `${T.add} — ${priceText(unitOf({ cat: ETERNAL, variant: eternalKinds.sc.one }))}`}
                <span className="ap-sr">: {nameOf(p)}</span>
              </button>
            );
          })()}
        />
      )}

      {/* ---- a runner, whole: the totes' window shell ---------------------------- */}
      {strip?.strip && (
        // THE VEIL CLOSES IT — on a press that both began AND ended on the
        // veil (ToteGallery.tsx: a drag that started inside the box and was
        // let go on the veil must not take the window away)
        <div
          className="ap-tgq ap-aeq"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ap-aeq-title"
          onPointerDown={(e) => {
            veilPress.current = e.target === e.currentTarget;
          }}
          onClick={(e) => {
            if (veilPress.current && e.target === e.currentTarget) closeStrip();
            veilPress.current = false;
          }}
        >
          <div className="ap-tgq__box ap-aeq__box" ref={stripBox}>
            <div className="ap-tgq__top">
              <div>
                <p className="ap-kicker">{T.title}</p>
                <h2 className="ap-tgq__title" id="ap-aeq-title">
                  {nameOf(strip)}
                </h2>
              </div>
              <button ref={stripClose} type="button" className="ap-tgq__x" onClick={closeStrip} aria-label={T.closeWindow}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 18L18 6M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* THE WHOLE STRIP at its own 1:5.5, end to end: the box scrolls
                down it with the head and the buy row held (eternal.css).
                width/height reserve its length before the file lands */}
            <div className="ap-aeq__strip" style={{ background: strip.avg }}>
              <img
                src={strip.strip.sm}
                srcSet={`${strip.strip.sm} ${strip.strip.smW}w, ${strip.strip.src} ${strip.strip.w}w`}
                sizes={STRIP_SIZES}
                alt={`${nameOf(strip)} from Armenia Eternal, by Arpine Baroyan: the whole runner, end to end`}
                width={strip.strip.w}
                height={strip.strip.h}
                decoding="async"
              />
            </div>

            <div className="ap-tgq__buy">
              <div className="ap-tgq__facts">
                <p className="ap-tgq__price">{priceText(unitOf({ cat: ETERNAL, variant: eternalKinds.ru.one }))}</p>
              </div>
              <div className="ap-tgq__act">
                <p className="ap-tgq__added" role="status">
                  {added === strip.id ? T.added : ""}
                </p>
                {(() => {
                  const sold = isSoldOut(ETERNAL, strip.id, eternalKinds.ru.one);
                  return (
                    <button
                      type="button"
                      className="ap-btn"
                      // the flight throws the runner's card — its crop, behind
                      // the veil — not the whole strip, which is a metre long
                      onClick={() => buy(strip, stripOpener.current?.querySelector("img"))}
                      disabled={sold}
                      data-sold={sold || undefined}
                    >
                      {sold ? "Sold out" : T.add}
                      <span className="ap-sr">: {nameOf(strip)}</span>
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
