// THE GLOBE'S NINE MORE (client, change 4.pdf p2, 2026-10-12: «գլոբուսիկի մեջ
// նկարներ ավելացնենք մի քանի հատ էլ, որ նոսր չլինի շատ» — add a few more
// pictures to the globe so it is not so sparse). Her Drive folder «new add»
// (imgss/redesign-2026-10-12/drive/globe/, gitignored) → ids 18–26 after the
// seventeen of 2026-09-21, THE SAME PIPELINE as scratchpad/assets-0921.cjs
// section 2: ensureAlpha → trim(threshold 6) → fit inside 640×640 without
// enlargement → webp q84 / alpha q90; w, h and avg read off the written file
// and appended to lib/globe.json — never typed. The 09-21 entries are read
// back from globe.json and kept byte-for-byte; only 18–26 are (re)written.
//
// Two departures from a plain trim, each because of what HER files are:
//  · 18.jpg / 21.jpg are product renders of a keychain on a pure white
//    ground (corners 255,255,255 measured). The 09-21 keychains (03, 06, 16)
//    arrived as real cut-outs, and the sphere discards cut-out pixels
//    (alphaTest in ParticleSphere) — a trim alone would hang each new
//    keychain in a white 350×809 slab among three that float free. So the
//    white that is CONNECTED TO THE BORDER is keyed to alpha 0 (a flood
//    from the edges, tolerance 12/255); white INSIDE the keychain — the
//    monument's spires on 18, the house's walls on 21 — is enclosed by the
//    case and never reached. The one enclosed white that IS ground is the
//    hole of the split ring (the 09-21 keychains show navy through theirs),
//    so a second, bounded pass keys near-white components that lie wholly
//    ABOVE the case — the case's top is read off the image as the first row
//    whose keychain span reaches 80% of the widest row. Both carry EXIF
//    orientation 1 today; .rotate() is kept so a re-export with a tag still
//    lands upright.
//  · «3min size .jpg» is 298×422 and stays 298×422: withoutEnlargement, as
//    in 09-21 — a small card rather than an upscaled soft one.
// The PNGs (28, 29, the T-shirt) keep their own alpha; the sticker sheets
// and the A6 postcard are printed rectangles and stay rectangles (trimmed).
//
//   node scratchpad/assets-1012-globe.cjs      (from C:/Users/ysaha/Desktop/arPage)
const sharp = require("sharp");
const fs = require("fs");

const ROOT = "C:/Users/ysaha/Desktop/arPage";
const SRC = `${ROOT}/imgss/redesign-2026-10-12/drive/globe`;
const hex = (v) => Math.round(v).toString(16).padStart(2, "0");
const avgOf = async (file) => { const s = await sharp(file).stats(); const [r, g, b] = s.channels; return "#" + hex(r.mean) + hex(g.mean) + hex(b.mean); };

/** her folder, in the order of the brief's table (SPEC.md P2) → ids 18–26 */
const NEW = [
  { id: "18", file: "18.jpg", key: true },
  { id: "19", file: "21.jpg", key: true },
  { id: "20", file: "28.png" },
  { id: "21", file: "29.png" },
  { id: "22", file: "2_sticker print _158x200 x 20-01.jpg" },
  { id: "23", file: "4_sticker print _158x200 x 20-01.jpg" },
  { id: "24", file: "3min size .jpg" },
  { id: "25", file: "A6, 350g all postcards_-07.jpg" },
  { id: "26", file: "t-shirt-white-23.png" },
];

/** alpha 0 for every near-white pixel reachable from the image border
 *  (4-connected flood); returns an RGBA buffer the same size */
