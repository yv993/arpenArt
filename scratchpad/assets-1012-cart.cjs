// THE CART'S PLATE, HER OWN PAINTING (client, change 4.pdf p18, 2026-10-12:
// «նկարը փոխենք, կոպեկներդ նույն ձևով» — change the picture, the coins the
// same way). Builds the three files components/CartPlate.tsx draws:
//
//   public/cart/plate.webp      the far plate: HER WHOLE PAINTING with her
//   public/cart/plate-sm.webp   figure painted out of it (see THE CLEAN PLATE)
//   public/cart/figure.webp     her figure cut out, with alpha — the front
//                               layer the title passes behind (was venus.webp)
//
// from imgss/redesign-2026-10-12/drive/cart/IMG_7665.png (1973×809, RGBA with
// EVERY pixel opaque — her file carries no cut-out, so the figure is cut here).
//
//   node scratchpad/assets-1012-cart.cjs            (from the repo root)
//
// The Primavera files are kept under imgss/redesign-2026-10-12/verify/pages/old/.
// Every number the component needs (FIG, FAR, HAND_A, HAND_B, the cut-out's
// size) is PRINTED at the end, read off the written files — never typed.
//
// PLATE SPACE. The component writes everything in a 1600×1000 box. That box
// is a 1294px-wide window of her picture at her full height, scaled ×1.2365;
// the window starts at x=153 so her fingertips (source x≈612) land at plate
// x≈567 — where Venus's cut-out began, which is the x the cart's title was
// sized to clear («5.2vw ends the line at ~499, just clear», shop.css).
//
// THE CLEAN PLATE (2026-10-13 — Vardan, on a screenshot: «improve girl hand
// part»). The first build copied the Primavera's trick: the far plate was the
// plate-space crop enlarged ×1.38, with her figure blotted to a dark
// silhouette so a second, bigger copy of her would not show beside the
// cut-out. Botticelli's grove is nearly black, so there the blot vanished;
// HER ground is green leaves and blue sky, and the blot — 38% bigger than
// she is and pushed outward from the middle — stood beside her raised hand
// as a black slab, and blacked out the right third of the frame. So:
//   · the far plate is her painting AT ITS OWN SCALE, in register with the
//     cut-out, and what covers the camera's sway is MORE OF HER PAINTING, not
//     an enlargement: 153 source px of it lie left of the plate window and
//     526 right of it (the file is 1973 wide, the window 1294), and above and
//     below, where she painted nothing more, the edge rows are mirrored;
//   · her figure is PAINTED OUT rather than blotted: every pixel under her
//     (grown 14px) takes the leaf on the other side of her outline, mirrored
//     across the nearest point of it — foliage continuing behind her. Only a
//     rim of this ever shows, as the camera turns and the two layers part by
//     a few pixels; the middle of it is never seen and is simply softened.
//
// THE CUT-OUT is a colour mask: she is warm (skin, the red cloak, auburn
// hair, a cream dress) on cool ground (green leaves, blue sky, dark teal), so
// hue separates them; the brown branches are warm too, but thin, and a
// morphological opening drops anything under ~19px wide, then the piece
// seeded at her face is kept and its exact edge re-grown from the raw mask.
// Small holes (her blue eyes) are filled.
// ITS EDGE (2026-10-13, the same screenshot). The first cut-out was the
// binary mask feathered by a pixel, at her file's own 680px — and the page
// shows her up to 1.5× that, so every stair of the mask was enlarged with
// it: her fingers and forearm were saw-toothed, with a rim of leaf-green.
// Now (a) the rim's colour is taken from the nearest pixel safely inside
// her, so no leaf is carried out on her edge; (b) the picture is enlarged
// ×2 here, by Lanczos, so the browser only ever scales it DOWN; (c) the
// mask is enlarged with it, blurred and re-thresholded with a soft knee —
// a smooth contour with a pixel and a half of anti-aliasing, not a stair.
const sharp = require("sharp");
const fs = require("fs");

const ROOT = "C:/Users/ysaha/Desktop/arPage";
const SRC = `${ROOT}/imgss/redesign-2026-10-12/drive/cart/IMG_7665.png`;
const OUT = `${ROOT}/public/cart`;
const OLD = `${ROOT}/imgss/redesign-2026-10-12/verify/pages/old`;
const DBG = `${ROOT}/imgss/redesign-2026-10-12/verify/p15-p18/assets`;

