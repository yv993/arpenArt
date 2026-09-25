// probe: colours around her head in the poster, the disc inside sun.webp,
// and how much her crown drifts between frames of the loop
const sharp = require("sharp");
const fs = require("fs");
const FR = "C:/Users/ysaha/AppData/Local/Temp/claude/C--Users-ysaha-Desktop-restor/a2afe695-9191-4773-b0a9-67be56018acd/scratchpad/frames";
const W = 1280, H = 720;
(async () => {
  const { data } = await sharp("public/hero/intro.webp").removeAlpha().resize(W, H, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => { const o = (y * W + x) * 3; return [data[o], data[o + 1], data[o + 2]]; };
  const pts = {
    crownHair: [380, 225], hairBaseBelowCrown: [380, 260], leftHairMass: [240, 420], leftStrandOuter: [175, 520], rightHairMass: [520, 400], rightHairLow: [600, 650],
    darkRedBandRight: [620, 316], darkRedBandLeft: [80, 300], orangeStripeHillLeft: [100, 275], greyHill: [300, 165], greenHill: [520, 175], purpleMountain: [620, 440],
    skinCheek: [330, 340], dressRed: [300, 650], yellowHillLeft: [60, 400], yellowHillRight: [800, 300], pinkSky: [200, 60],
  };
  for (const [k, [x, y]] of Object.entries(pts)) console.log(k.padEnd(22), x, y, px(x, y).join(","));

  // sun.webp: inscribed circle of the opaque shape (chamfer distance transform)
  const s = await sharp("public/hero/sun.webp").raw().toBuffer({ resolveWithObject: true });
  const sw = s.info.width, sh = s.info.height, C = s.info.channels;
  const a = new Uint8Array(sw * sh);
  for (let i = 0; i < sw * sh; i++) a[i] = s.data[i * C + 3] > 128 ? 1 : 0;
  const INF = 1e9; const d = new Float64Array(sw * sh).fill(INF);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) { const i = y * sw + x; if (!a[i]) { d[i] = 0; continue; } if (x === 0 || y === 0 || x === sw - 1 || y === sh - 1) { d[i] = 1; continue; }
    d[i] = Math.min(d[i], d[i - 1] + 1, d[i - sw] + 1, d[i - sw - 1] + 1.414, d[i - sw + 1] + 1.414); }
  for (let y = sh - 1; y >= 0; y--) for (let x = sw - 1; x >= 0; x--) { const i = y * sw + x; if (!a[i]) continue; if (x < sw - 1) d[i] = Math.min(d[i], d[i + 1] + 1); if (y < sh - 1) { d[i] = Math.min(d[i], d[i + sw] + 1); if (x > 0) d[i] = Math.min(d[i], d[i + sw - 1] + 1.414); if (x < sw - 1) d[i] = Math.min(d[i], d[i + sw + 1] + 1.414); } }
  let best = 0, bi = 0; for (let i = 0; i < sw * sh; i++) if (d[i] > best) { best = d[i]; bi = i; }
  console.log(`sun.webp ${sw}x${sh}: disc centre (${bi % sw}, ${Math.floor(bi / sw)}) radius ${best.toFixed(1)} → disc diameter ${(2 * best).toFixed(0)} = ${(200 * best / sw).toFixed(1)}% of the image width`);

  // crown drift: top of hair at x=370 and x=300, 440 across frames
  const isHair = (r, g, b) => { const avg = (r + g + b) / 3; if (avg < 92 && r >= b - 12) return true; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx - mn > 95 && avg < 175) { const yellowHill = r > 175 && g / r > 0.74 && b < 110; return !yellowHill; } return false; };
  const files = fs.readdirSync(FR).filter(f => f.endsWith(".png")).map(f => `${FR}/${f}`);
  const cols = [300, 370, 440, 500];
  const tops = Object.fromEntries(cols.map(c => [c, []]));
  const lefts = []; // leftmost hair pixel on row 420, rightmost on row 400
  const rights = [];
  for (const f of files) {
    const fr = await sharp(f).removeAlpha().resize(W, H, { fit: "fill" }).raw().toBuffer();
    const p = (x, y) => { const o = (y * W + x) * 3; return [fr[o], fr[o + 1], fr[o + 2]]; };
    for (const c of cols) { let run = 0, t = null; for (let y = 150; y < 470; y++) { if (isHair(...p(c, y))) { run++; if (run >= 8) { t = y - 7; break; } } else run = 0; } tops[c].push(t); }
    let l = null; for (let x = 150; x < 400; x++) { if (isHair(...p(x, 420)) && isHair(...p(x + 1, 420)) && isHair(...p(x + 2, 420)) && isHair(...p(x + 3, 420))) { l = x; break; } } lefts.push(l);
    let r = null; for (let x = 640; x > 400; x--) { if (isHair(...p(x, 400)) && isHair(...p(x - 1, 400)) && isHair(...p(x - 2, 400)) && isHair(...p(x - 3, 400))) { r = x; break; } } rights.push(r);
  }
  for (const c of cols) { const v = tops[c].filter(x => x != null).sort((a, b) => a - b); console.log(`crown x=${c}: min ${v[0]} median ${v[v.length >> 1]} max ${v[v.length - 1]}`); }
  const L = lefts.filter(x => x != null).sort((a, b) => a - b), R = rights.filter(x => x != null).sort((a, b) => a - b);
  console.log(`left hair edge on row 420: ${L[0]}..${L[L.length - 1]}; right hair edge on row 400: ${R[0]}..${R[R.length - 1]}`);
})();
