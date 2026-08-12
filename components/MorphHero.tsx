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
//   further   the arc rotates through the deck, clamped to 0.8 × spread so
//             the last card never leaves
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

/** How much of the pin the ring→arc morph takes; the rest shuffles the deck. */
const MORPH_SLICE = 0.22;

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
  intro: string;
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

      /** The original's two polar layouts, verbatim. */
      const shape = (i: number, morph: number, spin: number, par: number) => {
        const minDim = Math.min(W, H);
        const circleR = Math.min(minDim * 0.35, 350);
        const cAng = ((i / N) * 360 * Math.PI) / 180;
        const cx = Math.cos(cAng) * circleR;
        const cy = Math.sin(cAng) * circleR;
        const cRot = (i / N) * 360 + 90;

        const arcR = Math.min(W, H * 1.5) * 1.1;
        const centerY = H * 0.25 + arcR;
        const spread = 130;
        const start = -90 - spread / 2;
        const step = spread / (N - 1);
        const bounded = -spin * spread * 0.8;
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
        end: () => "+=" + window.innerHeight * 1.9,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          t.morph = Math.min(1, self.progress / MORPH_SLICE);
          t.spin = Math.max(0, (self.progress - MORPH_SLICE) / (1 - MORPH_SLICE));
        },
        onRefresh: () => {
          W = stage.offsetWidth;
          H = stage.offsetHeight;
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
          <p className="ap-mh__line">{intro}</p>
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
