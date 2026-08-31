// Magnets → web assets. The 35 PNGs arrive already cut (acrylic frame, soft
// shadow, real alpha), so unlike the keychains nothing needs lifting off a
// ground — just trim each to its content, keep the soft edge, and write the
// two webp tiers the rest of the catalogue uses. The fridge render becomes
// the section's stage.
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const rows = [];
for (let i = 1; i <= 35; i++) {
  const id = String(i).padStart(2, "0");
  const img = sharp(`scratchpad/mg/Magnet/pictures/${i}.png`).trim({ threshold: 8 });
  const full = await img.clone().resize({ height: 1000, withoutEnlargement: true }).webp({ quality: 92 }).toBuffer();
  const small = await img.clone().resize({ height: 460, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  writeFileSync(`public/products/magnet-${id}.webp`, full);
  writeFileSync(`public/products/magnet-${id}-sm.webp`, small);
  const m = await sharp(full).metadata();
  const st = await sharp(full).stats();
  const avg = "#" + [st.channels[0].mean, st.channels[1].mean, st.channels[2].mean]
    .map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  rows.push({ id, src: `/products/magnet-${id}.webp`, thumb: `/products/magnet-${id}-sm.webp`, w: m.width, h: m.height, alpha: true, avg });
  process.stdout.write(`${id}:${m.width}x${m.height} `);
}
console.log();

// the stage: her exact reference render, two widths
const fridge = sharp("scratchpad/cand-a.jpg");
await fridge.clone().resize({ width: 1500 }).webp({ quality: 84 }).toFile("public/products/fridge.webp");
await fridge.clone().resize({ width: 760 }).webp({ quality: 80 }).toFile("public/products/fridge-sm.webp");
const fm = await sharp("public/products/fridge.webp").metadata();
console.log("fridge:", fm.width + "x" + fm.height);
writeFileSync("scratchpad/magnet-rows.json", JSON.stringify(rows, null, 1));
console.log("rows:", rows.length);
