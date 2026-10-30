// HIS KNOB, AS A SHAPE (2026-10-29, «use same logic for other images»). Every
// tab on the eighteen pieces Vardan sent is measured from its alpha: at each
// distance d out from the body's edge, the width of the tab. The profiles are
// normalised (by the tab's length T and centred on the knob), averaged over
// all his tabs, made symmetric and smoothed, and printed as the polyline that
// lib/puzzleCut.ts draws for every other picture's puzzle — so a generated
// piece has the knob of the pieces he cut, not a stock jigsaw curve.
//   node scratchpad/puzzle-knob.cjs          (from C:/Users/ysaha/Desktop/arPage)
const sharp = require("sharp");
const fs = require("fs");

const SRC = "imgss/puzzle-2026-10-29/pieces";
const CELL = 305;
const LEVELS = 26; // b = 0 … 1 in 25 steps

(async () => {
  const profiles = [];
  const ratios = [];
  for (const f of fs.readdirSync(SRC).filter((n) => n.endsWith(".png"))) {
    const { data, info } = await sharp(`${SRC}/${f}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width;
    const H = info.height;
    const A = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : data[(y * W + x) * 4 + 3]);
    // where the body is: a tab adds ~92px on its side (same reading as puzzle-edges.cjs)
    const colFrac = (x) => { let k = 0; for (let y = 0; y < H; y++) if (A(x, y) > 128) k++; return k / H; };
    const rowFrac = (y) => { let k = 0; for (let x = 0; x < W; x++) if (A(x, y) > 128) k++; return k / W; };
    const ex = W - CELL, ey = H - CELL;
    let L = 0, R = 0, T = 0, B = 0;
    if (ex > 150) { L = R = 1; } else if (ex > 50) { if (colFrac(10) < colFrac(W - 10)) L = 1; else R = 1; }
    if (ey > 150) { T = B = 1; } else if (ey > 50) { if (rowFrac(10) < rowFrac(H - 10)) T = 1; else B = 1; }
    const bx0 = L ? W - CELL - (R ? ex - 92 : 0) - (R ? 92 : 0) : 0;
    const body = { x0: L ? (R ? Math.round(ex / 2) : ex) : 0, y0: T ? (B ? Math.round(ey / 2) : ey) : 0 };
    body.x1 = body.x0 + CELL - 1;
    body.y1 = body.y0 + CELL - 1;
    void bx0;
    // one tab: walk outwards from the body edge; `along(d, s)` reads the pixel
    // at distance d out and s along the edge (s from the edge's start)
    const tabs = [];
    if (R) tabs.push({ len: CELL, out: W - 1 - body.x1, at: (d, s) => A(body.x1 + 1 + d, body.y0 + s) });
    if (L) tabs.push({ len: CELL, out: body.x0, at: (d, s) => A(body.x0 - 1 - d, body.y0 + s) });
    if (B) tabs.push({ len: CELL, out: H - 1 - body.y1, at: (d, s) => A(body.x0 + s, body.y1 + 1 + d) });
    if (T) tabs.push({ len: CELL, out: body.y0, at: (d, s) => A(body.x0 + s, body.y0 - 1 - d) });
    for (const tab of tabs) {
      // the run of paint at each distance, nearest the edge's middle
      const rows = [];
      for (let d = 0; d < tab.out; d++) {
        let best = null;
        let s = 0;
        while (s < tab.len) {
          while (s < tab.len && tab.at(d, s) < 128) s++;
          const a = s;
          while (s < tab.len && tab.at(d, s) >= 128) s++;
          if (s > a) {
            const mid = (a + s) / 2;
            if (!best || Math.abs(mid - tab.len / 2) < Math.abs(best.mid - tab.len / 2)) best = { a, b: s, mid };
          }
        }
        if (!best) break;
        rows.push(best);
      }
      if (rows.length < 40) continue;
      const Tlen = rows.length;
      const centre = rows.reduce((m, r) => m + r.mid, 0) / rows.length;
      ratios.push(Tlen / CELL);
      // half-width at fixed levels b in [0, 1], by interpolation
      const hw = [];
      for (let k = 0; k < LEVELS; k++) {
        const d = (k / (LEVELS - 1)) * (Tlen - 1);
        const i = Math.floor(d);
        const t = d - i;
        const r0 = rows[i];
        const r1 = rows[Math.min(rows.length - 1, i + 1)];
        const w = ((r0.b - r0.a) * (1 - t) + (r1.b - r1.a) * t) / 2;
        hw.push(w / Tlen);
      }
      profiles.push({ f, hw, off: (centre - tab.len / 2) / Tlen });
    }
  }
  const n = profiles.length;
  const mean = Array.from({ length: LEVELS }, (_, k) => profiles.reduce((m, p) => m + p.hw[k], 0) / n);
  // a light smoothing that keeps the ends
  const smooth = mean.map((v, k) => (k === 0 || k === LEVELS - 1 ? v : (mean[k - 1] + 2 * v + mean[k + 1]) / 4));
  smooth[LEVELS - 1] = 0; // the head closes
  const T = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const offs = profiles.map((p) => p.off);
  console.log(`tabs measured: ${n}; tab length T = ${T.toFixed(4)} of a cell (min ${Math.min(...ratios).toFixed(3)}, max ${Math.max(...ratios).toFixed(3)})`);
  console.log(`knob centre offset along the edge, in T: mean ${(offs.reduce((a, b) => a + b, 0) / n).toFixed(3)}, spread ${Math.min(...offs).toFixed(3)}…${Math.max(...offs).toFixed(3)}`);
  console.log("half-width hw(b) in units of T, b = 0 … 1:");
  console.log(JSON.stringify(smooth.map((v) => +v.toFixed(4))));
})();