const PLATE_W = 1600;
const PLATE_H = 1000;
/** the window of her picture that IS plate space (see PLATE SPACE) */
const CROP = { x: 153, y: 0, w: 1294, h: 809 };
const SX = PLATE_W / CROP.w; // 1.2365
const SY = PLATE_H / CROP.h; // 1.2361
/** mirrored rows above and below her painting, in plate px — the scene is
 *  dropped ~10% of the window under the nav, and the camera pitches */
const PAD_T = 190;
const PAD_B = 110;
/** her hands, in HER pixels — measured on 4× gridded crops of the file
 *  (verify/orch/shots/z-src-hand-grid.png): A = the middle of the raised
 *  right hand, where the coins leave it (the first build's 657,360 was on
 *  the hand's outer edge); B = the lowered left hand holding the cloak, at
 *  the bottom edge of the frame */
const HAND_A_SRC = [640, 366];
const HAND_B_SRC = [1133, 767];
/** where the flood fill starts: her face */
const SEED = [985, 120];
/** the opening radius — drops branches up to 2r+1 px wide; her fingers are ~30px */
const OPEN_R = 9;
/** how far past her outline the paint-out reaches, source px */
const GROW = 14;
/** the cut-out is written at this multiple of her file's pixels */
const UP = 2;
/** the mean luminance of the far plate. CartPlate.tsx records the reference
 *  page's plate at 59.2; 62 keeps her foliage the dark room the cream title
 *  needs. Measured on the leaves and sky only — her figure is the light of
 *  the picture and is not in this plate. */
const TARGET_BG_MEAN = 62;

const toPlate = ([x, y]) => [Math.round((x - CROP.x) * SX), Math.round((y - CROP.y) * SY)];

// ---- tiny raster helpers on Uint8 masks (0/255) --------------------------
function erode(m, W, H, r) {
  const t = new Uint8Array(W * H);
  const o = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = 255;
      for (let k = -r; k <= r && v; k++) {
        const xx = x + k;
        if (xx < 0 || xx >= W || !m[y * W + xx]) v = 0;
      }
      t[y * W + x] = v;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = 255;
      for (let k = -r; k <= r && v; k++) {
        const yy = y + k;
        if (yy < 0 || yy >= H || !t[yy * W + x]) v = 0;
      }
      o[y * W + x] = v;
    }
  return o;
}
function dilate(m, W, H, r) {
  const t = new Uint8Array(W * H);
  const o = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = 0;
      for (let k = -r; k <= r && !v; k++) {
        const xx = x + k;
        if (xx >= 0 && xx < W && m[y * W + xx]) v = 255;
      }
      t[y * W + x] = v;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = 0;
      for (let k = -r; k <= r && !v; k++) {
        const yy = y + k;
        if (yy >= 0 && yy < H && t[yy * W + x]) v = 255;
      }
      o[y * W + x] = v;
    }
  return o;
}
/** the 4-connected piece of `m` that contains (sx, sy) */
function component(m, W, H, sx, sy) {
  const o = new Uint8Array(W * H);
  if (!m[sy * W + sx]) throw new Error(`seed (${sx},${sy}) is not in the mask`);
  const stack = [sy * W + sx];
  o[sy * W + sx] = 255;
  while (stack.length) {
    const i = stack.pop();
    const x = i % W;
    const y = (i - x) / W;
    const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
    for (const j of nb) if (j >= 0 && m[j] && !o[j]) (o[j] = 255), stack.push(j);
  }
  return o;
}
/** fill background pockets smaller than `max` px that touch no image edge */
function fillSmallHoles(m, W, H, max) {
  const seen = new Uint8Array(W * H);
  for (let s = 0; s < W * H; s++) {
    if (m[s] || seen[s]) continue;
    const px = [];
    const stack = [s];
    seen[s] = 1;
    let border = false;
    while (stack.length) {
      const i = stack.pop();
      px.push(i);
      const x = i % W;
      const y = (i - x) / W;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) border = true;
      const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
      for (const j of nb) if (j >= 0 && !m[j] && !seen[j]) (seen[j] = 1), stack.push(j);
    }
    if (!border && px.length <= max) for (const i of px) m[i] = 255;
  }
  return m;
}
/** For every pixel where `m` is set: the offset (dx, dy) to the nearest pixel
 *  where it is NOT (8SSEDT — two raster passes carrying the offset, which is
 *  exact enough for a picture and a thousand times faster than a search). */
