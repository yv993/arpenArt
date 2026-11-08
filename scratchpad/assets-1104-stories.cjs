// STORY 02's LEAD — change 5.pdf p8 (2026-11-04).
//
// «փոխենք էս նկարը էս մեկով էլ՝» + a Drive link: her studio render of the
// book «Հիշելու հեքիաթներ» (Drive 1Mgzavjqioq0WJxIDLJxnfkZzxGqedUpL,
// bc166bb6-e3f1-49f5-9241-526ba3cabad2.png, 1323×1189, no alpha) replaces the
// wooden-table photograph `tales-3844` as the lead of «FROM WORDS TO IMAGES».
//
// A NEW ID, `tales-cover`, not the old file name: /stories/* is served with
// max-age=86400 + stale-while-revalidate=604800 (next.config.mjs), so a
// picture written over s-tales-3844.webp would reach a returning visitor up
// to a day late.
//
// ONE-OFF, AND SURGICAL. It edits ONE row of lib/stories.json in place and
// leaves every other row — including the four hand-made `md` rungs — exactly
// as it is. assets-1001-stories.cjs must NOT be re-run: it rewrites the whole
// file from its own table (dropping the md rungs), deletes every s-*.webp it
// does not list, and flattens onto #0d0d0f.
//
//   node scratchpad/assets-1104-stories.cjs     (from anywhere; paths are absolute)
//
// The source is read from the gitignored intake folder, the way
// scripts/totes.mjs reads its own; its sha1 is checked against the download
// manifest so a different file cannot slip in under the same name.
//
// RUNGS, matched to the existing leads (measured on lib/stories.json, not
// assumed): base = 1600 inside, q82; -sm = 720 inside, q80; -md = 1080 wide,
// q82, only when the master is at least 1200 wide (it is: 1323), which is what
// StoriesView's phone <source> asks for. avg = the mean colour of the -sm
// file, as assets-1001 computes it. No upscaling anywhere.
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const INTAKE = path.join(ROOT, "imgss/change5-2026-11-04/drive/story-02");
const SRC_NAME = "bc166bb6-e3f1-49f5-9241-526ba3cabad2.png";
const OUT = path.join(ROOT, "public/stories");
const JSON_PATH = path.join(ROOT, "lib/stories.json");
const OLD_ID = "tales-3844";
const NEW_ID = "tales-cover";

const hex = (v) => Math.round(v).toString(16).padStart(2, "0");
const sha1 = (buf) => crypto.createHash("sha1").update(buf).digest("hex");

(async () => {
  const src = path.join(INTAKE, SRC_NAME);
  const manifest = JSON.parse(fs.readFileSync(path.join(INTAKE, "manifest.json"), "utf8"));
  const row = manifest.files.find((f) => f.name === SRC_NAME);
  if (!row) throw new Error(`${SRC_NAME} is not in the intake manifest`);
  const buf = fs.readFileSync(src);
  if (sha1(buf) !== row.sha1) throw new Error(`${SRC_NAME}: sha1 differs from the manifest`);

  const meta = await sharp(buf).metadata();
  let base = sharp(buf).rotate();
  if (meta.hasAlpha) {
    // HER OWN GROUND, never black: the mean of the outermost pixel ring.
    const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width: w, height: h, channels: c } = info;
    const sum = [0, 0, 0];
    let n = 0;
    const add = (x, y) => {
      const i = (y * w + x) * c;
      sum[0] += data[i];
      sum[1] += data[i + 1];
      sum[2] += data[i + 2];
      n++;
    };
    for (let x = 0; x < w; x++) add(x, 0), add(x, h - 1);
    for (let y = 1; y < h - 1; y++) add(0, y), add(w - 1, y);
    const edge = "#" + sum.map((s) => hex(s / n)).join("");
    console.log(`alpha found — flattened onto its own edge grey ${edge}`);
    base = base.flatten({ background: edge });
  } else {
    console.log("no alpha — nothing to flatten");
  }

  const file = (suffix) => path.join(OUT, `s-${NEW_ID}${suffix}.webp`);
  const big = await base.clone().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toFile(file(""));
  const sm = await base.clone().resize({ width: 720, height: 720, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toFile(file("-sm"));
  let md = null;
  if (meta.width >= 1200) {
    md = await base.clone().resize({ width: 1080, withoutEnlargement: true }).webp({ quality: 82 }).toFile(file("-md"));
  }
  const s = await sharp(file("-sm")).stats();
  const avg = "#" + s.channels.slice(0, 3).map((ch) => hex(ch.mean)).join("");

  const entry = {
    id: NEW_ID,
    src: `/stories/s-${NEW_ID}.webp`,
    thumb: `/stories/s-${NEW_ID}-sm.webp`,
    ...(md ? { md: `/stories/s-${NEW_ID}-md.webp` } : {}),
    w: big.width,
    h: big.height,
    avg,
  };

  // ---- lib/stories.json: replace the one row, in place ----------------------
  const list = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
  const at = list.findIndex((e) => e.id === OLD_ID || e.id === NEW_ID);
  if (at < 0) throw new Error(`neither ${OLD_ID} nor ${NEW_ID} is in lib/stories.json`);
  list[at] = entry;
  fs.writeFileSync(JSON_PATH, JSON.stringify(list, null, 1) + "\n");

  // ---- the old picture's files go ------------------------------------------
  for (const f of [`s-${OLD_ID}.webp`, `s-${OLD_ID}-sm.webp`, `s-${OLD_ID}-md.webp`]) {
    const p = path.join(OUT, f);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      console.log(`removed ${f}`);
    }
  }

  const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
  console.log(`${NEW_ID} ← ${SRC_NAME} (${meta.width}×${meta.height})`);
  console.log(`  base ${big.width}×${big.height} ${kb(big.size)}`);
  if (md) console.log(`  md   ${md.width}×${md.height} ${kb(md.size)}`);
  console.log(`  sm   ${sm.width}×${sm.height} ${kb(sm.size)}`);
  console.log(`  avg  ${avg}   ratio ${(big.width / big.height).toFixed(3)}`);
  const content = fs.readFileSync(path.join(ROOT, "lib/content.ts"), "utf8");
  console.log(content.includes(`"${NEW_ID}"`) ? `lib/content.ts lists "${NEW_ID}"` : `lib/content.ts does NOT list "${NEW_ID}" yet`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
