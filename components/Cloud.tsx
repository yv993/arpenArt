"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { add, dram, unit } from "@/lib/cart";
import { flyToCart } from "@/lib/fly";

type Art = {
  id: string;
  src: string;
  thumb: string;
  w: number;
  h: number;
  avg: string;
  /** the print-resolution scan, the postcard's back, the printed mockup and
      Arpine's own note (client files 2026-08-11) — three pictures (23/25/34)
      don't have them yet */
  lg?: string;
  lgW?: number;
  lgH?: number;
  back?: string;
  mock?: string;
  mockW?: number;
  mockH?: number;
  text?: string;
};

/** which face of the chosen picture the big card is showing */
type View = "front" | "back" | "mock";
const VIEWS: View[] = ["front", "back", "mock"];

/** one face of a picture: its file and its real box, for the fit decision */
const face = (p: Art, v: View) =>
  v === "back"
    ? { src: p.back, w: p.lgW, h: p.lgH }
    : v === "mock"
      ? { src: p.mock, w: p.mockW, h: p.mockH }
      : { src: p.lg, w: p.lgW, h: p.lgH };

// ============================================================================
// CLOUD — the series lying freely in space, after creativeapproa.ch.
//
// The reference was MEASURED, not eyeballed (scratchpad/refprobe.mjs):
//
//   geometry   ~92×130px cards, axis-aligned (no rotation), 6px radius, no
//              shadow; a white mount around roughly a third of them
//   movement   the cards FLOAT — their wrappers' transforms crept 1–3px
//              between samples with no pointer input. Not mouse parallax.
//   hover      nothing. Cursor only.
//   click      the card enlarges ~1.5× in place, every other card dims hard,
//              the intro text gets out of the way, and a small caption sits
//              directly under the card. Click-away (or another card) closes.
//
// ONE plane carries all 57 cards. A drag pans it, a throw coasts — and that
// is the only travel there is: the section takes no part in page scroll (the
// client asked the pin removed), so the page rolls straight past it. The
// float is a bounded ±few-px wobble per card on top.
//
// The scatter is DETERMINISTIC (hash of the index, quantised) because
// Math.sin differs between Node and browser V8 in the last bit and React
// calls that a hydration mismatch. See git history for the crime scene.
// ============================================================================

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

const hash = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return Math.round((x - Math.floor(x)) * 1e4) / 1e4;
};
const q = (n: number) => Math.round(n * 1e3) / 1e3;

type Placed = Art & { x: number; y: number; size: number; z: number; mount: boolean };

function scatter(items: Art[]): Placed[] {
  const n = items.length;
  return items.map((a, i) => {
    const ang = i * GOLDEN;
    const rad = Math.sqrt((i + 0.55) / n);
    const jx = (hash(i, 1) - 0.5) * 7;
    const jy = (hash(i, 2) - 0.5) * 8;
    const t = hash(i, 3);
    // roughly the reference's 92px cards at 1440 — smaller and denser than the
    // first cut, so far more of the series is in the frame at once
    const size = t < 0.24 ? 2.9 : t < 0.78 ? 3.7 : 4.7;
    return {
      ...a,
      // DRAWN IN TOWARDS THE MIDDLE (client 2026-08-12: "make more dense in
      // center, move from left side postcards to center"). The spread was
      // ±34% of the frame, which pushed cards to both edges and strewed a
      // thin group down the left, underneath the title. Tighter radii pile
      // the series in the centre, and the centre itself sits a little right
      // of middle so the title's column stays its own.
      x: q(54 + Math.cos(ang) * rad * 24 + jx),
      y: q(50 + Math.sin(ang) * rad * 27 + jy),
      size,
      z: Math.round(size * 10),
      mount: hash(i, 5) > 0.62,
    };
  });
}

/** Cards rest at 63–102px, so this opens a picked one to roughly 230–370px —
 *  big enough to actually look at, which the old ×1.8 (~210px) was not
 *  (client 2026-08-06: "it must open more big"). */
const VIEW_SCALE = 3.6;

const DESKTOP = "(min-width: 861px) and (prefers-reduced-motion: no-preference)";

