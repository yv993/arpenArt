// The 2026-10-01 brief (change 3.pdf, p10) — the ABOUT photograph.
//
// «փոխենք նկարը» + her Drive file: the laptop picture goes, and the photo of
// Arpine on a balcony holding her postcards takes its place.
//
//   node scratchpad/assets-1001-about.cjs      (from the project root)
//
// Same derivatives the old picture had, so nothing downstream changes shape:
// the old pair was 1067×1600 and 467×700 — "fit inside 1600" and "fit inside
// 700" of a 2:3 frame. The new file is 3:4, so the same two rules give
// 1200×1600 and 525×700.
//
// A NEW ID (02), not an overwrite of about-01: a file that changes under an
// unchanged URL is the one case a browser or CDN copy can outlive the deploy,
// and the old picture would then sit beside a biography that no longer
// matches it.
//
// Every number the site reads (w, h, avg) is measured off the written files —
// never typed. The manifest is patched as TEXT, only the "about" block: other
// work is editing lib/products.json at the same time, and a parse → stringify
// round-trip would rewrite all of it.
const sharp = require("sharp");
const fs = require("fs");

const ROOT = "C:/Users/ysaha/Desktop/arPage";
const SRC = `${ROOT}/imgss/redesign-2026-10-01/drive/root/about-IMG_5499.jpeg`;
const OUT = `${ROOT}/public/products`;
const MANIFEST = `${ROOT}/lib/products.json`;
const ID = "02";
const hex = (v) => Math.round(v).toString(16).padStart(2, "0");

(async () => {
  // .rotate() with no angle applies the EXIF orientation and then drops the
  // tag — a phone photo that is "portrait by flag" would otherwise land
  // sideways once the metadata is stripped. (This file carries no flag; the
  // call is here so the script stays right for the next one.)
  const base = sharp(SRC).rotate();
  const big = await base
    .clone()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(`${OUT}/about-${ID}.webp`);
  const sm = await base
    .clone()
    .resize({ width: 700, height: 700, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(`${OUT}/about-${ID}-sm.webp`);

  const { channels } = await sharp(`${OUT}/about-${ID}.webp`).stats();
  const avg = "#" + channels.slice(0, 3).map((c) => hex(c.mean)).join("");

  const entry = {
    id: ID,
    src: `/products/about-${ID}.webp`,
    thumb: `/products/about-${ID}-sm.webp`,
    w: big.width,
    h: big.height,
    // the thumb's real width: the page's srcSet descriptor reads it, so a
    // phone is never told the small file is wider or narrower than it is
    thumbW: sm.width,
    alpha: false,
    avg,
  };

  // the file is indented with ONE space per level (JSON.stringify(x, null, 1)):
  // rebuild the block at the same depth so the diff is the entry and nothing else
  const block =
    ' "about": ' +
    JSON.stringify([entry], null, 1)
      .split("\n")
      .map((l, i) => (i ? " " + l : l))
      .join("\n");
  const text = fs.readFileSync(MANIFEST, "utf8");
  const re = / "about": \[[\s\S]*?\n \]/;
  if (!re.test(text)) throw new Error('no "about" block found in lib/products.json');
  const next = text.replace(re, block);
  JSON.parse(next); // refuse to write a manifest that no longer parses
  fs.writeFileSync(MANIFEST, next);

  console.log(`about-${ID}.webp     ${big.width}x${big.height} ${(big.size / 1024).toFixed(0)} KB`);
  console.log(`about-${ID}-sm.webp  ${sm.width}x${sm.height} ${(sm.size / 1024).toFixed(0)} KB`);
  console.log(`avg ${avg}`);
})();
