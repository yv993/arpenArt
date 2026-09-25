// HER SILHOUETTE, LIVE. (Vardan 2026-09-22: «sun must placed girls head
// background with index, now it catted — improve look that part».)
//
// The sun sits BEHIND her, so she must be a layer ABOVE it — and the hero is
// one flat film. components/Sun.tsx therefore copies her own pixels out of
// the playing video onto a canvas that sits over the sun. Where she is, the
// copy is opaque; where the sky is, it is transparent and the sun shows.
// Her hair drifts through the loop (±4px at the crown, ±20px where the
// loose ends hang), so the edge cannot be a static mask (the last one was:
// the sun stopped short of her hair by the drift, a sliver of hill between
// them, and read as cut). The edge is decided PER PIXEL, PER FRAME, against
// what the background is at that pixel — which this script measures,
// because the background is static across the loop (probed: per-pixel
// σ 2–6 on every hill, zero shift) while her hair moves across it.
//
// Her silhouette is read ONCE, off the poster: the hair mass flood-filled
// from the crown, and she is everything below its top edge per column and,
// through the hair mass, between its leftmost and rightmost pixel per row
// (face, dress and all — the hair encloses the face). Per-frame silhouettes
// were tried and dropped: on the strand-rich sides the fill and the row
// scans landed differently frame to frame, and whole rows of her face
// flickered between hers and not. The frames are used only for what they
// are reliable at — telling, per pixel, what colour the hill is when her
// hair is not covering it.
//
// Writes public/hero/head-key.webp (1280×720 RGBA, lossless, colours to
// multiples of 8 — the key compares within ±16 anyway, and it halves the file):
//   alpha 0   — outside: the sun shows
//   alpha 128 — her, well inside the edge: drawn as-is from the video
//   alpha 255 — THE BAND, 24px out from her edge to 8px in. RGB is the
//               background at that pixel (median of the frames where the
//               pixel is not hair-coloured). Live: her alpha = how far the
//               video's pixel is from this colour, so a hair pixel is
//               opaque and a hill pixel lets the sun through, whichever
//               way the hair has drifted in that frame. A band pixel that
//               is hair in every frame becomes alpha 128.
const sharp = require("sharp");
const fs = require("fs");

const ROOT = "C:/Users/ysaha/Desktop/arPage";
const FR = "C:/Users/ysaha/AppData/Local/Temp/claude/C--Users-ysaha-Desktop-restor/a2afe695-9191-4773-b0a9-67be56018acd/scratchpad/frames";
const SHOTS = "C:/Users/ysaha/AppData/Local/Temp/claude/C--Users-ysaha-Desktop-restor/a2afe695-9191-4773-b0a9-67be56018acd/scratchpad/shots";
const W = 1280, H = 720;
const X0 = 60, X1 = 760; // columns that could be her
const Y0 = 150; // nothing of her is above this
const ROWS_OF_MASS = 520; // below this row the loose ends and the dress begin
const SEEDS = [[390, 240], [300, 300], [500, 320], [330, 480], [480, 480]];
const OUT = 16, IN = 5; // the band's reach outside and inside her edge — inside
// stays short: her orange strands match the yellow hill, and a keyed strand
// deeper in would let the sun through her hair

/** her hair, as opposed to every hill behind it — measured on the poster:
 *  base (95,72,75) (91,65,69) (83,54,66) (68,39,38): dark, r≥b, b≥g;
 *  the dark rust band left of her (116,60,40): dark but b<g — OUT;
 *  her magenta strands (143,51,167) (149,42,182): saturated, b≫g;
 *  the pink stripes on the left hill (198,80,90): saturated, b≈g — OUT;
 *  the rose band right of her (163,82,91): neither dark nor cool — OUT;
 *  the purple mountain (113,98,149): not saturated enough — OUT. */
const isHair = (r, g, b) => {
  const avg = (r + g + b) / 3;
  if (avg < 92 && r >= b - 12 && b >= g - 8) return true;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx - mn > 95 && avg < 165 && b > g + 25;
};

async function load(file) {
  return sharp(file).removeAlpha().resize(W, H, { fit: "fill" }).raw().toBuffer();
}
function hairOf(fr) {
  const hair = new Uint8Array(W * H);
  for (let y = Y0; y < H; y++) for (let x = X0; x <= X1; x++) {
    const o = (y * W + x) * 3;
    if (isHair(fr[o], fr[o + 1], fr[o + 2])) hair[y * W + x] = 1;
  }
  return hair;
}
/** 1 where any pixel within r is set (square window) */
function dilate(src, r) {
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let on = 0;
    for (let dy = -r; dy <= r && !on; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= H) continue;
      for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx;
        if (xx >= 0 && xx < W && src[yy * W + xx]) { on = 1; break; }
      }
    }
    out[y * W + x] = on;
  }
  return out;
}
/** 1 where every pixel within r is set */
function erode(src, r) {
  const inv = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) inv[i] = src[i] ? 0 : 1;
  const d = dilate(inv, r);
  const out = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = d[i] ? 0 : 1;
  return out;
}
/** the hair mass: hair-coloured pixels closed by 2px and flooded from the
 *  crown, so the hills' own dark strokes stay out */
