// change.pdf assets (2026-09-15): the five RING mockups keyed to alpha so they
// float as cut-outs like their neighbours, the nine TILE covers, and the
// twelve-shot SCARF roll (three designs × four photographs). Prints the
// manifest entries so nothing about a size or a colour is typed by hand.
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const IN = "imgss/redesign-2026-09-15";
const OUT = "public/products";
const hex = (v) => Math.round(v).toString(16).padStart(2, "0");
const avgOf = async (buf) => { const s = await sharp(buf).stats(); const [r, g, b] = s.channels; return "#" + hex(r.mean) + hex(g.mean) + hex(b.mean); };

// border-connected near-white (or already-transparent) → alpha 0
async function keyWhite(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const isBg = (i) => { const o = i * C; const r = data[o], g = data[o + 1], b = data[o + 2], a = data[o + 3]; if (a < 8) return true; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mn > 226 && mx - mn < 20; };
  const seen = new Uint8Array(W * H); const stack = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) { const i = stack.pop(); if (seen[i] || !isBg(i)) continue; seen[i] = 1; const x = i % W, y = (i - x) / W; if (x > 0) stack.push(i - 1); if (x < W - 1) stack.push(i + 1); if (y > 0) stack.push(i - W); if (y < H - 1) stack.push(i + W); }
  let n = 0; for (let i = 0; i < W * H; i++) if (seen[i]) { data[i * C + 3] = 0; n++; }
  const buf = await sharp(data, { raw: { width: W, height: H, channels: C } }).png().toBuffer();
  return { buf, keyed: +(n / (W * H)).toFixed(3) };
}

async function pair(src, base, big, small, opts = {}) {
  const b = await sharp(src).resize({ width: big, height: big, fit: "inside", withoutEnlargement: true }).webp({ quality: 82, ...opts }).toFile(`${OUT}/${base}.webp`);
  await sharp(src).resize({ width: small, height: small, fit: "inside", withoutEnlargement: true }).webp({ quality: 80, ...opts }).toFile(`${OUT}/${base}-sm.webp`);
  const avg = await avgOf(`${OUT}/${base}-sm.webp`);
  return { src: `/products/${base}.webp`, thumb: `/products/${base}-sm.webp`, w: b.width, h: b.height, avg };
}

(async () => {
  const out = { ring: {}, tiles: {}, scarves: [] };
  // ---- ring: the five the note names (t-shirt, scarf, postcard, bag, plate)
  const ring = { tshirt: "մայկա06.png", scarf: "98-scarves-mockup-01.png", postcard: "Postcard Envelope.png", tote: "totebag.png", plate: "աման.png" };
  for (const [k, f] of Object.entries(ring)) {
    const { buf, keyed } = await keyWhite(`${IN}/mockups/${f}`);
    const trimmed = await sharp(buf).trim({ threshold: 12 }).toBuffer();
    const r = await sharp(trimmed).resize({ width: 700, height: 700, fit: "inside", withoutEnlargement: true }).webp({ quality: 84, alphaQuality: 90 }).toFile(`${OUT}/ring-${k}.webp`);
    out.ring[k] = { tex: `/products/ring-${k}.webp`, w: r.width, h: r.height, keyed };
  }
  // ---- tiles: nine of the eleven lines
  const tiles = { hoodies: "t-shirt (2).jpg", scarves: "scarf.jpg", postcards: "postcard .jpg", totes: "tote bag.jpg", plates: "plate.png", cups: "cup.png", keychains: "keychain.png", magnets: "magnet.png", puzzles: "puzzle.jpg" };
  for (const [slug, f] of Object.entries(tiles)) out.tiles[slug] = await pair(`${IN}/mockups/${f}`, `tile-${slug}`, 1400, 700);
  // ---- scarves: three designs × four photographs, flat print first
  const designs = [
    ["scarf design_ 45x45-02.jpg", "02 Square Scarf.jpg", "1.jpg", "1395-v2-03-bandana-mockup.jpg"],
    ["scarf design_ 45x45-03.jpg", "02 Square Scarf (1).jpg", "2.jpg", "scarf 2 -08.jpg"],
    ["scarf design_ 45x45-01.jpg", "02s Square Scarf.jpg", "3.jpg", "IMG_5427.jpg"],
  ];
  let n = 1;
  for (const d of designs) for (const f of d) { const id = String(n++).padStart(2, "0"); const e = await pair(`${IN}/scarves/${f}`, `scarf-${id}`, 1600, 700); out.scarves.push({ id, ...e, alpha: false }); }
  fs.writeFileSync(`${IN}/manifest.json`, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out));
})().catch((e) => { console.error(e); process.exit(1); });
