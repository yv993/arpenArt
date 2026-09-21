// The 2026-09-21 brief's assets (change.pdf, second round):
//   · the SUN — her own file, embedded in the PDF at 928×905 with real alpha
//   · the GLOBE set — 17 product cut-outs from her Drive folder (p3)
//   · STUDIO STORIES — 18 photographs / artworks and two TV features (p12)
// Every number the site needs (w, h, avg) is read off the files here and
// written to lib/globe.json + lib/stories.json — never typed.
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = "C:/Users/ysaha/Desktop/arPage";
const IMG = "C:/Users/ysaha/AppData/Local/Temp/claude/C--Users-ysaha-Desktop-restor/a2afe695-9191-4773-b0a9-67be56018acd/images";
const TMP = "C:/Users/ysaha/AppData/Local/Temp";
const KEEP = `${ROOT}/imgss/redesign-2026-09-21`;
const hex = (v) => Math.round(v).toString(16).padStart(2, "0");
const avgOf = async (file) => { const s = await sharp(file).stats(); const [r, g, b] = s.channels; return "#" + hex(r.mean) + hex(g.mean) + hex(b.mean); };
const srcOf = (n) => `${IMG}/${n}.${n === 3 || n === 16 ? "png" : n >= 18 && n <= 33 || n === 37 || n === 39 ? "jpg" : "webp"}`;

(async () => {
  // ---- 0. keep the originals with the brief -------------------------------
  fs.mkdirSync(`${KEEP}/globe`, { recursive: true });
  fs.mkdirSync(`${KEEP}/stories`, { recursive: true });
  for (let n = 1; n <= 17; n++) fs.copyFileSync(srcOf(n), `${KEEP}/globe/${path.basename(srcOf(n))}`);
  for (const n of [18, 19, 20, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 39]) fs.copyFileSync(srcOf(n), `${KEEP}/stories/${path.basename(srcOf(n))}`);

  // ---- 1. the sun ---------------------------------------------------------
  const sunSrc = `${KEEP}/embedded/p08-img1-928x905.png`;
  const sun = await sharp(sunSrc).trim({ threshold: 4 }).webp({ quality: 86, alphaQuality: 92 }).toFile(`${ROOT}/public/hero/sun.webp`);
  console.log(`sun.webp ${sun.width}x${sun.height} ${(sun.size / 1024).toFixed(0)} KB`);

  // ---- 2. the globe -------------------------------------------------------
  fs.mkdirSync(`${ROOT}/public/globe`, { recursive: true });
  const globe = [];
  for (let n = 1; n <= 17; n++) {
    const id = String(n).padStart(2, "0");
    const trimmed = await sharp(srcOf(n)).ensureAlpha().trim({ threshold: 6 }).png().toBuffer();
    const r = await sharp(trimmed).resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true }).webp({ quality: 84, alphaQuality: 90 }).toFile(`${ROOT}/public/globe/g-${id}.webp`);
    const avg = await avgOf(`${ROOT}/public/globe/g-${id}.webp`);
    globe.push({ id, src: `/globe/g-${id}.webp`, w: r.width, h: r.height, avg });
    console.log(`globe ${id}: ${r.width}x${r.height} ${(r.size / 1024).toFixed(0)} KB ${avg}`);
  }
  fs.writeFileSync(`${ROOT}/lib/globe.json`, JSON.stringify(globe, null, 1) + "\n");
  // are 01 and 17 the same magnet card? measure, do not guess
  const a = await sharp(`${ROOT}/public/globe/g-01.webp`).resize(200, 200, { fit: "fill" }).raw().toBuffer();
  const b = await sharp(`${ROOT}/public/globe/g-17.webp`).resize(200, 200, { fit: "fill" }).raw().toBuffer();
  let d = 0; for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]); console.log(`01 vs 17 mean abs diff ${(d / a.length).toFixed(1)}`);

  // ---- 3. the stories -----------------------------------------------------
  fs.mkdirSync(`${ROOT}/public/stories`, { recursive: true });
  const stories = [];
  for (const n of [18, 19, 20, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 39]) {
    const id = String(n).padStart(2, "0");
    const base = sharp(srcOf(n)).flatten({ background: "#0d0d0f" }).rotate();
    const big = await base.clone().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toFile(`${ROOT}/public/stories/s-${id}.webp`);
    const sm = await base.clone().resize({ width: 720, height: 720, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toFile(`${ROOT}/public/stories/s-${id}-sm.webp`);
    const avg = await avgOf(`${ROOT}/public/stories/s-${id}-sm.webp`);
    stories.push({ id, src: `/stories/s-${id}.webp`, thumb: `/stories/s-${id}-sm.webp`, w: big.width, h: big.height, avg });
    console.log(`story ${id}: ${big.width}x${big.height} ${(big.size / 1024).toFixed(0)} KB / sm ${sm.width}x${sm.height}`);
  }
  fs.writeFileSync(`${ROOT}/lib/stories.json`, JSON.stringify(stories, null, 1) + "\n");

  // ---- 4. the two TV features -------------------------------------------
  const films = [
    { src: `${TMP}/Արփինե Բարոյանի առեղծվածային աշխարհը.mp4`, out: "film-union", poster: 4 },
    { src: `${TMP}/AQOeEESSGnpbMBHaJftRN1QEbDQ07puYUdS7R6_OqSKZHn8AsXKVHhesva_1M8z_2B97_UJY4NdsEBIhjF1eXPLsDPACtLNrlACS1Q_2G-lPRw.mp4`, out: "film-tsarapatum", poster: 12 },
  ];
  for (const f of films) {
    fs.copyFileSync(f.src, `${KEEP}/stories/${f.out}-original.mp4`);
    const mp4 = `${ROOT}/public/stories/${f.out}.mp4`;
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", f.src, "-vf", "scale=960:540:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", "28", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-ac", "2", "-movflags", "+faststart", mp4]);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(f.poster), "-i", f.src, "-frames:v", "1", "-vf", "scale=960:540:flags=lanczos", "-c:v", "libwebp", "-quality", "78", `${ROOT}/public/stories/${f.out}.webp`]);
    console.log(`${f.out}.mp4 ${(fs.statSync(mp4).size / 1048576).toFixed(1)} MB`);
  }
})();