export default function Cloud({
  items,
  kicker,
  title,
  copy,
  pick,
}: {
  /** what a chosen picture says — see home.strip in lib/content.ts */
  pick: { line: string; body: string; cta: string };
  items: Art[];
  kicker: string;
  title: string;
  copy: string;
}) {
  const root = useRef<HTMLDivElement | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  // every picture opens on its front; the switcher below the note changes it
  const [view, setView] = useState<View>("front");
  /** the page mid-turn. Forward: the OLD face rides on top, turning away,
   *  the new one already beneath. Backward: the NEW face turns back in on
   *  top, while the old one holds beneath until it is covered. */
  type Face = { src?: string; w?: number; h?: number };
  const [page, setPage] = useState<{ over: Face; under?: Face; dir: 1 | -1 } | null>(null);
  useEffect(() => {
    setView("front");
    setPage(null);
    // warm the picture's other faces the moment it opens, so the first
    // switch doesn't have to wait on the network
    const art = chosen ? items.find((a) => a.id === chosen) : undefined;
    [art?.back, art?.mock].forEach((s) => {
      if (s) new Image().src = s;
    });
  }, [chosen, items]);

  /** A later click supersedes a turn still waiting on its image. */
  const turnToken = useRef(0);

  /** Bought straight from the cloud (client 2026-08-12). The line is the
   *  SAME shape the shop writes — postcards / this illustration / Single
   *  card — so the cart, the totals and the order endpoint's server-side
   *  re-pricing all treat it identically; nothing here names a price. */
  const [added, setAdded] = useState(false);
  const buy = useCallback((id: string) => {
    add("postcards", id, 1, "Single card");
    flyToCart(document.querySelector<HTMLElement>(`.ap-cloud__card[data-id="${id}"]`));
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2400);
  }, []);
  useEffect(() => {
    setAdded(false);
  }, [chosen]);

  const switchView = useCallback(
    (v: View, art: Art | undefined) => {
      if (v === view || !art) return;
      const dir: 1 | -1 = VIEWS.indexOf(v) > VIEWS.indexOf(view) ? 1 : -1;
      const oldFace = face(art, view);
      const newFace = face(art, v);
      if (!oldFace.src || !newFace.src) {
        setPage(null);
        setView(v);
        return;
      }
      // NEVER start the turn before the incoming face has decoded — faces
      // load lazily, and turning onto an empty <img> showed whatever sat
      // beneath (the front thumb) until the real face popped in
      // (client 2026-08-12: "brings the first image then changes").
      const token = ++turnToken.current;
      const img = new Image();
      img.src = newFace.src;
      const go = () => {
        if (token !== turnToken.current) return;
        setPage(dir === 1 ? { over: oldFace, dir } : { over: newFace, under: oldFace, dir });
        setView(v);
      };
      img.decode().then(go, go);
    },
    [view],
  );

  // THE DRAG IS GONE (client 2026-08-06). It took the pointer-capture dance
  // with it — the capture-on-frame trick, the down-card ref, the click slop,
  // the timestamp guard against double-toggling, and the throw's friction and
  // rest thresholds — because all of it existed only to tell a drag from a
  // click. A card is now simply a button you press.
  // Checked before removing it, since a cloud you cannot move is a cloud whose
  // far side is unreachable: all 57 cards are on screen at rest at 1440×900
  // (spread x −34…1441 against a 1440 frame), so nothing is stranded.
  // `pan` survives for one job only: sliding the plane so a picked card lands
  // in the middle instead of opening half off the edge.
  const pan = useRef({ x: 0, y: 0 });
  const planeRef = useRef<HTMLElement | null>(null);
  /** Mirror of `chosen` for the flight loop — a 60fps tick cannot read state. */
  const chosenRef = useRef<string | null>(null);
  chosenRef.current = chosen;

  const placed = useMemo(() => scatter(items), [items]);

  const write = useCallback(() => {
    const plane = planeRef.current;
    if (plane) gsap.set(plane, { x: pan.current.x, y: pan.current.y });
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const plane = el.querySelector<HTMLElement>(".ap-cloud__plane");
    if (!plane) return;
    planeRef.current = plane;
    const mm = gsap.matchMedia();

    mm.add(DESKTOP, () => {
      // ---- the FLIGHT: every card rides its own slow orbit ----------------
      // The first cut was a ±3px sine breath, and the client asked for real
      // flight. Each card now traces a Lissajous drift — sin on one clock for
      // x, cos on another for y, amplitudes in the tens of pixels, a couple of
      // degrees of bank — with every number seeded from the hash, so the
      // paths never visibly repeat and the server has nothing to disagree
      // with (all of it is applied after mount). Cards sail over and under
      // each other; that is what makes it read as flying rather than bobbing.
      const cards = gsap.utils.toArray<HTMLElement>(".ap-cloud__card", plane);
      const flight = cards.map((c, i) => {
        gsap.set(c, { xPercent: -50, yPercent: -50 });
        return {
          id: c.dataset.id,
          setX: gsap.quickSetter(c, "x", "px"),
          setY: gsap.quickSetter(c, "y", "px"),
          setR: gsap.quickSetter(c, "rotation", "deg"),
          ax: 16 + hash(i, 6) * 22, // 16–38px of sideways travel
          ay: 13 + hash(i, 7) * 18,
          fx: 0.22 + hash(i, 8) * 0.22, // rad/s — one lap in ~15–30s
          fy: 0.18 + hash(i, 9) * 0.2,
          ph: hash(i, 10) * Math.PI * 2,
          ar: 1.6 + hash(i, 11) * 2.2, // degrees of bank
          fr: 0.12 + hash(i, 12) * 0.14,
          w: 1, // drift weight — eases to 0 while chosen, back to 1 after
          frozen: false,
        };
      });

      const tick = () => {
        const t = gsap.ticker.time;
        for (const f of flight) {
          // A chosen card STOPS — eased to a standstill, then NOT WRITTEN
          // AT ALL. The old 0.25 damping kept writing a new transform every
          // frame, and a perpetually-animating transform keeps the card on
          // a conservatively-rasterized compositor layer — the print looked
          // soft at open size no matter how large the file was (measured:
          // 188 Laplacian variance mid-animation vs 478 once static).
          const target = f.id && f.id === chosenRef.current ? 0 : 1;
          f.w += (target - f.w) * 0.1;
          if (target === 0 && f.w < 0.01) {
            if (!f.frozen) {
              f.frozen = true;
              f.setX(0);
              f.setY(0);
              f.setR(0);
            }
            continue;
          }
          f.frozen = false;
          if (f.w > 0.999) f.w = 1;
          f.setX(Math.sin(t * f.fx + f.ph) * f.ax * f.w);
          f.setY(Math.cos(t * f.fy + f.ph * 1.7) * f.ay * f.w);
          f.setR(Math.sin(t * f.fr + f.ph) * f.ar * f.w);
        }
        // the throw's inertia integration lived here and went with the drag;
        // the plane only moves now under the centring tween, which writes
        // itself through onUpdate
      };
      gsap.ticker.add(tick);

      return () => {
        gsap.ticker.remove(tick);
        gsap.killTweensOf([cards, pan.current]);
      };
    });

    return () => mm.revert();
  }, [write]);

  /** Step to the next or previous picture without closing the viewer — the
   *  pan choreography below flies the plane to wherever it lies. Declared
   *  before the choosing effect, which wires it to the arrow keys. */
  const step = useCallback(
    (dir: 1 | -1) => {
      setChosen((cur) => {
        if (!cur) return cur;
        const i = items.findIndex((a) => a.id === cur);
        return items[(i + dir + items.length) % items.length].id;
      });
    },
    [items],
  );

  // ---- choosing a picture --------------------------------------------------
  // Measured contract: the chosen card grows in place, the rest dim hard, the
  // intro clears out, a caption sits under the card. Here the plane also pans
  // the choice comfortably into view — our cloud extends past the screen, the
  // reference's does not.
  useEffect(() => {
    const el = root.current;
    // On the plain rail the caption CSS does the whole job; the dim / grow /
    // pan choreography is desktop-and-full-motion only.
    if (!el || !window.matchMedia(DESKTOP).matches) return;
    const cards = gsap.utils.toArray<HTMLElement>(".ap-cloud__card", el);
    const say = el.querySelector<HTMLElement>(".ap-cloud__say");
    const card = chosen ? cards.find((c) => c.dataset.id === chosen) : undefined;

    cards.forEach((c) => {
      const isIt = c === card;
      // GROWN BY LAYOUT, NOT BY transform SCALE (2026-08-12). A scaled card
      // lives on a compositor layer whose raster the engine refuses to redo
      // at full resolution while anything nearby still animates — measured
      // 179 Laplacian variance against the browser's own 388 for this file
      // at this size, i.e. half the sharpness, whatever the source quality.
      // A layout-sized image always paints at device resolution. The card is
      // centre-anchored (xPercent/yPercent -50), so growing width moves
      // nothing; aspect-ratio carries the height.
      const pSize = parseFloat(c.style.getPropertyValue("--w")) || 3.7;
      gsap.to(c, {
        opacity: card && !isIt ? 0.16 : 1,
        width: `${isIt ? pSize * VIEW_SCALE : pSize}%`,
        duration: 0.45,
        ease: "power2.out",
      });
      c.style.zIndex = isIt ? "600" : c.style.getPropertyValue("--z");
    });
    if (say) gsap.to(say, { autoAlpha: card ? 0 : 1, duration: 0.35 });

    if (card) {
      // bring it to the middle of the frame by panning the shared plane
      const r = card.getBoundingClientRect();
      const f = el.getBoundingClientRect();
      // centred in the FRAME, not the viewport: the panel sits to the right of
      // the picture, so the picture is offset left to leave it room
      const dx = f.left + f.width * 0.36 - (r.left + r.width / 2);
      const dy = f.top + f.height / 2 - (r.top + r.height / 2);
      gsap.to(pan.current, { x: pan.current.x + dx, y: pan.current.y + dy, duration: 0.6, ease: "power3.out", onUpdate: write });
    } else {
      // nothing chosen: the plane goes back where it started, or the cloud
      // drifts a little further off-centre with every pick
      gsap.to(pan.current, { x: 0, y: 0, duration: 0.6, ease: "power3.out", onUpdate: write });
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setChosen(null);
      if (!chosenRef.current) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chosen, write, step]);

  /** Press a card to open it, press it again to put it back. With no drag to
   *  distinguish this from, onClick is the whole of it — pointer and keyboard
   *  alike. */
  const choose = useCallback((id: string) => {
    setChosen((cur) => (cur === id ? null : id));
  }, []);

  return (
    // data-nosun: the flying sun (components/Sun.tsx) fades out rather than
    // passing behind this wall of pictures — see the note beside `veils`.
    <section className="ap-cloud ap-dark" ref={root} aria-label={title} data-nosun>
      <div
        className="ap-cloud__frame"
        data-chosen={chosen || undefined}
        // Click-away to close. It used to be a branch inside the drag's
        // pointer-up — "a clean press on the ground puts one back" — and went
        // out with the drag, leaving the ✕ and Escape as the only ways back.
        // A press on a card or on the panel is that element's business.
        onClick={(e) => {
          const t = e.target as HTMLElement;
          if (!t.closest(".ap-cloud__card") && !t.closest(".ap-cloud__info")) setChosen(null);
        }}
      >
        <div className="ap-cloud__plane">
          {placed.map((p) => (
            <button
              type="button"
              className={`ap-cloud__card${p.mount ? " is-mounted" : ""}`}
              key={p.id}
              data-id={p.id}
              // the caption under a chosen card. Only facts we actually have:
              // the number and the series. No invented titles or mediums.
              data-caption={`No. ${p.id} — the Armenia series`}
              aria-pressed={chosen === p.id}
              aria-label={`Illustration number ${p.id}. Press to view it larger.`}
              onClick={() => choose(p.id)}
              style={
                {
                  "--x": `${p.x}%`,
                  "--y": `${p.y}%`,
                  "--w": `${p.size}%`,
                  "--z": String(p.z),
                  background: p.avg,
                } as React.CSSProperties
              }
            >
              <img src={p.thumb} alt="" width={p.w} height={p.h} loading="lazy" decoding="async" />
              {/* the chosen card shows the selected face — front print, the
                  postcard's back, or the printed mockup — and CHANGES FACE
                  LIKE A BOOK PAGE (client 2026-08-12): forward turns the
                  current face away around its left edge, backward turns the
                  previous face back in, over the face beneath. A face whose
                  aspect differs from the card (art-13's portrait print of a
                  landscape original; every landscape mockup) letterboxes on
                  the artwork's own average colour instead of cropping. */}
              {chosen === p.id &&
                (() => {
                  const cur = face(p, view);
                  if (!cur.src) return null;
                  const fit = (w?: number, h?: number) => !(w && h && Math.abs(p.w / p.h - w / h) < 0.08);
                  const under = page?.under ?? cur;
                  return (
                    <>
                      {/* ONE persistent element, NEVER keyed by its file: a
                          remount paints empty for a few frames and the front
                          thumb beneath showed through on every switch (client
                          2026-08-12, twice). Swapping src in place keeps the
                          old bitmap until the new one paints, and the new one
                          is already decoded (the gate in switchView), so
                          decoding=sync makes the swap a single clean frame. */}
                      <img
                        className={`ap-cloud__lg${fit(under.w, under.h) ? " is-fit" : ""}`}
                        src={under.src}
                        alt=""
                        width={under.w}
                        height={under.h}
                        decoding="sync"
                        style={fit(under.w, under.h) ? { background: p.avg } : undefined}
                      />
                      {page && (
                        <img
                          className={`ap-cloud__page ${page.dir === 1 ? "is-out" : "is-in"}${fit(page.over.w, page.over.h) ? " is-fit" : ""}`}
                          key={(page.over.src ?? "") + view}
                          src={page.over.src}
                          alt=""
                          width={page.over.w}
                          height={page.over.h}
                          decoding="sync"
                          style={fit(page.over.w, page.over.h) ? { background: p.avg } : undefined}
                          onAnimationEnd={() => setPage(null)}
                        />
                      )}
                    </>
                  );
                })()}
            </button>
          ))}
        </div>

        {/* The kicker, the sentence and the drag cue are all still here for
            the PLAIN layer — the phone rail has no room to explain itself and
            this is its only introduction. In the live cloud, CSS shows the
            title alone and moves it to the left (client 2026-08-06). */}
        <div className="ap-cloud__say">
          <p className="ap-kicker">{kicker}</p>
          {/* every letter arrives cut in two — the halves slide vertically
              and seam shut, left to right */}
          <h2 className="ap-h2" data-tfx="cut">
            {title}
          </h2>
          <p className="ap-lede">{copy}</p>
        </div>

        {/* what a picked picture IS: its number, its series, and Arpine's own
            note for it (client files 2026-08-11). The three pictures without
            a note yet (23/25/34) keep the series body. ‹ › browse the whole
            series without closing — the plane flies to each one. */}
        {chosen && (
          <div className="ap-cloud__info" role="status">
            <p className="ap-cloud__no">No. {chosen}</p>
            <p className="ap-cloud__series">{pick.line}</p>
            {(items.find((a) => a.id === chosen)?.text ?? pick.body).split("\n").map((t) => (
              <p className="ap-cloud__body" key={t.slice(0, 24)}>
                {t}
              </p>
            ))}
            {(() => {
              const art = items.find((a) => a.id === chosen);
              if (!art?.back && !art?.mock) return null;
              return (
                <div className="ap-cloud__views" role="group" aria-label="Faces of this picture">
                  <button type="button" aria-pressed={view === "front"} onClick={() => switchView("front", art)}>
                    Front
                  </button>
                  {art.back && (
                    <button type="button" aria-pressed={view === "back"} onClick={() => switchView("back", art)}>
                      Back
                    </button>
                  )}
                  {art.mock && (
                    <button type="button" aria-pressed={view === "mock"} onClick={() => switchView("mock", art)}>
                      Printed
                    </button>
                  )}
                </div>
              );
            })()}
            <div className="ap-cloud__nav">
              <button type="button" onClick={() => step(-1)} aria-label="Previous picture">
                ←
              </button>
              <span aria-hidden="true">
                {items.findIndex((a) => a.id === chosen) + 1} / {items.length}
              </span>
              <button type="button" onClick={() => step(1)} aria-label="Next picture">
                →
              </button>
            </div>
            {/* buy this card without leaving the cloud */}
            <p className="ap-cloud__price">
              <strong>{dram(unit("postcards"))}</strong> <span>a card</span>
            </p>
            <div className="ap-cloud__buy">
              <button type="button" className="ap-btn" onClick={() => buy(chosen)} data-added={added || undefined}>
                {added ? "Added ✓" : "Add to cart"}
              </button>
              <Link className="ap-cloud__go" href="/shop/postcards">
                {pick.cta} <span aria-hidden>→</span>
              </Link>
            </div>
            <button
              type="button"
              className="ap-cloud__close"
              onClick={() => setChosen(null)}
              aria-label="Put the picture back"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
