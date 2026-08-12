"use client";

import { useEffect, useRef, useState } from "react";

// ============================================================================
// THE ILLUSTRATION, PRINTED ONTO THE CARDS LYING IN A PHOTOGRAPH.
//
// The mug needed a cylinder projection and the plate needed none, because a
// mug curves away and a plate faces the camera. A postcard does neither
// reliably: in this roll a card may stand square on, lie rotated on a table,
// or recede into the frame with real perspective. So each print is defined by
// a card's FOUR CORNERS, measured off the photograph, and mapped onto them by
// a homography — the one transform that handles all three cases.
//
// SEVERAL CARDS PER PHOTOGRAPH, back to front. Five scenes were styled with a
// second card beside or behind the first, and leaving those on their original
// artwork made the buyer's choice look like it had only half landed (client
// 2026-08-12). They are listed innermost first so the nearer card's print
// covers the further one exactly where the photograph has it overlapping.
//
// WHY THE SIZE IS MEASURED AND NOT ASSUMED. A homography is NOT
// scale-invariant: its perspective terms carry the width and height of the
// space they were solved in, so a matrix built in one coordinate system
// silently lands somewhere else in another. The first cut solved in percent
// and then applied `scale(100)`, which fed pixels into a matrix expecting
// units — the print rendered, reported present, and was nowhere near the
// card. The fix is to solve in the figure's CURRENT pixels and re-solve when
// that changes, which a ResizeObserver makes cheap and exact.
// ============================================================================

export type Quad = [[number, number], [number, number], [number, number], [number, number]];

/** Solve the 8x8 DLT system for the homography carrying `src` to `dst`. */
function homography(src: Quad, dst: Quad): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    b.push(v);
  }
  const n = 8;
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    [b[c], b[piv]] = [b[piv], b[c]];
    const p = A[c][c];
    if (Math.abs(p) < 1e-12) continue;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c] / p;
      if (!f) continue;
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const h = b.map((v, i) => v / A[i][i]);
  return [...h, 1]; // a b c d e f g i j
}

const len = (a: [number, number], b: [number, number]) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** THE BLEED, in the photograph's own pixels.
 *
 *  A photographed edge is not a step, it is a ramp two or three pixels wide,
 *  and a corner measured anywhere on that ramp leaves the far side of it
 *  showing. At 5x magnification that survivor is unmistakable: a hairline of
 *  the ORIGINAL card, blue down one side of the painting scene, and the
 *  client saw it as a white or black line left over from the previous
 *  picture. Printers solve this by bleeding the ink past the trim, and the
 *  same trick is exact here — the print is grown past the card by a pixel and
 *  a half, which is a quarter of a pixel on screen and cannot be seen, while
 *  the hairline it swallows could. */
const BLEED = 1.5;

/** Push every side of the quad outward by `m` and re-intersect the sides. A
 *  quad is not grown by scaling it about its centre: that moves the long
 *  sides further than the short ones and pulls the corners off the card. */
function dilate(q: Quad, m: number): Quad {
  const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4;
  const cy = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
  const lines = q.map((A, i) => {
    const B = q[(i + 1) % 4];
    let nx = -(B[1] - A[1]), ny = B[0] - A[0];
    const L = Math.hypot(nx, ny) || 1;
    nx /= L; ny /= L;
    if (nx * (cx - A[0]) + ny * (cy - A[1]) > 0) { nx = -nx; ny = -ny; }
    return { nx, ny, c: nx * A[0] + ny * A[1] + m };
  });
  return q.map((_, i) => {
    const p = lines[(i + 3) % 4], c = lines[i];
    const det = p.nx * c.ny - p.ny * c.nx;
    if (!det) return q[i];
    return [(p.c * c.ny - p.ny * c.c) / det, (p.nx * c.c - p.c * c.nx) / det];
  }) as Quad;
}

/** The card's own width:height, averaged over its two pairs of sides so a
 *  little perspective does not skew it. */
function cardAspect(q: Quad) {
  const w = (len(q[0], q[1]) + len(q[3], q[2])) / 2;
  const h = (len(q[0], q[3]) + len(q[1], q[2])) / 2;
  return w / h;
}

export default function CardPrint({
  src,
  quads,
  photo,
  art,
  occluder,
}: {
  /** the illustration to print */
  src: string;
  /** every card in the photograph, BACK TO FRONT, as corners in PHOTO pixels,
   *  clockwise from the artwork's top-left */
  quads: Quad[];
  /** the photograph's own pixel size — the quads are expressed in it */
  photo: [number, number];
  /** the illustration's own pixel size, so it is never stretched */
  art: [number, number];
  /** an RGBA cut-out of whatever must stay in FRONT of the cards */
  occluder?: string;
}) {
  const el = useRef<HTMLImageElement | null>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  // the figure's rendered size, kept current — see the note above on why the
  // matrix cannot simply be written in percentages
  useEffect(() => {
    const node = el.current?.parentElement;
    if (!node) return;
    const read = () => {
      const r = node.getBoundingClientRect();
      if (r.width && r.height) setBox({ w: r.width, h: r.height });
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const transformFor = (measured: Quad) => {
    if (!box) return undefined;
    const quad = dilate(measured, BLEED);
    const kx = box.w / photo[0];
    const ky = box.h / photo[1];
    // THE SOURCE IS A CROP, NOT THE WHOLE ELEMENT. The element covers the
    // figure and the artwork is stretched to fill it, so mapping the element's
    // own corners would squeeze the picture into whatever shape the card is.
    // On the two scenes whose card lies LANDSCAPE that meant a portrait
    // illustration stretched to 2.07x its width — a different drawing, not a
    // preview of one. Taking the largest centred piece of the artwork that
    // already has the card's proportions keeps every line the shape Arpine
    // drew it; on the nine portrait cards it crops well under a percent.
    const ca = cardAspect(quad);
    const aa = art[0] / art[1];
    const su = ca >= aa ? 1 : ca / aa;
    const sv = ca >= aa ? aa / ca : 1;
    const x0 = ((1 - su) / 2) * box.w, x1 = box.w - x0;
    const y0 = ((1 - sv) / 2) * box.h, y1 = box.h - y0;
    const srcQ: Quad = [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ];
    // the card, in the same rendered pixels
    const dstQ = quad.map(([x, y]) => [x * kx, y * ky]) as Quad;
    const [a, bb, c, d, e, f, g, i, j] = homography(srcQ, dstQ);
    // CSS matrix3d is column-major, with z carried through untouched
    return `matrix3d(${[a, d, 0, g, bb, e, 0, i, 0, 0, 1, 0, c, f, 0, j].join(",")})`;
  };

  return (
    <>
      {quads.map((quad, n) => {
        const transform = transformFor(quad);
        return (
          <img
            key={n}
            ref={n === 0 ? el : undefined}
            className="ap-cv__print ap-cv__print--card"
            src={src}
            alt=""
            aria-hidden="true"
            decoding="async"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              transformOrigin: "0 0",
              // until the figure has been measured the print stays invisible —
              // an untransformed copy would flash across the whole photograph
              transform,
              visibility: transform ? "visible" : "hidden",
            }}
          />
        );
      })}
      {/* what belongs in front of the cards — a petal, a leaf, the lip of a
          pocket — laid back over the prints at the photograph's own scale */}
      {occluder && <img className="ap-cv__front" src={occluder} alt="" aria-hidden="true" decoding="async" />}
    </>
  );
}
