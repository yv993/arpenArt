"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import type { PuzzleSet } from "@/lib/puzzles";
import { loopTab } from "@/lib/tabLoop";

// ============================================================================
// PUZZLE — a picture from the cloud, played as a jigsaw (Vardan, 2026-10-29:
// «when image opened it can provide puzzle, use provided images, puzzles can
// move like in first image provided moved and user can drag and construct
// puzzle» — his first image was the cloud itself, the cards drifting).
//
// The pieces are HIS files and the board is what they make (lib/puzzles.ts).
// What this adds is the room they lie in:
//
//   · the BOARD sits in the middle with the whole picture as a faint guide;
//     the pieces lie scattered round it and DRIFT the way the cloud's cards
//     do — a slow Lissajous wander and a little bank, every number seeded
//     per piece — so the puzzle is the same moving room, not a new screen;
//   · a piece is TAKEN where its paint is, not its box: the hit test reads
//     each piece's own alpha (a mask built from the loaded image), so a
//     press on the empty corner of one piece's box takes the piece whose
//     paint is under the hand;
//   · it LIFTS on the press (<100ms, scale + a deeper shadow) and follows the
//     hand exactly; released within a third of a cell of its place it
//     SNAPS in (220ms ease-out) and locks, otherwise it settles where it
//     was left and slowly picks its drift back up — never a jump: the drift
//     is folded into the piece's resting place the moment it is taken;
//   · when the last one goes in, the board fades to the finished picture
//     (the cut lines and the play in the cut disappear), a light passes over
//     it once, and the bar says how long it took.
//
// Dragging is not the only way in (WCAG 2.2, 2.5.7 dragging movements, and
// 2.1.1 keyboard): a TAP picks a piece up and a second tap on the picture
// sets it down there; every piece is a button — Enter picks it up, the
// arrow keys walk it cell by cell across the board, Enter sets it down
// (into its place if that is its cell), Escape puts it back. Every result is
// said in a status line. Tab order is the scatter's, never the answer's.
//
// Two forms, one component:
//   · "inline" — the desktop moved layer: the cloud's own 100svh frame is the
//     room (Cloud hides its cards and its panel while the puzzle is out);
//   · "sheet"  — everything else (phones, reduced motion): a full-screen
//     window with the board on top and the pieces below it, no drift under
//     reduced motion and no flights — pieces simply are where they are.
// Leaving and coming back keeps the game: the state is handed to `memory`
// on the way out and read back on the way in.
// ============================================================================

export type PuzzleCopy = {
  cta: string;
  keysShort: string;
  title: string;
  hint: string;
  again: string;
  replay: string;
  back: string;
  done: string;
  keys: string;
  picked: string;
  at: string;
  placed: string;
  miss: string;
  putBack: string;
  piece: string;
  inPlace: string;
  complete: string;
};

