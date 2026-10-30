// THE PUZZLE OF No. 05 (Vardan, 2026-10-29: «when image opened it can provide
// puzzle, use provided images … user can drag and construct puzzle»). He sent
// eighteen pieces (imgss/puzzle-2026-10-29/pieces/2.png … 19.png, transparent
// PNGs cut from her balloon-over-Ararat picture). Nothing here is drawn or
// invented: the pieces are his files, and where each one goes was read off
// them, not guessed:
//
//  · THE GRID, from the pieces' own sides (scratchpad/puzzle-edges.cjs): a
//    body is 305px, a tab adds 92px. The flat sides name the frame — 19 / 6 /
//    13 / 18 are the four corners, 2–5 the top, 14–17 the bottom, 12 and 7 the
//    ends of the middle row — so it is 6 × 3, and every one of the 17 + 15
//    joints is a tab meeting a blank (checked below, the script stops if not).
//  · THE PICTURE, from her painting (scratchpad/puzzle-match.cjs): the middle
//    four columns are art-05 at 2.08× (masked rmse 5–12 per piece), its
//    band y 214–658 and nearly its full width; the two outer columns go past
//    her painting's edges (sky and hills that art-05.webp does not have),
//    which is why those six matched nothing. So the assembled puzzle is the
//    picture HE sent, and the board shows exactly that.
//
// Each piece's place is then fitted to the pixel: the pieces' bounding boxes
// were rounded when they were cut (304–306, 396–397, 488–489), so each one
// is nudged ±3px until the alphas of the 18 tile the board with the least
// gap and overlap. The finished picture is the 18 composited with their
// alphas NORMALISED (colour sum / alpha sum), so the anti-aliased cut lines
// leave no hairline — it is what the board fades to when the last piece
// goes in.
//
// Writes public/puzzle/05/{p-NN.webp, full.webp} and lib/puzzles.json
// (geometry in SOURCE px — 305 per cell — and `v`, the first 10 hex of a
// sha1 over every file written: the component asks for `?v=` so a replaced
// piece can never meet yesterday's layout in a browser cache).
//   node scratchpad/assets-1029-puzzle.cjs     (from C:/Users/ysaha/Desktop/arPage)
const sharp = require("sharp");
const fs = require("fs");
const crypto = require("crypto");

const SRC = "imgss/puzzle-2026-10-29/pieces";
const OUT = "public/puzzle/05";
const JSON_OUT = "lib/puzzles.json";
const CELL = 305;
const TAB = 92;
const COLS = 6;
const ROWS = 3;
/** the pieces as he numbered them, laid out row by row */
const GRID = [
  [19, 2, 3, 4, 5, 6],
  [12, 11, 10, 9, 8, 7],
  [13, 14, 15, 16, 17, 18],
];
/** served at 0.8 of his files: a cell is at most ~140 CSS px on a desktop
 *  board, ~280 device px at 2× — his 305 is more than any screen shows */
const SERVE = 0.8;
const PAD = 120;
const BW = COLS * CELL;
const BH = ROWS * CELL;
const CW = BW + PAD * 2;
const CH = BH + PAD * 2;