function massOf(fr) {
  const closed = dilate(hairOf(fr), 2);
  const region = new Uint8Array(W * H);
  const stack = [];
  for (const [sx, sy] of SEEDS) if (closed[sy * W + sx]) stack.push(sy * W + sx);
  while (stack.length) {
    const i = stack.pop();
    if (region[i] || !closed[i]) continue;
    region[i] = 1;
    const x = i % W, y = (i - x) / W;
    if (x > X0) stack.push(i - 1);
    if (x < X1) stack.push(i + 1);
    if (y > Y0) stack.push(i - W);
    if (y < H - 1) stack.push(i + W);
  }
  return region;
}
/** HER: below the mass's top edge in every column, and — through the hair
 *  mass — between its leftmost and rightmost pixel in every row */
function silhouetteOf(fr) {
  const mass = massOf(fr);
  const s = new Uint8Array(W * H);
  const top = new Int16Array(W).fill(-1);
  for (let x = X0; x <= X1; x++) for (let y = Y0; y < H; y++) if (mass[y * W + x]) { top[x] = y; break; }
  for (let y = Y0; y < H; y++) {
    let l = -1, r = -1;
    if (y <= ROWS_OF_MASS) {
      for (let x = X0; x <= X1; x++) if (mass[y * W + x]) { if (l < 0) l = x; r = x; }
      if (l < 0) continue;
    } else { l = X0; r = X1; }
    for (let x = l; x <= r; x++) if (top[x] >= 0 && y >= top[x]) s[y * W + x] = 1;
  }
  return s;
}