export type PuzzleSaved = {
  /** loose pieces as fractions of the room, so a resize between visits
   *  cannot strand one outside it */
  pieces: { u: number; v: number; tilt: number; placed: boolean }[];
  z: number[];
  ms: number;
  done: boolean;
  /** the room's aspect when it was left — a different shape deals anew */
  ar?: number;
};

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const shuffle = <T,>(a: T[]) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const fmt = (ms: number) => {
  const s = Math.max(1, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** a piece within this fraction of a cell of its place (each axis) goes in */
const SNAP = 0.34;
/** THE DRIFT'S REACH, as a fraction of a cell: the widest wander (24px at a
 *  110px cell). Slots keep this much more room from the board and the
 *  room's edges, so a drifting piece never wanders onto either. The cloud's
 *  cards travel 16–38px (Cloud.tsx); the first cut here drifted 6–13, about
 *  a third of what he pointed at (review, 2026-10-29), and now 11–24. */
const REACH = 24 / 110;

// ---- the room --------------------------------------------------------------
type Slot = { x: number; y: number };
type Lay = { W: number; H: number; c: number; s: number; bx: number; by: number; slots: Slot[] };

/** Candidate resting places for pieces, a grid spread evenly over the room,
 *  minus everything that would lie on (or touch) the board. A piece is at
 *  most 1.6 cells across with its tabs, so a centre 0.8c from an edge keeps
 *  it whole, and 0.86c from the board keeps its tabs off the guide. */
function gen(W: number, H: number, c: number, bx: number, by: number, bw: number, bh: number, sp = 1.42) {
  const m = (0.8 + REACH) * c;
  const step = sp * c;
  const avoid = (0.86 + REACH) * c;
  const nx = Math.max(1, Math.floor((W - 2 * m) / step) + 1);
  const ny = Math.max(1, Math.floor((H - 2 * m) / step) + 1);
  const out: Slot[] = [];
  for (let iy = 0; iy < ny; iy++)
    for (let ix = 0; ix < nx; ix++) {
      const x = nx > 1 ? m + (ix * (W - 2 * m)) / (nx - 1) : W / 2;
      const y = ny > 1 ? m + (iy * (H - 2 * m)) / (ny - 1) : H / 2;
      if (x > bx - avoid && x < bx + bw + avoid && y > by - avoid && y < by + bh + avoid) continue;
      out.push({ x, y });
    }
  return out;
}

/** The biggest board for which every piece still has a place of its own
 *  off it. Wide rooms put the board in the middle with the pieces all round
 *  (the cloud's own composition); tall ones put it on top, pieces below. */
function layout(W: number, H: number, set: PuzzleSet): Lay {
  const { cols, rows } = set;
  const N = set.pieces.length;
  // A WIDE ROOM WANTS SLACK: with exactly enough places the deal had no
  // choice — at 1440×900 sixteen of eighteen pieces jammed into a row above
  // the board and a row below, the sides empty (review re-run, 2026-10-29).
  // The middle board is first tried with ~30% spare places, so the deal can
  // spread round all four sides like the cloud; then with just enough; the
  // tall (phone) room keeps its pieces as big as they can be.
  const tries: Array<["centre" | "side" | "top", number]> =
    W / H > 1.25
      ? [["centre", Math.ceil(N * 1.3)], ["centre", N], ["side", N], ["top", N]]
      : [["top", N], ["centre", N], ["side", N]];
  for (const [kind, need] of tries) {
    const cap =
      kind === "centre"
        ? Math.min(150, (W * 0.54) / cols, (H * 0.6) / rows)
        : kind === "top"
          ? Math.min(150, (W - 24) / cols, (H * 0.44) / rows)
          : Math.min(150, (W * 0.6) / cols, (H - 24) / rows);
    for (let c = Math.floor(cap); c >= 36; c -= 2) {
      const bw = cols * c;
      const bh = rows * c;
      const bx = kind === "side" ? Math.max(12, W * 0.04) : (W - bw) / 2;
      const by = kind === "top" ? 12 : (H - bh) / 2;
      const slots = gen(W, H, c, bx, by, bw, bh);
      if (slots.length >= need) return { W, H, c, s: c / set.cell, bx, by, slots };
    }
  }
  // a room too small for eighteen apart: the board as big as it can be in
  // the middle, the pieces packed tighter (overlapping) around it
  const c = Math.max(20, Math.min((W - 24) / cols, (H * 0.5) / rows));
  const bx = (W - cols * c) / 2;
  const by = 12;
  let slots = gen(W, H, c, bx, by, cols * c, rows * c, 0.9);
  if (!slots.length) slots = [{ x: W / 2, y: H - c }];
  while (slots.length < N) slots = slots.concat(slots.map((p) => ({ x: p.x + c * 0.3, y: p.y + c * 0.3 })));
  return { W, H, c, s: c / set.cell, bx, by, slots };
}

/** N of the slots, spread round the board (by angle from its centre), with
 *  a random start so a second scatter is not the first */
function spread(lay: Lay, N: number, cols: number, rows: number) {
  const { slots } = lay;
  if (slots.length <= N) return shuffle([...slots]);
  const cx = lay.bx + (cols * lay.c) / 2;
  const cy = lay.by + (rows * lay.c) / 2;
  const s = [...slots].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  const step = s.length / N;
  const off = Math.random() * step;
  const out: Slot[] = [];
  for (let k = 0; k < N; k++) out.push(s[Math.floor(k * step + off) % s.length]);
  return shuffle(out);
}

// ---- one piece's moving state (mutable; the ticker reads it) ---------------
type P = {
  i: number;
  /** the centre of its BODY cell, room px — its resting place */
  x: number;
  y: number;
  tilt: number;
  lift: number;
  /** the drift's weight, 0..1 (0 while held, placed, or still) */
  w: number;
  placed: boolean;
  z: number;
  ax: number;
  ay: number;
  fx: number;
  fy: number;
  ph: number;
  ar: number;
  fr: number;
  /** what was last drawn — the hit test reads these */
  rx: number;
  ry: number;
  rr: number;
  rs: number;
};

const makeP = (i: number): P => {
  const r = () => Math.random();
  return {
    i,
    x: 0,
    y: 0,
    tilt: 0,
    lift: 0,
    w: 0,
    placed: false,
    z: 10 + i,
    ax: 11 + r() * 13,
    ay: 9 + r() * 11,
    fx: 0.24 + r() * 0.24,
    fy: 0.2 + r() * 0.22,
    ph: r() * Math.PI * 2,
    ar: 1 + r() * 1.4,
    fr: 0.14 + r() * 0.14,
    rx: 0,
    ry: 0,
    rr: 0,
    rs: 1,
  };
};

export default function Puzzle({
  set,
  mode,
  label,
  copy,
  memory,
  onExit,
}: {
  set: PuzzleSet;
  mode: "inline" | "sheet";
  /** what the picture is called on this site — "No. 05" */
  label: string;
  copy: PuzzleCopy;
  memory: React.MutableRefObject<Record<string, PuzzleSaved | undefined>>;
  onExit: () => void;
}) {
  const N = set.pieces.length;
  const host = useRef<HTMLDivElement | null>(null);
  const sheet = useRef<HTMLDivElement | null>(null);
  const bar = useRef<HTMLDivElement | null>(null);
  const els = useRef<(HTMLButtonElement | null)[]>([]);
  const masks = useRef<({ w: number; h: number; a: Uint8Array } | null)[]>([]);
  const ps = useRef<P[]>([]);
  const lay = useRef<Lay | null>(null);
  const dirty = useRef(true);
  const visible = useRef(true);
  /** reduced motion: no drift, no flights, no lift tween */
  const still = useRef(false);
  const top = useRef(40);
  /** the "picture first" beat's delayed deal; null once it has dealt */
  const intro = useRef<gsap.core.Tween | null>(null);
  const introPending = () => !!intro.current && intro.current.progress() < 1;
  const titleId = useId();
  const keysId = useId();

  // Tab order and the pieces' spoken numbers follow a shuffle made once per
  // visit, never the board's order (which would read out the answer)
  const [order] = useState(() => shuffle([...Array(N).keys()]));
  const rank = useRef<number[]>([]);
  if (!rank.current.length) order.forEach((i, k) => (rank.current[i] = k + 1));

  const [L, setL] = useState<Lay | null>(null);
  const [ready, setReady] = useState(false);
  const [placed, setPlaced] = useState<boolean[]>(() => Array(N).fill(false));
  const [held, setHeldState] = useState<number | null>(null);
  const [sel, setSelState] = useState<number | null>(null);
  const [done, setDoneState] = useState(false);
  const [say, setSayRaw] = useState("");
  /** a status line said twice in a row ("Not its place") must be heard
   *  twice: the text alternates a trailing no-break space, so it changes */
  const flip = useRef(false);
  const setSay = (t: string) => {
    flip.current = !flip.current;
    setSayRaw(t ? t + (flip.current ? "\u00a0" : "") : "");
  };
  const [time, setTime] = useState("");
  const heldRef = useRef<number | null>(null);
  const selRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const setHeld = (i: number | null) => {
    heldRef.current = i;
    setHeldState(i);
  };
  const setSel = (i: number | null) => {
    selRef.current = i;
    setSelState(i);
  };
  const setDone = (v: boolean) => {
    doneRef.current = v;
    setDoneState(v);
  };
  const exit = useRef(onExit);
  exit.current = onExit;

  // ---- the clock: from the first piece taken to the last one in ----------
  const clock = useRef({ at: 0, ms: 0 });
  const clockMs = () => clock.current.ms + (clock.current.at ? performance.now() - clock.current.at : 0);
  const startClock = () => {
    if (!clock.current.at && !doneRef.current) clock.current.at = performance.now();
  };
  const stopClock = () => {
    clock.current.ms = clockMs();
    clock.current.at = 0;
  };

  // ---- geometry helpers ----------------------------------------------------
  const home = (l: Lay, i: number) => {
    const pc = set.pieces[i];
    return { x: l.bx + (pc.c + 0.5) * l.c, y: l.by + (pc.r + 0.5) * l.c };
  };
  /** the body's centre inside the piece's own box, CSS px at scale s */
  const origin = (i: number, s: number) => {
    const pc = set.pieces[i];
    return { x: (pc.c * set.cell - pc.x + set.cell / 2) * s, y: (pc.r * set.cell - pc.y + set.cell / 2) * s };
  };
  const mark = () => {
    dirty.current = true;
  };
  const amp = () => ((lay.current?.c ?? 110) / 110) * (mode === "sheet" ? 0.5 : 1);
  /** fold the drift into the resting place, so stopping it moves nothing */
  const absorb = (p: P) => {
    if (!still.current && p.w) {
      const t = gsap.ticker.time;
      const a = amp();
      p.x += Math.sin(t * p.fx + p.ph) * p.ax * a * p.w;
      p.y += Math.cos(t * p.fy + p.ph * 1.7) * p.ay * a * p.w;
      p.tilt += Math.sin(t * p.fr + p.ph) * p.ar * p.w;
    }
    p.w = 0;
  };
  const take = (p: P) => {
    gsap.killTweensOf(p);
    absorb(p);
  };
  const raise = (i: number) => {
    const p = ps.current[i];
    p.z = ++top.current;
    const el = els.current[i];
    if (el) el.style.zIndex = String(p.z);
  };
  const dur = (s: number) => (still.current ? 0 : s);
  /** let go: down from the lift, and the drift slowly back */
  const settle = (i: number) => {
    const p = ps.current[i];
    gsap.to(p, { lift: 0, duration: dur(0.18), ease: "power2.out", onUpdate: mark });
    if (!still.current) gsap.to(p, { w: 1, duration: 1.6, delay: 0.15, ease: "sine.inOut", onUpdate: mark });
  };

  /** a slot, jittered a little, with the whole piece kept inside the room:
   *  a body is ±0.5 cell, a tab 0.3 more, and the tilt a hair beyond — so
   *  no tab is cut by the room's edge (measured: 0.6c let a left tab run
   *  off a 390px phone) */
  const settleIn = (l: Lay, s: Slot): [number, number] => {
    const e = (0.86 + REACH) * l.c;
    return [
      clamp(s.x + (Math.random() - 0.5) * 0.2 * l.c, e, Math.max(e, l.W - e)),
      clamp(s.y + (Math.random() - 0.5) * 0.2 * l.c, e, Math.max(e, l.H - e)),
    ];
  };
  /** THE LOOSE PIECES GET NEW PLACES when the room changes shape (a phone
   *  turned on its side, a window made much narrower): kept as fractions of
   *  a portrait room they piled into two columns of a landscape one, two of
   *  them over the board (measured 390×844 → 844×390). Placed pieces stay
   *  in; a piece in the hand is left in the hand. */
  const redeal = (l: Lay) => {
    const loose = ps.current.filter((p) => !p.placed && heldRef.current !== p.i);
    const slots = spread(l, loose.length, set.cols, set.rows);
    loose.forEach((p, k) => {
      take(p);
      const [x, y] = settleIn(l, slots[k % slots.length]);
      p.x = x;
      p.y = y;
      p.tilt = (Math.random() - 0.5) * 10;
      p.w = still.current ? 0 : 1;
    });
    if (selRef.current !== null && !ps.current[selRef.current]?.placed) {
      ps.current[selRef.current].lift = 0;
      setSel(null);
    }
  };
  /** a change of shape worth a new deal: the aspect moved by over ~25% */
  const reshaped = (a: number, b: number) => Math.abs(Math.log(a / b)) > 0.22;

  // ---- scatter: every piece to a place of its own off the board ----------
  const scatter = useCallback(
    (fly: boolean) => {
      const l = lay.current;
      if (!l) return;
      // ONE DEAL AT A TIME, AND NOTHING LEFT IN A HAND (review, 2026-10-29):
      // «Scatter again» in the opening beat was dealt twice (its own, then
      // the beat's at 0.85s), and a deal under a held piece tweened it out of
      // the hand while the hand kept writing to it
      intro.current?.kill();
      intro.current = null;
      if (drag.current) {
        try {
          host.current?.releasePointerCapture(drag.current.id);
        } catch {
          /* already released */
        }
      }
      drag.current = null;
      tap.current = null;
      kbd.current = null;
      const slots = spread(l, N, set.cols, set.rows);
      const sequence = shuffle([...Array(N).keys()]);
      setDone(false);
      setSel(null);
      setHeld(null);
      setTime("");
      clock.current = { at: 0, ms: 0 };
      sequence.forEach((i, k) => {
        const p = ps.current[i];
        take(p);
        p.placed = false;
        p.lift = 0;
        p.z = 10 + k;
        const el = els.current[i];
        if (el) el.style.zIndex = String(p.z);
        const [tx, ty] = settleIn(l, slots[k]);
        const tt = (Math.random() - 0.5) * 10;
        if (fly && !still.current) {
          gsap.to(p, {
            x: tx,
            y: ty,
            tilt: tt,
            duration: 0.9,
            delay: k * 0.028,
            ease: "power3.inOut",
            onUpdate: mark,
            onComplete: () => {
              gsap.to(p, { w: 1, duration: 1.4, ease: "sine.inOut", onUpdate: mark });
            },
          });
        } else {
          p.x = tx;
          p.y = ty;
          p.tilt = tt;
          p.w = still.current ? 0 : 1;
        }
      });
      top.current = 10 + N;
      setPlaced(Array(N).fill(false));
      mark();
    },
    // `set` and N are fixed for the life of the component
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [N, set],
  );

  // ---- the room's size: measured, and re-measured on every resize --------
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const run = () => {
      const W = el.clientWidth;
      const H = el.clientHeight;
      if (W < 40 || H < 40) return;
      const prev = lay.current;
      if (prev && Math.abs(prev.W - W) < 0.5 && Math.abs(prev.H - H) < 0.5) return;
      // a flight, a snap or a keyboard step still running writes targets of
      // the OLD board: finish them there, then the rescale below carries
      // their end points over (review: a resize mid-flight left 4 pieces off
      // screen, one mid-snap left a placed piece 0.6 cell off its cell)
      if (prev) gsap.getTweensOf(ps.current).forEach((t) => t.progress(1));
      const next = layout(W, H, set);
      lay.current = next;
      // a placed piece re-seats on the new board; a loose one keeps its place
      // as a fraction of the room — unless the room changed shape, when the
      // loose ones are dealt new places (see redeal)
      const deal = !!prev && reshaped(W / H, prev.W / prev.H);
      for (const p of ps.current) {
        if (p.placed) {
          const h = home(next, p.i);
          p.x = h.x;
          p.y = h.y;
        } else if (prev && !deal) {
          p.x *= W / prev.W;
          p.y *= H / prev.H;
        }
      }
      if (deal && ps.current.length) redeal(next);
      setL(next);
      mark();
    };
    run();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set]);

  // reduced motion, read live: a change mid-game stops (or restarts) the drift
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    still.current = m.matches;
    const on = () => {
      still.current = m.matches;
      for (const p of ps.current) {
        if (m.matches) take(p);
        else if (!p.placed && heldRef.current !== p.i && selRef.current !== p.i) p.w = 1;
      }
      mark();
    };
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);

  // ---- the first layout: restore the last visit, or deal a new game ------
  const inited = useRef(false);
  useEffect(() => {
    if (!L || inited.current) return;
    inited.current = true;
    ps.current = set.pieces.map((_, i) => makeP(i));
    const saved = memory.current[set.art];
    if (saved && saved.pieces.length === N) {
      saved.pieces.forEach((s, i) => {
        const p = ps.current[i];
        p.placed = s.placed;
        p.z = saved.z[i] ?? p.z;
        top.current = Math.max(top.current, p.z);
        if (s.placed) {
          const h = home(L, i);
          p.x = h.x;
          p.y = h.y;
        } else {
          p.x = s.u * L.W;
          p.y = s.v * L.H;
          p.tilt = s.tilt;
          p.w = still.current ? 0 : 1;
        }
        const el = els.current[i];
        if (el) el.style.zIndex = String(p.z);
      });
      // left in a room of another shape (the window form on a phone that
      // has since turned, the desktop room after the sheet): new places
      if (saved.ar && reshaped(L.W / L.H, saved.ar)) redeal(L);
      clock.current = { at: 0, ms: saved.ms };
      setPlaced(saved.pieces.map((s) => s.placed));
      setDone(saved.done);
      if (saved.done) setTime(fmt(saved.ms));
    } else {
      // THE PICTURE FIRST: all eighteen lie in their places for a beat, so
      // the visitor sees what they are about to make, then the pieces fly
      // out to their places round the board
      ps.current.forEach((p) => {
        const h = home(L, p.i);
        p.x = h.x;
        p.y = h.y;
        const el = els.current[p.i];
        if (el) el.style.zIndex = String(p.z);
      });
      if (still.current) scatter(false);
      else intro.current = gsap.delayedCall(0.85, () => scatter(true));
    }
    // THE CHECK HARNESS'S WINDOW (imgss/puzzle-2026-10-29/check): the moving
    // state, read from outside on the dev server. The build replaces
    // NODE_ENV, so production carries none of it.
    if (process.env.NODE_ENV !== "production") (window as unknown as { __pz: unknown }).__pz = { ps, lay, still };
    mark();
    // shown after the first frame has put every piece where it belongs
    requestAnimationFrame(() => {
      setReady(true);
      // focus lands inside — on the first loose piece, in the scatter's
      // order — so a keyboard starts where the game is
      const first = order.find((i) => !ps.current[i]?.placed);
      const target = first !== undefined ? els.current[first] : bar.current?.querySelector("button");
      target?.focus({ preventScroll: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L]);

  // ---- the frame loop ------------------------------------------------------
  useEffect(() => {
    if (!L) return;
    const tick = () => {
      const l = lay.current;
      if (!l || !visible.current) return;
      const moving = !still.current;
      if (!moving && !dirty.current) return;
      dirty.current = false;
      const t = gsap.ticker.time;
      const a = amp();
      for (const p of ps.current) {
        const el = els.current[p.i];
        if (!el) continue;
        const w = moving ? p.w : 0;
        const dx = w ? Math.sin(t * p.fx + p.ph) * p.ax * a * w : 0;
        const dy = w ? Math.cos(t * p.fy + p.ph * 1.7) * p.ay * a * w : 0;
        const dr = w ? Math.sin(t * p.fr + p.ph) * p.ar * w : 0;
        const o = origin(p.i, l.s);
        p.rx = p.x + dx;
        p.ry = p.y + dy;
        p.rr = p.tilt + dr;
        p.rs = 1 + 0.05 * p.lift;
        el.style.transform = `translate3d(${(p.rx - o.x).toFixed(2)}px, ${(p.ry - o.y).toFixed(2)}px, 0) rotate(${p.rr.toFixed(3)}deg) scale(${p.rs.toFixed(4)})`;
      }
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, mode]);

  // the loop rests while the room is off screen (the cloud scrolls away)
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      visible.current = e.isIntersecting;
      if (e.isIntersecting) mark();
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // on the way out: kill every tween, and hand the game to `memory`
  useEffect(
    () => () => {
      // LEFT IN THE OPENING BEAT, the game was never dealt: keep nothing, so
      // the next visit deals fresh (review: it came back as a jumbled picture
      // that never scattered). Otherwise every running tween is finished
      // first, so a piece is kept where it was going, not where it was.
      const pending = introPending();
      intro.current?.kill();
      if (!pending) gsap.getTweensOf(ps.current).forEach((t) => t.progress(1));
      gsap.killTweensOf(ps.current);
      const l = lay.current;
      if (pending || !l || !ps.current.length) return;
      memory.current[set.art] = {
        pieces: ps.current.map((p) => ({ u: p.x / l.W, v: p.y / l.H, tilt: p.tilt, placed: p.placed })),
        z: ps.current.map((p) => p.z),
        ms: clockMs(),
        done: doneRef.current,
        ar: l.W / l.H,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ---- the alpha masks, one per piece, built as its image arrives --------
  const onImg = (i: number, img: HTMLImageElement) => {
    if (masks.current[i] || !img.naturalWidth) return;
    const w = Math.max(8, Math.round(img.naturalWidth / 4));
    const h = Math.max(8, Math.round(img.naturalHeight / 4));
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const g = cv.getContext("2d", { willReadFrequently: true });
    if (!g) return;
    g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    const a = new Uint8Array(w * h);
    for (let k = 0; k < w * h; k++) a[k] = d[k * 4 + 3];
    masks.current[i] = { w, h, a };
  };

  /** the loose piece whose PAINT is under (x, y), topmost first; -1 if none */
  const hit = (x: number, y: number) => {
    const l = lay.current;
    if (!l) return -1;
    let best = -1;
    let bz = -Infinity;
    for (const p of ps.current) {
      if (p.placed || p.z <= bz) continue;
      const pc = set.pieces[p.i];
      const o = origin(p.i, l.s);
      const a = (-p.rr * Math.PI) / 180;
      const vx = (x - p.rx) / p.rs;
      const vy = (y - p.ry) / p.rs;
      const lx = o.x + vx * Math.cos(a) - vy * Math.sin(a);
      const ly = o.y + vx * Math.sin(a) + vy * Math.cos(a);
      const W = pc.w * l.s;
      const H = pc.h * l.s;
      if (lx < 0 || ly < 0 || lx >= W || ly >= H) continue;
      const m = masks.current[p.i];
      if (m && m.a[Math.floor((ly / H) * m.h) * m.w + Math.floor((lx / W) * m.w)] < 96) continue;
      best = p.i;
      bz = p.z;
    }
    return best;
  };

  // ---- putting a piece in ------------------------------------------------
  const complete = () => {
    stopClock();
    const t = fmt(clock.current.ms);
    setTime(t);
    setDone(true);
    setSay(fill(copy.complete, { total: N, time: t }));
  };
  const place = (i: number) => {
    const l = lay.current;
    if (!l) return;
    const p = ps.current[i];
    take(p);
    p.placed = true;
    p.z = 2;
    const el = els.current[i];
    if (el) el.style.zIndex = "2";
    const h = home(l, i);
    gsap.to(p, { x: h.x, y: h.y, tilt: 0, lift: 0, duration: dur(0.22), ease: "power3.out", onUpdate: mark });
    // its button is about to be disabled: focus moves on before it is, or
    // it falls to <body> (review: a mouse placement of the focused piece)
    if (document.activeElement === el) focusNext(i);
    setPlaced((prev) => {
      const next = [...prev];
      next[i] = true;
      return next;
    });
    const n = ps.current.filter((q) => q.placed).length;
    if (n === N) complete();
    else setSay(fill(copy.placed, { n, total: N }));
  };
  /** set down: into its place if it is close enough, else where it lies */
  const drop = (i: number) => {
    const l = lay.current;
    if (!l) return;
    const p = ps.current[i];
    const h = home(l, i);
    if (Math.abs(p.x - h.x) < SNAP * l.c && Math.abs(p.y - h.y) < SNAP * l.c) place(i);
    else settle(i);
  };

  // ---- the hand ------------------------------------------------------------
  const drag = useRef<{ id: number; i: number; ox: number; oy: number; sx: number; sy: number; moved: boolean } | null>(null);
  /** a press on the empty room: a tap there sets the picked piece down */
  const tap = useRef<{ id: number; x: number; y: number } | null>(null);
  const kbd = useRef<{ i: number; from: { x: number; y: number; tilt: number }; r: number; c: number } | null>(null);
  const local = (e: { clientX: number; clientY: number }) => {
    const r = host.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  /** the keyboard's hold ends first, whatever takes over */
  const dropKbd = (check: boolean, quiet = false) => {
    const k = kbd.current;
    if (!k) return;
    kbd.current = null;
    setHeld(null);
    const pc = set.pieces[k.i];
    if (check && k.r === pc.r && k.c === pc.c) place(k.i);
    else {
      settle(k.i);
      if (check && !quiet) setSay(copy.miss);
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!lay.current || drag.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if ((e.target as HTMLElement).closest(".ap-pz__bar")) return;
    // IN THE OPENING BEAT every piece lies in its place, and the deal is a
    // moment away: a press there deals now rather than lifting a piece the
    // deal would pull out of the hand (review, 2026-10-29)
    if (introPending()) {
      e.preventDefault();
      scatter(true);
      return;
    }
    // a keyboard hold ends when a hand takes over — and a piece it left on
    // its own cell goes in (review: it lay exactly on its home, not placed).
    // Before the hit test, so a piece that just went in cannot be taken.
    if (kbd.current) dropKbd(true, true);
    const pt = local(e);
    const i = hit(pt.x, pt.y);
    if (i < 0) {
      // a press on the empty room keeps focus where it is: it used to fall
      // to <body> here, so the tap that set a picked piece into its place
      // lost focus before the piece went in (review re-run, 2026-10-29)
      e.preventDefault();
      tap.current = { id: e.pointerId, x: pt.x, y: pt.y };
      return;
    }
    e.preventDefault();
    try {
      host.current?.setPointerCapture(e.pointerId);
    } catch {
      /* a pointer already gone — the press still counts */
    }
    if (selRef.current !== null && selRef.current !== i) {
      settle(selRef.current);
      setSel(null);
    }
    const p = ps.current[i];
    take(p);
    raise(i);
    gsap.to(p, { lift: 1, tilt: 0, duration: dur(0.12), ease: "power2.out", onUpdate: mark });
    setHeld(i);
    startClock();
    drag.current = { id: e.pointerId, i, ox: pt.x - p.x, oy: pt.y - p.y, sx: pt.x, sy: pt.y, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const l = lay.current;
    if (!d || !l || e.pointerId !== d.id) return;
    const pt = local(e);
    if (!d.moved) {
      if (Math.hypot(pt.x - d.sx, pt.y - d.sy) < 4) return;
      d.moved = true;
    }
    const p = ps.current[d.i];
    // never so far out that it lies under the window's head or bar (their
    // presses would land on the piece) — half its body stays in the room
    p.x = clamp(pt.x - d.ox, 0.4 * l.c, l.W - 0.4 * l.c);
    p.y = clamp(pt.y - d.oy, 0.4 * l.c, l.H - 0.4 * l.c);
    mark();
  };

  const moveSelTo = (pt: { x: number; y: number }) => {
    const i = selRef.current;
    const l = lay.current;
    if (i === null || !l) return;
    setSel(null);
    const p = ps.current[i];
    take(p);
    gsap.to(p, {
      x: clamp(pt.x, 0.4 * l.c, l.W - 0.4 * l.c),
      y: clamp(pt.y, 0.4 * l.c, l.H - 0.4 * l.c),
      tilt: 0,
      duration: dur(0.3),
      ease: "power3.out",
      onUpdate: mark,
      onComplete: () => drop(i),
    });
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    const t = tap.current;
    if (t && t.id === e.pointerId) {
      tap.current = null;
      if (e.type === "pointerup" && selRef.current !== null) {
        const pt = local(e);
        if (Math.hypot(pt.x - t.x, pt.y - t.y) < 8) moveSelTo(pt);
      }
      return;
    }
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    try {
      if (host.current?.hasPointerCapture(e.pointerId)) host.current.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    setHeld(null);
    if (!d.moved && e.type === "pointerup") {
      // A TAP ON A PIECE picks it up (and a second tap on it puts it back
      // down) — the single-pointer way, for a hand that cannot drag
      if (selRef.current === d.i) {
        setSel(null);
        settle(d.i);
      } else setSel(d.i);
      return;
    }
    if (selRef.current === d.i) setSel(null);
    drop(d.i);
  };

  // ---- the keyboard --------------------------------------------------------
  const toCell = () => {
    const k = kbd.current;
    const l = lay.current;
    if (!k || !l) return;
    const p = ps.current[k.i];
    gsap.to(p, { x: l.bx + (k.c + 0.5) * l.c, y: l.by + (k.r + 0.5) * l.c, tilt: 0, duration: dur(0.16), ease: "power2.out", onUpdate: mark });
  };
  const focusNext = (from: number) => {
    const at = order.indexOf(from);
    for (let s = 1; s <= N; s++) {
      const i = order[(at + s) % N];
      if (!ps.current[i].placed) {
        els.current[i]?.focus({ preventScroll: true });
        return;
      }
    }
    bar.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  };
  const onKey = (i: number) => (e: React.KeyboardEvent) => {
    const l = lay.current;
    if (!l || ps.current[i]?.placed) return;
    const k = kbd.current;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      // a held key repeats: one pick-up per press, not nine set-downs and
      // pick-ups a second (review)
      if (e.repeat) return;
      // in the opening beat the piece lies in its place — picking it up
      // would read out its answer; the deal comes now instead
      if (introPending()) {
        scatter(true);
        return;
      }
      if (k && k.i === i) {
        // place() moves focus on when this one goes in
        dropKbd(true);
        return;
      }
      if (k) dropKbd(false);
      if (selRef.current !== null) {
        settle(selRef.current);
        setSel(null);
      }
      const p = ps.current[i];
      take(p);
      raise(i);
      const c = clamp(Math.floor((p.x - l.bx) / l.c), 0, set.cols - 1);
      const r = clamp(Math.floor((p.y - l.by) / l.c), 0, set.rows - 1);
      kbd.current = { i, from: { x: p.x, y: p.y, tilt: p.tilt }, r, c };
      gsap.to(p, { lift: 1, duration: dur(0.12), onUpdate: mark });
      toCell();
      setHeld(i);
      startClock();
      setSay(fill(copy.picked, { k: rank.current[i], r: r + 1, c: c + 1 }));
      return;
    }
    if (!k || k.i !== i) return;
    const step: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const s = step[e.key];
    if (s) {
      e.preventDefault();
      e.stopPropagation();
      k.r = clamp(k.r + s[0], 0, set.rows - 1);
      k.c = clamp(k.c + s[1], 0, set.cols - 1);
      toCell();
      setSay(fill(copy.at, { r: k.r + 1, c: k.c + 1 }));
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      kbd.current = null;
      setHeld(null);
      const p = ps.current[i];
      take(p);
      gsap.to(p, { x: k.from.x, y: k.from.y, tilt: k.from.tilt, duration: dur(0.2), ease: "power2.out", onUpdate: mark });
      settle(i);
      setSay(copy.putBack);
    }
  };

  // Escape leaves the puzzle (a held piece takes it first, above); in the
  // window form Tab stays inside, and the page under it does not scroll
  useEffect(() => {
    const onWin = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !kbd.current) {
        // ANOTHER WINDOW'S ESCAPE IS ITS OWN (review, 2026-10-29): the nav's
        // drawer or a photo window open over the page closed this puzzle too
        // and sent focus to «Play the puzzle» screens away. Inline, the key
        // is the puzzle's only when focus is in it, or nowhere with the room
        // on screen (a press on the room leaves focus on <body>).
        const modal = document.querySelector('[aria-modal="true"]');
        if (modal && modal !== sheet.current) return;
        if (mode === "inline") {
          const a = document.activeElement;
          const inside = !!a && (!!host.current?.contains(a) || !!bar.current?.contains(a));
          if (!inside && !(a === document.body && visible.current)) return;
        }
        e.preventDefault();
        // a piece picked up by a tap is put down first, as a held one is
        if (selRef.current !== null) {
          settle(selRef.current);
          setSel(null);
          setSay(copy.putBack);
          return;
        }
        exit.current();
        return;
      }
      if (mode === "sheet") loopTab(e, sheet.current);
    };
    window.addEventListener("keydown", onWin);
    let prev = "";
    if (mode === "sheet") {
      prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", onWin);
      if (mode === "sheet") document.body.style.overflow = prev;
    };
  }, [mode]);

  const again = () => {
    drag.current = null;
    tap.current = null;
    kbd.current = null;
    scatter(true);
    setSay("");
  };

  const count = placed.filter(Boolean).length;
  const v = `?v=${set.v}`;
  const board = L ? { left: L.bx, top: L.by, width: L.c * set.cols, height: L.c * set.rows } : undefined;

  const room = (
    <>
      <div
        className="ap-pz"
        data-mode={mode}
        data-ready={ready || undefined}
        data-done={done || undefined}
        ref={host}
        role="group"
        aria-label={`${copy.title} — ${label}`}
        aria-describedby={keysId}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onLostPointerCapture={(e) => {
          if (drag.current?.id === e.pointerId) onPointerEnd(e);
        }}
        onDragStart={(e) => e.preventDefault()}
      >
        <p className="ap-sr" id={keysId}>
          {copy.keys}
        </p>
        {board && (
          <div className="ap-pz__board" style={board} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- the guide: his eighteen, assembled */}
            <img className="ap-pz__ghost" src={set.full.src + v} alt="" width={set.full.w} height={set.full.h} draggable={false} />
          </div>
        )}
        {L &&
          order.map((i, k) => {
            const pc = set.pieces[i];
            const o = origin(i, L.s);
            const isIn = placed[i];
            return (
              <button
                key={pc.n}
                ref={(el) => {
                  els.current[i] = el;
                }}
                type="button"
                className="ap-pz__piece"
                style={
                  {
                    width: pc.w * L.s,
                    height: pc.h * L.s,
                    transformOrigin: `${o.x}px ${o.y}px`,
                    "--d": `${k * 14}ms`,
                  } as React.CSSProperties
                }
                data-held={held === i || undefined}
                data-sel={sel === i || undefined}
                data-placed={isIn || undefined}
                disabled={isIn}
                aria-pressed={!isIn ? held === i || sel === i : undefined}
                aria-label={isIn ? fill(copy.inPlace, { k: k + 1 }) : fill(copy.piece, { k: k + 1, total: N })}
                onKeyDown={onKey(i)}
                onBlur={() => {
                  if (kbd.current?.i === i) dropKbd(true);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- his piece, moved by transform */}
                <img
                  src={pc.src + v}
                  alt=""
                  width={pc.w}
                  height={pc.h}
                  draggable={false}
                  ref={(img) => {
                    if (img?.complete) onImg(i, img);
                  }}
                  onLoad={(e) => onImg(i, e.currentTarget)}
                />
              </button>
            );
          })}
        {board && (
          <div className="ap-pz__whole" style={board} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- the finished picture */}
            <img src={set.full.src + v} alt="" width={set.full.w} height={set.full.h} draggable={false} />
            <span className="ap-pz__shine" />
          </div>
        )}
        <p className="ap-sr" role="status">
          {say}
        </p>
      </div>
      <div className="ap-pz__bar" data-mode={mode} ref={bar}>
        <p className="ap-pz__count" aria-hidden="true">
          <strong>{count}</strong> / {N}
        </p>
        {done ? (
          <p className="ap-pz__msg">{fill(copy.done, { time })}</p>
        ) : (
          !count && <p className="ap-pz__msg is-hint">{copy.hint}</p>
        )}
        {/* the keyboard's way, in sight while a piece has keyboard focus
            (puzzle.css shows it on :focus-visible) — not only in the
            screen-reader text */}
        {!done && <p className="ap-pz__msg is-keys">{copy.keysShort}</p>}
        <button type="button" className="ap-pz__btn" onClick={again}>
          {done ? copy.replay : copy.again}
        </button>
        {mode === "inline" && (
          <button type="button" className="ap-pz__btn" onClick={onExit}>
            <span aria-hidden="true">←</span> {copy.back}
          </button>
        )}
      </div>
    </>
  );

  if (mode === "inline") return room;
  return createPortal(
    <div className="ap-pz-sheet ap-dark" ref={sheet} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="ap-pz-sheet__head">
        <p className="ap-pz-sheet__title" id={titleId}>
          {label} <span>{copy.title}</span>
        </p>
        <button type="button" className="ap-pz-sheet__x" onClick={onExit} aria-label={copy.back}>
          ✕
        </button>
      </div>
      {room}
    </div>,
    document.body,
  );
}