function nearestClear(m, W, H) {
  const BIG = 20000;
  const dx = new Int32Array(W * H);
  const dy = new Int32Array(W * H);
  for (let i = 0; i < W * H; i++) if (m[i]) (dx[i] = BIG), (dy[i] = BIG);
  const take = (i, x, y, ox, oy) => {
    const nx = x + ox;
    const ny = y + oy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) return;
    const j = ny * W + nx;
    const cx = dx[j] + ox;
    const cy = dy[j] + oy;
    if (cx * cx + cy * cy < dx[i] * dx[i] + dy[i] * dy[i]) (dx[i] = cx), (dy[i] = cy);
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      take(i, x, y, -1, 0), take(i, x, y, 0, -1), take(i, x, y, -1, -1), take(i, x, y, 1, -1);
    }
    for (let x = W - 1; x >= 0; x--) take(y * W + x, x, y, 1, 0);
  }
  for (let y = H - 1; y >= 0; y--) {
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      take(i, x, y, 1, 0), take(i, x, y, 0, 1), take(i, x, y, -1, 1), take(i, x, y, 1, 1);
    }
    for (let x = 0; x < W; x++) take(y * W + x, x, y, -1, 0);
  }
  return { dx, dy };
}
const rgb2hsv = (r, g, b) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx ? d / mx : 0, mx];
};
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

