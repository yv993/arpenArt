// ---------------------------------------------------------------------------
// ARMENIA ETERNAL → /public/products + lib/products.json + the page's social
// card (change 5.pdf p9 + p10, 2026-11-04)
//
// Her four Drive folders, downloaded into the gitignored intake folder
// imgss/change5-2026-11-04/drive/eternal/<group>/, each with a manifest.json
// (name, id, bytes, sha1, px):
//   postcards-1/1…8/   square cards, 92 × 92 mm, a front and a back each
//                      (+ a loose styled photograph of card 8)
//   postcards-2/1, 2, 3, «Новая папка»/   A6 cards, a front and a back each
//   runner/            5.jpg (her table photograph), erkar-01.jpg (navy),
//                      erkar2-01.jpg (white) — 2420 × 13286 each
//   scarves/           3.jpg (worn) + «Armenian 01…04» flat prints
//
// WHAT IS LEFT OUT, BY DEFAULT (SPEC p9/p10): square folder 8 — the apricot
// card «A TASTE OF ARMENIA», a different collection on its face — and the
// loose styled photograph of it. They are still classified and printed below,
// so the report shows what was skipped, and nothing of theirs is written.
//
// FRONT OR BACK IS READ OFF THE PICTURE, NEVER THE FILE NUMBER. Her numbers
// do not follow the sides (square folder 1 holds -01 and -08, folder 2 -02
// and -14; the A6 folders alternate). A back is her address layout: a white
// ground, rows of dotted writing lines and a QR code. Each file is measured
// for all three; a folder must hold exactly one back and one front, or the
// run stops. The table is printed on every run.
//
// THE IDS ARE THE CART'S `art` and name the kind: sq01–sq07 (square folders
// 1–7), a601–a604 (A6 folders 1, 2, 3, «Новая папка» — her folder order),
// sc01–sc04 (Armenian 01–04), ru01 (erkar-01, navy) and ru02 (erkar2-01,
// white). content.ts `eternalPiece` reads the kind and number from the id.
//
// RUNGS. Nothing is upscaled. Cards: the master's own width (545 square,
// 621 A6, q82) and a -sm (320 / 360, q80) — a desktop card is ~250 px, a
// phone rail card ~260 px, so 1x takes the -sm and 2x the master. Scarf
// prints: 1400 (or the master's width) and 700. The worn photograph: its own
// 765 and 480. A runner is 1:5.5, so its card is a CROP — the top 1:2 of the
// strip, her border, the vines and the first bird — at 700 and 400; the
// whole strip opens on demand at 960 and 480. Her table photograph: 1312 and
// 700, and it is the line's tile too. The home ring's card is A6 no. 01's
// front (h/w 1.409, inside FloatShopCanvas's 1.42). Every name is NEW
// (public/products is cached for a day).
//
// THE ORNAMENT is her bird, cut from the white runner (erkar2-01) where it
// stands alone between the vines: every pixel that is not her white ground,
// minus anything touching the cut's edge (the vines' leaves and pomegranates
// around it), its edge colours taken from the bird's own interior so it sits
// cleanly on the night page too. A transparent webp, 256 px tall.
//
// THE SOCIAL CARD (1200 × 630 JPEG) is her art only — no lettering is drawn:
// a band of the navy runner with three of her cards laid on it, the A6 no. 01
// (her own «Armenia Eternal» lettering) in the middle. It is written beside
// the page (app/armenia-eternal/) and imported there, so its URL is hashed.
//
//   node scripts/eternal.mjs
// ---------------------------------------------------------------------------
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "imgss", "change5-2026-11-04", "drive", "eternal");
const OUT = join(ROOT, "public", "products");
const MANIFEST = join(ROOT, "lib", "products.json");
const OG = join(ROOT, "app", "armenia-eternal", "armenia-eternal-og.jpg");

