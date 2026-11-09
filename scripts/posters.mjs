// ---------------------------------------------------------------------------
// POSTERS → /public/products + lib/products.json (change 5.pdf p5, 2026-11-04)
//
// Her Drive folder «posters» (1ouzxSnkGVYykocTkPMO-oLmmKsEJdxHD), downloaded
// into the gitignored intake folder imgss/change5-2026-11-04/drive/posters/
// with a manifest.json (name, id, bytes, sha1, px). Two subfolders:
//   file/Untitled-3-01…04.jpg   the four posters, flat, 596 × 842
//   mockup/1…4.jpg              each poster on a grey wall, 5249 × 3500
//
// THE PAIRING IS BY PICTURE, NOT BY NUMBER: mockup 1 is flat 04, 2 is 01,
// 3 is 02 and 4 is 03 (read off a contact sheet of all eight). A wrong pair
// would put one poster's wall photograph in another poster's window, so the
// table below is not trusted on its own: the four mockups share ONE wall
// photograph, the poster is exactly where they differ, and that region of
// each mockup is compared with every flat. The run stops if any flat's
// closest mockup is not the one the table names.
//
// THE NUMBERING is her flat files' own: Untitled-3-01 is poster no. 01 — the
// number a buyer reads («Poster no. 01») and the cart's `art`.
//
// RUNGS. The flats are small, so nothing is upscaled: the full file is the
// flat's own 596 px (q82) and the -sm is 400 px (q78) — the cards are
// 260–330 px wide on a desktop (a 1x screen takes the -sm, a 2x one the
// full file) and ~170 px on a phone (2x: the -sm, 3x: the full file). Half
// the flat (298 px) was tried first and is short of every desktop card at
// 1x, which then took the full file anyway. The walls are the large
// view in the poster's window: 2400 / 1600 / 800 px wide. The tile is a
// wall (mockup 1, poster no. 04, «Yerevan»), 1400 + 700; the home ring's
// card is the flat of the same poster, whose h/w 1.41 is inside
// FloatShopCanvas's [0.68, 1.42] clamp, so it is not stretched. Every
// picture gets a NEW name (public/products is cached for a day).
//
//   node scripts/posters.mjs
// ---------------------------------------------------------------------------
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "imgss", "change5-2026-11-04", "drive", "posters");
const OUT = join(ROOT, "public", "products");
const MANIFEST = join(ROOT, "lib", "products.json");

/** poster number (her flat file's) → the mockup that shows it on the wall */
const WALL_OF = { "01": "2", "02": "3", "03": "4", "04": "1" };
/** the poster whose wall is the tile and whose flat is the ring card */
const FACE = "04";

const sha1 = (b) => createHash("sha1").update(b).digest("hex");
const hex = (v) => Math.round(v).toString(16).padStart(2, "0");
const avgOf = async (file) => {
  const { channels } = await sharp(file).stats();
  return "#" + channels.slice(0, 3).map((c) => hex(c.mean)).join("");
};

// ---- the intake, checked against its manifest ------------------------------
const intake = JSON.parse(await readFile(join(SRC, "manifest.json"), "utf8"));
const bySha = new Map(intake.files.map((f) => [f.name, f.sha1]));
async function source(name) {
  const buf = await readFile(join(SRC, name));
  const want = bySha.get(name);
  if (!want) throw new Error(`${name} is not in the intake manifest`);
  if (sha1(buf) !== want) throw new Error(`${name}: sha1 differs from the intake manifest`);
  return buf;
}
const flatName = (id) => `file/Untitled-3-${id}.jpg`;
const wallName = (n) => `mockup/${n}.jpg`;
const IDS = Object.keys(WALL_OF);

const flats = Object.fromEntries(await Promise.all(IDS.map(async (id) => [id, await source(flatName(id))])));
const walls = Object.fromEntries(await Promise.all(["1", "2", "3", "4"].map(async (n) => [n, await source(wallName(n))])));

// ---- 1. the pairing, checked against the pictures ---------------------------
// where the poster hangs: the bounding box of every pixel at which any two
// mockups differ, measured at a fifth of the size
const SCAN = 1050;
const scans = await Promise.all(
  Object.values(walls).map((b) => sharp(b).resize(SCAN).removeAlpha().raw().toBuffer({ resolveWithObject: true })),
);
const { width: sw, height: sh } = scans[0].info;
let x0 = sw, x1 = -1, y0 = sh, y1 = -1;
for (let y = 0; y < sh; y++)
  for (let x = 0; x < sw; x++) {
    const k = (y * sw + x) * 3;
    let d = 0;
    for (let a = 0; a < scans.length; a++)
      for (let b = a + 1; b < scans.length; b++) {
        const A = scans[a].data, B = scans[b].data;
        d = Math.max(d, Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]));
      }
    if (d > 60) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
const wm = await sharp(walls["1"]).metadata();
const sc = wm.width / sw;
const POSTER = {
  left: Math.round(x0 * sc),
  top: Math.round(y0 * sc),
  width: Math.round((x1 + 1 - x0) * sc),
  height: Math.round((y1 + 1 - y0) * sc),
};
console.log(`the poster hangs at x ${POSTER.left}, y ${POSTER.top}, ${POSTER.width} × ${POSTER.height} in every mockup`);

