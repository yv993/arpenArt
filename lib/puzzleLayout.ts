// ============================================================================
// THE PUZZLE'S ROOM — where the board lies and where its pieces may rest.
//
// Moved here from components/Puzzle.tsx unchanged (review, change 5): the
// cloud section shows No. 05's still where the game's board WILL be while
// the game itself is still coming (its code waits for window load, its
// pictures for the section — Cloud.tsx), and the only way to know that
// place before the game's file has arrived is to run the very same layout.
// Puzzle.tsx imports it from here, so the two can never disagree. It is a
// few small functions with no imports: nothing heavy joins the home page.
// ============================================================================
import type { PuzzleSet } from "./puzzles";

/** THE DRIFT'S REACH, as a fraction of a cell: the widest wander (24px at a
 *  110px cell). Slots keep this much more room from the board and the
 *  room's edges, so a drifting piece never wanders onto either. The cloud's
 *  cards travel 16–38px (Cloud.tsx); the first cut here drifted 6–13, about
 *  a third of what he pointed at (review, 2026-10-29), and now 11–24. */
export const REACH = 24 / 110;

export type Slot = { x: number; y: number };
/** a box no piece may rest in (room px) — the cloud's title, when the
 *  puzzle is played in place beside it */
export type Rect = { l: number; t: number; r: number; b: number };
/** which way the board lies in its room: in the middle with the pieces all
 *  round ("centre"), to one side ("side"), on top with the pieces below
 *  ("top"), or a room too small for every piece apart ("packed") */
export type Kind = "centre" | "side" | "top" | "packed";
/** c: the larger side of a cell, CSS px; cw × ch: a cell, CSS px; s: CSS px
 *  per source px */
export type Lay = { W: number; H: number; c: number; s: number; cw: number; ch: number; bx: number; by: number; slots: Slot[]; kind: Kind };

/** Candidate resting places for pieces, in BANDS laid round the board: a
 *  block of columns to its left and to its right (the room's full height),
 *  then rows above and below it — each band spread evenly over its own
 *  space. A piece is at most 1.6 cells across with its tabs, so a centre
 *  0.8c from an edge keeps it whole, and 0.86c from the board keeps its tabs
 *  off the guide; neighbours sit 1.18c apart across, 1.08c down.
 *  BIGGER PIECES (Vardan, 2026-10-31: «image part can be bigger, change in
 *  all puzzle parts»): the old single grid over the whole room put its
 *  columns wherever the room's width divided, so the ones that fell in the
 *  board's margin were lost, and its 1.42c spacing left wide gaps — the
 *  places ran out long before the room did, and held the board to 70% of
 *  the room's height at 1920×945.
 *  NO-GO BOXES (change 5.pdf p1, 2026-11-04): played in place, the cloud's
 *  title stays up in the room's corner, and a place whose piece (its tabs
 *  and its drift included) would reach into `no` is not a place. */
export function gen(W: number, H: number, c: number, bx: number, by: number, bw: number, bh: number, sp = 1, no: Rect[] = []) {
  const m = (0.8 + REACH) * c;
  const avoid = (0.86 + REACH) * c;
  const fx = 1.18 * sp;
  const fy = 1.08 * sp;
  const out: Slot[] = [];
  const clear = (x: number, y: number) => !no.some((r) => x + m > r.l && x - m < r.r && y + m > r.t && y - m < r.b);
  /** slot centres spread over [x0, x1] × [y0, y1]; false when it has no room */
  const band = (x0: number, x1: number, y0: number, y1: number) => {
    if (x1 < x0 - 0.5 || y1 < y0 - 0.5) return false;
    const nx = Math.max(1, Math.floor((x1 - x0) / (fx * c) + 1e-6) + 1);
    const ny = Math.max(1, Math.floor((y1 - y0) / (fy * c) + 1e-6) + 1);
    for (let iy = 0; iy < ny; iy++)
      for (let ix = 0; ix < nx; ix++) {
        const x = nx > 1 ? x0 + (ix * (x1 - x0)) / (nx - 1) : (x0 + x1) / 2;
        const y = ny > 1 ? y0 + (iy * (y1 - y0)) / (ny - 1) : (y0 + y1) / 2;
        if (clear(x, y)) out.push({ x, y });
      }
    return true;
  };
  const left = band(m, bx - avoid, m, H - m);
  const right = band(bx + bw + avoid, W - m, m, H - m);
  // rows above and below stop a column short of a side band (no piece on
  // a corner piece); with no band on a side they run to the room's edge
  const ax0 = left ? bx - avoid + fx * c : m;
  const ax1 = right ? bx + bw + avoid - fx * c : W - m;
  band(ax0, ax1, m, by - avoid);
  band(ax0, ax1, by + bh + avoid, H - m);
  return out;
}

