"use client";

import { useEffect, useRef } from "react";

// ============================================================================
// THE SUN LEAVES THE PICTURE.
//
// Arpine's own sun (public/hero/sun.webp, pulled out of her 2026-09-21 PDF at
// native resolution) starts small over the hills in the right part of the
// film hero, clear of her, and then scrolls away: it lifts, drifts, drops
// and sets behind the rising curtain, then travels down behind the whole
// page until it settles into the footer.
//
// IF IT EVER CROSSES HER, SHE STAYS IN FRONT — a real layer, not a cut. The
// film is one flat picture, so "behind her" has to be built: her own
// pixels are copied out of the playing video every frame onto a canvas that
// sits OVER the sun, opaque where she is and transparent where the hills
// are. (For a day the sun lived behind her head and this ran at rest; the
// sun now sits away from her, so it engages only if a journey leg overlaps
// her box.) A static mask traced off the poster was tried first; her hair
// drifts ±4px through the loop and the sun stopped short of it by that
// much — a sliver of hill between the two, which read as the sun being
// cut. The edge is decided per pixel, per frame instead:
// scratchpad/head-key.cjs measured, for every pixel her edge moves through,
// what colour the hill behind it is (the background is static across the
// loop), and a live pixel is hers when it is not that colour. See `Her`.
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

/** the sun file: 879×830 with real alpha; the disc is 550 wide inside it
 *  and the rays make up the rest (measured by scratchpad/sun-probe.cjs) */
const IMG_W = 879;
const IMG_H = 830;

/** Where the sun sits in the hero, in the SOURCE FRAME's own pixels — and
 *  the hero has two sources.
 *
 *  STILL: the painting (hero.webp). THE CENTRE IS THE DISC'S, NOT THE
 *  CENTROID'S: the crown is clipped by the top of the picture, so averaging
 *  the sun's pixels lands low. The centre of the largest inscribed circle is
 *  y=74, and built around it the sun is 538 wide (scratchpad/sun4.mjs).
 *
 *  FILM: her animated cut (intro.mp4, 1280×720) is framed tighter and has no
 *  sun of its own. The sun sits IN THE RIGHT PART OF THE FRAME, over the
 *  hills to the right of her, small (Vardan 2026-09-23: «place sun in right
 *  part, now it is under girl head, and in hero part make it smaller» —
 *  it had been a 360px disc behind her head). The disc is 210 of the
 *  frame's 1280 (336 with its rays). `cx, cy` place the FILE's centre, and
 *  the disc sits off-centre in the file — its centre is (414, 475) of
 *  879×830 — so (950, 217) lands the disc at ≈(940, 240): its top at y 135
 *  clears the nav bar on the widest, shortest screen (1886×835 crops the
 *  frame's top 69px and the bar covers to 120), its right edge at 1045
 *  stays inside the 1024-wide crop (visible frame x 160–1120), and it is
 *  340px of hills clear of her hair. The rays above run under the bar's
 *  frosted glass, and that is fine. `key` is the map of her outline for
 *  the live cut, which now only engages if the journey ever crosses her. */
type Frame = { w: number; h: number; cx: number; cy: number; sunW: number; key?: string };
const STILL: Frame = { w: 1427, h: 1102, cx: 414, cy: 74, sunW: 538 };
const FILM: Frame = { w: 1280, h: 720, cx: 950, cy: 217, sunW: (210 * IMG_W) / 550, key: "/hero/head-key.webp" };

/** on the journey the sun is this fraction of the viewport's width (with
 *  its rays) — the same size it has at home at 1440, so it neither grows nor
 *  shrinks as it sets off; the path's scales below are relative to this */
const JOURNEY_W = 0.29;

/** The journey, as fractions of the viewport. `p` is progress through the
 *  whole document. The first two legs are the ones the client asked for by
 *  name — right, then down — and they are deliberately quick: they happen
 *  while the hero is still on screen, which is what makes it read as the sun
 *  leaving the picture rather than a decoration that was always floating.
 *  `hx`: this key keeps the sun's HOME x (its place in the picture) rather
 *  than a viewport fraction — so the first leg can be a straight rise.
 *  `home`: scale is relative to the home size, not the journey size. */
