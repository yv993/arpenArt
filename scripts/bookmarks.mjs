// ---------------------------------------------------------------------------
// BOOKMARKS → /public/products + lib/products.json (change 5.pdf p4, 2026-11-04)
//
// Her Drive folder «BookMarks» (1tdCHJ-REFNlgLG0cNbsxq7paS4HHNVbf), downloaded
// into the gitignored intake folder imgss/change5-2026-11-04/drive/bookmarks/
// with a manifest.json (name, id, bytes, sha1, px). 28 files
// «էջանշան 56-190mm-NN.jpg», printed 56×190 mm:
//   -01        THE BACK, shared by every bookmark (the reading log her p4
//              «back side» link opens: Date / Title / Rating)
//   -02 … -28  27 fronts
// plus cover/4.jpg, a styled photograph of two bookmarks on a book (the tile).
//
// THE DUPLICATE RULE (SPEC p4 default). -02/-15 and -08/-24 look alike in
// Drive's grid. The later file of a pair is dropped ONLY if the two are
// byte-identical or pixel-identical (same size, every decoded channel equal);
// "looks the same" is Arpine's call, not this script's. The test is run and
// printed on every run, so the numbers in the report are the script's own.
//
// THE NUMBERING. The kept fronts are numbered 01…NN in display order (her
// file order) — the number a buyer reads («Bookmark no. 05») and the cart's
// `art`. Her file number stays in each row as `her`, and the mapping table is
// printed, so «Bookmark no. 05» can always be traced to her -06.
//
// RUNGS. The masters are only ~662 px wide, so nothing is upscaled: the full
// file is the master's own width (q82) and the -sm is half of it (q78), which
// covers a ~150 px grid cell at 2x and a ~110 px phone cell at 3x. Every
// picture gets a NEW name (public/products is cached for a day).
//
//   node scripts/bookmarks.mjs
// ---------------------------------------------------------------------------
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "imgss", "change5-2026-11-04", "drive", "bookmarks");
const OUT = join(ROOT, "public", "products");
const MANIFEST = join(ROOT, "lib", "products.json");

const fileOf = (n) => `էջանշան 56-190mm-${n}.jpg`;
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

// ---- 1. the duplicate test --------------------------------------------------
const PAIRS = [
  ["02", "15"],
  ["08", "24"],
];
const drop = new Set();
console.log("duplicate test (drop the later file only if byte- or pixel-identical):");
for (const [a, b] of PAIRS) {
  const A = await source(fileOf(a));
  const B = await source(fileOf(b));
  const ra = await sharp(A).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rb = await sharp(B).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const bytes = A.equals(B);
  const sameSize = ra.info.width === rb.info.width && ra.info.height === rb.info.height;
  let max = null;
  let mean = null;
  if (sameSize) {
    let sum = 0;
    max = 0;
    for (let i = 0; i < ra.data.length; i++) {
      const d = Math.abs(ra.data[i] - rb.data[i]);
      if (d > max) max = d;
      sum += d;
    }
    mean = +(sum / ra.data.length).toFixed(3);
  }
  const pixels = sameSize && max === 0;
  if (bytes || pixels) drop.add(b);
  console.log(
    `  -${a} / -${b}: bytes ${bytes ? "identical" : "differ"}; ` +
      (sameSize
        ? `pixels ${pixels ? "identical" : `differ (max channel difference ${max}/255, mean ${mean})`}`
        : `sizes differ (${ra.info.width}x${ra.info.height} vs ${rb.info.width}x${rb.info.height}), so not pixel-identical`) +
      ` → ${bytes || pixels ? `-${b} DROPPED` : "both kept"}`,
  );
}

// ---- 2. the back -------------------------------------------------------------
async function rungs(buf, base) {
  const meta = await sharp(buf).metadata();
  const big = await sharp(buf).rotate().resize(meta.width, null, { withoutEnlargement: true }).webp({ quality: 82 }).toFile(join(OUT, `${base}.webp`));
  const sm = await sharp(buf).rotate().resize(Math.round(meta.width / 2), null, { withoutEnlargement: true }).webp({ quality: 78 }).toFile(join(OUT, `${base}-sm.webp`));
  return { big, sm, avg: await avgOf(join(OUT, `${base}-sm.webp`)) };
}

