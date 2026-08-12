"use client";

import { useEffect, useRef, useState } from "react";

// ============================================================================
// THE ILLUSTRATION, PRINTED ONTO A CARD LYING IN A PHOTOGRAPH.
//
// The mug needed a cylinder projection and the plate needed none, because a
// mug curves away and a plate faces the camera. A postcard does neither
// reliably: in this roll a card may stand square on, lie rotated on a table,
// or recede into the frame with real perspective. So the print is defined by
// the card's FOUR CORNERS, measured off each photograph, and mapped onto them
// by a homography — the one transform that handles all three cases.
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

export default function CardPrint({
  src,
  quad,
  photo,
  occluder,
}: {
  /** the illustration to print */
  src: string;
  /** the card's corners in PHOTO pixels, clockwise from the artwork's top-left */
  quad: Quad;
  /** the photograph's own pixel size — the quad is expressed in it */
  photo: [number, number];
  /** an RGBA cut-out of whatever must stay in FRONT of the card */
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

  let transform: string | undefined;
  if (box) {
    const kx = box.w / photo[0];
    const ky = box.h / photo[1];
    // the element covers the figure, so its own corners are the source
    const srcQ: Quad = [
      [0, 0],
      [box.w, 0],
      [box.w, box.h],
      [0, box.h],
    ];
    // the card, in the same rendered pixels
    const dstQ = quad.map(([x, y]) => [x * kx, y * ky]) as Quad;
    const [a, bb, c, d, e, f, g, i, j] = homography(srcQ, dstQ);
    // CSS matrix3d is column-major, with z carried through untouched
    transform = `matrix3d(${[a, d, 0, g, bb, e, 0, i, 0, 0, 1, 0, c, f, 0, j].join(",")})`;
  }

  return (
    <>
      <img
        ref={el}
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
      {/* what belongs in front of the card — a petal, a leaf, the lip of a
          pocket — laid back over the print at the photograph's own scale */}
      {occluder && <img className="ap-cv__front" src={occluder} alt="" aria-hidden="true" decoding="async" />}
    </>
  );
}