type Key = { p: number; x: number; y: number; s: number; o: number; hx?: boolean; home?: boolean };
const PATH: Key[] = [
  { p: 0.0, x: 0, y: 0, s: 1, o: 1, home: true }, // start: over the hills, right of her
  // IT LIFTS FIRST, straight up (~150px of scroll), to 0.22 of the screen —
  // with the disc's radius at ~0.15 of the viewport height that keeps the
  // whole disc under the nav bar (76px) — and only then drifts on
  { p: 0.03, x: 0, y: 0.22, s: 1, o: 1, hx: true, home: true },
  { p: 0.08, x: 0.82, y: 0.3, s: 0.96, o: 1 }, // → a little right and down
  { p: 0.15, x: 0.84, y: 0.66, s: 0.8, o: 0.85 }, // → down, and it sets behind the curtain
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

/** her hair by colour — the same test scratchpad/head-key.cjs traced her
 *  with: her dark purple-brown base, or one of her magenta strands. A live
 *  pixel that passes is hers whatever the key says (it stops a dark strand
 *  over a dark hill from ever letting the sun through). */
const isHair = (r: number, g: number, b: number) => {
  const avg = (r + g + b) / 3;
  if (avg < 92 && r >= b - 12 && b >= g - 8) return true;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return mx - mn > 95 && avg < 165 && b > g + 25;
};

/** HER, read out of public/hero/head-key.webp (1280×720, the film's frame):
 *  alpha 128 = her for certain; alpha 255 = the band her edge moves
 *  through, whose RGB is the hill's colour at that pixel; alpha 0 = never
 *  her. Everything is kept in the frame's own pixels; the canvas is drawn
 *  at frame resolution and scaled by CSS exactly as the video is, so its
 *  copy and the video resample the same way. */
type Her = {
  /** her box in frame pixels */
  x0: number;
  y0: number;
  w: number;
  h: number;
  /** band pixels: offset inside the box (y*w+x) and the hill colour there */
  band: Int32Array;
  ref: Uint8Array;
  /** every pixel of the box: 0 never her, 1 band, 2 her for certain */
  zone: Uint8Array;
  /** her leftmost and rightmost pixel per row of the box, in frame px
   *  (−1 on rows without her) — the overlap test reads her real width at
   *  the sun's height, not her whole box (her hair fans out far below the
   *  sun, and a box test kept the copy running for a sun well clear of her) */
  rowL: Int16Array;
  rowR: Int16Array;
  /** her certain pixels, as column runs, for a clip path */
  path: Path2D;
};
function parseKey(img: HTMLImageElement, fw: number, fh: number): Her | null {
  const c = document.createElement("canvas");
  c.width = fw;
  c.height = fh;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) return null;
  g.drawImage(img, 0, 0, fw, fh);
  const d = g.getImageData(0, 0, fw, fh).data;
  let x0 = fw;
  let y0 = fh;
  let x1 = -1;
  let y1 = -1;
  let n = 0;
  for (let i = 0; i < fw * fh; i++) {
    const a = d[i * 4 + 3];
    if (!a) continue;
    const x = i % fw;
    const y = (i - x) / fw;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    if (a > 192) n++;
  }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const band = new Int32Array(n);
  const ref = new Uint8Array(n * 3);
  const zone = new Uint8Array(w * h);
  const rowL = new Int16Array(h).fill(-1);
  const rowR = new Int16Array(h).fill(-1);
  const path = new Path2D();
  let j = 0;
  for (let x = x0; x <= x1; x++) {
    let run = -1;
    for (let y = y0; y <= y1 + 1; y++) {
      const a = y <= y1 ? d[(y * fw + x) * 4 + 3] : 0;
      const i = (y - y0) * w + (x - x0);
      if (a > 64) {
        if (rowL[y - y0] < 0) rowL[y - y0] = x;
        rowR[y - y0] = x;
      }
      if (a > 192) {
        const o = (y * fw + x) * 4;
        band[j] = i;
        ref[j * 3] = d[o];
        ref[j * 3 + 1] = d[o + 1];
        ref[j * 3 + 2] = d[o + 2];
        zone[i] = 1;
        j++;
      }
      // her certain pixels come in vertical runs; one rect per run
      const hers = a > 64 && a <= 192;
      if (hers) zone[i] = 2;
      if (hers && run < 0) run = y;
      if (!hers && run >= 0) {
        path.rect(x, run, 1, y - run);
        run = -1;
      }
    }
  }
  return { x0, y0, w, h, band, ref, zone, rowL, rowR, path };
}