(async () => {
  fs.mkdirSync(OLD, { recursive: true });
  fs.mkdirSync(DBG, { recursive: true });
  // the Primavera files, kept — copied once, before anything is overwritten
  for (const f of ["plate.webp", "plate-sm.webp", "venus.webp"]) {
    const from = `${OUT}/${f}`;
    const to = `${OLD}/${f}`;
    if (fs.existsSync(from) && !fs.existsSync(to)) fs.copyFileSync(from, to);
  }

  const meta = await sharp(SRC).metadata();
  const W = meta.width;
  const H = meta.height;
  console.log(`source ${W}×${H} ${meta.channels}ch alpha=${meta.hasAlpha}`);
  const { data } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });

  // ---- 1. the mask ------------------------------------------------------
  const raw = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const [h, s, v] = rgb2hsv(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
    let fig = (h <= 65 || h >= 330) && s >= 0.08 && v >= 0.18; // skin, cloak, hair, warm cream
    if (s < 0.08 && v >= 0.55) fig = true; // the dress's near-neutral lights
    raw[i] = fig ? 255 : 0;
  }
  // open (drops the branches), keep her piece, re-grow its exact edge
  const opened = dilate(erode(raw, W, H, OPEN_R), W, H, OPEN_R);
  const her = component(opened, W, H, SEED[0], SEED[1]);
  const ring = dilate(her, W, H, OPEN_R + 1);
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) mask[i] = ring[i] && raw[i] ? 255 : 0;
  // the re-grown edge may pick up a stub of a branch where one met her: keep
  // only the piece still connected to her face
  const grown = component(mask, W, H, SEED[0], SEED[1]);
  fillSmallHoles(grown, W, H, 4000);
  await sharp(Buffer.from(grown), { raw: { width: W, height: H, channels: 1 } }).png().toFile(`${DBG}/mask.png`);

  let bx0 = W, by0 = H, bx1 = -1, by1 = -1, n = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (grown[y * W + x]) {
        n++;
        if (x < bx0) bx0 = x;
        if (x > bx1) bx1 = x;
        if (y < by0) by0 = y;
        if (y > by1) by1 = y;
      }
  const bw = bx1 - bx0 + 1;
  const bh = by1 - by0 + 1;
  console.log(`figure: ${n}px, bbox x ${bx0}..${bx1} y ${by0}..${by1} (${bw}×${bh})`);

  // ---- 2. the cut-out ---------------------------------------------------
  // (a) her rim takes its colour from inside her: everything not safely
  //     inside (the mask eroded 2px) copies the nearest pixel that is
  const inside = erode(grown, W, H, 2);
  const notInside = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) notInside[i] = inside[i] ? 0 : 255;
  const toIn = nearestClear(notInside, W, H);
  const clean = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let s = i;
      // only near her: beyond 6px the colour is never shown (alpha is 0)
      if (notInside[i] && Math.abs(toIn.dx[i]) < 7 && Math.abs(toIn.dy[i]) < 7) s = (y + toIn.dy[i]) * W + (x + toIn.dx[i]);
      clean[i * 3] = data[s * 3];
      clean[i * 3 + 1] = data[s * 3 + 1];
      clean[i * 3 + 2] = data[s * 3 + 2];
    }
  // (b) ×2 by Lanczos, (c) the mask with it — blurred, then a soft knee
  const uw = bw * UP;
  const uh = bh * UP;
  const rgbUp = await sharp(clean, { raw: { width: W, height: H, channels: 3 } })
    .extract({ left: bx0, top: by0, width: bw, height: bh })
    .resize(uw, uh, { kernel: "lanczos3", fit: "fill" })
    .raw()
    .toBuffer();
  // (`toColourspace("b-w")`: a one-channel raw input comes back from blur()
  // as three channels otherwise, and an alpha read at a stride of one was
  // every third row of the figure — the very first build striped her)
  const { data: aUp, info: ai } = await sharp(Buffer.from(grown), { raw: { width: W, height: H, channels: 1 } })
    .extract({ left: bx0, top: by0, width: bw, height: bh })
    .resize(uw, uh, { kernel: "cubic", fit: "fill" })
    .blur(2.2)
    .toColourspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (ai.channels !== 1) throw new Error(`alpha has ${ai.channels} channels`);
  const rgba = Buffer.alloc(uw * uh * 4);
  for (let i = 0; i < uw * uh; i++) {
    rgba[i * 4] = rgbUp[i * 3];
    rgba[i * 4 + 1] = rgbUp[i * 3 + 1];
    rgba[i * 4 + 2] = rgbUp[i * 3 + 2];
    // the knee: the blur's ±4px ramp squeezed to about a pixel and a half,
    // centred a hair inside the mask's own edge (0.54, not 0.5)
    rgba[i * 4 + 3] = Math.round(clamp((aUp[i] / 255 - 0.54) * 3.2 + 0.5, 0, 1) * 255);
  }
  const figFile = `${OUT}/figure.webp`;
  await sharp(rgba, { raw: { width: uw, height: uh, channels: 4 } }).webp({ quality: 86, alphaQuality: 100, effort: 5 }).toFile(figFile);
  await sharp(figFile).flatten({ background: "#ff00ff" }).resize(600).png().toFile(`${DBG}/figure-on-magenta.png`);
  await sharp(figFile)
    .extract({ left: 0, top: 250 * UP, width: 260 * UP, height: 330 * UP })
    .flatten({ background: "#ff00ff" })
    .png()
    .toFile(`${DBG}/figure-hand-on-magenta.png`);
  if (fs.existsSync(`${OUT}/venus.webp`)) fs.unlinkSync(`${OUT}/venus.webp`);

  // ---- 3. the clean plate ----------------------------------------------
  // her figure painted out, on the WHOLE picture (so the margins beside the
  // plate window are real painting too)
  const out = dilate(grown, W, H, GROW);
  const near = nearestClear(out, W, H);
  const filled = Buffer.from(data);
  let deepest = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!out[i]) continue;
      const ddx = near.dx[i];
      const ddy = near.dy[i];
      const depth = Math.sqrt(ddx * ddx + ddy * ddy);
      if (depth > deepest) deepest = depth;
      // the leaf on the other side of her outline, mirrored across it
      let qx = clamp(x + 2 * ddx, 0, W - 1);
      let qy = clamp(y + 2 * ddy, 0, H - 1);
      let q = qy * W + qx;
      if (out[q]) {
        // the mirror point is under her as well (a narrow place, or deeper
        // than she is wide): fall back to the clear pixel nearest to IT
        qx = clamp(qx + near.dx[q], 0, W - 1);
        qy = clamp(qy + near.dy[q], 0, H - 1);
        q = qy * W + qx;
      }
      filled[i * 3] = data[q * 3];
      filled[i * 3 + 1] = data[q * 3 + 1];
      filled[i * 3 + 2] = data[q * 3 + 2];
    }
  // the part of it that can never be seen (deeper than the layers ever part)
  // is softened, so even a freak view of it is quiet, not a kaleidoscope
  const soft = await sharp(filled, { raw: { width: W, height: H, channels: 3 } }).blur(7).raw().toBuffer();
  for (let i = 0; i < W * H; i++) {
    if (!out[i]) continue;
    const depth = Math.sqrt(near.dx[i] * near.dx[i] + near.dy[i] * near.dy[i]);
    const k = clamp((depth - 34) / 30, 0, 1);
    if (!k) continue;
    for (let c = 0; c < 3; c++) filled[i * 3 + c] = Math.round(filled[i * 3 + c] * (1 - k) + soft[i * 3 + c] * k);
  }
  await sharp(filled, { raw: { width: W, height: H, channels: 3 } }).png().toFile(`${DBG}/clean-plate-source.png`);

  // the far plate: the whole picture at plate scale, mirrored above and below
  const farW = Math.round(W * SX);
  const padL = Math.round(CROP.x * SX);
  const farBody = await sharp(filled, { raw: { width: W, height: H, channels: 3 } })
    .resize(farW, PLATE_H, { kernel: "lanczos3", fit: "fill" })
    .png()
    .toBuffer();
  // the darkening, from the mean of the leaves and sky
  const grey = await sharp(data, { raw: { width: W, height: H, channels: 3 } }).greyscale().toColourspace("b-w").raw().toBuffer();
  let bgSum = 0, bgN = 0;
  for (let i = 0; i < W * H; i++) if (!out[i]) (bgSum += grey[i]), bgN++;
  const bgMean = bgSum / bgN;
  const dark = Math.min(1, TARGET_BG_MEAN / bgMean);
  // `.linear(f)` is a straight multiply of the sRGB values, so the greyscale
  // mean scales by exactly f; `.modulate({ brightness })` scales LAB L*,
  // which took the plate to a mean of 35 for a nominal ×0.73
  const far = await sharp(farBody)
    .extend({ top: PAD_T, bottom: PAD_B, left: 0, right: 0, extendWith: "mirror" })
    .linear(dark, 0)
    .png()
    .toBuffer();
  const fm0 = await sharp(far).metadata();
  await sharp(far).webp({ quality: 78, effort: 5 }).toFile(`${OUT}/plate.webp`);
  await sharp(far)
    .resize(Math.round(fm0.width / 2), Math.round(fm0.height / 2), { kernel: "lanczos3" })
    .webp({ quality: 78, effort: 5 })
    .toFile(`${OUT}/plate-sm.webp`);
  const mean1 = (await sharp(`${OUT}/plate.webp`).greyscale().stats()).channels[0].mean;

  // ---- 4. the numbers the component takes -------------------------------
  const fig = { x: Math.round((bx0 - CROP.x) * SX), y: Math.round((by0 - CROP.y) * SY), w: Math.round(bw * SX) };
  const A = toPlate(HAND_A_SRC);
  const B = toPlate(HAND_B_SRC);
  const kb = (f) => (fs.statSync(f).size / 1024).toFixed(0) + " KB";
  const fm = await sharp(figFile).metadata();
  const pm = await sharp(`${OUT}/plate.webp`).metadata();
  const sm = await sharp(`${OUT}/plate-sm.webp`).metadata();
  const farBox = { x: -padL, y: -PAD_T, w: pm.width, h: pm.height };
  console.log(`plate.webp ${pm.width}×${pm.height} ${kb(`${OUT}/plate.webp`)}, plate-sm.webp ${sm.width}×${sm.height} ${kb(`${OUT}/plate-sm.webp`)} — leaves and sky ${bgMean.toFixed(1)} → ×${dark.toFixed(3)} → whole plate mean ${mean1.toFixed(1)}; paint-out reaches ${deepest.toFixed(0)}px deep`);
  console.log(`figure.webp ${fm.width}×${fm.height} ${kb(figFile)}`);
  console.log(`FAR = ${JSON.stringify(farBox)}   (plate px: real painting ${padL} left of the plate and ${pm.width - padL - PLATE_W} right of it, ${PAD_T} mirrored above, ${PAD_B} below)`);
  console.log(`FIG = ${JSON.stringify(fig)}  (cut-out ${fm.width}×${fm.height} shown at width ${fig.w})`);
  console.log(`HAND_A = [${A}]  HAND_B = [${B}]   (plate px; source ${HAND_A_SRC} / ${HAND_B_SRC}, crop x ${CROP.x}, ×${SX.toFixed(4)})`);
  console.log(`check: fingertips source x 612 → plate ${Math.round((612 - CROP.x) * SX)}; crown source y ${by0} → plate ${Math.round(by0 * SY)}`);
  fs.writeFileSync(`${DBG}/numbers.json`, JSON.stringify({ crop: CROP, sx: SX, sy: SY, fig, far: farBox, handA: A, handB: B, cutout: [fm.width, fm.height], bbox: [bx0, by0, bw, bh], bgMean: [bgMean, bgMean * dark], plateMean: mean1, dark }, null, 1));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
