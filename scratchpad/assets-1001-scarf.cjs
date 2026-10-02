// «change 3.pdf» p8 (2026-10-01): «փոխենք նկարը սրանով» — the girl-and-sun
// SCARF DESIGN (scarf no. 02, the flat print) is replaced by her new file. The
// old print carried a small red figure on the hill at the upper right (the
// brief circles it); the new one does not. Same original name on her Drive
// («Копия scarf design_ 45x45-03.jpg») and the same 2659×2658 pixels as the
// file it replaces (imgss/redesign-2026-09-15/scarves/scarf design_ 45x45-03.jpg).
//
// ONE design image, TWO derived files — and nothing else on the site shows it:
//   public/products/scarf-05.webp      (1600 inside, q82)
//   public/products/scarf-05-sm.webp   ( 700 inside, q80)
// Her three photographs of this scarf (scarf-06/07/08) were already shot from
// the print WITHOUT the figure, the shop tile is design 01, the ring and the
// globe card are design 03, the home hero / OG image is the film frame, and
// art-16 is the postcard illustration (another picture) — all checked by eye
// and by a whole-image comparison over every file in /public.
//
// This mirrors `pair()` in scratchpad/redesign-assets.cjs exactly (the script
// that made the twelve-shot roll on 2026-09-15): same resize policy, same
// qualities, avg read off the small file. It does NOT write lib/products.json
// — other work is editing that manifest at the same time — it PRINTS the
// entry, so the three numbers are copied from here and never typed from memory.
//
// Run from the project root:  node scratchpad/assets-1001-scarf.cjs
const sharp = require("sharp");
const fs = require("fs");

const SRC = "imgss/redesign-2026-10-01/drive/root/hero-new.jpg";
const OUT = "public/products";
const BASE = "scarf-05";
const hex = (v) => Math.round(v).toString(16).padStart(2, "0");
const avgOf = async (file) => { const s = await sharp(file).stats(); const [r, g, b] = s.channels; return "#" + hex(r.mean) + hex(g.mean) + hex(b.mean); };

async function pair(src, base, big, small) {
  // to a buffer first, then one write each: sharp cannot read and write the
  // same path, and a half-written file must never sit where the dev server
  // can serve it
  const B = await sharp(src).resize({ width: big, height: big, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  const S = await sharp(src).resize({ width: small, height: small, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
  fs.writeFileSync(`${OUT}/${base}.webp`, B.data);
  fs.writeFileSync(`${OUT}/${base}-sm.webp`, S.data);
  const avg = await avgOf(`${OUT}/${base}-sm.webp`);
  return {
    entry: { src: `/products/${base}.webp`, thumb: `/products/${base}-sm.webp`, w: B.info.width, h: B.info.height, avg },
    small: { w: S.info.width, h: S.info.height },
    kb: { big: +(B.data.length / 1024).toFixed(0), small: +(S.data.length / 1024).toFixed(0) },
  };
}

(async () => {
  const m = await sharp(SRC).metadata();
  console.log(`source ${SRC}: ${m.width}x${m.height} ${m.space}`);
  const r = await pair(SRC, BASE, 1600, 700);
  console.log(`${BASE}.webp ${r.entry.w}x${r.entry.h} ${r.kb.big} KB · ${BASE}-sm.webp ${r.small.w}x${r.small.h} ${r.kb.small} KB`);
  console.log("products.json → scarves[id 05]:");
  console.log(JSON.stringify({ id: "05", ...r.entry, alpha: false }, null, 1));
  // The same picture is also the DESIGN's own picture: `scarfDesigns` in
  // products.json is keyed by design number (01–03), each entry a copy of that
  // design's print row, so the cart can picture "Scarf no. 02" (see
  // ownItemMedia in lib/content.ts). Design 02's print is shot 05.
  console.log("products.json → scarfDesigns[id 02]:");
  console.log(JSON.stringify({ id: "02", ...r.entry, alpha: false }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
