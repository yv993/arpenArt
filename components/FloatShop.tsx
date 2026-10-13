"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { FX_MEDIA, POOL, settle } from "@/lib/textfx";
import { soon } from "@/lib/content";
import { openSoon } from "./Soon";
import MapBoundary from "./MapBoundary";
import type { RoomSpin, Spot } from "./FloatShopCanvas";

/** THE ROOM IS ITS OWN CHUNK (2026-10-05 package, done 2026-10-07). Its
 *  Canvas only ever mounts on the desktop moved layer, yet three.js and
 *  @react-three/fiber were static imports here — so every phone evaluated
 *  them for a room it never shows (window.__THREE__ "171" at scrollY 0 at
 *  390x844). Requested when `live` turns true; warmed in idle time on the
 *  moved layer (below), so a desktop visitor's room arrives as before. */
const FloatShopCanvas = dynamic(() => import("./FloatShopCanvas"), { ssr: false });

/** Pins must be torn down in a LAYOUT effect — see the note in MorphHero.
 *  SSR has no window and useLayoutEffect warns there, so it swaps in only
 *  on the client. */
const useLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

// ============================================================================
// FLOAT SHOP — the shop categories as pahari.vercel.app's floating gallery.
//
// The reference was probed, not eyeballed: it is ONE viewport tall, a single
// WebGL canvas (no DOM images at all), Lenis virtual scroll turning the
// arrangement, a serif title dead-centre in the room, and a pill that morphs
// the layout between a SPHERE (cards strewn around you, rim ones steeply
// foreshortened) and a CYLINDER (a rising helix of cards). Everything floats
// gently the whole time.
//
// Kept: the fixed stage, both arrangements and the animated morph between
// them, scroll-driven rotation, the centre title, the pill, the float.
// Changed, deliberately:
//   · the wheel turns the room ONLY OVER THE ARRANGEMENT (client, change.pdf
//     p5, 2026-09-15: «when the mouse is in the empty parts and scrolls, the
//     page should go down; only over the spiral should the products turn»).
//     The pinned ScrollTrigger that used to spend ~4.6 screens of scroll on
//     the rotation is gone: the room is one ordinary screen in the flow, the
//     page rolls straight past it, and a wheel over the band the cards
//     occupy — or over a card, wherever it is — is taken and spent on the
//     turn instead. See the wheel effect below.
//   · the cards are CATEGORIES with names and prices — hover names them,
//     click goes to the category. The reference's paintings are mute.
//   · the DOM grid stays in the document as the accessible layer: sr-only
//     while the canvas runs, a visible bottom sheet the moment keyboard
//     focus enters it, and the whole experience on phones / reduced motion /
//     no WebGL. A shop must not be locked inside a canvas.
// ============================================================================

export type FloatCat = {
  slug: string;
  name: string;
  from: number;
  status: "open" | "soon";
  tex: string;
  w: number;
  h: number;
};

const DESKTOP = "(min-width: 861px) and (prefers-reduced-motion: no-preference)";

/* The room's geometry (RING_R, HELIX_R, HELIX_RISE, CARD_W, TURN), the Haze,
   the cards and the Scene moved to ./FloatShopCanvas.tsx on 2026-10-07 (the
   2026-10-05 phone package): they need three.js, and from here they made it
   a static import of the home route on every phone. */
/** How much of a full turn one pixel of wheel travel is worth: 100px ≈ a
 *  tenth of a turn, so one notch of a mouse wheel brings the next card round
 *  on an eleven-card ring. */
const WHEEL_TURN = 0.0009;
/** WHERE THE WHEEL STEERS: on the pictures themselves. This used to be a
 *  fixed band across the middle of the stage (8–92% × 22–86%), which also
 *  covered the name in the centre and the empty room between the cards —
 *  Vardan 2026-09-15, screenshot with the cursor on "T-SHIRTS": «scroll
 *  must affect only when the cursor is in the images' circle part». So each
 *  card now reports its own SCREEN spot every frame — centre and projected
 *  half-height, in canvas pixels — and the wheel is claimed only within
 *  SPOT_PAD of one. The pad covers the gaps between neighbours on the ring
 *  (cards are 2 units wide on a 3.5-unit pitch), so the whole ring reads
 *  as one target; the centre, the head, the pill and the counter belong to
 *  the page. */
