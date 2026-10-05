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
// The original's anatomy:
//   load      cards scatter in from nowhere → snap into a LINE → curl into a
//             RING around the intro line (the original's formulas verbatim:
//             ring radius min(35% of the short side, 350))
//   scroll    the ring morphs into a bottom "rainbow" ARC (lerp of the two
//             polar layouts). The original's arc — radius 1.1× min(W, 1.5H),
//             apex at 25% below centre, 130° spread, cards ×1.8 — is NOT
//             kept: see THE DARK VOID below for the FAN that replaced it
//   further   the arc rotates through the deck and stops with the last card
//             still whole in the frame
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
// …and then that empty stage, a full 100svh of it, scrolled away before the
// buy panel arrived. Her screenshot is the 100% frame, and her ellipse is the
// MIDDLE of it.
//
// Two things were wrong, fixed in two passes the same day:
//
// 1. THE PIN OUTLIVED THE ROW. The original turns the arc by 0.8 × its 130°
//    spread = 104°, but a full-viewport frame holds whole cards only within
//    about ±24° of the apex, so the last card was carried clean out of the
//    frame with all nineteen others ahead of it. The pin now ends when the
//    last card has arrived (`travel`, measured from the stage, not a
//    constant), and the buy panel follows the stage directly.
//
// 2. THE ROW WAS NOT THE SUBJECT OF THE STAGE. The original's arc puts its
//    apex 75% of the way down and never applied its ×1.8 (GSAP resolves the
//    alias "scale" to "scaleX,scaleY" before quickSetter looks for a setter,
//    and finds none), so after pass 1 the frame still read as her lead copy,
//    a third of a screen of nothing, and a row of 72px cards along the bottom
//    edge — about 60% of her ellipse was still empty. The arc is now a FAN
//    built from the frame itself (see `measure`): its apex card hangs
//    directly under the lead copy, its outermost whole cards reach the
//    bottom corners, the cards are as large as seven whole ones allow, and
//    the geometry is re-derived on every refresh so it holds at 1366×625 and
//    2560×1300 alike.

/** The pin's length in viewport heights IF the arc turned the original's full
 *  0.8 × spread. It no longer does (see above), so this is a RATE — the turn
 *  per pixel the client already knows — not the distance actually pinned. */
const PIN_VH = 1.9;

/** How much of that the ring→arc morph takes; the rest shuffles the deck. */
const MORPH_SLICE = 0.22;

/** The pointer sway's amplitude in px — the original's ±100. ONE constant,
 *  because it is also part of the fan's side clearance: the reviewer found
 *  the "last card whole" promise broken with the mouse at the right edge,
 *  the sway having carried the arc 100px past a clearance that ignored it. */
const SWAY = 100;

/** Whole cards the frame holds at the pin's end (and at the fan's first
 *  frame) — an odd number, so a card stands on the apex in both. */
const WHOLE = 7;

/** The row's distance under the lead copy, and how far it may grow when a
 *  tall frame has room to spare (the brief's window is 40–120px, measured
 *  to the top of the HIGHEST card, which mid-turn is a corner a few px above
 *  the apex card's top). */
const GAP_MIN = 56;
const GAP_MAX = 104;

/** How far a whole card keeps off the frame's sides and bottom. */
const EDGE_X = 10;
const EDGE_Y = 12;

/** Daylight between neighbouring cards where they come nearest — their
 *  inner corners, since the fan turns each card to its own radius. */
const BETWEEN = 10;

/** The fan's furthest reach from the apex, in degrees. Tall frames (4:3,
 *  16:10) would otherwise close into more than a half-wheel, and past ~52°
 *  the step between cards grows to where twenty of them wrap the full circle
 *  and the first re-enters at the far corner behind the last. */
const MAX_REACH = 50;

/** Card scale ceiling: the faces are 420px thumbs, and ×2.9 of the 72px card
 *  is what keeps them crisp on a 2× screen. */
const K_MAX = 2.9;