const sha1 = (b) => createHash("sha1").update(b).digest("hex");
const hex = (v) => Math.round(v).toString(16).padStart(2, "0");
const avgOf = async (file) => {
  const { channels } = await sharp(file).stats();
  return "#" + channels.slice(0, 3).map((c) => hex(c.mean)).join("");
};

// ---- the intake, checked against its manifests -----------------------------
const intake = {};
for (const g of ["postcards-1", "postcards-2", "runner", "scarves"]) {
  const m = JSON.parse(await readFile(join(SRC, g, "manifest.json"), "utf8"));
  intake[g] = new Map(m.files.map((f) => [f.name, f.sha1]));
}
async function source(group, name) {
  const buf = await readFile(join(SRC, group, name));
  const want = intake[group].get(name);
  if (!want) throw new Error(`${group}/${name} is not in the intake manifest`);
  if (sha1(buf) !== want) throw new Error(`${group}/${name}: sha1 differs from the intake manifest`);
  return buf;
}
const inFolder = (group, folder) => [...intake[group].keys()].filter((n) => n.startsWith(folder + "/")).sort();

// ---- 1. front or back: her address layout ----------------------------------
// Measured at 600 px wide (her cards are 544–622, so about their own size):
//   white    share of near-white pixels (every channel > 232, chroma < 18)
//   lines    dotted writing lines: rows where ≥ 28 short grey dashes alternate
//            with white and nothing else is drawn; adjacent rows count once
//   qr       6 × 6 blocks that are a QR code's checker: near-black AND
//            near-white pixels in one block, the black between 25% and 75%
// A back has all three (white > 0.6, lines ≥ 3, qr ≥ 8). Her square front no.
// 1 and no. 7 also stand on white, which is why white alone decides nothing.
async function address(buf) {
  const { data, info } = await sharp(buf).resize(600).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const px = (x, y) => {
    const k = (y * W + x) * 3;
    const r = data[k], g = data[k + 1], b = data[k + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return { mx, mn, chroma: mx - mn, luma: 0.299 * r + 0.587 * g + 0.114 * b };
  };
  const isWhite = (p) => p.mn > 232 && p.chroma < 18;
  const isGrey = (p) => p.chroma < 24 && p.luma > 110 && p.luma <= 228;
  const isBlack = (p) => p.chroma < 40 && p.luma < 80;

  let white = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isWhite(px(x, y))) white++;

  let lines = 0;
  let inLine = false;
  for (let y = 0; y < H; y++) {
    let dashes = 0, other = 0, run = 0;
    for (let x = 0; x < W; x++) {
      const p = px(x, y);
      if (isGrey(p)) run++;
      else {
        if (run >= 1 && run <= 8) dashes++;
        run = 0;
        if (!isWhite(p)) other++;
      }
    }
    const dotted = dashes >= 28 && other < W * 0.05;
    if (dotted && !inLine) lines++;
    inLine = dotted;
  }

  let qr = 0;
  for (let by = 0; by + 6 <= H; by += 6)
    for (let bx = 0; bx + 6 <= W; bx += 6) {
      let blk = 0, wht = 0;
      for (let y = by; y < by + 6; y++)
        for (let x = bx; x < bx + 6; x++) {
          const p = px(x, y);
          if (isBlack(p)) blk++;
          else if (isWhite(p)) wht++;
        }
      const f = blk / 36;
      if (f >= 0.25 && f <= 0.75 && blk + wht >= 30) qr++;
    }
  const share = white / (W * H);
  return { white: +share.toFixed(3), lines, qr, back: share > 0.6 && lines >= 3 && qr >= 8 };
}

async function sides(group, folder) {
  const names = inFolder(group, folder);
  if (names.length !== 2) throw new Error(`${group}/${folder}: ${names.length} files, expected a front and a back`);
  const rows = [];
  for (const n of names) rows.push({ name: n, buf: await source(group, n), ...(await address(await source(group, n))) });
  const backs = rows.filter((r) => r.back);
  if (backs.length !== 1) {
    throw new Error(`${group}/${folder}: ${backs.length} files read as a back — ${rows.map((r) => `${r.name} ${JSON.stringify({ white: r.white, lines: r.lines, qr: r.qr })}`).join(" | ")}`);
  }
  const back = backs[0];
  const front = rows.find((r) => !r.back);
  return { front, back };
}

