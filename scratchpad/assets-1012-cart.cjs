// THE CART'S PLATE, HER OWN PAINTING (client, change 4.pdf p18, 2026-10-12:
// «նկարը փոխենք, կոպեկներդ նույն ձևով» — change the picture, the coins the
// same way). Builds the two files components/CartPlate.tsx draws:
//
//   public/cart/plate.webp      the far plate: HER WHOLE PAINTING with her
//                               figure painted out of it (see THE CLEAN PLATE)
//   public/cart/figure.webp     her figure cut out, with alpha — the front
//                               layer the title passes behind (was venus.webp)
//
// (plate-sm.webp, a half-size candidate, went 2026-10-13: the plate only
// mounts from 861px up, where the browser never once chose it.)
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
//     526 right of it (the file is 1973 wide, the window 1294), and above,
//     below and to the LEFT, where she painted nothing more, the edge is
//     mirrored (see PAD_T / PAD_B / PAD_L);
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
 *  dropped ~10% of the window under the nav, and the camera pitches.
 *  260 above since 2026-10-13 (it was 190): projected through the camera's
 *  real extremes, 190 fell short in short windows (1280×600) and in very
 *  large ones (2560×1440). */
const PAD_T = 260;
const PAD_B = 110;
/** mirrored COLUMNS left of her painting, in plate px (2026-10-13). Her
 *  picture has 189 plate px left of the plate window and 651 right of it; in
 *  a wide, short window the scene is smaller than "cover" (so her raised arm
 *  clears the cart's panel) and the left 189 ran out — with the pointer in a
 *  corner the yawed plane's left edge came inside the window and the page's
 *  paper showed beside it (a 27px wedge at 1920×940). 360 more lets the
 *  scene stay centred up to 2560 wide; they are seen only as the camera
 *  turns, and at rest in windows beyond that. */
const PAD_L = 360;
/** THE MIRRORED MARGINS ARE SOFTENED (2026-10-13, a checker: «a second
 *  identical trunk, a butterfly column of leaves down the axis»). A clean
 *  reflection reads as one the moment it is seen. Every mirrored pixel is
 *  mixed with a blurred, darker copy — beginning a little INSIDE her
 *  painting (SOFT_IN px), a third of the way there at the seam, whole a
 *  short way out (SOFT_OUT px) — so the two sides of the axis no longer
 *  match, and what the camera's turn uncovers past
 *  her painting reads as leaves falling into shade and out of focus, not as
 *  her painting folded over. */
const SOFT_BLUR = 8;
const SOFT_DARK = 0.55;
const SOFT_IN = 40;
const SOFT_OUT = 70;
/** white export columns at the left edge of her file — see where they are read */
const WHITE_L = 2;
/** her hands, in HER pixels — measured on 4× gridded crops of the file
 *  (verify/orch/shots/z-src-hand-grid.png): A = the middle of the raised
 *  right hand, where the coins leave it (the first build's 657,360 was on
 *  the hand's outer edge); B = the lowered left hand holding the cloak, at
 *  the bottom edge of the frame */
const HAND_A_SRC = [640, 366];
const HAND_B_SRC = [1133, 767];
/** her raised hand and forearm, in HER pixels, and a point on her palm —
 *  where the hand's own mask and edge are used (see HER RAISED HAND) */
const HAND_BOX = { x: 590, y: 280, w: 190, h: 230 };
const HAND_SEED = [650, 385];
const HAND_BLUR = 1.6;
/** a pixel of her hand counts as skin (for the rim's colour) from this mean
 *  value up — her skin is 136-195, the marks she painted on it 89-124 */
const HAND_SKIN = 135;
const HAND_FEATHER = 12;
/** the coins' throw, from CartPlate.tsx (CTRL, the coin's 34px box and its
 *  largest own size and nearness) — only to print where a coin has cleared
 *  her fingers, see the end */
