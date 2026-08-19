// ---------------------------------------------------------------------------
// STOCKIST LOGOS → webp
//
// Reads whatever the shops sent (png/jpg/jpeg/webp) out of public/stockists/
// and writes an optimised `<slug>.webp` beside it. Run it again whenever a
// logo is replaced; it is idempotent.
//
//   node scripts/stockist-logos.mjs
//
// Nothing here is required for the site to build. A shop with no file keeps
// its monogram chip, which is a designed state rather than a missing image —
// see public/stockists/README.md.
// ---------------------------------------------------------------------------
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "stockists");

/** the names the site looks for — see `logo` in lib/content.ts */
const WANTED = [
  "note-mote",
  "made-by-armenia",
  "anyutis",
  "tic-dilijan",
  "nrani",
  "crafts-of-armenia",
];

const SRC = [".png", ".jpg", ".jpeg", ".webp"];
/** Displayed at 46–60 CSS px; 2x covers every screen these cards reach. */
const BOX = 240;

const files = await readdir(DIR).catch(() => []);

let made = 0;
for (const slug of WANTED) {
  // prefer a real source over a webp we wrote on a previous run, so re-running
  // never re-encodes our own output and softens it
  const src = SRC.map((e) => `${slug}${e}`).find(
    (f) => files.includes(f) && !(f.endsWith(".webp") && files.some((g) => g !== f && g.startsWith(`${slug}.`))),
  );
  if (!src) {
    console.log(`·  ${slug.padEnd(20)} no file yet — card keeps its monogram`);
    continue;
  }

  const buf = await readFile(join(DIR, src));

  // TRIM THE DEAD MARGIN FIRST. These arrived as screenshots and social
  // avatars, so the mark occupies wildly different fractions of each file —
  // Nrani's sat in about a third of a 1080px square and rendered as a speck in
  // a 52px chip next to Note Mote, which fills its own file edge to edge. Trim
  // takes its background from the corner pixel, so it works for the white
  // files and the black one alike without being told which is which.
  // Wrapped: trim throws when an image is entirely one colour, and a logo is
  // worth shipping untrimmed rather than not at all.
  // ONLY WHITE AND BLACK MARGINS ARE PACKAGING. A COLOURED field is part of
  // the mark: Made by Armenia is orange-on-white inside an orange tile, and
  // trimming to the letters threw their tile away — which is editing someone
  // else's logo, the thing this pipeline is not allowed to do. So look at the
  // corner first and leave anything that is actually a colour alone.
  //
  // The test is NEUTRALITY, not brightness — that distinction is the whole
  // rule and it was found by measuring, not guessing. Nrani's margin is a
  // screenshot's grey rgb(229,229,229) and Made by Armenia's field is orange
  // rgb(229,115,59): identical red channel, opposite meanings. A margin that
  // is some shade of grey (or black, or white) is packaging; a margin with a
  // hue in it is a decision somebody made.
  const corner = await sharp(buf).extract({ left: 0, top: 0, width: 2, height: 2 }).raw().toBuffer();
  const [r, g, b] = corner;
  const neutral = Math.max(r, g, b) - Math.min(r, g, b) <= 12;
  const packaging = neutral && (Math.min(r, g, b) > 200 || Math.max(r, g, b) < 40);

  // REPEATEDLY, because one pass is not enough: Nrani's file is a screenshot
  // with a hairline grey rule inside its white margin, so the first trim stops
  // at the rule, the rule becomes the new corner colour, and a second pass
  // takes it and the white inside it. Loop until it stops shrinking.
  let cur = buf;
  for (let pass = 0; packaging && pass < 4; pass++) {
    try {
      const next = await sharp(cur).trim({ threshold: 12 }).toBuffer();
      const a = await sharp(cur).metadata();
      const b = await sharp(next).metadata();
      if (b.width >= a.width && b.height >= a.height) break;
      cur = next;
    } catch {
      break; // a single-colour image has nothing to trim; ship it as it is
    }
  }
  const src2 = sharp(cur);

  const out = await src2
    // CONTAIN, never cover: a retailer's mark cropped is a mark damaged. The
    // background stays transparent so the card decides what it sits on — the
    // dark-drawn mark gets a dark chip via `logoDark` instead of being
    // recoloured, which would be editing someone else's brand.
    .resize(BOX, BOX, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90 })
    .toBuffer();

  await writeFile(join(DIR, `${slug}.webp`), out);
  console.log(`✓  ${slug.padEnd(20)} ${src} → ${slug}.webp  ${(out.length / 1024).toFixed(1)} kB`);
  made++;
}

console.log(`\n${made}/${WANTED.length} logos encoded.`);