async function load(n) {
  const { data, info } = await sharp(`${SRC}/${n}.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { n, data, w: info.width, h: info.height };
}

/** tab (+1) / blank (-1) / flat (0) and the body offset — the same reading
 *  as puzzle-edges.cjs */
function sides(p) {
  const A = (x, y) => p.data[(y * p.w + x) * 4 + 3];
  const col = (x, y0, y1) => { let k = 0; for (let y = y0; y < y1; y++) if (A(x, y) > 128) k++; return k / (y1 - y0); };
  const row = (y, x0, x1) => { let k = 0; for (let x = x0; x < x1; x++) if (A(x, y) > 128) k++; return k / (x1 - x0); };
  const ex = p.w - CELL;
  const ey = p.h - CELL;
  let L = 0, R = 0, T = 0, B = 0;
  if (ex > 150) { L = TAB; R = TAB; } else if (ex > 50) { if (col(10, 0, p.h) < col(p.w - 10, 0, p.h)) L = TAB; else R = TAB; }
  if (ey > 150) { T = TAB; B = TAB; } else if (ey > 50) { if (row(10, 0, p.w) < row(p.h - 10, 0, p.w)) T = TAB; else B = TAB; }
  const x0 = L, x1 = p.w - R - 1, y0 = T, y1 = p.h - B - 1;
  const s = (tab, f) => (tab ? 1 : f < 0.9 ? -1 : 0);
  return {
    bx: L,
    by: T,
    top: s(T > 0, row(y0 + 4, x0, x1)),
    right: s(R > 0, col(x1 - 4, y0, y1)),
    bottom: s(B > 0, row(y1 - 4, x0, x1)),
    left: s(L > 0, col(x0 + 4, y0, y1)),
  };
}

(async () => {
  const pieces = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const p = await load(GRID[r][c]);
      Object.assign(p, sides(p), { r, c });
      pieces.push(p);
    }
  const at = (r, c) => pieces.find((p) => p.r === r && p.c === c);

  // ---- 1. the grid must be a real jigsaw: frame flat, every joint a pair --
  const bad = [];
  for (const p of pieces) {
    if ((p.r === 0) !== (p.top === 0)) bad.push(`${p.n} top`);
    if ((p.r === ROWS - 1) !== (p.bottom === 0)) bad.push(`${p.n} bottom`);
    if ((p.c === 0) !== (p.left === 0)) bad.push(`${p.n} left`);
    if ((p.c === COLS - 1) !== (p.right === 0)) bad.push(`${p.n} right`);
    if (p.c < COLS - 1 && p.right + at(p.r, p.c + 1).left !== 0) bad.push(`${p.n}|${at(p.r, p.c + 1).n}`);
    if (p.r < ROWS - 1 && p.bottom + at(p.r + 1, p.c).top !== 0) bad.push(`${p.n}/${at(p.r + 1, p.c).n}`);
  }
  if (bad.length) throw new Error("the pieces do not make this grid: " + bad.join(", "));
  console.log("grid 6×3: frame flat, 15 + 12 joints all tab-to-blank");

  // ---- 2. fit each piece to the pixel ------------------------------------
  // S = summed alpha over a padded canvas. Inside the board it should be 255
  // everywhere; outside, 0.
  const S = new Float32Array(CW * CH);
  for (const p of pieces) {
    p.x = p.c * CELL - p.bx;
    p.y = p.r * CELL - p.by;
  }
  const stamp = (p, sign, dx = 0, dy = 0) => {
    for (let y = 0; y < p.h; y++) {
      const cy = PAD + p.y + dy + y;
      for (let x = 0; x < p.w; x++) {
        const a = p.data[(y * p.w + x) * 4 + 3];
        if (a) S[cy * CW + PAD + p.x + dx + x] += sign * a;
      }
    }
  };
  const inBoard = (cx, cy) => cx >= PAD && cx < PAD + BW && cy >= PAD && cy < PAD + BH;
  /** the cost over p's neighbourhood with p laid at (p.x+dx, p.y+dy) */
  const cost = (p, dx, dy) => {
    let e = 0;
    const x0 = PAD + p.x - 4, y0 = PAD + p.y - 4;
    for (let y = 0; y < p.h + 8; y++) {
      const cy = y0 + y;
      for (let x = 0; x < p.w + 8; x++) {
        const cx = x0 + x;
        const lx = cx - (PAD + p.x + dx);
        const ly = cy - (PAD + p.y + dy);
        const a = lx >= 0 && ly >= 0 && lx < p.w && ly < p.h ? p.data[(ly * p.w + lx) * 4 + 3] : 0;
        const s = S[cy * CW + cx] + a;
        e += inBoard(cx, cy) ? Math.abs(s - 255) : s;
      }
    }
    return e;
  };
  pieces.forEach((p) => stamp(p, 1));
  const total = () => { let e = 0; for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) { const s = S[cy * CW + cx]; e += inBoard(cx, cy) ? Math.abs(s - 255) : s; } return e; };
  console.log("tiling error before fit:", Math.round(total() / 255), "px-equivalents");
  for (let sweep = 0; sweep < 4; sweep++) {
    let moved = 0;
    for (const p of pieces) {
      stamp(p, -1);
      let best = { e: cost(p, 0, 0), dx: 0, dy: 0 };
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          if (!dx && !dy) continue;
          const e = cost(p, dx, dy);
          if (e < best.e - 1e-6) best = { e, dx, dy };
        }
      if (best.dx || best.dy) moved++;
      p.x += best.dx;
      p.y += best.dy;
      stamp(p, 1);
    }
    console.log(`sweep ${sweep + 1}: ${moved} moved, error ${Math.round(total() / 255)}`);
    if (!moved) break;
  }
  let gaps = 0, over = 0;
  for (let cy = PAD; cy < PAD + BH; cy++) for (let cx = PAD; cx < PAD + BW; cx++) { const s = S[cy * CW + cx]; if (s < 128) gaps++; if (s > 383) over++; }
  console.log(`board pixels under half cover: ${gaps}, doubled over half: ${over} (of ${BW * BH})`);

  // ---- 3. the finished picture: colours normalised by the alpha sum ------
  const acc = new Float32Array(BW * BH * 4);
  for (const p of pieces)
    for (let y = 0; y < p.h; y++) {
      const by = p.y + y;
      if (by < 0 || by >= BH) continue;
      for (let x = 0; x < p.w; x++) {
        const bx = p.x + x;
        if (bx < 0 || bx >= BW) continue;
        const i = (y * p.w + x) * 4;
        const a = p.data[i + 3];
        if (!a) continue;
        const o = (by * BW + bx) * 4;
        acc[o] += p.data[i] * a;
        acc[o + 1] += p.data[i + 1] * a;
        acc[o + 2] += p.data[i + 2] * a;
        acc[o + 3] += a;
      }
    }
  const full = Buffer.alloc(BW * BH * 3);
  // THE PLAY IN THE CUT: every blank is cut a little larger than the tab
  // that fills it (a crescent up to ~8px at his 305px cell — measured on a
  // magenta ground, scratchpad/puzzle-assembled.png), so the eighteen leave
  // ~1% of the board bare. Those pixels are filled from their covered
  // neighbours, ring by ring inwards (the mean of the 8-neighbourhood
  // already known), which continues the paint across each crescent rather
  // than smearing one column sideways. Pixels with any cover keep their own
  // colour (colour sum / alpha sum).
  const known = new Uint8Array(BW * BH);
  let holes = 0;
  for (let k = 0; k < BW * BH; k++) {
    const a = acc[k * 4 + 3];
    if (a < 64) { holes++; continue; }
    known[k] = 1;
    full[k * 3] = Math.round(acc[k * 4] / a);
    full[k * 3 + 1] = Math.round(acc[k * 4 + 1] / a);
    full[k * 3 + 2] = Math.round(acc[k * 4 + 2] / a);
  }
  let left = holes, ring = 0;
  while (left && ring < 64) {
    ring++;
    const next = [];
    for (let y = 0; y < BH; y++)
      for (let x = 0; x < BW; x++) {
        const k = y * BW + x;
        if (known[k]) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= BW || yy >= BH) continue;
            const j = yy * BW + xx;
            if (!known[j]) continue;
            r += full[j * 3]; g += full[j * 3 + 1]; b += full[j * 3 + 2]; n++;
          }
        if (n) next.push([k, r / n, g / n, b / n]);
      }
    for (const [k, r, g, b] of next) { full[k * 3] = Math.round(r); full[k * 3 + 1] = Math.round(g); full[k * 3 + 2] = Math.round(b); known[k] = 1; }
    left -= next.length;
  }
  console.log("finished picture:", BW + "×" + BH, `bare pixels filled: ${holes} in ${ring} rings, left: ${left}`);

  // ---- 4. write -----------------------------------------------------------
  fs.mkdirSync(OUT, { recursive: true });
  const hash = crypto.createHash("sha1");
  const fw = Math.round(BW * SERVE);
  const fh = Math.round(BH * SERVE);
  const fullBuf = await sharp(full, { raw: { width: BW, height: BH, channels: 3 } })
    .resize(fw, fh, { kernel: "lanczos3" })
    .webp({ quality: 84 })
    .toBuffer();
  fs.writeFileSync(`${OUT}/full.webp`, fullBuf);
  hash.update(fullBuf);
  const out = [];
  for (const p of pieces) {
    const name = `p-${String(p.n).padStart(2, "0")}.webp`;
    const buf = await sharp(p.data, { raw: { width: p.w, height: p.h, channels: 4 } })
      .resize(Math.round(p.w * SERVE), Math.round(p.h * SERVE), { kernel: "lanczos3" })
      .webp({ quality: 84, alphaQuality: 100 })
      .toBuffer();
    fs.writeFileSync(`${OUT}/${name}`, buf);
    hash.update(buf);
    // x, y: the piece's top-left on the board, SOURCE px (cell = 305)
    out.push({ n: p.n, r: p.r, c: p.c, x: p.x, y: p.y, w: p.w, h: p.h, src: `/puzzle/05/${name}`, kb: +(buf.length / 1024).toFixed(1) });
  }
  const v = hash.digest("hex").slice(0, 10);
  const json = {
    "05": {
      art: "05",
      cols: COLS,
      rows: ROWS,
      cell: CELL,
      w: BW,
      h: BH,
      full: { src: "/puzzle/05/full.webp", w: fw, h: fh },
      v,
      pieces: out.map(({ kb, ...p }) => p),
    },
  };
  fs.writeFileSync(JSON_OUT, JSON.stringify(json, null, 1) + "\n");
  const kb = out.reduce((s, p) => s + p.kb, 0);
  console.log(`wrote ${out.length} pieces (${kb.toFixed(0)} KB) + full.webp (${(fullBuf.length / 1024).toFixed(0)} KB), v=${v}`);
  console.log(out.map((p) => `${p.n}@r${p.r}c${p.c} (${p.x},${p.y}) ${p.kb}KB`).join("\n"));
})();
