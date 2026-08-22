// ---------------------------------------------------------------------------
// STICKER SHEETS → /public/products + lib/products.json
//
// Arpine's 2026-08-19 drop: six folders under imgss/stic/, each holding one
// sticker SHEET as three pictures — the flat print file (its name carries the
// real spec: 158×200 mm, 20 stickers) and two mockup photographs. This script
// REPLACES the stickers roll wholesale: the print is the sheet's identity and
// the mockups follow it, so the roll reads sheet by sheet rather than as a
// heap of photographs.
//
//   node scripts/sticker-sheets.mjs
//
// THE SHEET NUMBER COMES FROM THE PRINT FILENAME, NOT THE FOLDER NAME. The
// folders are "Новая папка", "Новая папка (2)"… — Windows' own "New folder"
// counters, which say in which ORDER the folders were made, not which sheet
// is inside ("Новая папка" holds sheet 1 only by accident of history). The
// prints are named `1-Sticker…`, `2_sticker…`; that digit is the client's own
// numbering, so it is the one that decides both the order and the ids.
// Rule of the house since the "2 page" delivery: never trust folder names.
// ---------------------------------------------------------------------------
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "imgss", "stic");
const OUT = join(ROOT, "public", "products");
const MANIFEST = join(ROOT, "lib", "products.json");

/** the site's two tiers: 1400px masters, 700px -sm thumbs (existing pipeline) */
const BIG = 1400;
const SM = 700;

const dirs = (await readdir(SRC, { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

/** one folder → { n, print, mocks[] } read from the PRINT's filename */
const sheets = [];
for (const dir of dirs) {
  const files = await readdir(join(SRC, dir));
  const print = files.find((f) => /sticker\s*print/i.test(f));
  if (!print) {
    console.warn(`·  ${dir}: no print file — skipped`);
    continue;
  }
  const n = Number(print.match(/^(\d+)/)?.[1]);
  if (!n) {
    console.warn(`·  ${dir}: print "${print}" carries no leading number — skipped`);
    continue;
  }
  // the two mockups, in their own stable name order (Psd 1, Psd 2)
  const mocks = files.filter((f) => /^psd/i.test(f)).sort();
  sheets.push({ n, dir, print, mocks });
}
sheets.sort((a, b) => a.n - b.n);

async function encode(srcPath, id) {
  const buf = await readFile(srcPath);
  const big = await sharp(buf).resize(BIG, BIG, { fit: "inside", withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
  const sm = await sharp(buf).resize(SM, SM, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  await writeFile(join(OUT, `stickers-${id}.webp`), big);
  await writeFile(join(OUT, `stickers-${id}-sm.webp`), sm);
  const meta = await sharp(big).metadata();
  const { channels } = await sharp(big).stats();
  const avg =
    "#" + channels.slice(0, 3).map((c) => Math.round(c.mean).toString(16).padStart(2, "0")).join("");
  return {
    id,
    src: `/products/stickers-${id}.webp`,
    thumb: `/products/stickers-${id}-sm.webp`,
    w: meta.width,
    h: meta.height,
    alpha: false, // JPEG sources — nothing here is keyed out
    avg,
  };
}

const roll = [];
for (const s of sheets) {
  // print first — the sheet's identity — then its two mockups
  const files = [s.print, ...s.mocks];
  for (const f of files) {
    const id = String(roll.length + 1).padStart(2, "0");
    roll.push(await encode(join(SRC, s.dir, f), id));
    console.log(`✓  sheet ${s.n}  ${f.slice(0, 40).padEnd(40)} → stickers-${id}.webp`);
  }
}

// rewrite ONLY the stickers key; the manifest's other rolls are untouched
const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
const before = manifest.stickers.length;
manifest.stickers = roll;
await writeFile(MANIFEST, JSON.stringify(manifest, null, 1) + "\n");
console.log(`\nstickers roll: ${before} shots → ${roll.length} (${sheets.length} sheets × 3)`);

// old files past the new count would linger as orphans — say so instead of
// deleting silently
for (let i = roll.length + 1; i <= 30; i++) {
  const id = String(i).padStart(2, "0");
  try {
    await readFile(join(OUT, `stickers-${id}.webp`));
    console.warn(`!  orphan: public/products/stickers-${id}.webp is no longer in the manifest`);
  } catch {}
}