// every flat against every mockup's poster region, small and blurred a
// little so the wall's lighting and the flats' print grain do not decide it
const CMP = { width: 48, height: 68 };
const tiny = (buf, region) =>
  (region ? sharp(buf).extract(region) : sharp(buf)).resize(CMP.width, CMP.height, { fit: "fill" }).blur(1).removeAlpha().raw().toBuffer();
const flatT = Object.fromEntries(await Promise.all(IDS.map(async (id) => [id, await tiny(flats[id])])));
const wallT = Object.fromEntries(await Promise.all(Object.keys(walls).map(async (n) => [n, await tiny(walls[n], POSTER)])));
const diff = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
};
console.log("\nmean difference, flat × mockup poster region (lower = same picture):");
console.log("        " + Object.keys(walls).map((n) => `mock ${n}`.padStart(8)).join(""));
for (const id of IDS) {
  const row = Object.keys(walls).map((n) => [n, diff(flatT[id], wallT[n])]);
  const best = row.reduce((m, r) => (r[1] < m[1] ? r : m));
  console.log(`flat ${id} ` + row.map(([, d]) => d.toFixed(1).padStart(8)).join("") + `   → closest mockup ${best[0]}, table says ${WALL_OF[id]}`);
  if (best[0] !== WALL_OF[id]) throw new Error(`flat ${id}: the closest mockup is ${best[0]}, not ${WALL_OF[id]} — fix WALL_OF`);
}

// ---- 2. the posters -------------------------------------------------------------
const webp = (buf, w, q, file) =>
  sharp(buf).rotate().resize(w, null, { withoutEnlargement: true }).webp({ quality: q }).toFile(join(OUT, file));

const roll = [];
for (const id of IDS) {
  const fm = await sharp(flats[id]).metadata();
  const big = await webp(flats[id], fm.width, 82, `poster-${id}.webp`);
  const sm = await webp(flats[id], Math.min(400, fm.width), 78, `poster-${id}-sm.webp`);
  const wb = walls[WALL_OF[id]];
  const w24 = await webp(wb, 2400, 80, `poster-${id}-wall.webp`);
  const w16 = await webp(wb, 1600, 80, `poster-${id}-wall-md.webp`);
  const w08 = await webp(wb, 800, 78, `poster-${id}-wall-sm.webp`);
  roll.push({
    id,
    her: flatName(id),
    src: `/products/poster-${id}.webp`,
    thumb: `/products/poster-${id}-sm.webp`,
    w: big.width,
    h: big.height,
    thumbW: sm.width,
    alpha: false,
    avg: await avgOf(join(OUT, `poster-${id}-sm.webp`)),
    wall: {
      her: wallName(WALL_OF[id]),
      src: `/products/poster-${id}-wall.webp`,
      md: `/products/poster-${id}-wall-md.webp`,
      sm: `/products/poster-${id}-wall-sm.webp`,
      w: w24.width,
      h: w24.height,
      mdW: w16.width,
      smW: w08.width,
      avg: await avgOf(join(OUT, `poster-${id}-wall-sm.webp`)),
    },
  });
}

// ---- 3. the tile (a wall) and the ring card (a flat) -----------------------------
const tile = await webp(walls[WALL_OF[FACE]], 1400, 82, "tile-posters.webp");
const tileSm = await webp(walls[WALL_OF[FACE]], 700, 78, "tile-posters-sm.webp");
const tileAvg = await avgOf(join(OUT, "tile-posters-sm.webp"));
const ring = await sharp(flats[FACE]).rotate().resize(null, 700, { withoutEnlargement: true }).webp({ quality: 82 }).toFile(join(OUT, "ring-posters.webp"));
const ringRatio = ring.height / ring.width;
if (ringRatio > 1.42 || ringRatio < 0.68) throw new Error(`ring card h/w ${ringRatio.toFixed(3)} is outside FloatShopCanvas's [0.68, 1.42]`);

// ---- 4. the manifest -------------------------------------------------------------
const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
manifest.poster = roll;
await writeFile(MANIFEST, JSON.stringify(manifest, null, 1) + "\n");

// ---- 5. what content.ts and CatFig need, read off the written files --------------
console.log("\nposter → her files:");
for (const r of roll) console.log(`  no. ${r.id}  flat ${r.her} (${r.w}×${r.h}, sm ${r.thumbW}w)  wall ${r.wall.her} (${r.wall.w}×${r.wall.h} / ${r.wall.mdW} / ${r.wall.smW})`);
console.log("\ncontent.ts covers:");
console.log(`  posters: { src: "/products/tile-posters.webp", thumb: "/products/tile-posters-sm.webp", w: ${tile.width}, h: ${tile.height}, avg: "${tileAvg}" },`);
console.log("content.ts ring:");
console.log(`  posters: { tex: "/products/ring-posters.webp", w: ${ring.width}, h: ${ring.height} },   // h/w ${ringRatio.toFixed(3)}`);
console.log("CatFig THUMB_W:");
console.log(`  "/products/tile-posters-sm.webp": ${tileSm.width},`);