/** The biggest board for which every piece still has a place of its own
 *  off it. Wide rooms put the board in the middle with the pieces all round
 *  (the cloud's own composition); tall ones put it on top, pieces below.
 *  `c` is the LARGER side of a cell in CSS px (margins and reach are counted
 *  in it); a cut picture's cells may be a little taller than wide, so the
 *  board is cols × cw by rows × ch. */
export function layout(W: number, H: number, set: PuzzleSet, no: Rect[] = []): Lay {
  const { cols, rows } = set;
  const N = set.pieces.length;
  const big = Math.max(set.cw, set.ch);
  /** CSS px per source px, for a board that is `fw` of the room wide and
   *  `fh` of it tall at most */
  const fit = (fw: number, fh: number) => Math.min(fw / (cols * set.cw), fh / (rows * set.ch));
  // Wide rooms: the board in the middle, its pieces in bands round it; tall
  // (phone) rooms: the board on top. Exactly enough places is enough now —
  // the ~30% spare a wide room used to ask for (2026-10-29: the old grid
  // jammed 16 of 18 pieces above and below the board) only shrank the
  // board, since the bands always fill the sides first.
  const tries: Array<["centre" | "side" | "top", number]> =
    W / H > 1.25 ? [["centre", N], ["side", N], ["top", N]] : [["top", N], ["centre", N], ["side", N]];
  // the board's share of the room in the middle: a portrait board up to 0.9
  // of its height (2026-10-31; 0.8 before, 0.6 at first), his 6×3 up to 0.8
  // — the places, not these shares, decide the size in most rooms
  const tall = rows > cols ? 0.9 : 0.8;
  // THE BOARD KEEPS OFF THE NO-GO BOXES TOO, not only the pieces' places
  // (review, change 5): in a room no wider than 5:4 the board went on top at
  // y 12 — the very corner the title sits in — and covered «THROUGH». A
  // board laid on top starts under every box over its columns, and no board
  // of any kind may cross one. With no boxes (the panel, the sheet) both
  // tests are idle and every layout is the one it always was.
  const hits = (x: number, y: number, w: number, h: number) => no.some((r) => x < r.r && x + w > r.l && y < r.b && y + h > r.t);
  const under = (x: number, w: number) => no.reduce((y, r) => (x < r.r && x + w > r.l ? Math.max(y, r.b) : y), 12);
  for (const [kind, need] of tries) {
    const s0 =
      kind === "centre" ? fit(W * 0.54, H * tall) : kind === "top" ? fit(W - 24, H * 0.44) : fit(W * 0.6, H - 24);
    // up to 200 px a cell on big screens (150 before); never past 1.75× the
    // picture's own pixels, so her three small files (Nos. 23/25/34, 299 px
    // wide) are not blown up softer than the old 150 cap already showed them
    const cap = Math.min(200, s0 * big, 1.75 * big);
    for (let c = Math.floor(cap); c >= 36; c -= 2) {
      const s = c / big;
      const bw = cols * set.cw * s;
      const bh = rows * set.ch * s;
      const bx = kind === "side" ? Math.max(12, W * 0.04) : (W - bw) / 2;
      const by = kind === "top" ? under(bx, bw) : (H - bh) / 2;
      if (by + bh > H || hits(bx, by, bw, bh)) continue;
      const slots = gen(W, H, c, bx, by, bw, bh, 1, no);
      if (slots.length >= need) return { W, H, c, s, cw: set.cw * s, ch: set.ch * s, bx, by, slots, kind };
    }
  }
  // a room too small for all of them apart: the board as big as it can be
  // in the middle, the pieces packed tighter (overlapping) around it — and
  // still under the no-go boxes, made smaller if it would not fit there
  let s = Math.max(20 / big, fit(W - 24, H * 0.5));
  let bw = cols * set.cw * s;
  let bx = (W - bw) / 2;
  const by = under(bx, bw);
  if (by > 12 && by + rows * set.ch * s > H - 12) {
    s = Math.max(20 / big, fit(W - 24, H - 12 - by));
    bw = cols * set.cw * s;
    bx = (W - bw) / 2;
  }
  const c = s * big;
  const bh = rows * set.ch * s;
  let slots = gen(W, H, c, bx, by, bw, bh, 0.9, no);
  if (!slots.length) slots = [{ x: W / 2, y: H - c }];
  while (slots.length < N) slots = slots.concat(slots.map((p) => ({ x: p.x + c * 0.3, y: p.y + c * 0.3 })));
  return { W, H, c, s, cw: set.cw * s, ch: set.ch * s, bx, by, slots, kind: "packed" };
}
