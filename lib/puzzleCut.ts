// ============================================================================
// PUZZLE CUT — every other picture in the cloud as a jigsaw, cut the way his
// eighteen pieces were cut (Vardan, 2026-10-29: «use same logic for other
// images can provide puzzle»).
//
// He cut one picture by hand (No. 05, lib/puzzles.json). The rest are cut
// here, in the browser, from the picture the cloud already shows — no files
// per piece. What is HIS in every generated piece:
//   · the KNOB: the half-width profile below was measured off all 27 tabs of
//     his pieces (scratchpad/puzzle-knob.cjs) — the flared base, the narrow
//     neck, the round head — and the tab's length, 0.2995 of a cell; his
//     knobs sit on the middle of their edge, and so do these;
//   · the RULES: a flat frame, and every joint a tab on one side and the
//     blank that takes it on the other (here exactly the same curve, so a
//     finished board has no gap in it).
// What is chosen per picture: the grid — near-square cells over the WHOLE
// picture (nothing of her painting is cropped), as close to his 18 pieces as
// a near-square cell allows (her 621×878 pictures: 4 × 5 = 20; 3 × 4 in a
// room too small for twenty fingertip-sized pieces, see Puzzle.tsx) — and which
// side of each joint gets the tab, from a seed made of the picture's number,
// so a picture is cut the same way every time it is opened.
// ============================================================================
import type { PuzzleSet } from "./puzzles";

/** his knob: half its width at 26 levels, from the body's edge (b = 0) to the
 *  top of the head (b = 1), in units of the tab's length */
export const KNOB_HW = [
  0.4721, 0.3491, 0.2903, 0.2785, 0.2822, 0.2935, 0.3102, 0.3313, 0.3541, 0.3748, 0.391, 0.4038, 0.4136, 0.42, 0.4227, 0.4216,
  0.4168, 0.408, 0.3953, 0.3788, 0.3571, 0.3285, 0.2918, 0.2439, 0.1691, 0,
];
/** his tab's length, as a fraction of the cell (27 tabs, 0.295–0.302) */
export const KNOB_T = 0.2995;

export type CutArt = { id: string; src: string; w: number; h: number };

/** how many pieces: about his 18 — or, in a room too small for twenty
 *  fingertip-sized ones (a 360×640 phone), about 12 */
export type CutSize = "his" | "few";
const SIZES: Record<CutSize, { n: number; lo: number; hi: number }> = {
  his: { n: 18, lo: 15, hi: 24 },
  few: { n: 12, lo: 9, hi: 15 },
};

/** near-square cells, close to the wanted count, the whole picture used */
export function gridFor(w: number, h: number, size: CutSize = "his") {
  const want = SIZES[size];
  let best = { cols: 4, rows: 5, cost: Infinity };
  for (let cols = 2; cols <= 8; cols++)
    for (let rows = 2; rows <= 8; rows++) {
      const n = cols * rows;
      if (n < want.lo || n > want.hi) continue;
      const cost = Math.abs(Math.log(h / rows / (w / cols))) + 0.03 * Math.abs(n - want.n);
      if (cost < best.cost) best = { cols, rows, cost };
    }
  return { cols: best.cols, rows: best.rows };
}

/** a small deterministic generator, seeded by the picture's number */
function seeded(id: string) {
  let s = 2166136261;
  for (let i = 0; i < id.length; i++) s = Math.imul(s ^ id.charCodeAt(i), 16777619);
  s >>>= 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** the puzzle of one picture: geometry in the picture's own pixels */
export function cutPuzzle(art: CutArt, size: CutSize = "his"): PuzzleSet {
  const { cols, rows } = gridFor(art.w, art.h, size);
  const cw = art.w / cols;
  const ch = art.h / rows;
  const T = KNOB_T * Math.min(cw, ch);
  const rnd = seeded(`arpenart-puzzle-${art.id}`);
  // +1: the piece on the left / above carries the tab
  const across = Array.from({ length: rows }, () => Array.from({ length: cols - 1 }, () => (rnd() < 0.5 ? 1 : -1)));
  const down = Array.from({ length: rows - 1 }, () => Array.from({ length: cols }, () => (rnd() < 0.5 ? 1 : -1)));
  const pieces = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const top = r === 0 ? 0 : -down[r - 1][c];
      const right = c === cols - 1 ? 0 : across[r][c];
      const bottom = r === rows - 1 ? 0 : down[r][c];
      const left = c === 0 ? 0 : -across[r][c - 1];
      const l = left === 1 ? T : 0;
      const t = top === 1 ? T : 0;
      pieces.push({
        n: r * cols + c + 1,
        r,
        c,
        x: c * cw - l,
        y: r * ch - t,
        w: cw + l + (right === 1 ? T : 0),
        h: ch + t + (bottom === 1 ? T : 0),
        src: "",
        edges: [top, right, bottom, left] as [number, number, number, number],
      });
    }
  return {
    kind: "cut",
    art: art.id,
    cols,
    rows,
    cell: Math.max(cw, ch),
    cw,
    ch,
    T,
    w: art.w,
    h: art.h,
    full: { src: art.src, w: art.w, h: art.h },
    v: "",
    pieces,
  };
}

/** One piece's outline, in its own box (source px): the body's four sides,
 *  clockwise, each flat or carrying his knob out (a tab) or in (a blank). */
export function piecePath(set: PuzzleSet, i: number): Path2D {
  const pc = set.pieces[i];
  const [top, right, bottom, left] = pc.edges ?? [0, 0, 0, 0];
  const T = set.T ?? KNOB_T * Math.min(set.cw, set.ch);
  const ox = pc.c * set.cw - pc.x;
  const oy = pc.r * set.ch - pc.y;
  const P = [
    [ox, oy],
    [ox + set.cw, oy],
    [ox + set.cw, oy + set.ch],
    [ox, oy + set.ch],
  ];
  const path = new Path2D();
  path.moveTo(P[0][0], P[0][1]);
  const L = KNOB_HW.length - 1;
  [top, right, bottom, left].forEach((type, k) => {
    const [x0, y0] = P[k];
    const [x1, y1] = P[(k + 1) % 4];
    if (type) {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const ex = (x1 - x0) / len;
      const ey = (y1 - y0) / len;
      // outward, for a clockwise walk on a y-down screen
      const nx = ey * type;
      const ny = -ex * type;
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      const at = (a: number, b: number) => path.lineTo(mx + a * T * ex + b * T * nx, my + a * T * ey + b * T * ny);
      for (let j = 0; j <= L; j++) at(-KNOB_HW[j], j / L);
      for (let j = L; j >= 0; j--) at(KNOB_HW[j], j / L);
    }
    path.lineTo(x1, y1);
  });
  path.closePath();
  return path;
}