module.exports = { isHair, load, hairOf, dilate, erode, massOf, silhouetteOf, W, H, X0, X1, Y0, FR, ROOT, SHOTS };
if (require.main === module) (async () => {
  const files = fs.readdirSync(FR).filter((f) => f.endsWith(".png")).sort().map((f) => `${FR}/${f}`);
  files.push(`${ROOT}/public/hero/intro.webp`);
  const frames = [];
  for (const f of files) frames.push(await load(f));
  const N = frames.length;
  const S = silhouetteOf(frames[N - 1]); // the poster
  const outerZone = dilate(S, OUT);
  const core = erode(S, IN);
  const hairs = frames.map(hairOf);

  // ---- classify every pixel ------------------------------------------------
  // 0 out, 1 band (keyed), 2 her
  const cls = new Uint8Array(W * H);
  const ref = new Uint8Array(W * H * 3);
  let nBand = 0, nHer = 0, nHairAlways = 0, nUntrusted = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!outerZone[i]) continue;
    if (core[i]) { cls[i] = 2; nHer++; continue; }
    const o = i * 3;
    const bg = [];
    for (let k = 0; k < N; k++) if (!hairs[k][i]) bg.push([frames[k][o], frames[k][o + 1], frames[k][o + 2]]);
    if (bg.length < 3) { cls[i] = 2; nHairAlways++; continue; } // hair in every frame
    const med = [0, 1, 2].map((c) => { const s = bg.map((p) => p[c]).sort((a, b) => a - b); return s[s.length >> 1]; });
    // the non-hair frames must mostly agree on one colour (a static hill);
    // if they do not, they were her highlights — she is here
    const d = bg.map((p) => Math.hypot(p[0] - med[0], p[1] - med[1], p[2] - med[2])).sort((a, b) => a - b);
    if (d[Math.floor(d.length * 0.7)] > 40) { cls[i] = 2; nUntrusted++; continue; }
    cls[i] = 1; nBand++;
    ref[o] = med[0]; ref[o + 1] = med[1]; ref[o + 2] = med[2];
  }
  let xl = W, xr = -1, yt = H, yb = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (cls[y * W + x]) { xl = Math.min(xl, x); xr = Math.max(xr, x); yt = Math.min(yt, y); yb = Math.max(yb, y); }
  console.log(`her box x ${xl}..${xr}, y ${yt}..${yb}; band ${nBand}px; her ${nHer}px core + ${nHairAlways} always-hair + ${nUntrusted} untrusted band px`);

  // ---- the key PNG ----------------------------------------------------------
  const key = Buffer.alloc(W * H * 4, 0);
  for (let i = 0; i < W * H; i++) {
    const k = i * 4;
    if (cls[i] === 1) { key[k] = ref[i * 3] & ~7; key[k + 1] = ref[i * 3 + 1] & ~7; key[k + 2] = ref[i * 3 + 2] & ~7; key[k + 3] = 255; }
    else if (cls[i] === 2) key[k + 3] = 128;
  }
  await sharp(key, { raw: { width: W, height: H, channels: 4 } }).webp({ lossless: true }).toFile(`${ROOT}/public/hero/head-key.webp`);
  const st = fs.statSync(`${ROOT}/public/hero/head-key.webp`);
  console.log(`head-key.webp ${(st.size / 1024).toFixed(1)} KB`);
  if (fs.existsSync(`${ROOT}/public/hero/head-key.png`)) fs.unlinkSync(`${ROOT}/public/hero/head-key.png`);

  // ---- look: band tinted red, her tinted green, over three frames, 2× ------
  const pick = [["poster", N - 1], ["f010", 9], ["f030", 29]];
  for (const [name, i] of pick) {
    const base = Buffer.from(frames[i]);
    for (let j = 0; j < W * H; j++) {
      const o = j * 3;
      if (cls[j] === 1) { base[o] = Math.min(255, base[o] + 110); base[o + 1] >>= 1; base[o + 2] >>= 1; }
      else if (cls[j] === 2) base[o + 1] = Math.min(255, base[o + 1] + 70);
    }
    await sharp(base, { raw: { width: W, height: H, channels: 3 } })
      .extract({ left: 80, top: 140, width: 640, height: 400 }).resize(1280, 800, { kernel: "nearest" }).png()
      .toFile(`${SHOTS}/key-check-${name}.png`);
  }

  // ---- composition preview: the sun behind her, cut as the runtime cuts it
  const sunMeta = await sharp(`${ROOT}/public/hero/sun.webp`).metadata();
  const DISC = 550, IMGW = sunMeta.width, IMGH = sunMeta.height; // disc ⌀ inside the 879-wide image
  const cands = [["B-disc360", 360, 388, 330]];
  const smooth = (d) => { const t = Math.min(1, Math.max(0, (d - 16) / 32)); return t * t * (3 - 2 * t); };
  for (const [name, disc, cx, cy] of cands) {
    const iw = Math.round((disc * IMGW) / DISC), ih = Math.round((disc * IMGH) / DISC);
    const sun = await sharp(`${ROOT}/public/hero/sun.webp`).resize(iw, ih).raw().toBuffer();
    const sx = Math.round(cx - iw / 2), sy = Math.round(cy - ih / 2);
    for (const [fname, i] of [["poster", N - 1], ["f030", 29], ["f017", 16]]) {
      const fr = frames[i];
      const out = Buffer.from(fr);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const ux = x - sx, uy = y - sy;
        if (ux < 0 || uy < 0 || ux >= iw || uy >= ih) continue;
        const so = (uy * iw + ux) * 4;
        const sa = sun[so + 3] / 255;
        if (sa === 0) continue;
        const o = (y * W + x) * 3;
        const k = (y * W + x) * 4;
        let her = 0;
        if (key[k + 3] === 128) her = 1;
        else if (key[k + 3] === 255) her = isHair(fr[o], fr[o + 1], fr[o + 2]) ? 1 : smooth(Math.hypot(fr[o] - key[k], fr[o + 1] - key[k + 1], fr[o + 2] - key[k + 2]));
        const a = sa * (1 - her);
        for (let c = 0; c < 3; c++) out[o + c] = Math.round(fr[o + c] * (1 - a) + sun[so + c] * a);
      }
      await sharp(out, { raw: { width: W, height: H, channels: 3 } })
        .extract({ left: 0, top: 40, width: 900, height: 620 }).png()
        .toFile(`${SHOTS}/comp-${name}-${fname}.png`);
      await sharp(out, { raw: { width: W, height: H, channels: 3 } })
        .extract({ left: 230, top: 170, width: 340, height: 150 }).resize(1020, 450, { kernel: "lanczos3" }).png()
        .toFile(`${SHOTS}/comp-${name}-${fname}-crown.png`);
      await sharp(out, { raw: { width: W, height: H, channels: 3 } })
        .extract({ left: 440, top: 240, width: 200, height: 220 }).resize(600, 660, { kernel: "lanczos3" }).png()
        .toFile(`${SHOTS}/comp-${name}-${fname}-right.png`);
    }
    console.log(`${name}: image ${iw}×${ih} at (${sx},${sy}) — disc top y ${Math.round(cy - disc / 2)}, rays top y ${sy}`);
  }
  console.log("previews written");
})();