async function keyWhiteFromEdges(input, tol = 12) {
  const { data, info } = await sharp(input).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const white = (i) => data[i * 4] >= 255 - tol && data[i * 4 + 1] >= 255 - tol && data[i * 4 + 2] >= 255 - tol;
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
  for (let y = 0; y < h; y++) { stack.push(y * w, y * w + w - 1); }
  let keyed = 0;
  /** flood one component from `seeds`; returns its pixels and bbox bottom */
  const flood = (seeds) => {
    const px = [];
    let bottom = -1;
    while (seeds.length) {
      const i = seeds.pop();
      if (seen[i] || !white(i)) continue;
      seen[i] = 1;
      px.push(i);
      const x = i % w;
      const y = (i - x) / w;
      if (y > bottom) bottom = y;
      if (x > 0) seeds.push(i - 1);
      if (x < w - 1) seeds.push(i + 1);
      if (i >= w) seeds.push(i - w);
      if (i < w * (h - 1)) seeds.push(i + w);
    }
    return { px, bottom };
  };
  for (const i of flood(stack).px) { data[i * 4 + 3] = 0; keyed++; }

  // the case's top: per row, the span of what is still opaque; the first row
  // whose span reaches 80% of the widest is where the case begins — above it
  // there is only the ring, and any white enclosed up there is its hole
  const span = new Int32Array(h);
  let widest = 0;
  for (let y = 0; y < h; y++) {
    let l = -1, r = -1;
    for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3]) { if (l < 0) l = x; r = x; }
    span[y] = l < 0 ? 0 : r - l + 1;
    if (span[y] > widest) widest = span[y];
  }
  let caseTop = 0;
  while (caseTop < h && span[caseTop] < widest * 0.8) caseTop++;
  let hole = 0;
  for (let y = 0; y < caseTop; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (seen[i] || !white(i)) continue;
      const c = flood([i]);
      // wholly above the case → ground seen through the ring; anything that
      // reaches the case is the product's own white and is left alone
      if (c.bottom < caseTop) for (const j of c.px) { data[j * 4 + 3] = 0; hole++; }
    }
  }
  return { buf: data, w, h, keyed, caseTop, hole };
}

(async () => {
  fs.mkdirSync(`${ROOT}/public/globe`, { recursive: true });
  const globe = JSON.parse(fs.readFileSync(`${ROOT}/lib/globe.json`, "utf8")).filter((s) => Number(s.id) <= 17);
  let bytes = 0;
  for (const n of NEW) {
    const src = `${SRC}/${n.file}`;
    let base;
    if (n.key) {
      const k = await keyWhiteFromEdges(src);
      base = sharp(k.buf, { raw: { width: k.w, height: k.h, channels: 4 } });
      console.log(`  ${n.id}: keyed ${k.keyed} border-connected white px of ${k.w * k.h}; case top at row ${k.caseTop}, ring hole ${k.hole} px`);
    } else {
      base = sharp(src).rotate().ensureAlpha();
    }
    // the same cut as 09-21: trim at threshold 6, then fit inside 640
    const trimmed = await base.trim({ threshold: 6 }).png().toBuffer();
    const out = `${ROOT}/public/globe/g-${n.id}.webp`;
    const r = await sharp(trimmed).resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true }).webp({ quality: 84, alphaQuality: 90 }).toFile(out);
    const avg = await avgOf(out);
    globe.push({ id: n.id, src: `/globe/g-${n.id}.webp`, w: r.width, h: r.height, avg });
    bytes += r.size;
    console.log(`globe ${n.id} ← ${n.file}: ${r.width}x${r.height} ${(r.size / 1024).toFixed(0)} KB ${avg}`);
  }
  fs.writeFileSync(`${ROOT}/lib/globe.json`, JSON.stringify(globe, null, 1) + "\n");
  const all = fs.readdirSync(`${ROOT}/public/globe`).filter((f) => /^g-\d\d\.webp$/.test(f));
  const total = all.reduce((s, f) => s + fs.statSync(`${ROOT}/public/globe/${f}`).size, 0);
  console.log(`new nine: ${(bytes / 1024).toFixed(0)} KB · all ${all.length} textures: ${(total / 1024).toFixed(0)} KB`);
})();
