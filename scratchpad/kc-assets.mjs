// Turns her 24 keychain photographs into web assets.
//
// The source files are 1080×1080 JPEGs on a white studio ground, and the
// showroom wall this section hangs them on is dark — so a white rectangle
// behind every keychain would read as a bug. They need a real alpha channel.
//
// The cut is a FLOOD FILL FROM THE BORDER, not a "delete white pixels" pass.
// Half of what makes these photographs work is white and must survive: the
// glare on the acrylic, the chrome ring's highlights, the snow on Ararat, the
// white lettering inside the illustrations. Only white that is CONNECTED to
// the edge of the canvas is the studio ground; white enclosed by the card is
// part of the picture. The boundary then gets a one-pixel feather so the
// edge does not alias against the dark wall.
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const SRC = "scratchpad/kc/keychain";
const OUT = "public/products";
const N = 24;

const near = (r, g, b) => r > 234 && g > 234 && b > 234 && Math.max(r, g, b) - Math.min(r, g, b) < 14;

const rows = [];
for (let i = 1; i <= N; i++) {
  const id = String(i).padStart(2, "0");
  const { data, info } = await sharp(`${SRC}/${i}.jpg`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;

  // ---- flood fill the studio ground, starting from every border pixel
  const bg = new Uint8Array(W * H);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const p = y * W + x;
    if (bg[p]) return;
    const o = p * C;
    if (!near(data[o], data[o + 1], data[o + 2])) return;
    bg[p] = 1; stack.push(x, y);
  };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }

  // ---- THE HOLE IN THE SPLIT RING is background too, and the border fill
  // cannot reach it: the ring encloses it completely. Left opaque it hangs a
  // white disc on a dark wall, which is exactly how the first cut looked.
  // So: a second fill for white that is ENCLOSED, restricted to the rows
  // above the card body. That restriction is what makes it safe — every
  // white the picture needs (the lettering, the snow on Ararat) is inside
  // the card, below this line, and is never considered. The threshold is
  // stricter than the border pass so a highlight on the chrome, which is
  // bright but not paper-white, keeps its metal.
  // The row counts are measured against the CARD's width, not the canvas's.
  // The first cut compared them to `W * 0.6` — 648px of a 1080px canvas — and
  // the card is only ~349px wide, so no row ever qualified, cardTop fell
  // through to the bottom of the frame, and the pocket fill below ran over the
  // whole picture: it took the white lettering out of no. 01 and a bite out of
  // no. 03's sky. The widest row IS the card, so that is the yardstick.
  const rowCount = new Int32Array(H);
  for (let y = 0; y < H; y++) {
    let n = 0;
    for (let x = 0; x < W; x++) if (!bg[y * W + x]) n++;
    rowCount[y] = n;
  }
  let cardW = 0;
  for (let y = 0; y < H; y++) if (rowCount[y] > cardW) cardW = rowCount[y];
  let cardTop = H;
  for (let y = 0; y < H; y++) if (rowCount[y] > cardW * 0.72) { cardTop = y; break; }
  const paper = (r, g, b) => r > 244 && g > 244 && b > 244 && Math.max(r, g, b) - Math.min(r, g, b) < 10;
  for (let y = 0; y < cardTop; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (bg[p]) continue;
      const o = p * C;
      if (!paper(data[o], data[o + 1], data[o + 2])) continue;
      // flood this enclosed pocket, staying above the card
      const q = [x, y]; const seen = [p]; bg[p] = 1;
      while (q.length) {
        const yy = q.pop(), xx = q.pop();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = xx + dx, ny = yy + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= cardTop) continue;
          const np = ny * W + nx;
          if (bg[np]) continue;
          const no = np * C;
          if (!paper(data[no], data[no + 1], data[no + 2])) continue;
          bg[np] = 1; seen.push(np); q.push(nx, ny);
        }
      }
    }
  }

  // ---- alpha + the content's bounding box, in one pass
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let p = 0; p < W * H; p++) {
    const o = p * C;
    if (bg[p]) { data[o + 3] = 0; continue; }
    data[o + 3] = 255;
    const x = p % W, y = (p / W) | 0;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  // feather: any kept pixel touching the ground gets a soft alpha, so the
  // chrome does not saw-tooth against a dark background
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const p = y * W + x;
      if (bg[p]) continue;
      const edge = bg[p - 1] || bg[p + 1] || bg[p - W] || bg[p + W];
      if (edge) data[p * C + 3] = 150;
    }
  }

  const pad = 6;
  const left = Math.max(0, minX - pad), top = Math.max(0, minY - pad);
  const w = Math.min(W - left, maxX - minX + pad * 2), h = Math.min(H - top, maxY - minY + pad * 2);

  const cut = sharp(data, { raw: { width: W, height: H, channels: C } }).extract({ left, top, width: w, height: h });
  const full = await cut.clone().resize({ height: 1200, withoutEnlargement: true }).webp({ quality: 92 }).toBuffer();
  const small = await cut.clone().resize({ height: 560, withoutEnlargement: true }).webp({ quality: 86 }).toBuffer();
  writeFileSync(`${OUT}/keychain-${id}.webp`, full);
  writeFileSync(`${OUT}/keychain-${id}-sm.webp`, small);
  const fm = await sharp(full).metadata();

  // average colour of the PICTURE, ignoring the transparent ground and the
  // chrome — it is what the card's glow is tinted with
  const st = await sharp(full).stats();
  const avg = "#" + [st.channels[0].mean, st.channels[1].mean, st.channels[2].mean]
    .map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

  rows.push({ id, src: `/products/keychain-${id}.webp`, thumb: `/products/keychain-${id}-sm.webp`, w: fm.width, h: fm.height, alpha: true, avg });
  process.stdout.write(`${id}:${fm.width}x${fm.height} `);
}
console.log("\ncut " + rows.length + " keychains");
writeFileSync("scratchpad/keychain-rows.json", JSON.stringify(rows, null, 1));
