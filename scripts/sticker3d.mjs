// ---------------------------------------------------------------------------
// 3D STICKERS → /public/products + lib/products.json
//
// Arpine's 2026-08-22 drop: 48 mockups of the domed ("3D") stickers, each on
// its airmail-bordered backing card. Every file is a 1667² frame with the card
// centred in a wide white margin — that margin is the MOCKUP's padding, not
// the product, so it is trimmed off and the card fills its own picture.
//
//   node scripts/sticker3d.mjs
//
// The trim rule is the one worked out for the stockist logos: only NEUTRAL
// margins are packaging. A corner with a hue in it is a decision somebody
// made and is left alone. Here every corner is pure white, so all 48 trim —
// but the rule stays, because the next drop may not be.
// ---------------------------------------------------------------------------
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// REPLACED 2026-08-24 with her cut-out set: same 48 designs, but on
// TRANSPARENT ground at 3334² instead of white-boxed JPEGs at 1667². The
// alpha is the whole point — the cards float in the lane now instead of
// sitting in little white rectangles — so it is preserved, not flattened.
const SRC = join(ROOT, "imgss", "drive-download-20260824T084600Z-1-001");
const OUT = join(ROOT, "public", "products");
const MANIFEST = join(ROOT, "lib", "products.json");

/** The lane renders a card at ~300×400 and magnifies the centred one to about
 *  2.4×, so 900px is the largest it is ever asked for. */
const BIG = 900;
const SM = 460;

const files = (await readdir(SRC))
  .filter((f) => /\.(png|jpe?g)$/i.test(f))
  // "3d -01.png" … "3d -48.png" — sorted NUMERICALLY, not lexically, or 10
  // lands between 1 and 2 and the whole series is shuffled. The extension is
  // matched loosely because the drops have arrived as both jpg and png.
  .sort((a, b) => Number(a.match(/(\d+)\.\w+$/)?.[1]) - Number(b.match(/(\d+)\.\w+$/)?.[1]));

async function trimmed(buf) {
  const corner = await sharp(buf).ensureAlpha().extract({ left: 0, top: 0, width: 2, height: 2 }).raw().toBuffer();
  const [r, g, b, a] = corner;
  // A TRANSPARENT corner is packaging whatever its RGB happens to be — a fully
  // clear pixel is often stored as white, sometimes as black, and neither is a
  // colour anybody chose. Only an OPAQUE corner has to argue its case, and
  // then the test is neutrality: grey/white/black is padding, a hue is a
  // decision (Made by Armenia's orange tile, see the logo pipeline).
  const neutral = Math.max(r, g, b) - Math.min(r, g, b) <= 12;
  const packaging = a < 8 || (neutral && (Math.min(r, g, b) > 200 || Math.max(r, g, b) < 40));
  if (!packaging) return buf;
  let cur = buf;
  for (let pass = 0; pass < 4; pass++) {
    try {
      const next = await sharp(cur).trim({ threshold: 12 }).toBuffer();
      const a = await sharp(cur).metadata();
      const c = await sharp(next).metadata();
      if (c.width >= a.width && c.height >= a.height) break;
      cur = next;
    } catch {
      break;
    }
  }
  return cur;
}

const roll = [];
for (const f of files) {
  const id = String(roll.length + 1).padStart(2, "0");
  const cut = await trimmed(await readFile(join(SRC, f)));

  const big = await sharp(cut).resize(BIG, BIG, { fit: "inside", withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
  const sm = await sharp(cut).resize(SM, SM, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  await writeFile(join(OUT, `sticker3d-${id}.webp`), big);
  await writeFile(join(OUT, `sticker3d-${id}-sm.webp`), sm);

  const meta = await sharp(big).metadata();
  const { channels } = await sharp(big).stats();
  roll.push({
    id,
    src: `/products/sticker3d-${id}.webp`,
    thumb: `/products/sticker3d-${id}-sm.webp`,
    w: meta.width,
    h: meta.height,
    alpha: true,
    avg: "#" + channels.slice(0, 3).map((c) => Math.round(c.mean).toString(16).padStart(2, "0")).join(""),
  });
  if (roll.length % 12 === 0) console.log(`  …${roll.length}/${files.length}`);
}

const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
manifest.sticker3d = roll;
await writeFile(MANIFEST, JSON.stringify(manifest, null, 1) + "\n");

const first = roll[0];
console.log(`\n${roll.length} encoded → ${first.w}×${first.h} (was 1667² before the trim)`);