export default function Sun() {
  const wrap = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const cut = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!window.matchMedia(DESKTOP).matches) return;
    const el = img.current;
    const box = wrap.current;
    const her = cut.current;
    if (!el || !box || !her) return;

    const hero = document.querySelector<HTMLElement>(".ap-hero__img");
    if (!hero) return;
    /** the stuck stage that clips the film — her copy is clipped to it too */
    const stage = hero.closest<HTMLElement>(".ap-hero__stage");

    // the hero is the film on desktop today and was the painting before it;
    // both are handled, so putting the still back in HomeView costs nothing
    // here (see the two Frames above)
    const art: Frame = hero.tagName === "VIDEO" ? FILM : STILL;
    const video = hero.tagName === "VIDEO" ? (hero as HTMLVideoElement) : null;

    // ---- her layer -----------------------------------------------------------
    let me: Her | null = null;
    /** the live copy's pixels for her box, alpha decided per band pixel */
    let buf: ImageData | null = null;
    /** the band's keyed alpha, dense over the box, before the dilation */
    let keyed: Uint8Array | null = null;
    let off: CanvasRenderingContext2D | null = null;
    const ctx = her.getContext("2d");
    /** what to copy her from: the playing film, or its poster until the
     *  film has a frame (autoplay refused, or not yet loaded) */
    const poster = new Image();
    let posterOk = false;
    /** true once her copy has been drawn at least once — the sun stays
     *  invisible over her until then, or it would flash across her face */
    let ready = false;
    /** the key could not be loaded: the sun shows regardless, as it did
     *  before the key existed, rather than never at all */
    let keyFailed = false;
    /** the sun's first appearance has been animated */
    let dawned = false;
    /** the copy runs only while the sun (with its glow) overlaps her box */
    let active = false;
    let vfc = 0;
    let raf2 = 0;
    let lastT = -1;
    let lastSrc: CanvasImageSource | null = null;

    if (art.key && ctx && video) {
      her.width = art.w;
      her.height = art.h;
      poster.src = video.poster;
      poster.decode().then(() => (posterOk = true), () => undefined);
      const k = new Image();
      k.src = art.key;
      k.decode().then(
        () => {
          me = parseKey(k, art.w, art.h);
          if (!me) {
            keyFailed = true;
            draw();
            return;
          }
          const o = document.createElement("canvas");
          o.width = me.w;
          o.height = me.h;
          off = o.getContext("2d", { willReadFrequently: true });
          buf = ctx.createImageData(me.w, me.h);
          keyed = new Uint8Array(me.w * me.h);
          // the key can arrive after the first draw and after the settle
          // pass (the film is downloading at the same time): decide now
          // whether the sun is over her, and start her copy if so
          measure();
          draw();
        },
        () => {
          keyFailed = true;
          draw();
        },
      );
    } else keyFailed = true;

    /** copy her out of the current film frame. The band is keyed: a pixel
     *  is hers by how far its colour is from the hill's colour measured
     *  there (16 = still hill, 48 = fully her, soft in between), or outright
     *  if it is hair-coloured; below the band she simply is. */
    const render = (force = false) => {
      if (!me || !buf || !keyed || !off || !ctx || !video) return;
      const src: CanvasImageSource | null = video.readyState >= 2 ? video : posterOk ? poster : null;
      if (!src) return;
      const t = src === video ? video.currentTime : -1;
      if (!force && src === lastSrc && t === lastT) return;
      lastSrc = src;
      lastT = t;
      const { x0, y0, w, h, band, ref, zone, path } = me;
      off.drawImage(src, x0, y0, w, h, 0, 0, w, h);
      const px = off.getImageData(0, 0, w, h).data;
      const out = buf.data;
      for (let j = 0; j < band.length; j++) {
        const i = band[j];
        const o = i * 4;
        const r = px[o];
        const g = px[o + 1];
        const b = px[o + 2];
        const dr = r - ref[j * 3];
        const dg = g - ref[j * 3 + 1];
        const db = b - ref[j * 3 + 2];
        const d2 = dr * dr + dg * dg + db * db;
        let a = 255;
        if (d2 < 48 * 48) {
          if (d2 <= 16 * 16) a = 0;
          else {
            const u = (Math.sqrt(d2) - 16) / 32;
            a = Math.round(255 * u * u * (3 - 2 * u));
          }
          if (a < 255 && isHair(r, g, b)) a = 255;
        }
        // brighter than the hill by a clear margin is never her hair — it is
        // one of the film's drifting motes crossing the band, which keyed as
        // "not the hill" and painted a speck of itself over the sun
        if (a && r + g + b > ref[j * 3] + ref[j * 3 + 1] + ref[j * 3 + 2] + 72) a = 0;
        out[o] = r;
        out[o + 1] = g;
        out[o + 2] = b;
        keyed[i] = a;
      }
      // HER EDGE GROWS BY ONE PIXEL: a strand the colour of the hill behind
      // it keys as hill and leaves a pinhole of sun inside her hair, which
      // made her right edge speckle. Each band pixel takes the strongest
      // alpha of its 3×3 neighbourhood, so pinholes close and the sun stops
      // one frame pixel short of her hair — invisible, where the speckle was
      // not.
      for (let j = 0; j < band.length; j++) {
        const i = band[j];
        const x = i % w;
        const y = (i - x) / w;
        let m = keyed[i];
        for (let dy = -1; dy <= 1 && m < 255; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            const k = yy * w + xx;
            const z = zone[k];
            const v = z === 2 ? 255 : z === 1 ? keyed[k] : 0;
            if (v > m) m = v;
          }
        }
        out[i * 4 + 3] = m;
      }
      ctx.putImageData(buf, x0, y0);
      ctx.save();
      ctx.clip(path);
      ctx.drawImage(src, x0, y0, w, h, x0, y0, w, h);
      ctx.restore();
      if (!ready) {
        ready = true;
        draw();
      }
    };
    const tick = () => {
      vfc = 0;
      raf2 = 0;
      if (!active) return;
      render();
      schedule();
    };
    /** one copy per FILM frame where the browser can say when that is,
     *  else per animation frame (render() skips unchanged frames) */
    const schedule = () => {
      const v = video as (HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }) | null;
      if (v?.requestVideoFrameCallback) vfc = v.requestVideoFrameCallback(tick);
      else raf2 = requestAnimationFrame(tick);
    };
    const stop = () => {
      const v = video as (HTMLVideoElement & { cancelVideoFrameCallback?: (h: number) => void }) | null;
      if (vfc && v?.cancelVideoFrameCallback) v.cancelVideoFrameCallback(vfc);
      if (raf2) cancelAnimationFrame(raf2);
      vfc = 0;
      raf2 = 0;
    };

    /** the painted sun's screen position and size, from the hero's real
     *  geometry — it is `contain` on the plain layer and `cover` once the
     *  media expansion engages, so the fit has to be read, not assumed */
    let home = { x: 0, y: 0, w: 0 };
    /** the frame's box on screen: where the film's pixels actually are */
    let frame = { l: 0, t: 0, w: 0, h: 0, k: 1 };
    /** Where the sun stops being part of the picture and becomes scenery.
     *  Read from the hero's own laid-out height — which INCLUDES its pin
     *  spacer, so it is the real scroll distance the hero occupies — rather
     *  than a guessed fraction of the document. Until this point the sun is
     *  above the hero, or leaving the picture would mean disappearing into
     *  it; after it, the sun drops behind every section's content. */
    let handover = 0;
    /** the frame's place inside the hero's box: `cover` or `contain`, and
     *  object-position READ, not assumed — the desktop hero is 50% 45% */
    const locate = () => {
      const r = hero.getBoundingClientRect();
      const cs = getComputedStyle(hero);
      const cover = cs.objectFit === "cover";
      const [ox, oy] = cs.objectPosition.split(/\s+/);
      const posX = ox?.endsWith("%") ? parseFloat(ox) / 100 : 0.5;
      const posY = oy?.endsWith("%") ? parseFloat(oy) / 100 : 0.5;
      const k = cover ? Math.max(r.width / art.w, r.height / art.h) : Math.min(r.width / art.w, r.height / art.h);
      const w = art.w * k;
      const h = art.h * k;
      frame = { l: r.left + (r.width - w) * posX, t: r.top + (r.height - h) * posY, w, h, k };
    };
    const measure = () => {
      locate();
      home = { x: frame.l + art.cx * frame.k, y: frame.t + art.cy * frame.k, w: art.sunW * frame.k };
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

    /** SECTIONS THE SUN MUST NOT SHOW THROUGH — any section carrying
     *  `data-nosun` fades the sun in proportion to how much of it the
     *  section covers. Behind a wall of pictures you never see the whole
     *  disc, only slivers between them, and slivers of a pale yellow shape
     *  read as a stain on the artwork rather than as a sun (client
     *  2026-08-10, about the cloud: "central part like blurred it must not
     *  show that way"). The cloud no longer needs the attribute: it is an
     *  opaque layer above the sun now, so the sun sets behind its curtain
     *  and stays covered until the cloud has scrolled by — a fade on top of
     *  that made the sun dissolve in mid air before the curtain reached it
     *  (Vardan 2026-09-22). Nothing carries it today; the hook stays for a
     *  section that is not opaque. */
    const veils = [...document.querySelectorAll<HTMLElement>("[data-nosun]")];

    /** the glow's reach past the sun's own pixels (globals.css: a 42px
     *  drop-shadow) — her copy must cover the glow too */
    const GLOW = 96;
    let lastHer = "";
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
      // viewport fraction, so it begins exactly where it was painted; a key
      // marked `hx` keeps that x, which is what makes the first leg a rise
      const kx = (k: Key) => (k.p === 0 || k.hx ? home.x : k.x * window.innerWidth);
      const ky = (k: Key) => (k.p === 0 ? home.y : k.y * window.innerHeight);
      const ks = (k: Key) => (k.home ? k.s : (k.s * JOURNEY_W * window.innerWidth) / home.w);
      const x = lerp(kx(a), kx(b), t);
      const y = lerp(ky(a), ky(b), t);
      const s = lerp(ks(a), ks(b), t);
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

      // BEHIND HER HEAD. While the sun (glow included) overlaps her box —
      // and only while the sun is still the hero's — her copy runs over it:
      // the canvas is laid exactly on the film's frame, read from the hero's
      // LIVE box every frame (the scrub pushes the film in and parallaxes
      // it), with the same filter the scrub puts on the film, masked to the
      // sun's neighbourhood so the copy's edge never shows over the rest of
      // her, and CLIPPED TO THE STAGE. The stage clips the film; a fixed
      // canvas is clipped by nothing, and once the stuck stage slid up under
      // the curtain the copy kept painting her shoulders over the next
      // section's ground (Vardan 2026-09-22, screenshot of the cloud
      // section with a slice of her neck across it).
      let hit = false;
      if (me && ctx) {
        locate();
        if (window.scrollY < handover) {
          // the sun's box (glow included) in the frame's own pixels, against
          // her real width on each row it spans
          const k = frame.k;
          const sx0 = (dx - GLOW - frame.l) / k;
          const sx1 = (dx + dw + GLOW - frame.l) / k;
          const ya = Math.max(0, Math.floor((dy - GLOW - frame.t) / k) - me.y0);
          const yb = Math.min(me.h - 1, Math.ceil((dy + dh + GLOW - frame.t) / k) - me.y0);
          for (let ry = ya; ry <= yb && !hit; ry++) {
            const l = me.rowL[ry];
            if (l >= 0 && sx0 < me.rowR[ry] + 1 && sx1 > l) hit = true;
          }
        }
        if (hit) {
          const cx = x - frame.l;
          const cy = y - frame.t;
          const rx = dw / 2 + GLOW;
          const ry = dh / 2 + GLOW;
          const mask = `radial-gradient(ellipse ${rx.toFixed(0)}px ${ry.toFixed(0)}px at ${cx.toFixed(0)}px ${cy.toFixed(0)}px, #000 calc(100% - 56px), transparent)`;
          const st = stage?.getBoundingClientRect();
          const clip = st
            ? `inset(${Math.max(0, st.top - frame.t).toFixed(1)}px ${Math.max(0, frame.l + frame.w - st.right).toFixed(1)}px ${Math.max(0, frame.t + frame.h - st.bottom).toFixed(1)}px ${Math.max(0, st.left - frame.l).toFixed(1)}px)`
            : "none";
          const geo = `${frame.l.toFixed(1)},${frame.t.toFixed(1)},${frame.w.toFixed(1)},${frame.h.toFixed(1)}|${mask}|${clip}|${getComputedStyle(hero).filter}`;
          if (geo !== lastHer) {
            lastHer = geo;
            her.style.width = `${frame.w}px`;
            her.style.height = `${frame.h}px`;
            her.style.transform = `translate3d(${frame.l}px, ${frame.t}px, 0)`;
            her.style.filter = getComputedStyle(hero).filter;
            her.style.clipPath = clip;
            her.style.setProperty("mask-image", mask);
            her.style.setProperty("-webkit-mask-image", mask);
          }
          if (!active) {
            active = true;
            her.dataset.on = "";
            render(true);
            schedule();
          }
        } else if (active) {
          active = false;
          stop();
          delete her.dataset.on;
        }
      }
      // over her, the sun waits for her copy — and while the key is still
      // on its way it is assumed to be over her as long as it has not left
      // home; elsewhere it needs nothing
      const overHer = hit || (!me && !keyFailed && p < PATH[2].p);
      const hidden = overHer && !ready;
      el.style.opacity = hidden ? "0" : String(o * (1 - ease(veil)));
      // it was held invisible until the key had been read (a few hundred
      // ms); when it first shows it dawns rather than pops. A one-off
      // animation, so the scroll-driven opacity written inline above is
      // untouched once it ends.
      if (!hidden && !dawned) {
        dawned = true;
        el.animate([{ opacity: 0 }, { opacity: el.style.opacity }], { duration: 900, easing: "ease-out" });
      }

      // THE HERO'S SUN, THEN SCENERY. While the hero is on screen the sun
      // sits at 1: over the stuck stage (the film), under the title and
      // under the cloud's curtain, both at 2 — so as the curtain rises the
      // sun SETS behind it, a real occlusion, instead of fading out in mid
      // air. From the handover on it drops to 0, behind every section's
      // content, and comes back up over the gallery's sky from behind the
      // cloud's bottom edge.
      if (window.scrollY > handover) {
        box.dataset.behind = "";
        delete box.dataset.hero;
      } else {
        delete box.dataset.behind;
        box.dataset.hero = "";
      }
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    const onResize = () => {
      measure();
      draw();
    };

    measure();
    draw();
    box.dataset.on = "";
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
      active = false;
      stop();
      delete her.dataset.on;
      delete box.dataset.hero;
      delete box.dataset.behind;
      delete box.dataset.on;
    };
  }, []);

  return (
    <>
      <div className="ap-sun" ref={wrap} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- positioned by
            transform against measured hero geometry; next/image's own wrapper
            fights that, and this is one small decorative cutout */}
        <img ref={img} className="ap-sun__disc" src="/hero/sun.webp" alt="" width={IMG_W} height={IMG_H} />
      </div>
      {/* her, copied live out of the film, over the sun — see the header */}
      <canvas ref={cut} className="ap-sun__her" aria-hidden="true" />
    </>
  );
}