const fmt = (r) => `white ${r.white.toFixed(2)} · lines ${String(r.lines).padStart(2)} · qr ${String(r.qr).padStart(3)}`;
const short = (n) => n.replace(/^.*\//, "").replace(/^Armenian postcard /, "");

// ---- 2. the cards -----------------------------------------------------------------
const webp = (buf, w, q, file, opts = {}) =>
  sharp(buf).rotate().resize(w, null, { withoutEnlargement: true }).webp({ quality: q, ...opts }).toFile(join(OUT, file));

const CARD = {
  sq: { group: "postcards-1", folders: ["1", "2", "3", "4", "5", "6", "7"], sm: 320 },
  a6: { group: "postcards-2", folders: ["1", "2", "3", "Новая папка"], sm: 360 },
};
const roll = [];
const mapping = [];
for (const [kind, c] of Object.entries(CARD)) {
  for (const [i, folder] of c.folders.entries()) {
    const id = `${kind}${String(i + 1).padStart(2, "0")}`;
    const { front, back } = await sides(c.group, folder);
    mapping.push({ id, folder: `${c.group}/${folder}`, front, back });
    const fm = await sharp(front.buf).metadata();
    const bm = await sharp(back.buf).metadata();
    const f = await webp(front.buf, fm.width, 82, `ae-${id}.webp`);
    const fs = await webp(front.buf, c.sm, 80, `ae-${id}-sm.webp`);
    const b = await webp(back.buf, bm.width, 82, `ae-${id}-back.webp`);
    const bs = await webp(back.buf, c.sm, 80, `ae-${id}-back-sm.webp`);
    roll.push({
      id,
      kind,
      her: `${c.group}/${front.name}`,
      src: `/products/ae-${id}.webp`,
      thumb: `/products/ae-${id}-sm.webp`,
      w: f.width,
      h: f.height,
      thumbW: fs.width,
      alpha: false,
      avg: await avgOf(join(OUT, `ae-${id}-sm.webp`)),
      back: {
        her: `${c.group}/${back.name}`,
        src: `/products/ae-${id}-back.webp`,
        thumb: `/products/ae-${id}-back-sm.webp`,
        w: b.width,
        h: b.height,
        thumbW: bs.width,
        avg: await avgOf(join(OUT, `ae-${id}-back-sm.webp`)),
      },
    });
  }
}
// square folder 8 — classified for the report, not written (see the head)
const left = await sides("postcards-1", "8");

// ---- 3. the scarves -----------------------------------------------------------------
const SCARVES = [
  "Armenian 01_Монтажная область 1.jpg",
  "Armenian 02_Монтажная область 1.jpg",
  "Armenian 03_Монтажная область 1.jpg",
  "Armenian 04-01.jpg",
];
for (const [i, name] of SCARVES.entries()) {
  const id = `sc${String(i + 1).padStart(2, "0")}`;
  const buf = await source("scarves", name);
  const big = await webp(buf, 1400, 82, `ae-${id}.webp`);
  const sm = await webp(buf, 700, 80, `ae-${id}-sm.webp`);
  roll.push({
    id,
    kind: "sc",
    her: `scarves/${name}`,
    src: `/products/ae-${id}.webp`,
    thumb: `/products/ae-${id}-sm.webp`,
    w: big.width,
    h: big.height,
    thumbW: sm.width,
    alpha: false,
    avg: await avgOf(join(OUT, `ae-${id}-sm.webp`)),
  });
}

// ---- 4. the runners: a crop for the card, the whole strip on demand -----------
const RUNNERS = ["erkar-01.jpg", "erkar2-01.jpg"];
for (const [i, name] of RUNNERS.entries()) {
  const id = `ru${String(i + 1).padStart(2, "0")}`;
  const buf = await source("runner", name);
  const m = await sharp(buf).metadata();
  // the top 1:2 of the strip: her border, the vines, the first bird
  const crop = await sharp(buf).extract({ left: 0, top: 0, width: m.width, height: m.width * 2 }).toBuffer();
  const big = await webp(crop, 700, 82, `ae-${id}.webp`);
  const sm = await webp(crop, 400, 80, `ae-${id}-sm.webp`);
  const strip = await webp(buf, 960, 80, `ae-${id}-strip.webp`);
  const stripSm = await webp(buf, 480, 78, `ae-${id}-strip-sm.webp`);
  roll.push({
    id,
    kind: "ru",
    her: `runner/${name}`,
    src: `/products/ae-${id}.webp`,
    thumb: `/products/ae-${id}-sm.webp`,
    w: big.width,
    h: big.height,
    thumbW: sm.width,
    alpha: false,
    avg: await avgOf(join(OUT, `ae-${id}-sm.webp`)),
    strip: {
      src: `/products/ae-${id}-strip.webp`,
      sm: `/products/ae-${id}-strip-sm.webp`,
      w: strip.width,
      h: strip.height,
      smW: stripSm.width,
    },
  });
}

// ---- 5. the two photographs: worn, and on the table (also the tile) -----------
const extra = [];
{
  const buf = await source("scarves", "3.jpg");
  const m = await sharp(buf).metadata();
  const big = await webp(buf, m.width, 82, "ae-worn.webp");
  const sm = await webp(buf, 480, 80, "ae-worn-sm.webp");
  extra.push({ id: "worn", her: "scarves/3.jpg", src: "/products/ae-worn.webp", thumb: "/products/ae-worn-sm.webp", w: big.width, h: big.height, thumbW: sm.width, alpha: false, avg: await avgOf(join(OUT, "ae-worn-sm.webp")) });
}
const tableBuf = await source("runner", "5.jpg");
{
  const m = await sharp(tableBuf).metadata();
  const big = await webp(tableBuf, m.width, 82, "ae-table.webp");
  const sm = await webp(tableBuf, 700, 80, "ae-table-sm.webp");
  extra.push({ id: "table", her: "runner/5.jpg", src: "/products/ae-table.webp", thumb: "/products/ae-table-sm.webp", w: big.width, h: big.height, thumbW: sm.width, alpha: false, avg: await avgOf(join(OUT, "ae-table-sm.webp")) });
}

// ---- 6. the ornament: her bird, cut from the white runner -------------------------
{
  const WIN = { left: 900, top: 1150, width: 600, height: 1150 };
  const { data, info } = await sharp(await source("runner", "erkar2-01.jpg"))
    .extract(WIN)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const N = W * H;
  const at = (i) => [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
  const ink = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const [r, g, b] = at(i);
    ink[i] = 255 - Math.min(r, g, b) > 12 ? 1 : 0;
  }
  // 8-connected parts of the drawing; a part that touches the cut's edge is
  // a neighbour (a vine leaf, a pomegranate) and leaves
  const part = new Int32Array(N).fill(-1);
  const keep = [];
  let label = 0;
  for (let s = 0; s < N; s++) {
    if (!ink[s] || part[s] !== -1) continue;
    const stack = [s];
    part[s] = label;
    let edge = false, size = 0;
    while (stack.length) {
      const i = stack.pop();
      size++;
      const x = i % W, y = (i / W) | 0;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge = true;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (ink[j] && part[j] === -1) {
            part[j] = label;
            stack.push(j);
          }
        }
    }
    if (!edge && size > 40) keep.push(label);
    label++;
  }
  const kept = new Set(keep);
  const on = (i) => ink[i] && kept.has(part[i]);
  // interior = drawn, with every pixel within 2 drawn too; an edge pixel
  // takes its colour from the nearest interior pixel and its alpha from
  // how far it is from white toward that colour
  const interior = (i) => {
    const x = i % W, y = (i / W) | 0;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || !on(ny * W + nx)) return false;
      }
    return true;
  };
  const offsets = [];
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) offsets.push([dx, dy, dx * dx + dy * dy]);
  offsets.sort((a, b) => a[2] - b[2]);
  const rgba = Buffer.alloc(N * 4);
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let i = 0; i < N; i++) {
    const x = i % W, y = (i / W) | 0;
    // the anti-aliased rim lies just outside the drawn mask: look one pixel
    // around every kept pixel as well
    let near = on(i);
    if (!near && ink[i] === 0) {
      for (let dy = -1; dy <= 1 && !near; dy++)
        for (let dx = -1; dx <= 1 && !near; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H && on(ny * W + nx)) near = true;
        }
    }
    if (!near) continue;
    const C = at(i);
    let F = null;
    if (on(i) && interior(i)) F = C;
    else
      for (const [dx, dy] of offsets) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (on(j) && interior(j)) {
          F = at(j);
          break;
        }
      }
    let a;
    if (F === C) a = 1;
    else if (F) {
      const wf = [255 - F[0], 255 - F[1], 255 - F[2]];
      const wc = [255 - C[0], 255 - C[1], 255 - C[2]];
      const den = wf[0] * wf[0] + wf[1] * wf[1] + wf[2] * wf[2];
      a = den ? Math.max(0, Math.min(1, (wc[0] * wf[0] + wc[1] * wf[1] + wc[2] * wf[2]) / den)) : 0;
    } else {
      F = C;
      a = Math.max(0, Math.min(1, (255 - Math.min(...C)) / 80));
    }
    if (a <= 0.02) continue;
    rgba[i * 4] = F[0];
    rgba[i * 4 + 1] = F[1];
    rgba[i * 4 + 2] = F[2];
    rgba[i * 4 + 3] = Math.round(a * 255);
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  const bird = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .png()
    .toBuffer();
  const out = await sharp(bird).resize(null, 256).webp({ quality: 88, alphaQuality: 100 }).toFile(join(OUT, "ae-bird.webp"));
  // the same row shape as every other picture (id, src, thumb, w, h, alpha,
  // avg): one file is its own thumb; avg is the bird over paper
  const birdAvg = await sharp(join(OUT, "ae-bird.webp")).flatten({ background: "#fcf2e6" }).stats();
  extra.push({
    id: "bird",
    her: `runner/erkar2-01.jpg (x ${WIN.left + x0}, y ${WIN.top + y0}, ${x1 - x0 + 1} × ${y1 - y0 + 1})`,
    src: "/products/ae-bird.webp",
    thumb: "/products/ae-bird.webp",
    w: out.width,
    h: out.height,
    alpha: true,
    avg: "#" + birdAvg.channels.slice(0, 3).map((c) => hex(c.mean)).join(""),
  });
  console.log(`the ornament: ${keep.length} part(s) of her bird kept, ${label - keep.length} neighbours dropped; ${x1 - x0 + 1} × ${y1 - y0 + 1} → ${out.width} × ${out.height}`);
}

