// Where does each of the 18 puzzle pieces (Vardan, 2026-10-29) sit in her
// painting No. 05? Masked template matching: every piece is scaled down to
// the painting's size and slid over it; the error is counted only where the
// piece is opaque. Scale first (shared by all pieces), then a coarse search
// at quarter size, then a full-size refinement.
//   node scratchpad/puzzle-match.cjs            (run from arPage)
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ART = "public/art/art-05.webp";
const DIR = "imgss/puzzle-2026-10-29/pieces";
const OUT = "scratchpad/puzzle-match.json";

async function rgb(file, w, h) {
  const img = sharp(file).ensureAlpha();
  const r = w ? img.resize(w, h, { fit: "fill", kernel: "lanczos3" }) : img;
  const { data, info } = await r.raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

/** masked mean squared error of piece p laid at (ox, oy) over painting a */
function err(a, p, ox, oy, step = 1) {
  let s = 0;
  let n = 0;
  for (let y = 0; y < p.h; y += step) {
    const ay = oy + y;
    for (let x = 0; x < p.w; x += step) {
      const pi = (y * p.w + x) * 4;
      if (p.data[pi + 3] < 230) continue;
      const ax = ox + x;
      if (ax < 0 || ax >= a.w || ay < 0 || ay >= a.h) {
        s += 3 * 255 * 255; // off the painting costs the most
        n++;
        continue;
      }
      const ai = (ay * a.w + ax) * 4;
      const dr = a.data[ai] - p.data[pi];
      const dg = a.data[ai + 1] - p.data[pi + 1];
      const db = a.data[ai + 2] - p.data[pi + 2];
      s += dr * dr + dg * dg + db * db;
      n++;
    }
  }
  return n ? s / n : Infinity;
}

async function search(a, file, k, Q) {
  const m = await sharp(file).metadata();
  const pw = Math.max(4, Math.round(m.width / k / Q));
  const ph = Math.max(4, Math.round(m.height / k / Q));
  const p = await rgb(file, pw, ph);
  let best = { e: Infinity, x: 0, y: 0 };
  for (let oy = -ph; oy < a.h; oy++)
    for (let ox = -pw; ox < a.w; ox++) {
      const e = err(a, p, ox, oy, 2);
      if (e < best.e) best = { e, x: ox, y: oy };
    }
  return { ...best, pw, ph };
}

(async () => {
  const meta = await sharp(ART).metadata();
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".png")).sort((a, b) => parseInt(a) - parseInt(b));
  const Q = 4;
  const aQ = await rgb(ART, Math.round(meta.width / Q), Math.round(meta.height / Q));

  // 1. the scale, from three pieces with strong detail (the balloon ones)
  const probe = ["2.png", "10.png", "17.png"];
  let bestK = null;
  for (let k = 1.5; k <= 2.8; k += 0.1) {
    let tot = 0;
    for (const f of probe) tot += (await search(aQ, path.join(DIR, f), k, Q)).e;
    if (!bestK || tot < bestK.tot) bestK = { k, tot };
    console.log("k", k.toFixed(2), Math.round(tot));
  }
  // finer
  let K = bestK.k;
  for (let k = bestK.k - 0.08; k <= bestK.k + 0.081; k += 0.02) {
    let tot = 0;
    for (const f of probe) tot += (await search(aQ, path.join(DIR, f), k, Q)).e;
    if (tot < bestK.tot) bestK = { k, tot };
  }
  K = process.argv[2] ? +process.argv[2] : bestK.k;
  console.log("scale k =", K.toFixed(3), "(piece px per painting px)");

  // 2. every piece: coarse at Q, refine at full painting size
  const aF = await rgb(ART);
  const out = [];
  for (const f of files) {
    const file = path.join(DIR, f);
    const m = await sharp(file).metadata();
    const c = await search(aQ, file, K, Q);
    const pw = Math.round(m.width / K);
    const ph = Math.round(m.height / K);
    const p = await rgb(file, pw, ph);
    let best = { e: Infinity, x: 0, y: 0 };
    for (let oy = c.y * Q - 8; oy <= c.y * Q + 8; oy++)
      for (let ox = c.x * Q - 8; ox <= c.x * Q + 8; ox++) {
        const e = err(aF, p, ox, oy, 1);
        if (e < best.e) best = { e, x: ox, y: oy };
      }
    // in PIECE pixels: where the piece's top-left lands in the painting
    // scaled up by K
    out.push({ file: f, w: m.width, h: m.height, x: +(best.x * K).toFixed(1), y: +(best.y * K).toFixed(1), rmse: +Math.sqrt(best.e / 3).toFixed(1) });
    console.log(f, m.width + "x" + m.height, "at painting", best.x, best.y, "-> piece space", (best.x * K).toFixed(0), (best.y * K).toFixed(0), "rmse", Math.sqrt(best.e / 3).toFixed(1));
  }
  fs.writeFileSync(OUT, JSON.stringify({ k: K, art: ART, artW: meta.width, artH: meta.height, pieces: out }, null, 1));
})();
