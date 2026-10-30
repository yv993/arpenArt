// Read every piece's four sides from its alpha: tab (+1), blank (-1) or
// flat (0). Body = 305px square, a tab adds ~92px on its side.
//   node scratchpad/puzzle-edges.cjs           (run from arPage)
const sharp = require("sharp");
const fs = require("fs");
const DIR = "imgss/puzzle-2026-10-29/pieces";

(async () => {
  const out = {};
  for (const f of fs.readdirSync(DIR).filter((n) => n.endsWith(".png")).sort((a, b) => parseInt(a) - parseInt(b))) {
    const { data, info } = await sharp(`${DIR}/${f}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width;
    const H = info.height;
    const A = (x, y) => data[(y * W + x) * 4 + 3];
    const colFrac = (x, y0 = 0, y1 = H) => {
      let n = 0;
      for (let y = y0; y < y1; y++) if (A(x, y) > 128) n++;
      return n / (y1 - y0);
    };
    const rowFrac = (y, x0 = 0, x1 = W) => {
      let n = 0;
      for (let x = x0; x < x1; x++) if (A(x, y) > 128) n++;
      return n / (x1 - x0);
    };
    // the extra beyond one body, split between the two sides by which edge
    // strip is mostly empty (a tab strip is ~25% opaque, a body edge ~70%+)
    const extraX = W - 305;
    const extraY = H - 305;
    const T = 92;
    let L = 0;
    let R = 0;
    let Tp = 0;
    let B = 0;
    if (extraX > 150) {
      L = T;
      R = T;
    } else if (extraX > 50) {
      if (colFrac(10) < colFrac(W - 10)) L = T;
      else R = T;
    }
    if (extraY > 150) {
      Tp = T;
      B = T;
    } else if (extraY > 50) {
      if (rowFrac(10) < rowFrac(H - 10)) Tp = T;
      else B = T;
    }
    const bx0 = L;
    const bx1 = W - R - 1;
    const by0 = Tp;
    const by1 = H - B - 1;
    const side = (hasTab, frac) => (hasTab ? 1 : frac < 0.9 ? -1 : 0);
    const s = {
      top: side(Tp > 0, rowFrac(by0 + 4, bx0, bx1)),
      right: side(R > 0, colFrac(bx1 - 4, by0, by1)),
      bottom: side(B > 0, rowFrac(by1 - 4, bx0, bx1)),
      left: side(L > 0, colFrac(bx0 + 4, by0, by1)),
    };
    out[f] = { w: W, h: H, body: { x: bx0, y: by0, w: bx1 - bx0 + 1, h: by1 - by0 + 1 }, ...s };
    const sym = (v) => (v === 1 ? "+" : v === -1 ? "-" : "|");
    console.log(f.padEnd(7), `${W}x${H}`.padEnd(8), "body", bx0, by0, bx1 - bx0 + 1, by1 - by0 + 1, " T", sym(s.top), "R", sym(s.right), "B", sym(s.bottom), "L", sym(s.left));
  }
  fs.writeFileSync("scratchpad/puzzle-edges-match.json", JSON.stringify(out, null, 1));
})();
