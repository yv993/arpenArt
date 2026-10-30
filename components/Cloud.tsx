"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { add, dram, unit } from "@/lib/cart";
import { flyToCart } from "@/lib/fly";
import { withheldArt } from "@/lib/content";
import dynamic from "next/dynamic";
import { puzzles } from "@/lib/puzzles";
import type { PuzzleCopy, PuzzleSaved } from "./Puzzle";
import MapBoundary from "./MapBoundary";

// THE PUZZLE COMES WHEN IT IS ASKED FOR: its code is not in the home page's
// first load (nothing needs it until «Play the puzzle» is pressed), and it
// sits in a MapBoundary below, so a chunk that is gone after a deploy (a tab
// left open across one) fails alone — back to the picture — instead of
// throwing to app/error.tsx and taking the whole home page with it (the
// same reason GlobeCanvas and the store map sit in one).
const Puzzle = dynamic(() => import("./Puzzle"), { ssr: false });

/** a jigsaw piece, the panel's sign for «Play the puzzle» (one tab out on
 *  top and right, a blank on the bottom and left) */
const PieceIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path
      fill="currentColor"
      d="M3 4h3.2a1.8 1.8 0 1 1 3.6 0H13v3.2a1.8 1.8 0 1 1 0 3.6V14H9.8a1.8 1.8 0 1 0-3.6 0H3v-3.2a1.8 1.8 0 1 0 0-3.6V4z"
    />
  </svg>
);

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
  })
    // THE MOUNTED CARDS ARE GONE (client, change.pdf p2, 2026-09-15: «too
    // many pictures, and some have a white frame — remove the white-framed
    // ones from this section»). Filtered AFTER the scatter, so the cards
    // that stay keep the exact positions they always had — the frame simply
    // has fewer, and none with a mount.
    .filter((p) => !p.mount);
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
  puzzle,
}: {
  /** what a chosen picture says — see home.strip in lib/content.ts */
  pick: { line: string; body: string; cta: string };
  /** the puzzle's interface words (home.strip.puzzle) — a picture with
   *  pieces in lib/puzzles.ts offers «Play the puzzle» in its panel */
  puzzle: PuzzleCopy;
  items: Art[];
  kicker: string;
  /** the title's LINES — the break is the client's (change.pdf p2,
   *  2026-09-21), so it is data, not a wrap the viewport happens to make */
  title: string[];
  copy: string;
}) {
  const root = useRef<HTMLDivElement | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  /** the PLAIN layer (phones, reduced motion): a card there opens the panel
   *  under the rail — a disclosure, not a picture growing in place — so it
   *  is named and stated as one (2026-10-05 package). False on the server
   *  and on the desktop moved layer, whose card stays exactly as it was. */
  const [plain, setPlain] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(DESKTOP);
    const read = () => setPlain(!m.matches);
    read();
    m.addEventListener("change", read);
    return () => m.removeEventListener("change", read);
  }, []);
  const infoId = useId();
  /** "No. n" — where focus goes when a card on the plain layer opens it */
  const noRef = useRef<HTMLParagraphElement | null>(null);
  /** set by a card press (not by ‹ ›, whose own button keeps focus) */
  const focusNo = useRef(false);
  // every picture opens on its front; the switcher below the note changes it
  const [view, setView] = useState<View>("front");
  /** the page mid-turn. Forward: the OLD face rides on top, turning away,
   *  the new one already beneath. Backward: the NEW face turns back in on
   *  top, while the old one holds beneath until it is covered. */
  type Face = { src?: string; w?: number; h?: number };
  const [page, setPage] = useState<{ over: Face; under?: Face; dir: 1 | -1 } | null>(null);

  // THE PUZZLE (Vardan, 2026-10-29). A picture with pieces (lib/puzzles.ts —
  // No. 05 today) offers «Play the puzzle» in its panel. On the desktop
  // moved layer the cloud's own frame becomes the room: the cards fade out,
  // the panel steps aside, the plane's drag and the panel's keys stand down
  // (`playingRef`), and the puzzle's bar brings the picture back. On the
  // plain layer it opens as a window over the page. Leaving keeps the game
  // (`puzzleMemory`), so coming back finds the pieces where they were left.
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  playingRef.current = playing;
  const puzzleMemory = useRef<Record<string, PuzzleSaved | undefined>>({});
  const playBtn = useRef<HTMLButtonElement | null>(null);
  const wasPlaying = useRef(false);
  const startPuzzle = useCallback(() => {
    // the desktop room is the frame: bring the whole of it on screen first,
    // or the board can open half under the fold
    const frame = root.current?.querySelector<HTMLElement>(".ap-cloud__frame");
    if (frame && window.matchMedia(DESKTOP).matches) {
      const top = frame.getBoundingClientRect().top;
      if (Math.abs(top) > 2) window.scrollTo({ top: window.scrollY + top, behavior: "smooth" });
    }
    setPlaying(true);
  }, []);
  const stopPuzzle = useCallback(() => setPlaying(false), []);
  // the way back lands on the button that opened it
  useEffect(() => {
    // …but only when focus was in the puzzle (it is on <body> once the
    // puzzle's pieces are gone) or still in the cloud — never pulled out of
    // somewhere else the reader has gone (review, 2026-10-29)
    if (wasPlaying.current && !playing)
      requestAnimationFrame(() => {
        const a = document.activeElement;
        if (!a || a === document.body || root.current?.contains(a)) playBtn.current?.focus({ preventScroll: true });
      });
    wasPlaying.current = playing;
  }, [playing]);

  useEffect(() => {
    setView("front");
    setPage(null);
    setPlaying(false);
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
  /** the open picture is not sold as a postcard — see the buy row below */
  const notACard = !!chosen && !!withheldArt.postcards?.includes(chosen);
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

  // THE DRAG IS BACK (client, change 4.pdf p1, 2026-10-12: «Էն ժամանակ լինում
  // էր քլիք անել վրա ու շարժել, հիմա չի լինում» — "back then you could click
  // on it and move it, now you can't"). She had asked it removed on
  // 2026-08-06, and with it went the pointer-capture dance, the click slop,
  // the timestamp guard and the throw's friction; the new note wins, so all
  // of that is rebuilt below (inside the DESKTOP match, so the phone rail —
  // a native horizontal scroller since the 2026-10-05 pass — never sees it):
  //   · a press that travels under SLOP px is a CLICK and reaches the card's
  //     own onClick untouched (nothing is captured until the slop is passed,
  //     so the browser still delivers the click to the card);
  //   · past the slop the FRAME captures the pointer and the plane follows
  //     the hand; the click the browser then fires lands on the frame, and
  //     `dragEndAt` makes both the frame's click-away and a card's onClick
  //     ignore it;
  //   · on release the plane coasts with the hand's last velocity under
  //     friction, inside a SOFT LIMIT: a free range big enough to bring the
  //     far side of the plane on screen (plus a quarter-screen of play, since
  //     at 1440 the whole scatter already fits), a rubber band beyond it,
  //     and a spring back to the range at rest — the plane cannot be thrown
  //     away to nowhere.
  // `pan` is the plane's translation; `rest` is where the hand last left it,
  // which is where the plane returns when a picked card is put back.
  const pan = useRef({ x: 0, y: 0 });
  const rest = useRef({ x: 0, y: 0 });
  /** the throw: on while coasting / springing back; px per second */
  const fling = useRef({ on: false, vx: 0, vy: 0 });
  /** performance.now() of the last drag's release — the click that the
   *  browser fires right after it must not open or close anything */
  const dragEndAt = useRef(0);
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

      // ---- the DRAG and the THROW (restored 2026-10-12, change 4.pdf p1) --
      const frame = el.querySelector<HTMLElement>(".ap-cloud__frame");
      /** a press travelling less than this is a click (UX laws: ~6px slop) */
      const SLOP = 6;
      /** the free range of the pan, in plane px, and the play beyond it */
      let lo = { x: 0, y: 0 };
      let hi = { x: 0, y: 0 };
      let play = { x: 0, y: 0 };
      /** the cards' box in the frame at pan 0 — from their --x/--y/--w
       *  against the plane, so the float plays no part — sets the range: far
       *  enough that the farthest card can be brought 6% inside the frame's
       *  edge, never so far that the whole scatter leaves the screen, plus a
       *  quarter-screen of play each way so the cloud can always be moved
       *  (at 1440×900 the scatter already fits the frame, and without the
       *  play there would be nothing to drag). */
      const measureBounds = () => {
        if (!frame) return;
        const fr = frame.getBoundingClientRect();
        const pr = plane.getBoundingClientRect();
        let L = Infinity;
        let R = -Infinity;
        let T = Infinity;
        let B = -Infinity;
        for (const c of cards) {
          const x = (parseFloat(c.style.getPropertyValue("--x")) / 100) * pr.width;
          const y = (parseFloat(c.style.getPropertyValue("--y")) / 100) * pr.height;
          const r = c.getBoundingClientRect();
          const cx = pr.left - pan.current.x - fr.left + x;
          const cy = pr.top - pan.current.y - fr.top + y;
          L = Math.min(L, cx - r.width / 2);
          R = Math.max(R, cx + r.width / 2);
          T = Math.min(T, cy - r.height / 2);
          B = Math.max(B, cy + r.height / 2);
        }
        if (!Number.isFinite(L)) return;
        const mx = fr.width * 0.06;
        const my = fr.height * 0.06;
        play = { x: fr.width * 0.25, y: fr.height * 0.22 };
        lo = { x: Math.min(0, fr.width - mx - R) - play.x, y: Math.min(0, fr.height - my - B) - play.y };
        hi = { x: Math.max(0, mx - L) + play.x, y: Math.max(0, my - T) + play.y };
      };
      /** the rubber band: past the free range the plane follows the hand at
       *  a third of its travel, and never more than 60% of the play beyond */
      const rubber = (v: number, a: number, b: number, p: number) =>
        v < a ? a - Math.min(p * 0.6, (a - v) * 0.3) : v > b ? b + Math.min(p * 0.6, (v - b) * 0.3) : v;
      type Sample = { x: number; y: number; t: number };
      let down: { id: number; x: number; y: number; t: number; px: number; py: number; dragging: boolean; samples: Sample[] } | null = null;
      let dirty = false;

      const onDown = (e: PointerEvent) => {
        if (!frame) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        // the info panel's own controls (and its scrolling sheet) keep the
        // pointer; so does anything outside the plane's room
        if ((e.target as HTMLElement).closest(".ap-cloud__info")) return;
        // while the puzzle is out the frame is its room: a press there moves
        // a piece, never the hidden plane (2026-10-29)
        if (playingRef.current || (e.target as HTMLElement).closest(".ap-pz, .ap-pz__bar")) return;
        // a press takes over from whatever was moving the plane — a throw
        // still coasting, or the centring tween of a picked card
        gsap.killTweensOf(pan.current);
        fling.current.on = false;
        fling.current.vx = 0;
        fling.current.vy = 0;
        // A NEW PRESS CLEARS THE LAST DRAG'S GUARD (review fix, 2026-10-12).
        // The click the guard exists for is the one the browser fires at the
        // END of a drag, and it always arrives before the next pointerdown;
        // left as a bare time window it also swallowed a clean press on a
        // card made within 400ms of the release — drag, then click the card
        // now under the hand: nothing opened (measured: a press 300ms after
        // a drag chose nothing, 420ms chose the card).
        dragEndAt.current = 0;
        measureBounds();
        down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, px: pan.current.x, py: pan.current.y, dragging: false, samples: [] };
      };
      const onMove = (e: PointerEvent) => {
        if (!frame || !down || e.pointerId !== down.id) return;
        // NO BUTTON, NO PRESS (review fix, 2026-10-12). Until the slop is
        // passed nothing is captured, so a press that leaves the frame
        // before 6px of travel — a few px under the nav bar, released on
        // the bar — never showed the frame its release: `down` stayed set,
        // and from then on every bare mouse move over the frame panned the
        // plane with the cursor stuck at `grabbing` (measured at 1440×900:
        // 14 hover moves carried the plane 290×286px). A hover-capable
        // pointer that reports no primary button is not pressing; a touch
        // always is while it is in contact.
        if (e.pointerType !== "touch" && !(e.buttons & 1)) {
          if (down.dragging) onUp(e);
          else down = null;
          return;
        }
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        if (!down.dragging) {
          // the click/drag decision: travel past the slop, or a press held
          // a third of a second that has started to move — never a tap
          const dist = Math.hypot(dx, dy);
          if (dist < SLOP && !(e.timeStamp - down.t > 300 && dist >= 2)) return;
          down.dragging = true;
          // CAPTURE ON THE FRAME, AND ONLY NOW: captured at pointerdown, the
          // browser would fire the following click at the frame instead of
          // the card, and a clean press could never open a picture
          try {
            frame.setPointerCapture(e.pointerId);
          } catch {
            /* a pointer already gone (pen lifted between events) — the move still counts */
          }
          frame.dataset.drag = "";
        }
        pan.current.x = rubber(down.px + dx, lo.x, hi.x, play.x);
        pan.current.y = rubber(down.py + dy, lo.y, hi.y, play.y);
        dirty = true;
        down.samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
        if (down.samples.length > 8) down.samples.shift();
      };
      const onUp = (e: PointerEvent) => {
        if (!frame || !down || e.pointerId !== down.id) return;
        const was = down;
        down = null;
        // the hand is off whatever happened: never leave the grabbing
        // cursor behind (review fix, 2026-10-12)
        delete frame.dataset.drag;
        // a clean press: the click the browser fires next opens (or puts
        // back) the card, exactly as a keyboard press would
        if (!was.dragging) return;
        if (frame.hasPointerCapture(e.pointerId)) frame.releasePointerCapture(e.pointerId);
        dragEndAt.current = performance.now();
        // the hand's velocity over its last ~100ms, in px/s, capped — a
        // cancelled pointer (the page took the touch for a scroll) throws
        // nothing
        const f = fling.current;
        f.vx = 0;
        f.vy = 0;
        if (e.type !== "pointercancel") {
          const recent = was.samples.filter((s) => e.timeStamp - s.t <= 100);
          const first = recent[0];
          if (first && e.timeStamp - first.t > 8) {
            const dt = (e.timeStamp - first.t) / 1000;
            const cap = 2600;
            f.vx = Math.max(-cap, Math.min(cap, (e.clientX - first.x) / dt));
            f.vy = Math.max(-cap, Math.min(cap, (e.clientY - first.y) / dt));
          }
        }
        // on, even at rest: the integration below also springs the plane
        // back into its range and records where it came to rest
        f.on = true;
      };
      /** the throw's integration, one step per ticker frame: coast under
       *  friction, spring back into the free range, and stop at a threshold
       *  — the plane never drifts forever and never stays outside. */
      const coast = () => {
        const f = fling.current;
        const dt = Math.min(0.05, gsap.ticker.deltaRatio(60) / 60);
        // friction: the velocity keeps ~7% less per 60fps frame, whatever
        // the real frame rate
        const keep = Math.pow(0.013, dt);
        f.vx *= keep;
        f.vy *= keep;
        pan.current.x += f.vx * dt;
        pan.current.y += f.vy * dt;
        let settled = Math.abs(f.vx) < 6 && Math.abs(f.vy) < 6;
        const axis = (k: "x" | "y") => {
          const v = pan.current[k];
          const edge = v < lo[k] ? lo[k] : v > hi[k] ? hi[k] : null;
          if (edge === null) return;
          // the spring: close most of the gap each frame and bleed the
          // velocity that carried it out, so it eases home without a bounce
          const gap = edge - v;
          pan.current[k] = Math.abs(gap) < 0.5 ? edge : v + gap * Math.min(1, 9 * dt);
          f[k === "x" ? "vx" : "vy"] *= 0.7;
          if (Math.abs(gap) >= 0.5) settled = false;
        };
        axis("x");
        axis("y");
        dirty = true;
        if (settled) {
          f.on = false;
          f.vx = 0;
          f.vy = 0;
          rest.current = { x: pan.current.x, y: pan.current.y };
        }
      };
      if (frame) {
        frame.addEventListener("pointerdown", onDown);
        frame.addEventListener("pointermove", onMove);
      }
      // THE RELEASE IS HEARD ANYWHERE (review fix, 2026-10-12): a press
      // under the slop is not captured, so one released over the nav bar
      // or past the window's bottom edge ended nowhere and the next hover
      // dragged the plane. Both events bubble from the frame to here, so
      // the captured case is the same path as before — onUp ignores a
      // pointer it is not holding.
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);

      const tick = () => {
        const t = gsap.ticker.time;
        if (fling.current.on) coast();
        if (dirty) {
          dirty = false;
          write();
        }
        // THE HIDDEN CLOUD RESTS (review, 2026-10-29): under the puzzle the
        // plane is invisible, and writing ~35 cards' transforms every frame
        // was most of the frame's style work. The clock runs on, so when
        // «Back to the picture» fades the plane in, the cards are simply
        // further along their paths — the step happens at opacity 0.
        if (!playingRef.current) for (const f of flight) {
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
        // the plane itself moved above, before the cards: the throw's
        // integration (coast) and the drag's pending write; the centring
        // tween of a picked card writes itself through onUpdate
      };
      gsap.ticker.add(tick);

      return () => {
        gsap.ticker.remove(tick);
        gsap.killTweensOf([cards, pan.current]);
        if (frame) {
          frame.removeEventListener("pointerdown", onDown);
          frame.removeEventListener("pointermove", onMove);
          delete frame.dataset.drag;
        }
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        down = null;
        fling.current.on = false;
        // THE PAN DOES NOT OUTLIVE THE LAYER (review fix, 2026-10-12). The
        // drag writes the plane's transform from event handlers, outside
        // this context, so matchMedia's own revert never saw it: a 300px
        // drag at 1440, then a window under 861px, left the plain rail's
        // plane at -300px with its first cards off the left edge (measured
        // at 800×900). The rail starts from zero, as it always did.
        pan.current.x = 0;
        pan.current.y = 0;
        rest.current.x = 0;
        rest.current.y = 0;
        gsap.set(plane, { clearProps: "transform" });
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
    if (!el) return;
    // CROSSING TO THE PLAIN LAYER WITH A PICTURE OPEN (review, 2026-10-29 —
    // older than the puzzle): the desktop branch below had written opacity
    // and width onto every card and hidden the title, and the rail kept all
    // of it — every card at 0.16 and the open one at 3.6× its width. On the
    // plain layer those inline styles go; back on the desktop the branch
    // runs again (this effect follows `plain`) and re-grows the open card.
    if (!window.matchMedia(DESKTOP).matches) {
      const cards = el.querySelectorAll<HTMLElement>(".ap-cloud__card");
      gsap.killTweensOf(cards);
      gsap.set(cards, { clearProps: "opacity,width" });
      const say = el.querySelector<HTMLElement>(".ap-cloud__say");
      if (say) {
        gsap.killTweensOf(say);
        gsap.set(say, { clearProps: "opacity,visibility" });
      }
      return;
    }
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

    // the centring tween owns the plane now: a throw still coasting would
    // fight it frame by frame (drag restored 2026-10-12)
    fling.current.on = false;
    fling.current.vx = 0;
    fling.current.vy = 0;
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
      // nothing chosen: the plane goes back to where the hand last left it
      // (`rest` — the origin until the first drag), or the cloud drifts a
      // little further off-centre with every pick. Not to 0,0 any more: with
      // the drag back (2026-10-12) that would undo the reader's own pan.
      gsap.to(pan.current, { x: rest.current.x, y: rest.current.y, duration: 0.6, ease: "power3.out", onUpdate: write });
    }

    const onKey = (e: KeyboardEvent) => {
      // the puzzle has the keys while it is out: its Escape leaves the
      // puzzle (not the picture), its arrows move a piece (not the series)
      if (playingRef.current) return;
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
  }, [chosen, write, step, plain]);

  // THE RAIL FOLLOWS THE PANEL — plain layer only (phone repair pass,
  // 2026-10-05). ‹ › in the panel choose the next picture, and on the rail
  // that card can be screens away sideways; its caption and the face the
  // panel's Front · Back · Printed switch to are drawn ON the card, so
  // pressing Back changed a picture nobody could see (measured at 390x844:
  // card 12 off the right edge while its panel said "Back").
  // AND THE PAGE FOLLOWS THE CARD (2026-10-05 package). Sideways only was not
  // enough: pressing card 05 at 390x844 left its card at y 316 and the
  // panel's Add to cart at y 1052 — below the fold — and after → the new card
  // was wherever the rail had scrolled to, under the bar. Now the chosen card
  // comes to rest under the bar (its scroll-margin-top in cloud.css is the
  // bar's 84px) and at the start of the rail (its snap point), which puts
  // the card, its note and Add on one screen. "start", not "nearest": a card
  // already fully on screen at y 316 would not move, and Add would stay
  // below the fold. Instant under reduced motion.
  // THE PAGE MOVES ON A PHONE ONLY (2026-10-05 repair). The plain layer is
  // also the desktop under reduced motion, and there the page scroll pulled
  // the page 255px when card 06 was pressed at 1440x900 — the approved
  // desktop rail slides sideways and the page stays put, so at 861px and up
  // it is the old sideways centring again, unchanged.
  useEffect(() => {
    // read and clear in one go: a press that CLOSED the panel, or one on the
    // desktop, must not leave the flag set for the next ‹ ›
    const wantFocus = focusNo.current;
    focusNo.current = false;
    const el = root.current;
    if (!chosen || !el || window.matchMedia(DESKTOP).matches) return;
    const card = el.querySelector<HTMLElement>(`.ap-cloud__card[data-id="${chosen}"]`);
    if (!card) return;
    const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    if (window.matchMedia("(max-width: 860px)").matches) {
      card.scrollIntoView({ block: "start", inline: "start", behavior });
    } else {
      const plane = el.querySelector<HTMLElement>(".ap-cloud__plane");
      if (plane) {
        const pr = plane.getBoundingClientRect();
        const cr = card.getBoundingClientRect();
        plane.scrollBy({ left: cr.left + cr.width / 2 - (pr.left + pr.width / 2), behavior });
      }
    }
    // a card press hands focus to the panel's "No. n", so a screen reader
    // lands on what opened; preventScroll — the page is already moving
    if (wantFocus) noRef.current?.focus({ preventScroll: true });
  }, [chosen]);

  /** Press a card to open it, press it again to put it back — pointer and
   *  keyboard alike, through onClick. The one click that is NOT a press is
   *  the one the browser fires at the end of a drag (2026-10-12): a drag is
   *  never a choice, so a click inside a beat of a drag's release is let go. */
  const choose = useCallback((id: string) => {
    if (performance.now() - dragEndAt.current < 400) return;
    focusNo.current = true;
    setChosen((cur) => (cur === id ? null : id));
  }, []);

  return (
    // No `data-nosun` here: this section is an opaque stacking context at
    // z 2 (globals.css) and the flying sun (components/Sun.tsx) is under it
    // from the moment the curtain rises. THE SUN SHOWS IN HERE ALL THE SAME
    // (client, change 4.pdf p1, 2026-10-12: «արևը էս հատվածի տակով ա
    // անցնում, հնարավոր ա երևա արևը էս բաժնում էլ» — the sun passes under this
    // part; could it show in this section too): .ap-cloud__sun below is a
    // TWIN of the disc, laid inside the section over its dark ground and
    // under the frame — so under the title and under every card — and
    // Sun.tsx writes it the same place, size and opacity it writes the real
    // one, every frame. Where the section covers the screen the twin is
    // seen; where it does not, the real sun is; the two meet at the
    // curtain's edge without a jump, and nothing of the hero shows through.
    // Her 2026-08-10 note (no sun between the cards) still holds: the
    // journey's cloud keys keep the disc in the right margin, clear of
    // every card's box at rest (measured — see Sun.tsx PATH), and the
    // z-order means it can never cover one in any case.
    <section className="ap-cloud ap-dark" ref={root} aria-label={title.join(" ")}>
      <div className="ap-cloud__sun" aria-hidden="true">
        {/* the same <picture> gate as Sun.tsx: where the sun never flies —
            narrow, reduced motion, no scripting — the source is a 1×1 data
            GIF and nothing is fetched (2026-10-05 package rule) */}
        <picture style={{ display: "contents" }}>
          <source
            media="(max-width: 860px), (prefers-reduced-motion: reduce), (scripting: none)"
            srcSet="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- driven by
              transform from Sun.tsx's measured journey, like the real disc */}
          <img className="ap-cloud__sun-disc" src="/hero/sun.webp" alt="" width={879} height={830} />
        </picture>
      </div>
      <div
        className="ap-cloud__frame"
        data-chosen={chosen || undefined}
        data-puzzle={playing && !plain ? "" : undefined}
        // Click-away to close: "a clean press on the ground puts one back".
        // A press on a card or on the panel is that element's business, and
        // the click the browser fires at the end of a DRAG (it lands here,
        // on the capturing frame) is not a press at all — see dragEndAt.
        // Nor is any press while the puzzle is out: the room is the frame.
        onClick={(e) => {
          if (playingRef.current) return;
          if (performance.now() - dragEndAt.current < 400) return;
          const t = e.target as HTMLElement;
          if (!t.closest(".ap-cloud__card") && !t.closest(".ap-cloud__info")) setChosen(null);
        }}
        // a drag that starts on a picture must pan the plane, not lift the
        // picture's bitmap out of the page (the native image drag fires
        // dragstart and cancels the pointer stream mid-gesture)
        onDragStart={(e) => e.preventDefault()}
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
              // THE PLAIN LAYER'S CARD IS A DISCLOSURE (2026-10-05 package):
              // it opens the panel under the rail rather than viewing the
              // picture larger, so it says expanded/collapsed and points at
              // that panel. MICROCOPY: "view it larger" → "see its details"
              // there. The desktop card is untouched: pressed, same name.
              aria-pressed={plain ? undefined : chosen === p.id}
              aria-expanded={plain ? chosen === p.id : undefined}
              aria-controls={plain && chosen === p.id ? infoId : undefined}
              aria-label={
                plain
                  ? `Illustration number ${p.id}. Press to see its details.`
                  : `Illustration number ${p.id}. Press to view it larger.`
              }
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
              <img src={p.thumb} alt="" width={p.w} height={p.h} loading="lazy" decoding="async" draggable={false} />
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
              and seam shut, left to right. ONE LINE PER SPAN (change.pdf p2,
              2026-09-21: «write it in 2 lines, ARMENIA up to the line»): the
              runner splits each line on its own, the second a beat behind,
              and CSS keeps a line from wrapping where the box is narrow. */}
          <h2 className="ap-h2">
            {title.map((line, i) => (
              <span className="ap-cloud__tl" key={line} data-tfx="cut" data-tfx-delay={i ? "0.18" : undefined}>
                {line}
              </span>
            ))}
          </h2>
          <p className="ap-lede">{copy}</p>
        </div>

        {/* what a picked picture IS: its number, its series, and Arpine's own
            note for it (client files 2026-08-11). The three pictures without
            a note yet (23/25/34) keep the series body. ‹ › browse the whole
            series without closing — the plane flies to each one. */}
        {/* the desktop panel steps aside while the puzzle has the frame */}
        {chosen && !(playing && !plain) && (
          // NO role=status ON THE PLAIN LAYER (2026-10-05 package): the
          // whole panel — note, faces, price, buttons — was read out on every
          // change. Focus moves to "No. n" when a card opens it, and only
          // that line is live, so ‹ › announce the new number. The desktop
          // panel keeps its status role, as it was.
          <div className="ap-cloud__info" id={infoId} role={plain ? undefined : "status"}>
            {/* THE SHEET SCROLLS, THE PANEL DOES NOT (2026-10-05). On the
                desktop cloud the long-note cap (max-height + overflow) sat on
                the panel itself, so it clipped its own ✕ — which hung 46px
                above the panel's top edge: invisible, and a press at its
                centre landed on the plane at 1440x900, 1280x720 and 1886x835
                (measured with elementFromPoint). The cap lives on this inner
                sheet now and the ✕ is its sibling, so it stays in its corner
                while a long note scrolls. On the plain layer the sheet is
                `display: contents` and the panel's grid is what it was. */}
            <div className="ap-cloud__sheet">
              <p className="ap-cloud__no" ref={noRef} tabIndex={-1} aria-live={plain ? "polite" : undefined}>
                No. {chosen}
              </p>
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
              {puzzles[chosen] && (
                <button type="button" className="ap-cloud__play" ref={playBtn} onClick={startPuzzle}>
                  <PieceIcon />
                  {puzzle.cta}
                </button>
              )}
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
              {/* buy this card without leaving the cloud — UNLESS it is one the
                  client took out of the postcard catalogue (change 3.pdf p2,
                  2026-10-01: nos. 23 and 25, `withheldArt` in content.ts). The
                  picture stays in the cloud to be looked at — her note removes
                  a postcard, not a picture — but this button writes a
                  "postcards" line to the cart, i.e. it is a second door into
                  the very catalogue she closed, so for those two neither the
                  card's price nor the button is offered. The way to the shop
                  stays. */}
              {!notACard && (
                <p className="ap-cloud__price">
                  <strong>{dram(unit("postcards"))}</strong> <span>a card</span>
                </p>
              )}
              <div className="ap-cloud__buy">
                {!notACard && (
                  <button type="button" className="ap-btn" onClick={() => buy(chosen)} data-added={added || undefined}>
                    {added ? "Added ✓" : "Add to cart"}
                  </button>
                )}
                <Link className="ap-cloud__go" href="/shop/postcards">
                  {pick.cta} <span aria-hidden>→</span>
                </Link>
              </div>
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

        {/* the puzzle: in the frame on the desktop moved layer, as a window
            everywhere else (a portal — it lies over the page, not the rail) */}
        {playing && chosen && puzzles[chosen] && (
          <MapBoundary onError={stopPuzzle}>
            <Puzzle
              key={plain ? "sheet" : "inline"}
              set={puzzles[chosen]}
              mode={plain ? "sheet" : "inline"}
              label={`No. ${chosen}`}
              copy={puzzle}
              memory={puzzleMemory}
              onExit={stopPuzzle}
            />
          </MapBoundary>
        )}
      </div>
    </section>
  );
}