const DESKTOP = "(min-width: 861px) and (prefers-reduced-motion: no-preference)";
const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;
const clamp = (lo: number, hi: number, v: number) => Math.max(lo, Math.min(hi, v));
const RAD = Math.PI / 180;

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
      const mid = Math.floor((N - 1) / 2); // the card on the apex when the fan forms
      const half = (WHOLE - 1) / 2;

      // THE CARD'S OWN SIZE — read once, before `--mh-k` is set on the stage.
      // The card is laid out at the FAN's size (72×102 × k, through that
      // custom property in morph.css) and GSAP scales it DOWN for the ring,
      // never up: a composited layer (will-change + preserve-3d) is
      // rasterised at its layout size, so a 72px card scaled ×2.7 would be
      // a 72px picture stretched — blurred faces in Safari always and in
      // Chrome under will-change.
      const baseW = cards[0].offsetWidth || 72;
      const baseH = cards[0].offsetHeight || 102;

      let W = stage.offsetWidth;
      let H = stage.offsetHeight;
      /** the fan: card scale, radius, degrees between neighbours, the apex
       *  card's centre in px below the stage's centre */
      let k = 1;
      let arcR = 1;
      let step = 1;
      let apexY = 0;
      /** how far the fan turns, in degrees — until the last card stands on
       *  the outermost whole position at the right, and no further */
      let travel = 0;
      /** the pin's two legs in scrolled pixels: the morph, then the shuffle */
      let morphPx = 1;
      let spinPx = 0;

      /** Read the stage and derive the fan. Runs wherever ScrollTrigger
       *  re-reads `end` — on load, on resize, on refresh — so the geometry
       *  is always the one for the frame on screen.
       *
       *  THE FAN IS SOLVED FROM THE FRAME, not set by constants. Given the
       *  box left under the lead copy — half the width minus the sway and
       *  the side clearance (a), the height down to the bottom clearance
       *  (b) — the arc through the apex that leaves the box exactly at its
       *  bottom corners has reach θ = 2·atan(b/a) and radius a/sin θ. The
       *  step between cards is θ/3 so that seven stand whole from −θ to +θ,
       *  and the card is as wide as that step allows at the inner corners:
       *  w = 2(R − h/2)·tan(step/2) − BETWEEN. The clearances depend on the
       *  card's rotated half-extents, which depend on the card, so it is
       *  iterated to a fixed point. Where the reach would exceed MAX_REACH it
       *  is capped and the room left over splits between the gap under the
       *  copy and the bottom margin. */
      const measure = () => {
        W = stage.offsetWidth;
        H = stage.offsetHeight;
        // the lead copy's bottom edge — offsetTop ignores the transform the
        // tick writes on the block, which is what makes it safe to read here
        const copyBottom = arcEl ? arcEl.offsetTop + arcEl.offsetHeight : H * 0.3;
        const top = copyBottom + GAP_MIN; // the highest a card may reach
        const ratio = baseH / baseW;
        let reach = MAX_REACH * RAD;
        let kk = 1.8;
        let b = 1;
        for (let i = 0; i < 30; i++) {
          const w = baseW * kk;
          const h = baseH * kk;
          const hx = (w / 2) * Math.cos(reach) + (h / 2) * Math.sin(reach);
          const hy = (w / 2) * Math.sin(reach) + (h / 2) * Math.cos(reach);
          const a = Math.max(1, W / 2 - SWAY - EDGE_X - hx);
          b = Math.max(1, H - EDGE_Y - hy - (top + h / 2));
          const t = Math.min(MAX_REACH * RAD, 2 * Math.atan2(b, a));
          const R = a / Math.sin(t);
          const st = t / half;
          const tn = Math.tan(st / 2);
          const kFit = (2 * R * tn - BETWEEN) / (1 + ratio * tn) / baseW;
          // and never taller than four fifths of the band itself (a very
          // short frame), nor larger than the thumbs can honestly fill
          const kTall = ((H - EDGE_Y - top) / baseH) * 0.8;
          const next = clamp(0.5, K_MAX, Math.min(kFit, kTall));
          kk += (next - kk) / 2;
          reach += (t - reach) / 2;
          arcR = R;
          step = st / RAD;
        }
        k = kk;
        const h = baseH * k;
        const used = arcR * (1 - Math.cos(reach)); // the drop to the outermost whole card
        const room = Math.max(0, b - used); // 0 unless the reach was capped
        const gap = GAP_MIN + Math.min(GAP_MAX - GAP_MIN, room / 2);
        apexY = copyBottom + gap + h / 2 - H / 2;
        stage.style.setProperty("--mh-k", k.toFixed(4));
        // at spin 0 card `mid` is on the apex; the last card is (N-1-mid)
        // steps right of it and comes in as far as the outermost whole
        // position, `half` steps right of the apex
        travel = Math.max(0, N - 1 - mid - half) * step;
        const full = window.innerHeight * PIN_VH;
        morphPx = full * MORPH_SLICE;
        // same CARDS per pixel as the original, whose 0.8 × spread turn is
        // 0.8 × (N − 1) steps — so a shorter turn is a shorter pin
        spinPx = full * (1 - MORPH_SLICE) * (travel / step / (0.8 * (N - 1)));
      };
      measure();

      // smoothed values chasing their targets — the port of the springs
      const s = { morph: 0, spin: 0, par: 0 };
      const t = { morph: 0, spin: 0, par: 0 };
      let introDone = false;

      // scaleX AND scaleY, not "scale": quickSetter resolves that alias to
      // the string "scaleX,scaleY" and then finds no setter for it, so the
      // original's ×1.8 silently never happened (measured 2026-10-01)
      const setters = cards.map((c) => ({
        x: gsap.quickSetter(c, "x", "px"),
        y: gsap.quickSetter(c, "y", "px"),
        r: gsap.quickSetter(c, "rotation", "deg"),
        sx: gsap.quickSetter(c, "scaleX"),
        sy: gsap.quickSetter(c, "scaleY"),
      }));

      /** The original's ring, verbatim, and the fan `measure` solved — a
       *  card's scale runs from 1/k (its 72×102 ring size) to 1 (its layout
       *  size), see the note on `baseW`. */
      const shape = (i: number, morph: number, spin: number, par: number) => {
        const minDim = Math.min(W, H);
        const circleR = Math.min(minDim * 0.35, 350);
        const cAng = (i / N) * 360 * RAD;
        const cx = Math.cos(cAng) * circleR;
        const cy = Math.sin(cAng) * circleR;
        const cRot = (i / N) * 360 + 90;

        const centerY = apexY + arcR;
        const aDeg = -90 + (i - mid) * step - spin * travel;
        const aRad = aDeg * RAD;
        const ax = Math.cos(aRad) * arcR + par;
        const ay = Math.sin(aRad) * arcR + centerY;

        return {
          x: lerp(cx, ax, morph),
          y: lerp(cy, ay, morph),
          rot: lerp(cRot, aDeg + 90, morph),
          scale: lerp(1 / k, 1, morph),
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
          setters[i].sx(p.scale);
          setters[i].sy(p.scale);
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
      // (scales are the original's 0.6 and 1, in ring units — i.e. over k)
      cards.forEach((c) => {
        gsap.set(c, {
          x: (Math.random() - 0.5) * 1500,
          y: (Math.random() - 0.5) * 1000,
          rotation: (Math.random() - 0.5) * 180,
          scale: 0.6 / k,
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
        scale: () => 1 / k,
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

      // ---- pointer sway, ±SWAY px like the original ------------------------
      const onMouse = (e: MouseEvent) => {
        const r = stage.getBoundingClientRect();
        t.par = ((e.clientX - r.left) / r.width) * 2 * SWAY - SWAY;
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
        // WHAT THE TICK WROTE BY HAND, matchMedia cannot revert (it only
        // knows the tweens). Leaving it crossed the 861px breakpoint
        // downward — an iPad turning to portrait — with the plain layer's
        // h1 and lead copy stuck at opacity 0 and shoved half off the left
        // edge by the arc's translate(-50%) (reviewer, 2026-10-01).
        arcEl?.style.removeProperty("opacity");
        arcEl?.style.removeProperty("transform");
        introEl?.style.removeProperty("opacity");
        stage.style.removeProperty("--mh-k");
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