const back = await rungs(await source(fileOf("01")), "bookmark-back");
const backRow = {
  id: "back",
  her: "01",
  src: "/products/bookmark-back.webp",
  thumb: "/products/bookmark-back-sm.webp",
  w: back.big.width,
  h: back.big.height,
  thumbW: back.sm.width,
  alpha: false,
  avg: back.avg,
};

// ---- 3. the fronts, renumbered in display order -----------------------------
const roll = [];
const map = [];
for (let n = 2; n <= 28; n++) {
  const her = String(n).padStart(2, "0");
  if (drop.has(her)) {
    map.push([her, "— dropped (identical to its pair)"]);
    continue;
  }
  const id = String(roll.length + 1).padStart(2, "0");
  const r = await rungs(await source(fileOf(her)), `bookmark-${id}`);
  roll.push({
    id,
    her,
    src: `/products/bookmark-${id}.webp`,
    thumb: `/products/bookmark-${id}-sm.webp`,
    w: r.big.width,
    h: r.big.height,
    thumbW: r.sm.width,
    alpha: false,
    avg: r.avg,
  });
  map.push([her, id]);
}

// ---- 4. the tile (cover/4.jpg) and the ring's crop ---------------------------
const coverBuf = await source("cover/4.jpg");
const cm = await sharp(coverBuf).metadata();
const tile = await sharp(coverBuf).rotate().resize(1400, null, { withoutEnlargement: true }).webp({ quality: 82 }).toFile(join(OUT, "tile-bookmarks.webp"));
const tileSm = await sharp(coverBuf).rotate().resize(700, null, { withoutEnlargement: true }).webp({ quality: 78 }).toFile(join(OUT, "tile-bookmarks-sm.webp"));
const tileAvg = await avgOf(join(OUT, "tile-bookmarks-sm.webp"));
// THE RING CARD IS A CROP, NOT THE FLAT: FloatShopCanvas clamps a card's h/w
// to [0.68, 1.42] and STRETCHES the texture into it, so a 190/56 = 3.39
// bookmark would be squashed to 1.42. The crop takes the full height of the
// cover and the band holding both bookmarks (measured on the file: the left
// one spans x ≈ 290–760, the right one x ≈ 690–1140), at h/w ≈ 1.32.
const CROP = { left: 250, top: 0, width: 910, height: cm.height };
if (CROP.left + CROP.width > cm.width) throw new Error("ring crop runs past the cover's edge");
const ring = await sharp(coverBuf).rotate().extract(CROP).resize(null, 700, { withoutEnlargement: true }).webp({ quality: 82 }).toFile(join(OUT, "ring-bookmarks.webp"));
const ringRatio = ring.height / ring.width;
if (ringRatio > 1.42 || ringRatio < 0.68) throw new Error(`ring crop h/w ${ringRatio.toFixed(3)} is outside FloatShopCanvas's [0.68, 1.42]`);

// ---- 5. the manifest -----------------------------------------------------------
const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
manifest.bookmark = roll;
manifest.bookmarkBack = [backRow];
await writeFile(MANIFEST, JSON.stringify(manifest, null, 1) + "\n");

// ---- 6. what content.ts and CatFig need, read off the written files ----------
console.log("\nher file → our number:");
for (const [her, id] of map) console.log(`  -${her} → ${id}`);
console.log(`\n${roll.length} fronts ${roll[0].w}×${roll[0].h} (sm ${roll[0].thumbW}w); back ${backRow.w}×${backRow.h} (sm ${backRow.thumbW}w)`);
console.log("\ncontent.ts covers:");
console.log(`  bookmarks: { src: "/products/tile-bookmarks.webp", thumb: "/products/tile-bookmarks-sm.webp", w: ${tile.width}, h: ${tile.height}, avg: "${tileAvg}" },`);
console.log("content.ts ring:");
console.log(`  bookmarks: { tex: "/products/ring-bookmarks.webp", w: ${ring.width}, h: ${ring.height} },   // h/w ${ringRatio.toFixed(3)}`);
console.log("CatFig THUMB_W:");
console.log(`  "/products/tile-bookmarks-sm.webp": ${tileSm.width},`);
