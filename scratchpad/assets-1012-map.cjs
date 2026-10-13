// «change 4.pdf» p12 (2026-10-12): «փոխում ենք քարտեզը, դնում ենք սա» — the
// country map's picture is replaced by HER PAINTED MAP (drive/map/IMG_7667.png,
// 1223×1286 RGBA: each province its own landscape, Sevan light blue,
// transparent outside the border). The relief model keeps its real SRTM
// heights, its drag, its pins and its UV maths; only the two rasters that
// describe the SURFACE change.
//
// THE FIT IS SOLVED, NOT EYEBALLED. The three rasters in public/map share one
// grid — equirectangular over lib/armenia.json's bbox, rows linear in latitude
// (lib/terrain-meta.json) — and the pins are placed in that grid from true
// lat/lng. So her painting must be laid into THAT grid: her outline (alpha >
// 128) is fitted to the ORIGINAL mask's main body (holes filled, exclave
// dropped — she painted neither) with a 6-parameter affine found by coordinate
// descent on the XOR area, then the painting is resampled through the same
// transform — then CONSTRAINED to stay inside the grid (see KEEP HER INSIDE
// THE GRID below; the free fit overran the west and north edges). The numbers
// are printed and saved beside the captures; nothing in them is typed from
// memory. Measured on 2026-10-12 (this script's own run): free fit scale
// 1.234/1.245 her px per mask px, rotation −0.70°, shear −0.045, IoU 0.926,
// boundary error median 6.0 mask px (1.6 km), max 32.8 px (8.7 km, at the
// Syunik tip — her tail is shorter than the real one). SHIPPED (shrunk
// ×0.9882 about Yerevan's latitude, shifted 9.0 / 5.6 texels): IoU 0.918,
// median 7.0 px (1.85 km), p95 20.2 px, max 35.4 px (9.4 km, same tip).
// Yerevan, Dilijan, Garni and Gyumri land inside the province she painted
// them in, with the same room as under the free fit (printed per town).
//
// TWO FILES OUT (the old ones are kept under imgss/redesign-2026-10-12/verify/places/old/):
//   public/map/relief.webp   2048×2064 webp — her painting in the grid. Texels
//                            outside her alpha take the colour of the nearest
//                            painted texel (jump-flood), so the model's cut
//                            side and the mask's soft edge never sample black.
//   public/map/mask.png      1024×1032 — HER outline in the grid, R=G=B (the
//                            component reads R, three.js alphaMap reads G).
//                            DECISION: the cut follows her painting. Cut by the
//                            real border instead, up to 33 texels of her paint
//                            would be shaved on the east and the same width of
//                            smeared filler shown on the west and the tail;
//                            the mesh, the alpha cut and the picture all come
//                            from this one outline now, so they agree exactly.
//                            The vector shadow in ArmeniaMap.tsx is replaced by
//                            a plane under this same mask for the same reason.
//   height.png is untouched: it carries real elevation beyond the border too
//   (checked: outside-mask mean 63/255, only 8% zero texels, none near the
//   edge), so where her paint reaches past the real line it still stands on
//   real ground.
//
// The old relief's quality was estimated by re-encoding it: q75 reproduced
// 0.98× its size, q80 1.06×, so the painting goes out at q80.
//
// Run from the project root:  node scratchpad/assets-1012-map.cjs
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const HER = "imgss/redesign-2026-10-12/drive/map/IMG_7667.png";
const OLD_DIR = "imgss/redesign-2026-10-12/verify/places/old";
const REPORT = "imgss/redesign-2026-10-12/verify/places/bake.json";
const OUT_RELIEF = "public/map/relief.webp";
const OUT_MASK = "public/map/mask.png";
const QUALITY = 80;

// Always fit against the ORIGINAL mask (the real border), never against a
// mask this script wrote on an earlier run — the backups are the source.
for (const f of ["relief.webp", "mask.png", "height.png"]) {
  const dst = path.join(OLD_DIR, f);
  if (!fs.existsSync(dst)) {
    fs.mkdirSync(OLD_DIR, { recursive: true });
    fs.copyFileSync(path.join("public/map", f), dst);
    console.log(`kept the old ${f} under ${OLD_DIR}`);
  }
}

async function raw(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { d: data, w: info.width, h: info.height };
}