const SPOT_PAD = 1.35;

/** GRAB AND TURN (Vardan 2026-10-13, a screenshot of the room: «this part
 *  must be draggable, user can grab and move»). The room answered a wheel
 *  over its pictures and nothing else; a hand on it did nothing. A press
 *  anywhere in the room now takes hold of it and a sideways drag turns it.
 *
 *  THE CARD THAT WAS TAKEN FOLLOWS THE HAND — whichever side of the ring it
 *  is on. The first version turned the room one way for a rightward drag,
 *  the way the NEAR side goes, and was measured doing the wrong thing: this
 *  ring is seen from outside, its far side is the row across the top of the
 *  room and holds seven of the eleven cards, and a far card dragged right
 *  went LEFT (and at a third of the hand's speed). So a press notes which
 *  card it is on (r3f's raycast for that very press — Card's onPointerDown
 *  in FloatShopCanvas.tsx), and that card's own answer to a turn — Spot.g, written by
 *  the frame loop: its sideways screen travel per radian — sets both the
 *  direction and the gearing, read again on every move so the card stays
 *  under the hand as it comes round. The direction is fixed at the press: a
 *  card dragged past the ring's edge goes on round the front, it does not
 *  shudder at the silhouette (where g is zero and changes sign).
 *
 *  A press on the EMPTY room has no card to follow and turns it like a
 *  turntable, by its near side. GRAB is that gearing, in turns per
 *  ROOM-HEIGHT of sideways travel: the ring is 6.2 units from its axis and
 *  the camera 13.4, so the near card is 7.2 away, where (fov 50°) one pixel
 *  is 2 x 7.2 x tan 25° / H = 6.715 / H units; a turn of `a` radians carries
 *  that card 6.2 x a, so a = dx x 1.083 / H radians = dx x 0.172 / H turns.
 *  GRAB_FAR is the far card's own value by the same sum (19.6 away): the
 *  loosest gearing a hand is ever given, which is what a card near the
 *  silhouette gets instead of the infinite one its g asks for.
 *
 *  The rest is the globe's own rules (Gallery.tsx), so the two things on
 *  this page that turn under a hand behave alike:
 *    · the pointer is captured at an 8px SLOP, not on the press — capture up
 *      front retargets the release to the stage, the canvas never sees it and
 *      r3f can never raise a click, so no card would open. Under the slop a
 *      press is still a click on a card;
 *    · a release throws the room — at the speed the hand had over its last
 *      tenth of a second — and the frame loop bleeds that off
 *      (FloatShopCanvas.tsx); unless the hand had already stopped, which is
 *      setting it down, not throwing it;
 *    · a press on a coasting room catches it. */
const GRAB = 0.172;
const GRAB_FAR = 0.47;
/** one turn in radians — the Canvas's TURN: scrollP x this is the rig's angle */
const TAU = Math.PI * 2;
/** a room turning faster than this (turns per second) is visibly moving: a
 *  press on it is a hand stopping it, and must not also open the card that
 *  happened to be passing underneath (about 90px a second on the near card) */
const CAUGHT = 0.02;
const DRAG_SLOP = 8;
/** the hardest throw the room accepts, in turns per second */
const THROW_MAX = 1.5;
/** a hand that has been still this long before letting go has stopped (ms) */
const SET_DOWN = 90;
/** the stretch of the drag a throw's speed is measured over (ms) */
const THROW_WINDOW = 100;

// ============================================================================
// The centre's appearance repertoire. Naming a category is not one animation
// but three, taken in turn on every change:
//   flip      the whole centre panel turns over (the original)
//   rise      the name climbs letter by letter out of its own line
//   decipher  the name settles out of Armenian letterforms, left to right
// GSAP drives all three — a CSS transition on `transform` would ease every
// per-frame write and turn the other two logics to soup.
//
// The centre names whatever holds the CENTRE POSITION as the room turns, and
// a hover overrides it — so there is always a product named there and every
// change is an entrance. That is why there is no conceal: nothing ever
// leaves, it is only replaced.
// ============================================================================

