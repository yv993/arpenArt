// ============================================================================
// PUZZLES — a picture in the cloud that can be played as a jigsaw.
//
// The data is lib/puzzles.json, written by scratchpad/assets-1029-puzzle.cjs
// from the pieces Vardan sent (2026-10-29) — never typed. Geometry is in the
// pieces' SOURCE pixels: a cell is `cell` (305) wide, a piece's (x, y) is its
// image's top-left on the assembled board, and the board is cols × rows cells.
// The component scales it all by one factor. `v` versions every file's
// address (see the cache rule in next.config.mjs).
//
// Keyed by the artwork id the cloud already uses. EVERY OTHER PICTURE plays
// too (2026-10-29, «use same logic for other images»): lib/puzzleCut.ts cuts
// it in the browser with his knob. A picture given pieces of its own here
// (his files + one entry) plays with those instead — nothing in Cloud.tsx
// names No. 05.
// ============================================================================
import data from "./puzzles.json";

export type PuzzlePiece = {
  /** his number for the piece (the file he sent); 1… in reading order for a
   *  cut picture */
  n: number;
  r: number;
  c: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** his piece's file; empty for a cut picture (drawn from `full`) */
  src: string;
  /** a cut picture's sides, top · right · bottom · left: +1 tab, −1 blank,
   *  0 flat (lib/puzzleCut.ts) */
  edges?: [number, number, number, number];
};

export type PuzzleSet = {
  /** "pieces": his files (No. 05); "cut": cut in the browser from the
   *  picture itself, with his knob (lib/puzzleCut.ts) */
  kind: "pieces" | "cut";
  art: string;
  cols: number;
  rows: number;
  /** the larger side of a cell */
  cell: number;
  /** a cell's width and height (equal for his pieces; near-square for a cut
   *  picture, which uses the WHOLE picture, so they may differ a little) */
  cw: number;
  ch: number;
  /** a cut picture's tab length */
  T?: number;
  w: number;
  h: number;
  /** the whole picture — the board's guide, and what it settles into when
   *  the last piece goes in */
  full: { src: string; w: number; h: number };
  /** the version asked for (`?v=`) — empty for a cut picture, whose file is
   *  the cloud's own and must hit the same cache */
  v: string;
  pieces: PuzzlePiece[];
};

/** the pictures with pieces of their own — No. 05, the eighteen he sent */
export const puzzles: Record<string, PuzzleSet> = Object.fromEntries(
  Object.entries(data).map(([id, s]) => [id, { ...s, kind: "pieces" as const, cw: s.cell, ch: s.cell }]),
);
