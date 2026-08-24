// ---------------------------------------------------------------------------
// TOTE BAGS → /public/products + lib/products.json
//
// Arpine's 2026-08-24 drop: four designs, two photographs each, in folders
// named 1–4 with inconsistent file names (1.jpg, 1a.jpg, as.jpg, 3.jpg). The
// pairing is not in the names, it is in the PICTURES: one shot holds the bag
// up against the mountains so the printed grid can be read, the other has it
// carried on a shoulder. So the two are told apart by file size — the carried
// shots are consistently the heavier files — and then verified by eye rather
// than trusted, because a wrong pairing would put the lifestyle shot where the
// product shot belongs on every card.
//
//   node scripts/totes.mjs
// ---------------------------------------------------------------------------
import { readdir, readFile, writeFile } from "node:fs/promises";
import { stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "imgss", "drive-download-20260824T094150Z-1-001");
const OUT = join(ROOT, "public", "products");
const MANIFEST = join(ROOT, "lib", "products.json");

/** the expanded card reaches ~60% of a 1200px row, so 1400 covers retina */
const BIG = 1400;
const SM = 700;

const roll = [];
for (const folder of ["1", "2", "3", "4"]) {
  const dir = join(SRC, folder);
  const files = (await readdir(dir)).filter((f) => /\.jpe?g$/i.test(f));
  const sized = await Promise.all(files.map(async (f) => ({ f, size: (await stat(join(dir, f))).size })));
  sized.sort((a, b) => a.size - b.size);
  // lighter = the held-up product shot, heavier = the carried one
  const pair = { hold: sized[0].f, worn: sized[sized.length - 1].f };
  const id = folder.padStart(2, "0");

  for (const [kind, file] of Object.entries(pair)) {
    const buf = await readFile(join(dir, file));
    const big = await sharp(buf).resize(BIG, null, { withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    const sm = await sharp(buf).resize(SM, null, { withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    await writeFile(join(OUT, `tote-${id}-${kind}.webp`), big);
    await writeFile(join(OUT, `tote-${id}-${kind}-sm.webp`), sm);
  }

  const meta = await sharp(join(OUT, `tote-${id}-hold.webp`)).metadata();
  const { channels } = await sharp(join(OUT, `tote-${id}-hold.webp`)).stats();
  roll.push({
    id,
    src: `/products/tote-${id}-hold.webp`,
    thumb: `/products/tote-${id}-hold-sm.webp`,
    worn: `/products/tote-${id}-worn.webp`,
    wornThumb: `/products/tote-${id}-worn-sm.webp`,
    w: meta.width,
    h: meta.height,
    alpha: false,
    avg: "#" + channels.slice(0, 3).map((c) => Math.round(c.mean).toString(16).padStart(2, "0")).join(""),
  });
  console.log(`  ${id}  hold=${pair.hold}  worn=${pair.worn}`);
}

const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
manifest.toteBags = roll;
await writeFile(MANIFEST, JSON.stringify(manifest, null, 1) + "\n");
console.log(`\n${roll.length} designs → ${roll[0].w}×${roll[0].h}`);
