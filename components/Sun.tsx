"use client";

import { useEffect, useRef } from "react";

// ============================================================================
// THE SUN LEAVES THE PICTURE.
//
// Arpine's hero illustration has a big hand-painted sun in its top-left. It is
// cut out of the artwork (public/hero/sun.webp, a real alpha cutout made by
// flood-filling the disc and rebuilding the crown the image edge had clipped),
// and the hero is swapped for a plate with the sun painted out
// (hero-nosun.webp, diffusion-inpainted). At rest the two line up exactly, so
// the hero looks untouched. Then it scrolls: the sun slides right, drops, and
// travels down behind the whole page until it settles into the footer.
//
// THE PLATE SWAP IS DONE HERE, IN JS, ON PURPOSE. The plain layer — phones, no
// JS, reduced motion — never runs this, keeps `/hero/hero.webp`, and therefore
// keeps its painted sun. Baking the sunless plate into the markup would leave
// those visitors looking at a sky with nothing in it.
//
// PROGRESS IS HAND-COMPUTED, NOT ScrollTrigger. This page pins three sections,
// and with pins present nothing ScrollTrigger-based can measure the end of the
// document — refresh() measures with every pin-spacer reverted, so a trigger on
// main, an absolute maxScroll, and an end-of-main sentinel all read ~1440px too
// high and report progress 1 for the whole last screen. Same trap, same fix as
// components/FootReveal.tsx: read scrollHeight at scroll time, in a
// rAF-throttled listener, when the pins have already been applied.
// ============================================================================

const DESKTOP = "(min-width: 861px) and (prefers-reduced-motion: no-preference)";

/** THE SUN IS HER OWN FILE NOW (client, change.pdf p8, 2026-09-21: «aren't
 *  we bringing that gorgeous sun back?», with the sun attached — it is
 *  embedded in the PDF at 928×905 with real alpha and was pulled out of it
 *  by scratchpad/pdfimages.mjs, trimmed to 879×830). It replaces the cutout
 *  that used to be flood-filled out of the painting. */
const IMG_W = 879;
const IMG_H = 830;

/** Where the sun sits in the hero, in the SOURCE FRAME's own pixels — and
 *  the hero has two sources.
 *
 *  STILL: the painting (hero.webp). THE CENTRE IS THE DISC'S, NOT THE
 *  CENTROID'S. Averaging every sun pixel put it at y=126 and produced a
 *  506x376 OVAL, because the crown is clipped by the top of the picture and
 *  the missing pixels drag the average down. The disc's real centre is the
 *  point furthest from any edge of the shape — the centre of the largest
 *  inscribed circle, which a distance transform finds and which does not
 *  care what the image edge cut off. That is y=74, and built around it the
 *  sun comes out 538 wide, round like the painting. See scratchpad/sun4.mjs.
 *
 *  FILM: her animated cut (intro.mp4, 1280×720) is framed tighter and has no
 *  sun of its own — which is why the sun stayed out of the page for a month
 *  (a sun over a sky she did not paint one into felt invented). She asked
 *  for it back, so it takes the corner it came from: the painting's sun sat
 *  29% in from the left and cut off by the top edge; here it sits at the
 *  same corner, whole, above her hair. Fractions of the frame, so it lands
 *  on the same pixels of the film at every viewport. */
type Frame = {
  w: number;
  h: number;
  cx: number;
  cy: number;
  sunW: number;
  /** HER HEAD, as an ellipse in fractions of the frame — where the sun must
   *  not paint, so it reads as BEHIND her (Vardan 2026-09-21, screenshot of
   *  the disc over her eye: «move sun behind girl head and a bit top, it
   *  must start from there»). The film is one flat layer, so "behind" is a
   *  mask: the part of the sun inside this ellipse is cut away. Read off the
   *  poster frame (1280×720): the crown at y 215, the face centred at x 370,
   *  the hair 180–540 wide at eye level — an ellipse centred at (0.289,
   *  0.62) with radii 0.16 × 0.32 has its top at the crown and is hair-wide
   *  at the eyes. Her hair drifts a few pixels in the film; the mask is
   *  static against the frame and a soft edge covers the difference. */
  head?: { cx: number; cy: number; rx: number; ry: number };
};
const STILL: Frame = { w: 1427, h: 1102, cx: 414, cy: 74, sunW: 538 };
// The sun rises from behind her head: its centre a little above the crown
// (0.30), so the upper half and the rays show over her hair and the lower
// half is hidden by the head mask. It leaves to the right from there.
const FILM: Frame = {
  w: 1280,
  h: 720,
  cx: 1280 * 0.289,
  cy: 720 * 0.26,
  sunW: 1280 * 0.22,
  head: { cx: 0.289, cy: 0.62, rx: 0.16, ry: 0.32 },
};

/** The journey, as fractions of the viewport. `p` is progress through the
 *  whole document. The first two legs are the ones the client asked for by
 *  name — right, then down — and they are deliberately quick: they happen
 *  while the hero is still on screen, which is what makes it read as the sun
 *  leaving the picture rather than a decoration that was always floating. */
