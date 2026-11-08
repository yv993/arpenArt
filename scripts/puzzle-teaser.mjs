// ---------------------------------------------------------------------------
// THE PUZZLE'S STILL → /public/puzzle/05/teaser-<hash>.webp + lib/puzzle-teaser.json
//
// Arpine's change 5.pdf p1 (2026-11-04) draws the cloud section as a jigsaw:
// No. 05 on a board with WHITE CUT LINES and two loose pieces lying to its
// left (her mock, pdf/embedded/p01-2.png + p01-3.png + p01-4.png — those two
// are his pieces 14 and 19). Where the section cannot be played in place —
// phones and reduced motion — that picture IS the section, with «Play the
// puzzle» under it. It is built here from the shipped set alone, never drawn:
//   · the board is public/puzzle/05/full.webp (his eighteen, assembled);
//   · the lines are the borders between his pieces, found from their own
//     alpha (each board pixel belongs to the piece that covers it; a line is
//     where that changes, and round the board's edge);
//   · the two loose pieces are his files 14 and 19, placed as in her mock
//     (the upper one nearer the board, the lower one further out), a little
//     closer than in the mock so the board stays large on a phone.
// The name carries the content's hash: /puzzle is cached for a day, so a new
// still must never reuse an old address. The previous still is deleted.
//
//   node scripts/puzzle-teaser.mjs
// ---------------------------------------------------------------------------
import { readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ART = "05";
const DIR = join(ROOT, "public", "puzzle", ART);
const SET = JSON.parse(await readFile(join(ROOT, "lib", "puzzles.json"), "utf8"))[ART];
const OUT_JSON = join(ROOT, "lib", "puzzle-teaser.json");

/** the still's width: a phone's 358 css px at 3×, a reduced-motion desktop's
 *  ~620 px at 2× — one file */
const WIDTH = 1100;
/** the two loose pieces (his numbers) and where their BOXES' top-left lie,
 *  in cells from the board's top-left (her mock, tightened) */
const LOOSE = [
  { n: 14, x: -1.42, y: 0.04 },
  { n: 19, x: -1.72, y: 1.92 },
];
const PAD = 0.1; // cells round the whole still (room for the shadows)

const { cols, rows, cell } = SET;
const left = -Math.min(...LOOSE.map((l) => l.x)) + PAD;
const spanW = left + cols + PAD;
const c = Math.floor(WIDTH / spanW); // px per cell in the still
const k = c / cell; // px per source px
const W = Math.round(spanW * c);
const bx = Math.round(left * c);
const loosePc = LOOSE.map((l) => ({ ...l, pc: SET.pieces.find((p) => p.n === l.n) }));
const bottom = Math.max(rows, ...loosePc.map((l) => l.y + l.pc.h / cell));
const by = Math.round(PAD * c);
const H = Math.round((bottom + 2 * PAD) * c);
const BW = Math.round(cols * c);
const BH = Math.round(rows * c);

// ---- the cut lines, found at 2× and drawn back down (smooth edges) --------
const S = 2;
const LW = BW * S;
const LH = BH * S;
const label = new Int8Array(LW * LH).fill(-1);
const best = new Uint8Array(LW * LH);
for (let i = 0; i < SET.pieces.length; i++) {
  const pc = SET.pieces[i];
  const w = Math.round(pc.w * k * S);
  const h = Math.round(pc.h * k * S);
  const x0 = Math.round(pc.x * k * S);
  const y0 = Math.round(pc.y * k * S);
  const a = await sharp(join(ROOT, "public", pc.src)).extractChannel("alpha").resize(w, h, { fit: "fill" }).raw().toBuffer();
  for (let y = 0; y < h; y++) {
    const Y = y0 + y;
    if (Y < 0 || Y >= LH) continue;
    for (let x = 0; x < w; x++) {
      const X = x0 + x;
      if (X < 0 || X >= LW) continue;
      const v = a[y * w + x];
      const j = Y * LW + X;
      if (v >= 128 && v > best[j]) {
        best[j] = v;
        label[j] = i;
      }
    }
  }
}
// the play in his cuts (a blank a little larger than its tab) leaves slivers
// no piece covers: they take a neighbour's label, so each border is ONE line
for (let pass = 0; pass < 6; pass++) {
  let left = 0;
  for (let y = 0; y < LH; y++)
    for (let x = 0; x < LW; x++) {
      const j = y * LW + x;
      if (label[j] >= 0) continue;
      const n = x > 0 && label[j - 1] >= 0 ? label[j - 1] : x < LW - 1 && label[j + 1] >= 0 ? label[j + 1] : y > 0 && label[j - LW] >= 0 ? label[j - LW] : y < LH - 1 && label[j + LW] >= 0 ? label[j + LW] : -1;
      if (n >= 0) label[j] = n;
      else left++;
    }
  if (!left) break;
}
const LINE = 2 * S; // a line 2 px wide in the still
const line = Buffer.alloc(LW * LH * 4);
const ink = (x, y) => {
  if (x < 0 || y < 0 || x >= LW || y >= LH) return;
  const o = (y * LW + x) * 4;
  line[o] = line[o + 1] = line[o + 2] = 255;
  line[o + 3] = 235;
};
for (let y = 0; y < LH; y++)
  for (let x = 0; x < LW; x++) {
    const j = y * LW + x;
    const edge = x < LINE / 2 || y < LINE / 2 || x >= LW - LINE / 2 || y >= LH - LINE / 2;
    const r = x < LW - 1 && label[j + 1] !== label[j];
    const d = y < LH - 1 && label[j + LW] !== label[j];
    if (edge) ink(x, y);
    if (r || d) for (let t = -LINE / 2 + 1; t <= LINE / 2; t++) (r ? ink(x + t, y) : null, d ? ink(x, y + t) : null);
  }
const lines = await sharp(line, { raw: { width: LW, height: LH, channels: 4 } }).resize(BW, BH, { kernel: "lanczos3" }).png().toBuffer();

// ---- the board, its shadow, the loose pieces and theirs -------------------
const board = await sharp(join(DIR, "full.webp")).resize(BW, BH, { fit: "fill" }).toBuffer();
const shadowOf = async (buf, w, h, blur, alpha) => {
  const a = await sharp(buf).resize(w, h, { fit: "fill" }).ensureAlpha().extractChannel("alpha").raw().toBuffer();
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) rgba[i * 4 + 3] = Math.round(a[i] * alpha);
  const pad = Math.ceil(blur * 3);
  return {
    pad,
    img: await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .blur(blur)
      .png()
      .toBuffer(),
  };
};
const layers = [];
const boardShadow = await shadowOf(board, BW, BH, c * 0.12, 0.55);
layers.push({ input: boardShadow.img, left: bx - boardShadow.pad, top: by - boardShadow.pad + Math.round(c * 0.08) });
layers.push({ input: board, left: bx, top: by });
layers.push({ input: lines, left: bx, top: by });
for (const l of loosePc) {
  const w = Math.round(l.pc.w * k);
  const h = Math.round(l.pc.h * k);
  const file = await readFile(join(ROOT, "public", l.pc.src));
  const piece = await sharp(file).resize(w, h, { fit: "fill" }).png().toBuffer();
  const sh = await shadowOf(file, w, h, c * 0.05, 0.6);
  const x = Math.round(bx + l.x * c);
  const y = Math.round(by + l.y * c);
  layers.push({ input: sh.img, left: x - sh.pad, top: y - sh.pad + Math.round(c * 0.04) });
  layers.push({ input: piece, left: x, top: y });
}
// laid out on a larger sheet (a shadow may reach past the still's edge),
// then the still is cut out of it
const M = Math.ceil(c * 0.6);
const sheet = await sharp({ create: { width: W + 2 * M, height: H + 2 * M, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(layers.map((l) => ({ ...l, left: l.left + M, top: l.top + M })))
  .png()
  .toBuffer();
const out = await sharp(sheet).extract({ left: M, top: M, width: W, height: H }).webp({ quality: 86, alphaQuality: 85, effort: 6 }).toBuffer();

const hash = createHash("sha1").update(out).digest("hex").slice(0, 8);
const name = `teaser-${hash}.webp`;
for (const f of await readdir(DIR)) if (/^teaser-[0-9a-f]+\.webp$/.test(f) && f !== name) await unlink(join(DIR, f));
await writeFile(join(DIR, name), out);
const manifest = {
  art: ART,
  src: `/puzzle/${ART}/${name}`,
  w: W,
  h: H,
  /** the board's box inside the still, as fractions (for a caller that
   *  wants to line something up with it) */
  board: { x: +(bx / W).toFixed(4), y: +(by / H).toFixed(4), w: +(BW / W).toFixed(4), h: +(BH / H).toFixed(4) },
};
await writeFile(OUT_JSON, JSON.stringify(manifest, null, 1) + "\n");
console.log(`${manifest.src}  ${W}×${H}  ${(out.length / 1024).toFixed(1)} KB  (cell ${c}px, board ${BW}×${BH} at ${bx},${by})`);