// ---- 7. the home ring's card: A6 no. 01's front, whole ----------------------------
const a601 = mapping.find((m) => m.id === "a601");
const ring = await sharp(a601.front.buf).rotate().resize(null, 700, { withoutEnlargement: true }).webp({ quality: 82 }).toFile(join(OUT, "ring-armenia-eternal.webp"));
const ringRatio = ring.height / ring.width;
if (ringRatio > 1.42 || ringRatio < 0.68) throw new Error(`ring card h/w ${ringRatio.toFixed(3)} is outside FloatShopCanvas's [0.68, 1.42]`);

// ---- 8. the social card: her runner, three of her cards ---------------------------
{
  const navy = await source("runner", "erkar-01.jpg");
  // a band of the navy runner around its second bird, 1200 × 630
  const bandH = Math.round(2420 * (630 / 1200));
  const ground = await sharp(navy).extract({ left: 0, top: 4300, width: 2420, height: bandH }).resize(1200, 630).toBuffer();
  const shadowed = async (buf, h) => {
    const img = await sharp(buf).resize(null, h).toBuffer({ resolveWithObject: true });
    const { width: w } = img.info;
    const pad = 40;
    const shadow = await sharp({ create: { width: w + pad * 2, height: h + pad * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w + pad * 2}" height="${h + pad * 2}"><rect x="${pad}" y="${pad + 14}" width="${w}" height="${h}" fill="rgba(5,8,20,0.6)"/></svg>`) }])
      .blur(16)
      .png()
      .toBuffer();
    return { shadow, img: img.data, w, h, pad };
  };
  const sq05 = mapping.find((m) => m.id === "sq05").front.buf;
  const sq01 = mapping.find((m) => m.id === "sq01").front.buf;
  const L = await shadowed(sq05, 330);
  const C = await shadowed(a601.front.buf, 520);
  const R = await shadowed(sq01, 330);
  const cx = 600 - C.w / 2;
  const layers = [
    { c: L, x: Math.round(cx - L.w + 44), y: 168 },
    { c: R, x: Math.round(cx + C.w - 44), y: 132 },
    { c: C, x: Math.round(cx), y: 55 },
  ];
  await sharp(ground)
    .composite(layers.flatMap(({ c, x, y }) => [
      { input: c.shadow, left: x - c.pad, top: y - c.pad },
      { input: c.img, left: x, top: y },
    ]))
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(OG);
}

// ---- 9. the manifest -------------------------------------------------------------
const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
manifest.eternal = roll;
manifest.eternalExtra = extra;
await writeFile(MANIFEST, JSON.stringify(manifest, null, 1) + "\n");

// ---- 10. the report --------------------------------------------------------------
console.log("\nfront / back, read off the pictures (her file numbers do not decide):");
for (const m of mapping) {
  console.log(`  ${m.id}  ${m.folder.padEnd(24)} front ${short(m.front.name).padEnd(34)} ${fmt(m.front)}`);
  console.log(`  ${" ".repeat(4)}  ${" ".repeat(24)} back  ${short(m.back.name).padEnd(34)} ${fmt(m.back)}`);
}
console.log(`  LEFT OUT  postcards-1/8 (the apricot «A TASTE OF ARMENIA»): front ${short(left.front.name)}, back ${short(left.back.name)}; and the loose «Абрикосы и солнечные тени на камне.jpg»`);
console.log("\npieces (id → her file):");
for (const r of roll) console.log(`  ${r.id}  ${r.her}  ${r.w}×${r.h} (sm ${r.thumbW}w)${r.back ? `  back ${r.back.her}` : ""}${r.strip ? `  strip ${r.strip.w}×${r.strip.h} / ${r.strip.smW}w` : ""}`);
console.log("\nextra:");
for (const e of extra) console.log(`  ${e.id}  ${e.her}  ${e.w}×${e.h}`);
const tbl = extra.find((e) => e.id === "table");
console.log("\ncontent.ts covers:");
console.log(`  "armenia-eternal": { src: "${tbl.src}", thumb: "${tbl.thumb}", w: ${tbl.w}, h: ${tbl.h}, avg: "${tbl.avg}" },`);
console.log("content.ts ring:");
console.log(`  "armenia-eternal": { tex: "/products/ring-armenia-eternal.webp", w: ${ring.width}, h: ${ring.height} },   // h/w ${ringRatio.toFixed(3)}`);
console.log("CatFig THUMB_W:");
console.log(`  "${tbl.thumb}": ${tbl.thumbW},`);
console.log(`\nsocial card: ${OG.replace(ROOT, "").replace(/\\/g, "/")} (1200 × 630)`);
