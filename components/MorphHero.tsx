"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// A PIN MUST BE TORN DOWN IN A *LAYOUT* EFFECT (2026-08-12).
//
// ScrollTrigger's `pin` wraps its element in a pin-spacer — it REPARENTS a
// node React owns. React only tolerates that if the wrapper is gone before
// it unmounts the tree. And the two effect kinds unmount at different times:
// a deleted tree's useEffect cleanups run in the PASSIVE phase, which is
// AFTER React has already removed the DOM, while useLayoutEffect cleanups
// run during the mutation phase, BEFORE removal. With useEffect the un-pin
// was always too late — React looked for <section class="ap-mh"> inside
// <main>, found the pin-spacer there instead, and threw
//   NotFoundError: Failed to execute 'removeChild' on 'Node'
// on every navigation away from this page. Proved by instrumenting
// removeChild: child section.ap-mh, expected parent main, actual parent
// div.pin-spacer.
//
// SSR renders this file, and useLayoutEffect warns there, so it is only
// swapped in once there is a window.
const useLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

type Art = { id: string; src: string; thumb: string; w: number; h: number; avg: string };

// ============================================================================
// MORPH HERO — the opening of /shop/postcards, ported from
// feturesss21/best/examples/scroll-morph-hero.tsx.
//
// The original's anatomy, kept exactly:
//   load      cards scatter in from nowhere → snap into a LINE → curl into a
//             RING around the intro line
//   scroll    the ring morphs into a bottom "rainbow" ARC (lerp of the two
//             polar layouts, the original's formulas verbatim: ring radius
//             min(35% of the short side, 350); arc radius 1.1× min(W, 1.5H),
//             apex at 25% below centre, 130° spread, cards ×1.8)
//   further   the arc rotates through the deck and STOPS WITH THE LAST CARD
//             STILL WHOLE IN THE FRAME — see "THE DARK VOID" below; this is
//             the one place the original's numbers are not kept
//   always    the arc sways ±100px with the pointer; a hovered card flips to
//             its back face
//
// What was deliberately NOT kept: framer-motion (three packages for one hero
// in a 3-dependency project) and the VIRTUAL WHEEL. The original preventDefaults
// every wheel event over the hero and spends 3000 virtual pixels; on a page
// whose purpose is the buy panel below, that is a trap. A pinned ScrollTrigger
// produces the identical progression from honest page scroll — the springs
// become a per-tick exponential chase toward the same targets.
//
// The scatter uses Math.random FREELY, because unlike the cloud it is never
// server-rendered: cards render in the plain fallback layout and the random
// positions are applied by GSAP after mount, so there is nothing to mismatch.
// ============================================================================

const MAX_CARDS = 20;

// THE DARK VOID (client, «change 3.pdf» p1, 2026-10-01: «երբ 1-ին անգամ սքրոլ
// ենք անում էն սիրուն շարքով նկարները, հետո դատարկ մեծ սենց մնում ա» — after
// the first scroll through the row of cards, a big empty dark area stays).
//
// Measured before touching anything (imgss/redesign-2026-10-01/verify/
// postcards/before/facts.txt, 1440×900 and 1886×835, cards in frame at each
// stop of the pin):
//   22% of the pin   10 in frame, 8 whole   — the arc has just formed
//   50%              last card (19) arrives  — the row is done HERE
//   80%               3 left
//   93%               1, cut
//  100%               0 — title, copy and an empty dark stage
// …and then that empty stage, a full 100svh of it, scrolls away before the
// buy panel arrives. So roughly the second half of the pin plus one whole
// screen was dark with nothing on it: her screenshot is the 100% frame.
//
// The pin-spacer was never wrong (its padding is exactly the pin's length and
// the next section starts at its bottom edge). The cause is the shuffle's
// bound. The original turns the arc by 0.8 × its 130° spread = 104°, but the
// frame holds whole cards only within about ±24° of the apex — the rest of
// the arc is below the fold — so the last card, which starts 65° right of the
// apex, is carried to 39° LEFT of it: out of the frame, with all nineteen
// others ahead of it. "Clamped so the last card never leaves" was true of the
// original's small boxed demo and false of a full-viewport stage.
//
// The fix keeps everything up to the moment the last card arrives exactly as
// it was — same morph, same turn per pixel scrolled — and ENDS THE PIN THERE:
// the arc now turns only until the last card stands whole at the right end of
// the frame (`travel`, measured from the stage, not a constant), and the pin
// is shortened by the same proportion. The stage is released with a full row
// on it and the buy panel follows it directly.

