"use client";

import { useEffect, useRef } from "react";

// ============================================================================
// THE PRINT, WRAPPED ON THE MUG.
//
// A flat <img> laid over the photo is a sticker: its middle and its edges are
// the same scale, so the eye reads a rectangle floating in front of a cylinder
// rather than ink on one. This draws the artwork through the projection a
// cylinder actually has.
//
// THE GEOMETRY. Take the mug as a cylinder of radius R seen head on. A point
// on its surface at angle θ from the centre line lands at
//
//     x = R · sin θ
//
// so equal steps ACROSS THE ARTWORK are not equal steps across the photo — the
// picture bunches up towards the silhouette. Sampling per destination column
// and inverting (θ = asin(x / R)) fills every pixel, where stepping through the
// source instead would leave gaps at the compressed edges.
//
// Vertical lines on a vertical-axis cylinder stay vertical and unforeshortened,
// so nothing is scaled in y. What DOES bend is the horizontal: the mug is shot
// slightly from above — its rim is a visible ellipse — so a horizontal line
// around the body dips towards the viewer at the centre. That is the `bow`.
//
// R is measured, not chosen: the mug body spans x 112–1098 of the 1578px photo,
// so R ≈ 493px, and the printable band is ±34° of arc around the front.
// ============================================================================

/** the mug body's half-width, in the photo's own pixels */
const R = 493;
/** How far the centre of a horizontal band dips below its ends, in photo px.
 *
 *  TWO of them, and the difference is the whole point. The camera sits above
 *  the mug's centre, so every horizontal circle on the body reads as an
 *  ellipse — and the further BELOW eye level a circle is, the more open that
 *  ellipse becomes. The bottom edge of the print therefore bows MORE than the
 *  top, which also makes the band taller down the middle than at its ends:
 *  correct, because the centre of a cylinder is the part nearest the camera.
 *  Read off the curve of the printed design in the original photograph. */
const BOW_TOP = 22;
const BOW_BOTTOM = 36;

export default function MugPrint({
  src,
  /** the printable area as fractions of the photo: x, y, w, h */
  box,
  /** the photo's pixel size, which is the space `box` and R are written in */
  photo,
}: {
  src: string;
  box: [number, number, number, number];
  photo: [number, number];
}) {
  const cv = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const [PW] = photo;
    const bw = Math.round(box[2] * PW);
    const bh = Math.round(box[3] * photo[1]);
    // The canvas is the printable area PLUS the room the bottom bow needs —
    // the deepest column now draws to bh + BOW_BOTTOM, and a canvas sized to
    // bh would simply clip that curve off flat again. The CSS height below
    // carries the same allowance, so the drawing is never squashed to fit.
    c.width = bw;
    c.height = bh + BOW_BOTTOM;

    let dead = false;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (dead) return;
      ctx.clearRect(0, 0, bw, bh);

      // the artwork keeps its own shape, fitted by height — the same rule the
      // flat version used, so swapping between them cannot move the picture
      const k = bh / img.height;
      const flatW = img.width * k;
      const halfArc = Math.min(0.95, flatW / 2 / R); // sin θ at the print's edge
      const cx = bw / 2;

      // walk DESTINATION columns; inverting the projection per column is what
      // keeps the compressed edges gap-free
      for (let x = 0; x < bw; x++) {
        const dx = x - cx;
        if (Math.abs(dx) > flatW / 2) continue;
        const sinT = dx / R;
        if (Math.abs(sinT) > halfArc) continue;
        const t = Math.asin(sinT) / Math.asin(halfArc); // −1 … 1 across the art
        const u = (t + 1) / 2;
        const sx = u * (img.width - 1);
        // BOTH edges dip at the centre and lift at the ends — cos θ, deepest
        // where the surface faces the camera. Writing this as `y = dip` with
        // `height = bh - dip` (the first version) moved the top and pinned the
        // BOTTOM at bh in every column: a straight edge under a curved one,
        // which is exactly what a decal looks like and what a printed band
        // does not. The two edges are placed independently now.
        const c = Math.cos((Math.PI / 2) * t);
        const top = BOW_TOP * c;
        const bottom = bh + BOW_BOTTOM * c;
        ctx.drawImage(img, sx, 0, 1, img.height, x, top, 1, bottom - top);
      }

      // the cylinder turns away from the light at its edges. The mug's own
      // shading already reads through (the canvas is composited `multiply`),
      // but the INK has to fall off too or the print stays flatly lit.
      const g = ctx.createLinearGradient(0, 0, bw, 0);
      g.addColorStop(0, "rgba(90,86,80,0.34)");
      g.addColorStop(0.18, "rgba(120,116,110,0.12)");
      g.addColorStop(0.44, "rgba(255,255,255,0)");
      g.addColorStop(0.72, "rgba(120,116,110,0.10)");
      g.addColorStop(1, "rgba(80,76,70,0.4)");
      ctx.globalCompositeOperation = "source-atop"; // only where there is ink
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, bw, bh);
      ctx.globalCompositeOperation = "source-over";
    };
    img.src = src;
    return () => {
      dead = true;
      img.onload = null;
    };
  }, [src, box, photo]);

  return (
    <canvas
      className="ap-cv__print"
      ref={cv}
      aria-hidden="true"
      style={
        {
          "--bx": `${box[0] * 100}%`,
          "--by": `${box[1] * 100}%`,
          "--bw": `${box[2] * 100}%`,
          // the same allowance the canvas takes for the bottom bow, or the
          // element's CSS box and its drawing would disagree and the whole
          // print would be squashed vertically to fit
          "--bh": `${((box[3] * photo[1] + BOW_BOTTOM) / photo[1]) * 100}%`,
        } as React.CSSProperties
      }
    />
  );
}