const CTRL = [840, -300];
const COIN_R = 17 * (0.78 + 10 / 22);
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
  // HER FILE'S FIRST TWO COLUMNS ARE WHITE — an export border, column means
  // 255 / 253 against 73 beside them (measured 2026-10-13). At the far left
  // of the far plate it drew a pale hairline down the painting's edge, and
  // mirrored (PAD_L) it would stand as a white line in the leaves. They take
  // the first painted column; nothing of her picture is lost.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < WHITE_L; x++)
      for (let c = 0; c < 3; c++) data[(y * W + x) * 3 + c] = data[(y * W + WHITE_L) * 3 + c];

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
  // HER RAISED HAND, FROM THE PLAIN COLOUR MASK (2026-10-14 — Vardan, on a
  // crop of it: «improve hand fingers»). The opening that drops the branches
  // drops anything narrower than 2·OPEN_R+1 px, and her fingertips taper
  // below that: the regrown edge could only reach OPEN_R+1 px back from what
  // survived, so the top finger ended in a flat cut and the two fingers on
  // the left lost their tips. Around the hand the ground is dark leaves and
  // no branch touches her, so there the plain colour mask is the right one:
  // the piece of it connected to her palm is added back. Finger gaps are
  // leaf-coloured, so they stay open; the hole fill has already run, so a gap
  // the new tips close into a pocket stays open too.
  {
    const { x: hx, y: hy, w: hw, h: hh } = HAND_BOX;
    const box = new Uint8Array(W * H);
    for (let y = hy; y < hy + hh; y++) for (let x = hx; x < hx + hw; x++) box[y * W + x] = raw[y * W + x];
    const hand = component(box, W, H, HAND_SEED[0], HAND_SEED[1]);
    let added = 0;
    for (let i = 0; i < W * H; i++) if (hand[i] && !grown[i]) (grown[i] = 255), added++;
    console.log(`hand: ${added}px of fingertip given back from the plain colour mask`);
  }
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
  // In her raised hand the rim takes its colour from the nearest SKIN pixel
  // inside her, not merely the nearest inside pixel (2026-10-14): the top
  // fingertip is barely wider than the erosion, the only pixels left inside
  // it are the dark mark she painted there, and copied outward they made a
  // dark cap of the whole tip. Her mark stays where she painted it.
  const inHand = (x, y) => x >= HAND_BOX.x && x < HAND_BOX.x + HAND_BOX.w && y >= HAND_BOX.y && y < HAND_BOX.y + HAND_BOX.h;
  const notSkin = new Uint8Array(W * H).fill(255);
  for (let y = HAND_BOX.y; y < HAND_BOX.y + HAND_BOX.h; y++)
    for (let x = HAND_BOX.x; x < HAND_BOX.x + HAND_BOX.w; x++) {
      const i = y * W + x;
      if (inside[i] && (data[i * 3] + data[i * 3 + 1] + data[i * 3 + 2]) / 3 >= HAND_SKIN) notSkin[i] = 0;
    }
  const toSkin = nearestClear(notSkin, W, H);
  const clean = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let s = i;
      // only near her: beyond 6px the colour is never shown (alpha is 0) —
      // except in her raised hand, where a fingertip is thinner than the
      // erosion and its nearest safe pixel lies further down the finger
      if (notInside[i]) {
        const t = inHand(x, y) ? toSkin : toIn;
        const reach = inHand(x, y) ? 15 : 7;
        if (Math.abs(t.dx[i]) < reach && Math.abs(t.dy[i]) < reach) s = (y + t.dy[i]) * W + (x + t.dx[i]);
      }
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
  // THE HAND'S EDGE IS DRAWN FINER (2026-10-14). The figure's blur of 2.2 at
  // ×2 smooths away the mask's stairs, and also closes any gap narrower than
  // about two of her pixels and rounds a fingertip: between her fingers that
  // made a mitten. Inside HAND_BOX the mask is enlarged by Lanczos and
  // blurred by HAND_BLUR only, with a knee centred on the edge itself; the
  // two are cross-faded over HAND_FEATHER px at the box's edge.
  const { data: aHand } = await sharp(Buffer.from(grown), { raw: { width: W, height: H, channels: 1 } })
    .extract({ left: bx0, top: by0, width: bw, height: bh })
    .resize(uw, uh, { kernel: "lanczos3", fit: "fill" })
    .blur(HAND_BLUR)
    .toColourspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true });
  const hb = { x0: (HAND_BOX.x - bx0) * UP, y0: (HAND_BOX.y - by0) * UP, x1: (HAND_BOX.x + HAND_BOX.w - bx0) * UP, y1: (HAND_BOX.y + HAND_BOX.h - by0) * UP };
  const rgba = Buffer.alloc(uw * uh * 4);
  for (let i = 0; i < uw * uh; i++) {
    rgba[i * 4] = rgbUp[i * 3];
    rgba[i * 4 + 1] = rgbUp[i * 3 + 1];
    rgba[i * 4 + 2] = rgbUp[i * 3 + 2];
    // the knee: the blur's ±4px ramp squeezed to about a pixel and a half,
    // centred a hair inside the mask's own edge (0.54, not 0.5)
    const soft = clamp((aUp[i] / 255 - 0.54) * 3.2 + 0.5, 0, 1);
    const x = i % uw;
    const y = (i - x) / uw;
    const inBox = Math.min(x - hb.x0, hb.x1 - x, y - hb.y0, hb.y1 - y);
    const w = clamp(inBox / (HAND_FEATHER * UP), 0, 1);
    const fine = w ? clamp((aHand[i] / 255 - 0.5) * 3 + 0.5, 0, 1) : 0;
    rgba[i * 4 + 3] = Math.round((soft * (1 - w) + fine * w) * 255);
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

  // the far plate: the whole picture at plate scale, mirrored above, below
  // and to the left
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
  const sharpFar = await sharp(farBody)
    .extend({ top: PAD_T, bottom: PAD_B, left: PAD_L, right: 0, extendWith: "mirror" })
    .linear(dark, 0)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const FW = sharpFar.info.width;
  const FH = sharpFar.info.height;
  const FC = sharpFar.info.channels;
  const shade = await sharp(sharpFar.data, { raw: { width: FW, height: FH, channels: FC } })
    .blur(SOFT_BLUR)
    .linear(SOFT_DARK, 0)
    .raw()
    .toBuffer();
  const mixed = Buffer.from(sharpFar.data);
  // d: how far past the seam (negative: inside her painting)
  const ramp = (d) => Math.min(1, Math.max(0, (d + SOFT_IN) / (SOFT_IN + SOFT_OUT)));
  for (let y = 0; y < FH; y++)
    for (let x = 0; x < FW; x++) {
      const w = Math.max(ramp(PAD_L - x), ramp(PAD_T - y), ramp(y - (FH - PAD_B) + 1));
      if (!w) continue;
      const i = (y * FW + x) * FC;
      for (let c = 0; c < 3; c++) mixed[i + c] = Math.round(sharpFar.data[i + c] * (1 - w) + shade[i + c] * w);
    }
  const far = await sharp(mixed, { raw: { width: FW, height: FH, channels: FC } }).png().toBuffer();
  await sharp(far).webp({ quality: 78, effort: 5 }).toFile(`${OUT}/plate.webp`);
  if (fs.existsSync(`${OUT}/plate-sm.webp`)) fs.unlinkSync(`${OUT}/plate-sm.webp`);
  const mean1 = (await sharp(`${OUT}/plate.webp`).greyscale().stats()).channels[0].mean;

  // ---- 4. the numbers the component takes -------------------------------
  const fig = { x: Math.round((bx0 - CROP.x) * SX), y: Math.round((by0 - CROP.y) * SY), w: Math.round(bw * SX) };
  const A = toPlate(HAND_A_SRC);
  const B = toPlate(HAND_B_SRC);
  const kb = (f) => (fs.statSync(f).size / 1024).toFixed(0) + " KB";
  const fm = await sharp(figFile).metadata();
  const pm = await sharp(`${OUT}/plate.webp`).metadata();
  const farBox = { x: -padL - PAD_L, y: -PAD_T, w: pm.width, h: pm.height };
  console.log(`plate.webp ${pm.width}×${pm.height} ${kb(`${OUT}/plate.webp`)} — leaves and sky ${bgMean.toFixed(1)} → ×${dark.toFixed(3)} → whole plate mean ${mean1.toFixed(1)}; paint-out reaches ${deepest.toFixed(0)}px deep`);
  console.log(`figure.webp ${fm.width}×${fm.height} ${kb(figFile)}`);
  console.log(`FAR = ${JSON.stringify(farBox)}   (plate px: real painting ${padL} left of the plate and ${pm.width - PAD_L - padL - PLATE_W} right of it; mirrored: ${PAD_L} further left, ${PAD_T} above, ${PAD_B} below)`);
  console.log(`FIG = ${JSON.stringify(fig)}  (cut-out ${fm.width}×${fm.height} shown at width ${fig.w})`);
  console.log(`HAND_A = [${A}]  HAND_B = [${B}]   (plate px; source ${HAND_A_SRC} / ${HAND_B_SRC}, crop x ${CROP.x}, ×${SX.toFixed(4)})`);
  console.log(`check: fingertips source x 612 → plate ${Math.round((612 - CROP.x) * SX)}; crown source y ${by0} → plate ${Math.round(by0 * SY)}`);
  // WHERE A COIN HAS CLEARED HER FINGERS (2026-10-14). The coins fade in as
  // they leave her palm, and the first stretch of the throw crosses her
  // fingers: half a coin's gold over her skin read as an orange smudge on
  // the fingertips. The component keeps a coin unseen until the coin's
  // whole disc (at its largest size) is clear of her — this is where.
  let clear = 0;
  for (let p = 0; p <= 0.5; p += 0.0025) {
    const u = 1 - p;
    const cx = u * u * A[0] + 2 * u * p * CTRL[0] + p * p * B[0];
    const cy = u * u * A[1] + 2 * u * p * CTRL[1] + p * p * B[1];
    const r = COIN_R * (1 + Math.sin(Math.PI * p) * 0.22);
    let hit = false;
    for (let dy = -r; dy <= r && !hit; dy += 1)
      for (let dx = -r; dx <= r && !hit; dx += 1) {
        if (dx * dx + dy * dy > r * r) continue;
        const fx = Math.round(((cx + dx - fig.x) * uw) / fig.w);
        const fy = Math.round(((cy + dy - fig.y) * uw) / fig.w);
        if (fx < 0 || fy < 0 || fx >= uw || fy >= uh) continue;
        if (rgba[(fy * uw + fx) * 4 + 3] > 25) hit = true;
      }
    if (hit) clear = p + 0.0025;
  }
  console.log(`COIN_CLEAR = ${clear.toFixed(4)}   (the throw's p at which a coin's disc has left her hand)`);
  fs.writeFileSync(`${DBG}/numbers.json`, JSON.stringify({ crop: CROP, sx: SX, sy: SY, fig, far: farBox, pad: { left: PAD_L, top: PAD_T, bottom: PAD_B }, handA: A, handB: B, cutout: [fm.width, fm.height], bbox: [bx0, by0, bw, bh], bgMean: [bgMean, bgMean * dark], plateMean: mean1, dark }, null, 1));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