type FxKind = "flip" | "rise" | "decipher";

/** ONE logic, every time (client 2026-08-06: "this part all text appearance
 *  must be like skirts text appeared").
 *
 *  Which one that is was MEASURED, not guessed: the cycle used to advance once
 *  per change, so walking the pin from a fresh load and reading the panel's own
 *  `data-fx` marker gives the order deterministically — Skirts came up seventh
 *  and drew `rise`. (The screenshot the client sent showed SCARVES, which had
 *  landed on `decipher` — the scramble — which is the contrast they were
 *  reacting to.) `rise` is also the only one of the three that animates ALL
 *  the panel's text rather than just the name: the letters climb and the
 *  kicker and price line follow it up.
 *
 *  The other two timelines are kept below rather than deleted: this project is
 *  not under version control, and restoring the old behaviour should stay a
 *  one-word edit here. Site-wide variety is unaffected — lib/textfx.ts still
 *  runs six different logics across the other sections. */
const FX_ALWAYS: FxKind = "rise";

type FxEls = {
  panel: HTMLElement;
  chars: HTMLElement[];
  lines: HTMLElement[];
};

function grabFxEls(root: HTMLElement): FxEls | null {
  const panel = root.querySelector<HTMLElement>(".ap-fs__panel");
  if (!panel) return null;
  return {
    panel,
    chars: Array.from(panel.querySelectorAll<HTMLElement>(".ap-fs__ch")),
    lines: Array.from(panel.querySelectorAll<HTMLElement>(".ap-kicker, .ap-fs__from")),
  };
}

/** The decipher core: a proxy tween shuffles every unsettled span through the
 *  Armenian pool and locks them to their real glyph left to right. */
function scrambleTo(tl: gsap.core.Timeline, chars: HTMLElement[], at: number, dur: number) {
  const run = { p: 0 };
  tl.to(
    run,
    {
      p: 1,
      duration: dur,
      ease: "power1.inOut",
      onUpdate: () => {
        const done = Math.floor(run.p * chars.length);
        chars.forEach((c, i) => {
          c.textContent = i < done ? (c.dataset.ch ?? "") : POOL[(Math.random() * POOL.length) | 0];
        });
      },
      onComplete: () => settle(chars),
    },
    at,
  );
}

/** Every change of the named category is an ENTRANCE of the new name —
 *  React has already written the text by the time these run, so there is
 *  nothing to animate out. `rise` is the one that ships; see FX_ALWAYS. */
const CHANGE: Record<FxKind, (els: FxEls) => gsap.core.Timeline> = {
  // the panel turns over on its own hinge and arrives face-on
  flip: ({ panel, chars, lines }) => {
    settle(chars);
    const tl = gsap.timeline();
    tl.set(chars, { clearProps: "all" }, 0)
      .set(lines, { clearProps: "all" }, 0)
      .fromTo(
        panel,
        { rotationX: -94, autoAlpha: 0, transformPerspective: 1100, transformOrigin: "50% 50%" },
        { rotationX: 0, autoAlpha: 1, duration: 0.72, ease: "power3.out" },
        0,
      );
    return tl;
  },
  // the letters climb out of their own line, the two small lines follow
  rise: ({ panel, chars, lines }) => {
    settle(chars);
    const tl = gsap.timeline();
    tl.set(panel, { clearProps: "transform", autoAlpha: 1 }, 0)
      .fromTo(chars, { yPercent: 135, autoAlpha: 1 }, { yPercent: 0, duration: 0.7, ease: "power4.out", stagger: 0.03 }, 0)
      .fromTo(lines, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: "power3.out", stagger: 0.1 }, 0.12);
    return tl;
  },
  // the name settles out of Armenian letterforms, left to right
  decipher: ({ panel, chars, lines }) => {
    settle(chars);
    const tl = gsap.timeline();
    tl.set(panel, { clearProps: "transform", autoAlpha: 1 }, 0)
      .set(chars, { yPercent: 0 }, 0)
      .fromTo(chars, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.22, ease: "none", stagger: 0.02 }, 0)
      .fromTo(lines, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, stagger: 0.1 }, 0.35);
    scrambleTo(tl, chars, 0.04, Math.max(0.6, chars.length * 0.055));
    return tl;
  },
};