(async () => {
  const her = await raw(HER);
  const mask = await raw(path.join(OLD_DIR, "mask.png"));
  const oldRelief = await sharp(path.join(OLD_DIR, "relief.webp")).metadata();
  const W = mask.w, H = mask.h; // 1024 × 1032
  const TW = oldRelief.width, TH = oldRelief.height; // 2048 × 2064
  console.log(`her ${her.w}×${her.h}  mask ${W}×${H}  relief ${TW}×${TH}`);

  // ---- the real border's main body: holes filled, exclave dropped ----------
  const inMask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) inMask[i] = mask.d[i * 4] > 128 ? 1 : 0;
  const bg = new Uint8Array(W * H);
  const st = [];
  const push = (i) => { if (!inMask[i] && !bg[i]) { bg[i] = 1; st.push(i); } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (st.length) { const i = st.pop(); const x = i % W, y = (i / W) | 0; if (x > 0) push(i - 1); if (x < W - 1) push(i + 1); if (y > 0) push(i - W); if (y < H - 1) push(i + W); }
  const body = new Uint8Array(W * H);
  // keep only the component under the country's centre (drops the exclave)
  { const seed = ((H / 2) | 0) * W + ((W / 2) | 0); const s2 = [seed]; body[seed] = 1;
    while (s2.length) { const i = s2.pop(); const x = i % W, y = (i / W) | 0; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && !bg[j] && !body[j]) { body[j] = 1; s2.push(j); } } }

  // ---- her outline and the initial guess from the two bounding boxes -------
  const herA = (x, y) => x >= 0 && y >= 0 && x < her.w && y < her.h && her.d[(y * her.w + x) * 4 + 3] > 128;
  const bbox = (test, w, h) => { let x0 = w, y0 = h, x1 = -1, y1 = -1; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (test(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 }; };
  const hb = bbox(herA, her.w, her.h);
  const mb = bbox((x, y) => body[y * W + x], W, H);
  console.log("her bbox", hb, "\nbody bbox", mb);

  // ---- 6-parameter affine, mask px → her px: [ax, ay] = [a b c; d e f]·[x y 1]
  const map = (p) => (x, y) => [p[0] * x + p[1] * y + p[2], p[3] * x + p[4] * y + p[5]];
  const cost = (f, stride) => { let c = 0; for (let y = 0; y < H; y += stride) for (let x = 0; x < W; x += stride) { const [ax, ay] = f(x + 0.5, y + 0.5); if ((herA(Math.round(ax), Math.round(ay)) ? 1 : 0) !== body[y * W + x]) c++; } return c; };
  let p = [hb.w / mb.w, 0, hb.x0 - mb.x0 * (hb.w / mb.w), 0, hb.h / mb.h, hb.y0 - mb.y0 * (hb.h / mb.h)];
  let steps = [0.02, 0.02, 8, 0.02, 0.02, 8];
  let best = cost(map(p), 2);
  for (let round = 0; round < 9; round++) {
    let improved = true;
    while (improved) { improved = false; for (let k = 0; k < 6; k++) for (const dir of [1, -1]) { const q = p.slice(); q[k] += dir * steps[k]; const c = cost(map(q), 2); if (c < best) { best = c; p = q; improved = true; } } }
    steps = steps.map((s) => s / 2);
  }
  // ---- KEEP HER INSIDE THE GRID (review fix, 2026-10-12) -------------------
  // The grid is the real country's bbox with no padding at all (the old mask
  // touched its west edge on 9 rows and its south edge on 5 columns), and her
  // outline runs a few texels past the real line in the north-west. The free
  // fit above therefore put her opaque paint at x −6.6 / y −3.1 mask px: the
  // grid's bounds sliced the Shirak lobe and two stretches of Lori's north
  // edge flat (165 + 50 of her px, ≈ 1.7 km of the lobe) and the mesh had an
  // open, curtain-less edge along those rows and columns. So the fit is
  // CONSTRAINED: a uniform shrink plus a shift, m' = s·m + T, that keeps her
  // opaque edge MARGIN texels inside on every side.
  //
  // NOT ABOUT THE PAINTING'S CENTRE. With the west and north edges pinned at
  // the margin, the paint's displacement at any point is fixed by s alone
  // (MARGIN − edge − (1−s)·lever), and the smallest shrink that fits the
  // height (0.9946) moved her paint 3 texels south under YEREVAN — whose true
  // coordinate sits only ~8 of her px inside the yellow Yerevan patch, under
  // its line with Kotayk — and put the pin ON that white line (first run of
  // this fix, verify/places/fix/pin-her-yerevan.png). So the correction is
  // ANCHORED on the pin with the least room: s is the largest shrink at
  // which that pin is not pushed toward its nearest line at all (the lever
  // to the top edge is 475 texels, so 1.2 % pays the north's 5.6 texels),
  // and T is then chosen as close as the edges allow to leaving that pin
  // where the free fit verified it — the remainder of the west clearance
  // becomes a shift that runs ALONG Yerevan's line (25 texels of yellow to
  // the west), not across it. Which pin anchors is computed, not typed.
  // Both fits are measured against the real border below, so the price of
  // the constraint is on record; the pins themselves never move (true lat/lng).
  const MARGIN = 2.5; // texel centres: her one-texel anti-aliased ramp then ends a texel inside, and the mask's column 0 / row 0 stay 0
  const extentOf = (q) => {
    const det = q[0] * q[4] - q[1] * q[3];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let y = 0; y < her.h; y++) for (let x = 0; x < her.w; x++) {
      if (!herA(x, y)) continue;
      const hx = x + 0.5 - q[2], hy = y + 0.5 - q[5];
      const mx = (q[4] * hx - q[1] * hy) / det, my = (-q[3] * hx + q[0] * hy) / det;
      if (mx < x0) x0 = mx; if (mx > x1) x1 = mx; if (my < y0) y0 = my; if (my > y1) y1 = my;
    }
    return { x0, y0, x1, y1 };
  };
  // the stocked towns (+ Gyumri, which the SPEC names) under a given fit: her
  // colour at the pin and the ROOM to the nearest province line in her paint.
  // Her lines are thin — measured through Yerevan's: one texel of 253,255,255
  // with one blended texel each side — and her fields carry pale flecks (snow,
  // roofs, the highlights on Gyumri's pink), so a colour test alone picked the
  // wrong anchor once. A LINE is a near-white core with DIFFERENT dominant
  // colours on its two sides; a fleck has the same colour on both. Her
  // painting's outer edge counts as a line.
  const BBX = require(path.resolve("lib/armenia.json")).bbox;
  const TOWNS = [["Yerevan", 40.177711, 44.512623], ["Dilijan", 40.741713, 44.872221], ["Garni", 40.117484, 44.734059], ["Gyumri", 40.7942, 43.8453]];
  const herRGB = (x, y) => (herA(x, y) ? [her.d[(y * her.w + x) * 4], her.d[(y * her.w + x) * 4 + 1], her.d[(y * her.w + x) * 4 + 2]] : null);
  const core = (c) => !c || (Math.min(...c) >= 225 && Math.max(...c) - Math.min(...c) <= 40);
  const room = (hx, hy) => {
    const walk = (dx, dy) => {
      const at = (i) => herRGB(Math.round(hx + dx * i), Math.round(hy + dy * i));
      const side = (from, to) => { const cs = []; for (let j = from; j <= to; j++) { const c = at(j); if (c && !core(c)) cs.push(c); } return cs.length >= 2 ? cs.reduce((a, c) => a.map((v, k) => v + c[k] / cs.length), [0, 0, 0]) : null; };
      for (let i = 1; i < 400; i++) {
        if (!core(at(i))) continue;
        if (!at(i)) return i; // her outer edge
        const before = side(i - 7, i - 3), after = side(i + 3, i + 7);
        if (!before || !after) return i;
        if (Math.hypot(before[0] - after[0], before[1] - after[1], before[2] - after[2]) > 90) return i;
      }
      return Infinity;
    };
    return { west: walk(-1, 0), east: walk(1, 0), north: walk(0, -1), south: walk(0, 1) };
  };
  const townsUnder = (q) => { const fn = map(q), scale = Math.hypot(q[0], q[3]); return TOWNS.map(([name, lat, lng]) => {
    const u = (lng - BBX[0]) / (BBX[2] - BBX[0]), v = (BBX[3] - lat) / (BBX[3] - BBX[1]); const mx = u * W, my = v * H;
    const [hx, hy] = fn(mx, my); const ix = Math.round(hx), iy = Math.round(hy); const o = (iy * her.w + ix) * 4;
    const rm = room(hx, hy); const dir = Object.keys(rm).reduce((a, b) => (rm[b] < rm[a] ? b : a));
    return { name, maskPx: [+mx.toFixed(1), +my.toFixed(1)], herPx: [ix, iy], inHerPaint: herA(ix, iy), rgba: [her.d[o], her.d[o + 1], her.d[o + 2], her.d[o + 3]], roomHerPx: rm, tightest: { dir, herPx: rm[dir], maskPx: +(rm[dir] / scale).toFixed(1) } }; }); };
  const pFree = p.slice();
  const eFree = extentOf(pFree);
  const townsFree = townsUnder(pFree);
  const anchor = townsFree.reduce((a, b) => (b.tightest.herPx < a.tightest.herPx ? b : a));
  const [Ax, Ay] = anchor.maskPx;
  const sEdge = Math.min((W - 1 - 2 * MARGIN) / (eFree.x1 - eFree.x0), (H - 1 - 2 * MARGIN) / (eFree.y1 - eFree.y0));
  const sAnchor = { north: (Ay - MARGIN) / (Ay - eFree.y0), south: (H - 1 - MARGIN - Ay) / (eFree.y1 - Ay), west: (Ax - MARGIN) / (Ax - eFree.x0), east: (W - 1 - MARGIN - Ax) / (eFree.x1 - Ax) }[anchor.tightest.dir];
  const shrink = Math.min(1, sEdge, sAnchor);
  const pick = (lo, hi, want) => Math.min(Math.max(want, lo), hi);
  const Tx = pick(MARGIN - shrink * eFree.x0, W - 1 - MARGIN - shrink * eFree.x1, (1 - shrink) * Ax);
  const Ty = pick(MARGIN - shrink * eFree.y0, H - 1 - MARGIN - shrink * eFree.y1, (1 - shrink) * Ay);
  // new mask point m' = shrink·m + T  ⇒  m = k·m' − k·T, and f' = f∘(that)
  { const k = 1 / shrink; const ox = -Tx * k, oy = -Ty * k;
    p = [p[0] * k, p[1] * k, p[0] * ox + p[1] * oy + p[2], p[3] * k, p[4] * k, p[3] * ox + p[4] * oy + p[5]]; }
  const eCon = extentOf(p);
  const fmtE = (e) => `x ${e.x0.toFixed(1)}…${e.x1.toFixed(1)}, y ${e.y0.toFixed(1)}…${e.y1.toFixed(1)}`;
  console.log(`constraint: anchor ${anchor.name} (room ${anchor.tightest.herPx} her px ${anchor.tightest.dir}) · shrink ×${shrink.toFixed(5)} (edges alone would allow ${sEdge.toFixed(5)}, the anchor asks ${sAnchor.toFixed(5)}) · shift T (${Tx.toFixed(2)}, ${Ty.toFixed(2)}) mask px`);
  console.log(`  her opaque extent in the ${W}×${H} grid: free fit ${fmtE(eFree)} → shipped ${fmtE(eCon)}`);

  const f = map(p);
  const sx = Math.hypot(p[0], p[3]), rot = Math.atan2(p[3], p[0]);
  const shear = (p[0] * p[1] + p[3] * p[4]) / (sx * sx);
  const sy = (p[0] * p[4] - p[1] * p[3]) / sx;

  // ---- boundary error, symmetric, in mask px — for BOTH fits ---------------
  const bnd = (b) => { const pts = []; for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (b[i] && (!b[i - 1] || !b[i + 1] || !b[i - W] || !b[i + W])) pts.push([x, y]); } return pts; };
  const dist = (A, B) => { const cell = 16; const g = new Map(); for (const [x, y] of B) { const k = ((x / cell) | 0) + "," + ((y / cell) | 0); (g.get(k) || g.set(k, []).get(k)).push([x, y]); }
    const ds = A.map(([x, y]) => { let bestD = Infinity; const cx = (x / cell) | 0, cy = (y / cell) | 0; for (let r = 0; r < 64; r++) { for (let gy = cy - r; gy <= cy + r; gy++) for (let gx = cx - r; gx <= cx + r; gx++) { if (Math.max(Math.abs(gx - cx), Math.abs(gy - cy)) !== r) continue; const c = g.get(gx + "," + gy); if (!c) continue; for (const [bx, by] of c) { const d = Math.hypot(bx - x, by - y); if (d < bestD) bestD = d; } } if (bestD < r * cell) break; } return bestD; }).sort((a, b) => a - b);
    const q = (t) => ds[Math.min(ds.length - 1, Math.floor(t * ds.length))]; return { max: ds[ds.length - 1], p99: q(0.99), p95: q(0.95), p50: q(0.5), mean: ds.reduce((s, d) => s + d, 0) / ds.length }; };
  const bodyB = bnd(body);
  const measure = (fn) => {
    const warped = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const [ax, ay] = fn(x + 0.5, y + 0.5); warped[y * W + x] = herA(Math.round(ax), Math.round(ay)) ? 1 : 0; }
    const wB = bnd(warped);
    const d1 = dist(bodyB, wB), d2 = dist(wB, bodyB);
    let inter = 0, uni = 0; for (let i = 0; i < W * H; i++) { if (warped[i] && body[i]) inter++; if (warped[i] || body[i]) uni++; }
    return { d1, d2, iou: inter / uni, maxErr: Math.max(d1.max, d2.max) };
  };
  const KM = 0.2644; // one mask texel, both axes, at the bbox's middle latitude
  const free = measure(map(pFree));
  const { d1, d2, iou, maxErr } = measure(f);
  const line = (tag, m) => console.log(`${tag}: IoU ${m.iou.toFixed(4)} · boundary error (mask px) median ${Math.max(m.d1.p50, m.d2.p50).toFixed(1)}  p95 ${Math.max(m.d1.p95, m.d2.p95).toFixed(1)}  max ${m.maxErr.toFixed(1)} = ${(2 * m.maxErr).toFixed(0)} relief px = ${(KM * m.maxErr).toFixed(1)} km`);
  console.log(`fit: sx ${sx.toFixed(4)} sy ${sy.toFixed(4)} her px per mask px · rotation ${(rot * 180 / Math.PI).toFixed(3)}° · shear ${shear.toFixed(4)}`);
  line("  free fit   ", free);
  line("  shipped fit", { d1, d2, iou, maxErr });

  // ---- the pins under the SHIPPED fit, beside the free fit's numbers --------
  const towns = townsUnder(p).map((t, i) => ({ ...t, paintMovedMaskPx: [+(Tx - (1 - shrink) * t.maskPx[0]).toFixed(2), +(Ty - (1 - shrink) * t.maskPx[1]).toFixed(2)], free: townsFree[i] }));
  for (const t of towns) console.log(`  ${t.name.padEnd(8)} mask (${t.maskPx}) → her (${t.herPx}) rgba ${t.rgba} · room ${JSON.stringify(t.roomHerPx)} her px, tightest ${t.tightest.dir} ${t.tightest.herPx} (free fit: ${t.free.tightest.dir} ${t.free.tightest.herPx}) · her paint moved (${t.paintMovedMaskPx}) mask px under the pin`);

  // ---- bake the relief: her painting through the same transform ------------
  // Premultiplied bilinear sampling, so her anti-aliased edge does not drag a
  // dark fringe in; the texture grid is exactly 2× the mask grid.
  const kx = W / TW, ky = H / TH;
  const tex = Buffer.alloc(TW * TH * 4);
  const sampleHer = (ax, ay) => {
    const x0 = Math.floor(ax - 0.5), y0 = Math.floor(ay - 0.5);
    const fx = ax - 0.5 - x0, fy = ay - 0.5 - y0;
    let r = 0, g = 0, b = 0, a = 0;
    for (const [dx, dy, wgt] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
      const x = x0 + dx, y = y0 + dy;
      if (x < 0 || y < 0 || x >= her.w || y >= her.h) continue;
      const o = (y * her.w + x) * 4; const al = her.d[o + 3] / 255;
      r += her.d[o] * al * wgt; g += her.d[o + 1] * al * wgt; b += her.d[o + 2] * al * wgt; a += al * wgt;
    }
    return a > 0 ? [r / a, g / a, b / a, a] : [0, 0, 0, 0];
  };
  for (let Y = 0; Y < TH; Y++) for (let X = 0; X < TW; X++) {
    const [ax, ay] = f((X + 0.5) * kx, (Y + 0.5) * ky);
    const [r, g, b, a] = sampleHer(ax, ay);
    const o = (Y * TW + X) * 4;
    tex[o] = r; tex[o + 1] = g; tex[o + 2] = b; tex[o + 3] = Math.round(a * 255);
  }
  // Jump-flood: every texel learns its nearest OPAQUE texel, and the ones
  // outside her paint borrow that colour. The curtain's fragments and the
  // soft edge of the mask sample a texel or two outside the outline, and the
  // old satellite plate had imagery there; her PNG has nothing, and nothing
  // renders black.
  const near = new Int32Array(TW * TH).fill(-1);
  for (let i = 0; i < TW * TH; i++) if (tex[i * 4 + 3] >= 128) near[i] = i;
  for (let step = 1 << 11; step >= 1; step >>= 1) {
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
      const i = y * TW + x;
      let bi = near[i], bd = bi < 0 ? Infinity : (x - (bi % TW)) ** 2 + (y - ((bi / TW) | 0)) ** 2;
      for (let dy = -step; dy <= step; dy += step) for (let dx = -step; dx <= step; dx += step) {
        if (!dx && !dy) continue;
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= TW || yy >= TH) continue;
        const c = near[yy * TW + xx]; if (c < 0) continue;
        const d = (x - (c % TW)) ** 2 + (y - ((c / TW) | 0)) ** 2;
        if (d < bd) { bd = d; bi = c; }
      }
      near[i] = bi;
    }
  }
  const rgb = Buffer.alloc(TW * TH * 3);
  let bled = 0;
  for (let i = 0; i < TW * TH; i++) {
    const src = tex[i * 4 + 3] >= 128 ? i : near[i];
    if (src !== i) bled++;
    rgb[i * 3] = tex[src * 4]; rgb[i * 3 + 1] = tex[src * 4 + 1]; rgb[i * 3 + 2] = tex[src * 4 + 2];
  }
  const reliefBuf = await sharp(rgb, { raw: { width: TW, height: TH, channels: 3 } }).webp({ quality: QUALITY }).toBuffer();
  fs.writeFileSync(OUT_RELIEF, reliefBuf);
  console.log(`${OUT_RELIEF}  ${TW}×${TH} q${QUALITY}  ${(reliefBuf.length / 1024).toFixed(0)} kB  (${bled} texels took a neighbour's colour)`);

  // ---- the mask: her alpha through the same transform, at the mask's grid --
  // Area-averaged from the 2× texture's alpha, which keeps her anti-aliased
  // edge as a one-texel ramp — the mesh slides its curtain down over that ramp
  // and the fragment test cuts at 0.12 of it, exactly as it did on the old file.
  // HER INTERIOR IS NOT QUITE OPAQUE: the PNG's alpha sits at 250–254 across
  // the paint (brush texture, measured: 420k texels in 224–254, only 8k at
  // 255), which is invisible on the model but quadrupled the PNG (136 kB) and
  // is not an edge. Anything at or above 224 is inside and becomes 255; the
  // real ramp (1–223) is left exactly as sampled.
  const m4 = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let a = 0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) a += tex[((y * 2 + dy) * TW + x * 2 + dx) * 4 + 3];
    const v = a / 4 >= 224 ? 255 : Math.round(a / 4);
    const o = (y * W + x) * 4;
    m4[o] = v; m4[o + 1] = v; m4[o + 2] = v; m4[o + 3] = 255;
  }
  const maskBuf = await sharp(m4, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
  fs.writeFileSync(OUT_MASK, maskBuf);
  console.log(`${OUT_MASK}  ${W}×${H}  ${(maskBuf.length / 1024).toFixed(0)} kB`);

  fs.writeFileSync(REPORT, JSON.stringify({ date: "2026-10-12", source: HER, her: { w: her.w, h: her.h, bbox: hb }, bodyBbox: mb,
    // `affine` is the SHIPPED transform (the constrained one, which the review
    // scripts read); `affineFree` is the unconstrained optimum it was derived from
    affine: p, affineFree: pFree, constraint: { marginTexels: MARGIN, anchor: { name: anchor.name, dir: anchor.tightest.dir, roomHerPx: anchor.tightest.herPx, maskPx: anchor.maskPx }, shrink, shrinkAllowedByEdges: sEdge, shrinkAskedByAnchor: sAnchor, T: [Tx, Ty], herExtentMaskPx: { free: eFree, shipped: eCon } },
    sx, sy, rotationDeg: rot * 180 / Math.PI, shear, iou, iouFree: free.iou, boundaryMaskPx: { body2her: d1, her2body: d2, free: { body2her: free.d1, her2body: free.d2 } }, maxErr: { maskPx: maxErr, reliefPx: 2 * maxErr, km: KM * maxErr, freeMaskPx: free.maxErr }, towns, quality: QUALITY, bledTexels: bled, out: { relief: reliefBuf.length, mask: maskBuf.length } }, null, 1));
  console.log(`report → ${REPORT}`);
})();
