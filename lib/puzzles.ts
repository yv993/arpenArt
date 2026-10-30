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
// Keyed by the artwork id the cloud already uses, so another picture becomes
// playable by adding its pieces and one entry here — nothing in Cloud.tsx
// names No. 05.
// ============================================================================
import data from "./puzzles.json";

export type PuzzlePiece = {
  /** his number for the piece (the file he sent) */
  n: number;
  r: number;
  c: number;
  x: number;
  y: number;
  w: number;
  h: number;
  src: string;
};

export type PuzzleSet = {
  art: string;
  cols: number;
  rows: number;
  cell: number;
  w: number;
  h: number;
  /** the eighteen as one picture — the board's guide, and what it settles
   *  into when the last piece goes in */
  full: { src: string; w: number; h: number };
  v: string;
  pieces: PuzzlePiece[];
};

export const puzzles: Record<string, PuzzleSet> = data;