export default function FloatShop({
  cats,
  kicker,
  name,
  copy,
}: {
  cats: FloatCat[];
  kicker: string;
  /** the section's name — it stands in the room's top-left corner */
  name: string;
  copy: string;
}) {
  const root = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const [live, setLive] = useState(false);
  const [mode, setMode] = useState<"sphere" | "cylinder">("sphere");
  /** what the pointer is on — overrides the centre while it lasts */
  const [hovered, setHovered] = useState<FloatCat | null>(null);
  /** which card the turning room has brought to the centre position */
  const [focusI, setFocusI] = useState(0);

  // refs shared with the frame loop — a pill click is state, 60fps is not
  const view = useRef(0);
  const scrollP = useRef(0);

  // Gate check only — the pin must NOT be created here. setLive is async, so
  // a ScrollTrigger created in the same effect measures the 295px plain-layer
  // box and locks it into the pin's inline styles before the [data-live] CSS
  // has ever laid out the 100svh room. Found the hard way.
  useEffect(() => {
    let webgl = false;
    try {
      const c = document.createElement("canvas");
      webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {}
    if (webgl && window.matchMedia(DESKTOP).matches && window.matchMedia("(scripting: enabled)").matches) {
      setLive(true);
    }
  }, []);

  // the room's chunk, fetched in idle time on the moved layer — `live`
  // requests it anyway the moment it turns true; this only makes sure the
  // fetch never waits for the first frame budget to free up
  useEffect(() => {
    if (!window.matchMedia(FX_MEDIA).matches) return;
    const warm = () => {
      import("./FloatShopCanvas").catch(() => {});
    };
    // Safari has no requestIdleCallback; the type says it always exists
    const idle = window.requestIdleCallback as typeof window.requestIdleCallback | undefined;
    if (idle) {
      const id = window.requestIdleCallback(warm, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(warm, 1200);
    return () => window.clearTimeout(t);
  }, []);

  /** true while the pointer is on a card (r3f's own raycast) — the fast path */
  const overCard = useRef(false);
  /** every card's screen spot, written by the frame loop, read by the wheel */
  const spots = useRef<Spot[]>([]);

  // THE WHEEL, taken only ON THE PICTURES. The section attribute still
  // hides the sibling grid while the room runs. No pin any more: the room is
  // one screen in ordinary flow, and unless the pointer is on a card or
  // within a card's padded spot (see Spot above), a wheel here scrolls the
  // page exactly as it does anywhere else — over the name in the middle,
  // the head, the pill, the counter and the empty room alike. On the
  // pictures, the wheel is spent on the turn — the same `scrollP` the pin
  // used to drive, now a wrapped fraction of a turn.
  useLayout(() => {
    const el = root.current;
    if (!el || !live) return;
    const section = el.closest("#shop");
    section?.setAttribute("data-float", "");
    const onWheel = (e: WheelEvent) => {
      let onPictures = overCard.current;
      if (!onPictures) {
        const canvas = el.querySelector("canvas");
        if (!canvas) return;
        const r = canvas.getBoundingClientRect();
        const px = e.clientX - r.left;
        const py = e.clientY - r.top;
        for (const s of spots.current) {
          if (s && Math.hypot(px - s.x, py - s.y) <= s.r * SPOT_PAD) {
            onPictures = true;
            break;
          }
        }
      }
      if (!onPictures) return; // the page scrolls
      e.preventDefault();
      // lines and pages (Firefox's deltaModes) brought to pixels
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      const p = (scrollP.current ?? 0) + dy * WHEEL_TURN;
      scrollP.current = p - Math.floor(p);
    };
    // non-passive on purpose: this is the one listener on the site allowed
    // to keep a wheel event, and only when the pointer is on the spiral
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      section?.removeAttribute("data-float");
    };
  }, [live]);

  // the pill's morph — chase, so it eases exactly like the reference's
  useEffect(() => {
    const target = mode === "cylinder" ? 1 : 0;
    const tween = gsap.to(view, { current: target, duration: 1.1, ease: "power2.inOut" });
    return () => {
      tween.kill();
    };
  }, [mode]);

  // ---- the grab (see GRAB above) -------------------------------------------
  /** the throw's speed and whether a hand is on the room — the frame loop's */
  const spin = useRef<RoomSpin>({ v: 0, held: false });
  /** the pointer that pressed the room: where it is, where it went down, when
   *  it last moved, whether it has passed the slop and is ours — and WHAT it
   *  took: the card's index (−1 for the empty room) and which way that card
   *  goes for a rightward hand (+1 with the near side, −1 round the back) */
  const grab = useRef<{
    id: number;
    x: number;
    sx: number;
    sy: number;
    /** where the hand last was while still under the slop */
    ux: number;
    t: number;
    captured: boolean;
    card: number;
    dir: 1 | -1;
    /** how far this drag has turned the room so far, in turns */
    a: number;
    /** the last tenth of a second of that, for the throw: (when, how far) */
    trail: { t: number; a: number }[];
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  /** when the last drag ended — a drag must never also be a click */
  const draggedAt = useRef(-Infinity);
  /** true when the last press stopped a room that was turning (see CAUGHT) */
  const caught = useRef(false);
  /** the card r3f's raycast found under the last press, and which press */
  const pressed = useRef<{ i: number; id: number; t: number } | null>(null);
  // r3f's listener sits on its own div INSIDE the stage, so for any press it
  // runs before the stage's handler below: by the time onGrabDown reads
  // `pressed`, the card under this very event is in it — for a finger too,
  // which has no hover before it lands (r3f books hover on moves only).
  const onPress = useCallback((i: number, id: number, t: number) => {
    pressed.current = { i, id, t };
  }, []);

  const onGrabDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // ONE HAND AT A TIME: a second finger landing mid-drag must not take the
    // room over, or it jumps to wherever that finger is. (A press that never
    // passed the slop holds nothing, so a new press simply replaces it.)
    if (grab.current?.captured) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // WHICH CARD THE HAND IS ON: the one r3f's raycast hit for THIS press —
    // matched by pointer and timestamp, so a card from an earlier press is
    // never mistaken for it. Failing that, the nearest card whose padded spot
    // holds the press — the wheel's own idea of "on the pictures", which
    // takes in the gaps between neighbours — or nothing: the empty room.
    const hit = pressed.current;
    let card = hit && hit.id === e.pointerId && hit.t === e.timeStamp ? hit.i : -1;
    if (card < 0) {
      const box = (e.currentTarget.querySelector("canvas") ?? e.currentTarget).getBoundingClientRect();
      const px = e.clientX - box.left;
      const py = e.clientY - box.top;
      let best = SPOT_PAD;
      for (let i = 0; i < spots.current.length; i++) {
        const s = spots.current[i];
        const q = s ? Math.hypot(px - s.x, py - s.y) / Math.max(1, s.r) : Infinity;
        if (q <= best) {
          best = q;
          card = i;
        }
      }
    }
    // while the pill is morphing ring into spiral the cards are changing
    // sides (the two seat them a quarter turn apart), so a direction fixed
    // now would be wrong a moment later: mid-morph the room is a turntable
    if (view.current !== 0 && view.current !== 1) card = -1;
    const taken = card >= 0 ? spots.current[card] : undefined;
    grab.current = {
      id: e.pointerId,
      x: e.clientX,
      sx: e.clientX,
      sy: e.clientY,
      ux: e.clientX,
      t: e.timeStamp,
      captured: false,
      card,
      dir: taken && taken.g < 0 ? -1 : 1,
      a: 0,
      trail: [],
    };
    // A press catches a coasting room, as a hand on a turntable does — and a
    // press that did that is not also a click (onPick): the room stops with
    // some card under the pointer, r3f sees a press and a release on it, and
    // without this the hand that stopped the room would have opened it.
    caught.current = Math.abs(spin.current.v) > CAUGHT;
    spin.current.v = 0;
  }, []);

  /** let go of the room; `thrown` is false when the browser took the pointer
   *  away (a cancel) rather than the hand releasing it */
  const letGo = useCallback((el: HTMLDivElement, pointerId: number, at: number, thrown: boolean) => {
    const g = grab.current;
    if (!g || g.id !== pointerId) return;
    grab.current = null;
    const s = spin.current;
    s.held = false;
    if (!g.captured) return;
    try {
      if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
    } catch {}
    // THE THROW is the hand's speed over its last tenth of a second. (Not a
    // running average of per-event speeds: a 1000Hz mouse reports a pixel or
    // nothing each millisecond, and that sum is noise; a slow pointer reports
    // in leaps.) No throw if the hand was already still — it set the room
    // down — or the release was not a release.
    const first = g.trail[0];
    const last = g.trail[g.trail.length - 1];
    if (!thrown || !first || !last || at - last.t > SET_DOWN) s.v = 0;
    else {
      // The trail keeps ONE sample from before the window to measure from
      // (onGrabMove). Where that sample is older than the window, the room's
      // place at the window's start is read off the line to the next sample,
      // so the sum is what was turned in those hundred milliseconds — not
      // that plus whatever went before.
      let a0 = first.a;
      let t0 = first.t;
      const from = last.t - THROW_WINDOW;
      const next = g.trail[1];
      if (t0 < from && next && next.t > t0) {
        a0 += ((next.a - a0) * (from - t0)) / (next.t - t0);
        t0 = from;
      }
      // never over less than a frame: two samples a millisecond apart are not
      // a speed
      const v = (last.a - a0) / Math.max(0.016, (last.t - t0) / 1000);
      s.v = Math.max(-THROW_MAX, Math.min(THROW_MAX, v));
    }
    draggedAt.current = performance.now();
    setDragging(false);
  }, []);

  const onGrabMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const g = grab.current;
      if (!g || e.pointerId !== g.id) return;
      // the button came up somewhere this stage never heard about (a press
      // near the edge, released outside before the slop): without this the
      // next bare hover would be read as the rest of that drag
      if ((e.buttons & 1) === 0) {
        letGo(e.currentTarget, e.pointerId, e.timeStamp, false);
        return;
      }
      if (!g.captured) {
        if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) <= DRAG_SLOP) {
          // when and where the hand last was while still under the slop
          g.t = e.timeStamp;
          g.ux = e.clientX;
          return;
        }
        try {
          e.currentTarget.setPointerCapture(g.id);
        } catch {}
        g.captured = true;
        spin.current.held = true;
        setDragging(true);
        // The turn is counted FROM THE PRESS, so the card comes to sit exactly
        // under the hand: `g.x` is still where the press was, and this move
        // falls through to be applied whole. (Counting from here instead threw
        // the first step away — eight pixels for a slow hand, but half of a
        // quick one's travel when the browser reports it in two leaps.)
      }
      // Turns of the rig per pixel of hand travel. With a card in the hand it
      // is that card's own figure, read fresh — 1 / (TAU x |g|) is exactly
      // the turn that moves it one pixel — and never looser than GRAB_FAR;
      // on the empty room it is the turntable's (see GRAB).
      const h = Math.max(1, e.currentTarget.clientHeight);
      const taken = g.card >= 0 ? spots.current[g.card] : undefined;
      const per = taken ? Math.min(GRAB_FAR / h, 1 / (TAU * Math.max(1e-6, Math.abs(taken.g)))) : GRAB / h;
      // THE THROW'S FIRST SAMPLE (empty only on the move that takes the room):
      // where the hand already was at its last report under the slop, and
      // when. Booking the whole creep from the press to the one interval
      // before capture made a slow 9px nudge leave the hand at nine times its
      // speed.
      if (!g.trail.length) g.trail.push({ t: g.t, a: -g.dir * (g.ux - g.sx) * per });
      // the rig's angle is −scrollP x TAU and a positive angle carries the
      // near side right, so for a card on the near side (dir +1) the fraction
      // goes DOWN as the hand goes right; round the back it is the reverse
      const d = -g.dir * (e.clientX - g.x) * per;
      const p = (scrollP.current ?? 0) + d;
      scrollP.current = p - Math.floor(p);
      g.x = e.clientX;
      g.t = e.timeStamp;
      // The trail the throw is read from (letGo): the last tenth of a second,
      // plus the one sample before it to measure from. A hand that had
      // STOPPED starts a new throw — a still hand sends no moves, so without
      // this a flick after a pause was measured across the pause and thrown
      // at a fraction of its speed.
      const prev = g.trail[g.trail.length - 1];
      if (prev && g.t - prev.t > SET_DOWN) g.trail.length = 0;
      g.a += d;
      g.trail.push({ t: g.t, a: g.a });
      while (g.trail.length > 2 && g.trail[1].t < g.t - THROW_WINDOW) g.trail.shift();
    },
    [letGo],
  );
  const onGrabUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => letGo(e.currentTarget, e.pointerId, e.timeStamp, true),
    [letGo],
  );
  const onGrabCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => letGo(e.currentTarget, e.pointerId, e.timeStamp, false),
    [letGo],
  );

  const onPick = useCallback(
    (c: FloatCat) => {
      // A DRAG IS NEVER ALSO A CLICK. Capture already keeps the release away
      // from the canvas; this is the second lock, because the card a hand
      // dragged is — by the gearing — still under that hand when it lets go,
      // and r3f raises a click for any release on the card that was pressed,
      // however far the pointer travelled in between. Nor is a press that
      // stopped a turning room (`caught`), nor a second finger's tap while
      // the first still has the room.
      if (caught.current || grab.current?.captured || performance.now() - draggedAt.current < 400) return;
      // a closed line opens the small Available Soon window, not a page
      if (c.status === "open") router.push(`/shop/${c.slug}`);
      else openSoon(c.name);
    },
    [router],
  );
  const onHover = useCallback((c: FloatCat | null) => {
    overCard.current = !!c;
    setHovered(c);
  }, []);
  // the frame loop calls this on every change of the centre card; React
  // bails out of the re-render when the index has not actually moved
  const onFocus = useCallback((i: number) => setFocusI(i), []);

  // The centre always names something: whatever the room has brought to the
  // centre position, unless a pointer is on a card, which wins.
  const shown = hovered ?? cats[focusI] ?? cats[0] ?? null;

  // ---- the centre's entrance ----------------------------------------------
  // Every change of the named category replays the same logic. Runs after
  // React has committed the new name, so the letter spans the timeline
  // animates are the ones on screen.
  const fxTl = useRef<gsap.core.Timeline | null>(null);
  const prevSlug = useRef<string | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || !live || !shown) return;
    if (shown.slug === prevSlug.current) return;
    prevSlug.current = shown.slug;
    const els = grabFxEls(el);
    if (!els) return;
    const kind = FX_ALWAYS;
    els.panel.dataset.fx = kind; // a marker for tests, not a style hook
    fxTl.current?.kill();
    fxTl.current = CHANGE[kind](els);
  }, [shown, live]);

  useEffect(
    () => () => {
      fxTl.current?.kill();
    },
    [],
  );

  return (
    <div className="ap-fs" ref={root} data-live={live || undefined} data-drag={dragging || undefined}>
      {/* THE STAGE IS WHAT A HAND TAKES HOLD OF (2026-10-13). The handlers
          sit here, on the canvas's parent, for the reason the globe's do:
          the pointer has to be captured by an ANCESTOR of the canvas for a
          drag's release to stay away from r3f. data-over is the cursor's:
          a hand over the room, a pointing finger over a card that opens. */}
      <div
        className="ap-fs__stage"
        aria-hidden="true"
        data-over={hovered ? "" : undefined}
        onPointerDown={onGrabDown}
        onPointerMove={onGrabMove}
        onPointerUp={onGrabUp}
        onPointerCancel={onGrabCancel}
        // ONLY THE STAGE'S OWN LOSS COUNTS. A finger is captured, implicitly,
        // by the element it lands on — the canvas — so when the stage takes
        // the pointer at the slop the browser tells the CANVAS it has lost
        // it, and that event bubbles up to here. Read as the end of the
        // grab, it killed every touch drag one step after it began (found in
        // review, reproduced with real touch input; a mouse has no implicit
        // capture, which is why every mouse test passed).
        onLostPointerCapture={(e) => {
          if (e.target === e.currentTarget) onGrabCancel(e);
        }}
      >
        {/* the room's chunk can fail to arrive (a page left open across a
            deploy asks for a filename that is gone), and next/dynamic throws
            that to app/error.tsx — the whole home for one room. With the
            boundary the room fails alone and the section falls back to its
            plain layer, the grid every phone already gets (2026-10-12; the
            `live` gate above runs once, so nothing turns it back on). */}
        {live && (
          <MapBoundary onError={() => setLive(false)}>
            <FloatShopCanvas cats={cats} view={view} scrollP={scrollP} spin={spin} spots={spots} onPick={onPick} onPress={onPress} onHover={onHover} onFocus={onFocus} />
          </MapBoundary>
        )}
      </div>

      {/* The section's own name sits in the room's TOP-LEFT corner and never
          moves — the middle belongs to the products. On the plain layer
          this is the whole section, in ordinary flow. */}
      <div className="ap-fs__head">
        <p className="ap-kicker">{kicker}</p>
        <h2 className="ap-fs__big">{name}</h2>
        <p className="ap-lede">{copy}</p>
      </div>

      {/* The centre carries ONLY product text: whatever the turning room has
          brought to the centre position, or the card under the pointer. Every
          name arrives the same way now — the rise above, letters climbing with
          the kicker and price line behind them. The name is split into spans
          so the letter logic has letters; spaces stay text nodes so the name
          can still wrap. */}
      <div className="ap-fs__now">
        <div className="ap-fs__panel" aria-hidden="true">
          <p className="ap-kicker">{hovered ? "(You are looking at)" : "(In the middle)"}</p>
          <p className="ap-fs__prod">
              {/* words are atomic inline-blocks — bare char spans would let
                  the browser break "HOODIES" in half mid-word */}
              {(shown?.name ?? "").split(/(\s+)/).map((part, i) =>
                /\s/.test(part) ? (
                  " "
                ) : part ? (
                  <span className="ap-fs__w" key={`${i}${part}`}>
                    {Array.from(part).map((ch, j) => (
                      <span className="ap-fs__ch" data-ch={ch} key={`${j}${ch}`}>
                        {ch}
                      </span>
                    ))}
                  </span>
                ) : null,
              )}
          </p>
          {/* no price here any more (client, change.pdf p5, 2026-09-15:
              «remove the prices part») — only what a click does */}
          <p className="ap-fs__from">
            {shown ? (shown.status === "open" ? "click to open" : soon.tile) : ""}
          </p>
        </div>
      </div>

      {/* The announcement for readers who cannot see the room. Only the
          POINTED-AT card is announced: the centre also renames itself as the
          ring turns, and narrating that on a timer would be noise. */}
      <p className="ap-sr" role="status">
        {hovered ? `${hovered.name}${hovered.status === "open" ? "" : ` — ${soon.tile}`}` : ""}
      </p>

      {/* how far through the catalogue the room has turned — it also says
          plainly that there are more pieces below, which a room that simply
          rotates never manages to */}
      <p className="ap-fs__count" aria-hidden="true">
        <span>{String(cats.indexOf(shown as FloatCat) + 1 || 1).padStart(2, "0")}</span>
        <span className="ap-fs__count-of">/ {String(cats.length).padStart(2, "0")}</span>
      </p>

      <div className="ap-fs__pill" role="group" aria-label="Change the view">
        <span>Change the view</span>
        <button type="button" aria-pressed={mode === "sphere"} onClick={() => setMode("sphere")}>
          ring
        </button>
        <button type="button" aria-pressed={mode === "cylinder"} onClick={() => setMode("cylinder")}>
          spiral
        </button>
      </div>
    </div>
  );
}
