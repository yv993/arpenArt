// Textures for the 3D keychain: each keychain's OWN printed illustration,
// lifted out of its own photograph.
//
// The R3F model needs the picture, not a photograph of the object holding the
// picture — mapping keychain-01.webp onto the art plane would put a photo of
// a keychain inside a keychain. The print is found the same way the ring hole
// was: by measurement, not by a hardcoded box. Saturated pixels are the print
// (chrome and clear acrylic never are), so the print's bounding box falls out
// of a saturation mask, per image, and each keeps its own true aspect ratio.
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const N = 24;
const rows = [];
for (let i = 1; i <= N; i++) {
  const id = String(i).padStart(2, "0");
  const src = `public/products/keychain-${id}.webp`;
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;

  // the print: opaque AND saturated. The 0.30 height floor keeps the chrome
  // ring and the case's top tab out of it even on a picture whose top edge
  // happens to be vivid.
  let minX = W, maxX = 0, minY = H, maxY = 0;
  for (let y = Math.round(H * 0.3); y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * C;
      if (data[o + 3] < 120) continue;
      const r = data[o], g = data[o + 1], b = data[o + 2];
      if (Math.max(r, g, b) - Math.min(r, g, b) <= 38) continue;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  // a hair inside the found edge, so no sliver of the acrylic bevel rides
  // along the texture's border
  const inset = 3;
  const left = minX + inset, top = minY + inset;
  const width = maxX - minX - inset * 2, height = maxY - minY - inset * 2;

  const out = await sharp(src)
    .extract({ left, top, width, height })
    .removeAlpha() // the print is opaque; alpha here would only cost bytes
    .resize({ width: 620, withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer();
  writeFileSync(`public/products/keychain-${id}-art.webp`, out);
  const m = await sharp(out).metadata();
  rows.push({ id, w: m.width, h: m.height, ar: +(m.width / m.height).toFixed(4) });
  process.stdout.write(`${id}:${m.width}x${m.height} `);
}
console.log("\ncut " + rows.length + " art textures");
const ars = rows.map((r) => r.ar);
console.log("aspect min/max:", Math.min(...ars), Math.max(...ars));