/** The pin's length in viewport heights IF the arc turned the original's full
 *  0.8 × spread. It no longer does (see above), so this is a RATE — the turn
 *  per pixel the client already knows — not the distance actually pinned. */
const PIN_VH = 1.9;

/** How much of that the ring→arc morph takes; the rest shuffles the deck. */
const MORPH_SLICE = 0.22;

/** The arc's spread and the original's turn through it, in degrees. */
const SPREAD = 130;
const FULL_TURN = SPREAD * 0.8;

const DESKTOP = "(min-width: 861px) and (prefers-reduced-motion: no-preference)";
const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;

export default function MorphHero({
  items,
  intro,
  cue,
  title,
  copy,
}: {
  items: Art[];
  intro: string[];
  cue: string;
  title: string;
  copy: string;
}) {
  const root = useRef<HTMLElement | null>(null);

  useLayout(() => {
    const el = root.current;
    if (!el) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();

    mm.add(DESKTOP, () => {
      const stage = el.querySelector<HTMLElement>(".ap-mh__stage");
      const cards = gsap.utils.toArray<HTMLElement>(".ap-mh__card", el);
      const introEl = el.querySelector<HTMLElement>(".ap-mh__intro");
      const arcEl = el.querySelector<HTMLElement>(".ap-mh__arc");
      if (!stage || cards.length === 0) return;
      const N = cards.length; // the ring and arc are built for what actually renders

      let W = stage.offsetWidth;
      let H = stage.offsetHeight;
      /** how far the arc turns, in degrees — until the last card stands whole
       *  at the right end of the frame, and no further */
      let travel = 0;
      /** the pin's two legs in scrolled pixels: the morph, then the shuffle */
      let morphPx = 1;
      let spinPx = 0;

      /** Read the stage and derive the three numbers above. Runs wherever
       *  ScrollTrigger re-reads `end` — on load, on resize, on refresh — so
       *  the bound is always the one for the frame on screen. */
      const measure = () => {
        W = stage.offsetWidth;
        H = stage.offsetHeight;
        const arcR = Math.min(W, H * 1.5) * 1.1;
        // THE FRAME'S REACH ALONG THE ARC: the furthest a card can sit from
        // the apex and still be whole on the stage. The arc leaves a wide
        // frame through the BOTTOM edge and a narrow one through the SIDES,
        // so it is whichever comes first. One card-height of clearance
        // covers the card's own rotated half-extent with room to spare
        // (1440×900 gives 23.5° — within half a degree of where the
        // outermost WHOLE card of the freshly formed arc stands, 23.9° — so
        // the row the pin ends on is as full as the row it begins with:
        // measured 8 whole cards at both).
        //
        // That is for the cards AS THEY RENDER, which is at their CSS size:
        // the ×1.8 the tick asks for never reaches the transform (measured
        // 2026-10-01 — no scale() in a card's inline transform at the arc;
        // GSAP resolves the alias "scale" to "scaleX,scaleY" before
        // quickSetter looks for a setter, and finds none). Left alone on
        // purpose: this size is the row the client has seen and called
        // «սիրուն». If the scale is ever made to apply, a card's half-extent
        // grows past this clearance by ~10px — raise it in the same change.
        const clear = cards[0].offsetHeight;
        const byX = Math.asin(Math.max(0, Math.min(1, (W / 2 - clear) / arcR)));
        const byY = Math.acos(Math.max(-1, Math.min(1, 1 - Math.max(0, H * 0.25 - clear) / arcR)));
        const reach = (Math.min(byX, byY) * 180) / Math.PI;
        // the last card starts SPREAD/2 right of the apex and may come in as
        // far as `reach`; never more than the original's turn
        travel = Math.max(0, Math.min(FULL_TURN, SPREAD / 2 - reach));
        const full = window.innerHeight * PIN_VH;
        morphPx = full * MORPH_SLICE;
        // same turn per pixel as before, so a shorter turn is a shorter pin
        spinPx = full * (1 - MORPH_SLICE) * (travel / FULL_TURN);
      };
      measure();

      // smoothed values chasing their targets — the port of the springs
      const s = { morph: 0, spin: 0, par: 0 };
      const t = { morph: 0, spin: 0, par: 0 };
      let introDone = false;

      const setters = cards.map((c) => ({
        x: gsap.quickSetter(c, "x", "px"),
        y: gsap.quickSetter(c, "y", "px"),
        r: gsap.quickSetter(c, "rotation", "deg"),
        sc: gsap.quickSetter(c, "scale"),
      }));

      /** The original's two polar layouts, verbatim — except how far `spin`
       *  turns the arc: `travel`, not 0.8 × spread (THE DARK VOID, above). */
      const shape = (i: number, morph: number, spin: number, par: number) => {
        const minDim = Math.min(W, H);
        const circleR = Math.min(minDim * 0.35, 350);
        const cAng = ((i / N) * 360 * Math.PI) / 180;
        const cx = Math.cos(cAng) * circleR;
        const cy = Math.sin(cAng) * circleR;
        const cRot = (i / N) * 360 + 90;

        const arcR = Math.min(W, H * 1.5) * 1.1;
        const centerY = H * 0.25 + arcR;
        const spread = SPREAD;
        const start = -90 - spread / 2;
        const step = spread / (N - 1);
        const bounded = -spin * travel;
        const aDeg = start + i * step + bounded;
        const aRad = (aDeg * Math.PI) / 180;
        const ax = Math.cos(aRad) * arcR + par;
        const ay = Math.sin(aRad) * arcR + centerY;

        return {
          x: lerp(cx, ax, morph),
          y: lerp(cy, ay, morph),
          rot: lerp(cRot, aDeg + 90, morph),
          scale: lerp(1, 1.8, morph),
        };
      };

      const tick = () => {
        if (!introDone) return;
        // the original's stiffness-40/damping-20 springs, near enough:
        // an 8%-per-frame exponential chase toward the same targets
        s.morph += (t.morph - s.morph) * 0.08;
        s.spin += (t.spin - s.spin) * 0.08;
        s.par += (t.par - s.par) * 0.06;
        for (let i = 0; i < cards.length; i++) {
          const p = shape(i, s.morph, s.spin, s.par);
          setters[i].x(p.x);
          setters[i].y(p.y);
          setters[i].r(p.rot);
          setters[i].sc(p.scale);
        }
        if (introEl) introEl.style.opacity = String(Math.max(0, Math.min(1, 1 - s.morph * 2)));
        if (arcEl) {
          const o = Math.max(0, Math.min(1, (s.morph - 0.8) / 0.2));
          arcEl.style.opacity = String(o);
          arcEl.style.transform = `translate(-50%, ${lerp(20, 0, o)}px)`;
        }
      };
      gsap.ticker.add(tick);

      // ---- the load sequence: scatter → line → ring ------------------------
      cards.forEach((c) => {
        gsap.set(c, {
          x: (Math.random() - 0.5) * 1500,
          y: (Math.random() - 0.5) * 1000,
          rotation: (Math.random() - 0.5) * 180,
          scale: 0.6,
          opacity: 0,
          xPercent: -50,
          yPercent: -50,
        });
      });
      const lineSpacing = 76;
      const tl = gsap.timeline({ delay: 0.4 });
      tl.to(cards, {
        x: (i) => i * lineSpacing - (N * lineSpacing) / 2,
        y: 0,
        rotation: 0,
        scale: 1,
        opacity: 1,
        duration: 1.05,
        ease: "power3.out",
        stagger: 0.02,
      })
        .to(
          cards,
          {
            x: (i) => shape(i, 0, 0, 0).x,
            y: (i) => shape(i, 0, 0, 0).y,
            rotation: (i) => shape(i, 0, 0, 0).rot,
            duration: 1.25,
            ease: "power2.inOut",
            stagger: 0.015,
            onComplete: () => {
              introDone = true;
            },
          },
          "+=0.9",
        )
        .to(introEl, { opacity: 1, duration: 0.8 }, "<0.35");

      // ---- honest scroll in place of the virtual wheel ---------------------
      const st = ScrollTrigger.create({
        trigger: el,
        start: "top top",
        // THE PIN ENDS WHEN THE ROW DOES (2026-10-01). It used to be a flat
        // 1.9 viewports, of which everything after ~53% was the deck leaving
        // an emptying stage. `measure` runs here because this is the one
        // callback ScrollTrigger re-evaluates on every refresh, BEFORE it
        // sizes the pin-spacer from the answer.
        end: () => {
          measure();
          return "+=" + Math.round(morphPx + spinPx);
        },
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          // in scrolled pixels rather than fractions of progress: the two
          // legs are no longer a fixed share of the pin (the shuffle's
          // length depends on the frame), but each is a known distance
          const d = self.progress * (self.end - self.start);
          t.morph = Math.min(1, d / morphPx);
          t.spin = spinPx > 0 ? Math.max(0, Math.min(1, (d - morphPx) / spinPx)) : 0;
        },
      });

      // ---- pointer sway, ±100px like the original --------------------------
      const onMouse = (e: MouseEvent) => {
        const r = stage.getBoundingClientRect();
        t.par = ((e.clientX - r.left) / r.width) * 200 - 100;
      };
      stage.addEventListener("mousemove", onMouse);

      return () => {
        stage.removeEventListener("mousemove", onMouse);
        gsap.ticker.remove(tick);
        tl.kill();
        // kill(TRUE) — REVERT THE PIN (2026-08-12). A pin wraps its element
        // in a pin-spacer, i.e. it REPARENTS a node React owns. Killing the
        // trigger without reverting leaves that wrapper in place, so when
        // React unmounts this page it looks for the section in its original
        // parent, finds the spacer instead, and throws NotFoundError:
        // "The node to be removed is not a child of this node".
        st.kill(true);
      };
    });

    return () => mm.revert();
  }, []);

  const deck = items.slice(0, MAX_CARDS);

  return (
    <section className="ap-mh ap-dark" ref={root} aria-label={title}>
      <div className="ap-mh__stage">
        {deck.map((a, i) => (
          // the hover flip is pure CSS: a preserve-3d flipper with two faces
          <div className="ap-mh__card" key={a.id} style={{ zIndex: i + 1 }}>
            <div className="ap-mh__flip">
              <figure className="ap-mh__face" style={{ background: a.avg }}>
                <img src={a.thumb} alt="" width={a.w} height={a.h} loading={i < 6 ? undefined : "lazy"} decoding="async" />
              </figure>
              <figure className="ap-mh__face is-back">
                <span>No. {a.id}</span>
                <em>the Armenia series</em>
              </figure>
            </div>
          </div>
        ))}

        <div className="ap-mh__intro" aria-hidden="true">
          {/* her line break (change.pdf p10, 2026-09-21): SEND / A LITTLE
              ARMENIA — one block per line */}
          <p className="ap-mh__line">
            {intro.map((l) => (
              <span key={l} style={{ display: "block" }}>
                {l}
              </span>
            ))}
          </p>
          <p className="ap-mh__cue">{cue}</p>
        </div>

        <div className="ap-mh__arc">
          <h1 className="ap-mh__title">{title}</h1>
          <p className="ap-mh__copy">{copy}</p>
        </div>
      </div>
    </section>
  );
}