type Key = { p: number; x: number; y: number; s: number; o: number };
const PATH: Key[] = [
  { p: 0.0, x: 0, y: 0, s: 1, o: 1 }, // start: exactly on the painted sun
  { p: 0.06, x: 0.78, y: 0.14, s: 0.92, o: 1 }, // → right
  { p: 0.15, x: 0.84, y: 0.66, s: 0.8, o: 0.85 }, // → down
  // OPACITY IS TUNED TO WHAT IT CROSSES, and it has to be. The sun is pale
  // yellow: against the dark bands (the cloud and the gallery) a third of it
  // is plenty and more would glare, but the same value over cream paper is
  // invisible — measured at p=0.80, where 0.41 left nothing on screen at all.
  // So it is held low through the dark sections and lifted through the light
  // ones, which is also what a sun crossing a sky would do.
  { p: 0.34, x: 0.2, y: 0.34, s: 0.66, o: 0.4 }, // cloud — dark
  { p: 0.55, x: 0.74, y: 0.6, s: 0.6, o: 0.34 }, // gallery — dark
  { p: 0.76, x: 0.22, y: 0.3, s: 0.7, o: 0.66 }, // shop — paper
  { p: 0.93, x: 0.58, y: 0.78, s: 0.9, o: 0.82 }, // studio — paper
  // IT SETS. Measured, not guessed: the footer is 310px tall and the sun is
  // ~536px, so it cannot sit inside without covering something — the first
  // attempt landed dead centre and cut "drawn by hand" in half. The tagline's
  // glyphs end at x≈580 and the Privacy/Terms links start at x=1215, so the
  // sun drops into the gap between them and mostly below the fold, leaving a
  // half-sun on the horizon and every word of the footer legible.
  { p: 1.0, x: 0.62, y: 1.06, s: 1.05, o: 0.95 },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** smoothstep — a linear ramp between keys makes the sun visibly change
 *  direction at each one, like a paper cut-out being dragged */
const ease = (t: number) => t * t * (3 - 2 * t);

export default function Sun() {
  const wrap = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!window.matchMedia(DESKTOP).matches) return;
    const el = img.current;
    const box = wrap.current;
    if (!el || !box) return;

    const hero = document.querySelector<HTMLElement>(".ap-hero__img");
    if (!hero) return;

    // the hero is the film on desktop today and was the painting before it;
    // both are handled, so putting the still back in HomeView costs nothing
    // here (see the two Frames above)
    const art: Frame = hero.tagName === "VIDEO" ? FILM : STILL;

    // The sunless plate is chosen by <picture> in HomeView, not swapped here.
    // A JS swap made desktop download both plates and showed the change; the
    // <source> media query is the same gate as this component's, so the two
    // cannot disagree — if this effect is running, scripting is enabled and
    // the browser has already resolved to the sunless plate.
    box.dataset.on = "";

    /** the painted sun's screen position and size, from the hero's real
     *  geometry — it is `contain` on the plain layer and `cover` once the
     *  media expansion engages, so the fit has to be read, not assumed */
    let home = { x: 0, y: 0, w: 0 };
    /** whether the hero fills its box (cover) or sits inside it (contain) —
     *  read once, used by the head mask every frame */
    let cover = true;
    /** Where the sun stops being part of the picture and becomes scenery.
     *  Read from the hero's own laid-out height — which INCLUDES its pin
     *  spacer, so it is the real scroll distance the hero occupies — rather
     *  than a guessed fraction of the document. Until this point the sun is
     *  above the hero, or leaving the picture would mean disappearing into
     *  it; after it, the sun drops behind every section's content. */
    let handover = 0;
    const measure = () => {
      const r = hero.getBoundingClientRect();
      const fit = getComputedStyle(hero).objectFit;
      cover = fit === "cover";
      const k = cover ? Math.max(r.width / art.w, r.height / art.h) : Math.min(r.width / art.w, r.height / art.h);
      const dw = art.w * k;
      const dh = art.h * k;
      // object-position is 50% 50% on both branches
      home = {
        x: r.left + (r.width - dw) / 2 + art.cx * k,
        y: r.top + (r.height - dh) / 2 + art.cy * k,
        w: art.sunW * k,
      };
      el.style.width = `${home.w}px`;
      el.style.height = `${(IMG_H / IMG_W) * home.w}px`;

      const heroSec = hero.closest<HTMLElement>(".ap-hero");
      // half a screen before the picture is gone: by then it is mostly
      // covered, so the change of depth happens where there is nothing to
      // see it against. "Gone" is when the NEXT section has slid over it
      // (the curtain, globals.css — the hero's box runs 100svh past that
      // point, so the box's own last pixel would be a screen too late).
      const after = heroSec?.nextElementSibling as HTMLElement | null;
      const gone = heroSec ? (after ? after.offsetTop : heroSec.offsetTop + heroSec.offsetHeight) : 0;
      handover = heroSec ? gone - window.innerHeight * 0.5 : 0;
    };

    /** SECTIONS THE SUN MUST NOT PASS BEHIND.
     *
     *  Over open ground the cutout reads as what it is — the gallery's dark
     *  sky has room around the sphere and a painted sun sits in it happily.
     *  Behind the cloud's wall of 57 cards you never see the whole disc, only
     *  the slivers between pictures, and slivers of a pale yellow shape read
     *  as a stain on the artwork rather than as a sun (client 2026-08-10:
     *  "central part like blurred it must not show that way"). So it fades
     *  out in proportion to how much of it that section is covering, and
     *  comes back the moment it is clear again. */
    const veils = [...document.querySelectorAll<HTMLElement>("[data-nosun]")];

    let raf = 0;
    const draw = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;

      let i = 0;
      while (i < PATH.length - 2 && p > PATH[i + 1].p) i++;
      const a = PATH[i];
      const b = PATH[i + 1];
      const t = ease(b.p === a.p ? 0 : Math.min(1, Math.max(0, (p - a.p) / (b.p - a.p))));

      // leg 0 starts from the sun's real place in the picture rather than a
      // viewport fraction, so it begins exactly where it was painted
      const ax = a.p === 0 ? home.x : a.x * window.innerWidth;
      const ay = a.p === 0 ? home.y : a.y * window.innerHeight;
      const x = lerp(ax, b.x * window.innerWidth, t);
      const y = lerp(ay, b.y * window.innerHeight, t);
      const s = lerp(a.s, b.s, t);
      const o = lerp(a.o, b.o, t);

      const h = (IMG_H / IMG_W) * home.w;
      el.style.transform = `translate3d(${x - home.w / 2}px, ${y - h / 2}px, 0) scale(${s})`;

      // the disc's box on screen, computed rather than measured — scale is
      // about the centre, and asking for a rect here would force a layout
      // every frame right after writing the transform
      const dw = home.w * s;
      const dh = h * s;
      const dx = x - dw / 2;
      const dy = y - dh / 2;
      let veil = 0;
      for (const sec of veils) {
        const r = sec.getBoundingClientRect();
        const ox = Math.max(0, Math.min(dx + dw, r.right) - Math.max(dx, r.left));
        const oy = Math.max(0, Math.min(dy + dh, r.bottom) - Math.max(dy, r.top));
        const f = dw * dh > 0 ? (ox * oy) / (dw * dh) : 0;
        if (f > veil) veil = f;
      }
      el.style.opacity = String(o * (1 - ease(veil)));

      // BEHIND HER HEAD. The mask lives on the fixed, viewport-sized box, so
      // its coordinates are the screen's and the disc can fly through it.
      // The head is read from the hero's LIVE box every frame — the scrub
      // pushes the film in and parallaxes it up, and the mask follows —
      // and the mask is only written while the disc actually overlaps the
      // head's box; elsewhere it is "none", so a full-screen gradient is
      // not rasterised on every scroll frame of the page.
      if (art.head) {
        const r = hero.getBoundingClientRect();
        const k = cover ? Math.max(r.width / art.w, r.height / art.h) : Math.min(r.width / art.w, r.height / art.h);
        const fw = art.w * k;
        const fh = art.h * k;
        const ex = r.left + (r.width - fw) / 2 + art.head.cx * fw;
        const ey = r.top + (r.height - fh) / 2 + art.head.cy * fh;
        const erx = art.head.rx * fw;
        const ery = art.head.ry * fh;
        const hit = dx < ex + erx && dx + dw > ex - erx && dy < ey + ery && dy + dh > ey - ery;
        const mask = hit
          ? `radial-gradient(${erx.toFixed(1)}px ${ery.toFixed(1)}px at ${ex.toFixed(1)}px ${ey.toFixed(1)}px, transparent 96%, #000 100%)`
          : "none";
        if (mask !== lastMask) {
          lastMask = mask;
          box.style.setProperty("mask-image", mask);
          box.style.setProperty("-webkit-mask-image", mask);
        }
      }

      // in front of the hero while it is still the hero's sun, behind the
      // page's content from there on
      if (window.scrollY > handover) box.dataset.behind = "";
      else delete box.dataset.behind;
    };
    let lastMask = "";

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    const onResize = () => {
      measure();
      draw();
    };

    measure();
    draw();
    // the hero's own plate finishes loading after this runs, and the media
    // expansion changes object-fit — both move where the sun belongs
    const settle = window.setTimeout(onResize, 900);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.clearTimeout(settle);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
      delete box.dataset.on;
    };
  }, []);

  return (
    <div className="ap-sun" ref={wrap} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- positioned by
          transform against measured hero geometry; next/image's own wrapper
          fights that, and this is one small decorative cutout */}
      <img ref={img} className="ap-sun__disc" src="/hero/sun.webp" alt="" width={IMG_W} height={IMG_H} />
    </div>
  );
}
