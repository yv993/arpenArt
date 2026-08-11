"use client";

import { useEffect, useRef, useState } from "react";

// ============================================================================
// THE CART'S PLATE — a Renaissance painting behind the cart, with coins thrown
// from one hand to the other.
//
// ANATOMY, taken from shopify.com/editions/winter2026#finance ITSELF (the
// client sent a recording first; the live page is the authority and corrected
// two readings). What the live page does, at rest:
//
//   · The scene is drawn into a full-viewport <canvas>, so none of its parts
//     are in the DOM — no coin elements exist to inspect. Ours is DOM, which
//     is the right trade at this size: seven coins do not need a renderer.
//   · THE TYPE IS BEHIND THE FIGURE. "Finance" is enormous and cream, and her
//     arms, sleeves and hands pass in front of it. This is the whole look, and
//     it is why the figure below is cut out rather than left in the plate.
//   · The coins arc from the RAISED hand up over the top and down into the
//     other one, spinning about a horizontal axis so each collapses to a line
//     twice a turn, with a bright specular catch on the rim.
//   · A faint hairline web is laid over the sky — long, near-invisible
//     straight lines between points, like a diagram over a painting.
//   · Plate treatment measured off the recording: mean luminance 59.2/255,
//     dominant bin #040404 at 47.3%. Ours is built to 57.4.
//
// THE PAINTING is Botticelli's Primavera, c. 1480 (Uffizi) — public domain,
// from Wikimedia Commons, cropped to Venus, who is the only figure in it with
// two open hands far enough apart to throw between. Nothing is repainted or
// re-posed: the hands are where Botticelli put them, read off the 4926x3236
// scan. Shopify's figure is a bespoke composite; this is a real painting, used
// as it is.
//
// LAYERS, and the order is the point:
//     .ap-plate        z 0   the painting
//     .ap-sec__head    z 1   the giant title  ← in CartView, between the two
//     .ap-plate__front z 2   Venus, cut out, + the web + the coins
//     .ap-cart__grid   z 3   the line items, on opaque paper
// .ap-cart therefore must NOT set a z-index of its own: a stacking context
// there would trap its children below the front layer and Venus would be
// painted over the numbers.
//
// Two-layer contract as everywhere else: desktop + no-reduced-motion only. A
// phone, a reader who asked for less motion and a no-JS visitor keep the paper
// cart — a dark plate under ink-on-paper type is a legibility regression, not
// a decoration, on the page where money is decided.
// ============================================================================

const DESKTOP = "(min-width: 861px) and (prefers-reduced-motion: no-preference)";

/** The plate's own pixels. EVERYTHING below is written in these: the front
 *  layer is a 1600x1000 box scaled and offset to sit exactly over the drawn
 *  plate, so the figure and the coins need no per-frame screen maths at all. */
const PLATE_W = 1600;
const PLATE_H = 1000;
/** Venus's hands. A = the raised, open right hand; B = the left, on the
 *  mantle. Measured on the full-resolution scan, carried through the crop. */
const HAND_A = [620, 380];
const HAND_B = [977, 760];
/** Where the cut-out figure sits in the plate, and how big — from the same
 *  crop arithmetic (scratchpad/venus.mjs prints it). */
const FIG = { x: 567, y: 27, w: 587 };
/** The throw's control point, in plate pixels — ABOVE the top of the plate on
 *  purpose. A Bézier only travels half way to its control point, so an apex up
 *  in the sky needs the handle well outside the frame: this puts the highest
 *  coin at about (779, 135), over her shoulder, which is where the live page
 *  throws its own. Deriving it perpendicular to the chord instead (the first
 *  version) bulged the arc across her chest and the coins read as spilling
 *  down her gown rather than being thrown. */
const CTRL = [760, -300];

const COINS = 7;
/** seconds for one coin to cross */
const CROSS = 3.4;

/** THE CAMERA — measured off the live page with a ±48px search window
 *  (scratchpad/ed3.mjs). MY FIRST PASS WAS WRONG AND THE ERROR IS INSTRUCTIVE:
 *  it searched ±16px, every region pinned at exactly 16, and saturated numbers
 *  cannot tell a uniform pan from parallax. Widened, the page says:
 *
 *   · Across 1260px of cursor travel the NEAR foliage and the FAR sky move in
 *     OPPOSITE horizontal directions — treeL −36, treeR −33, leafTR −47
 *     against dress +48, cloudL +48, starTR +46. Opposed motion is not a pan
 *     at any strength; it means the camera ORBITS a pivot BETWEEN the layers.
 *   · Vertically, FAR moves MORE than near (cloud −44, star −43 against trees
 *     −30, dress −29). Translation gives near > far; rotation gives far >
 *     near. Rotation, again.
 *   · The two side trees shift vertically in OPPOSITE directions (+43 / −33) —
 *     the perspective shear a yawed plane produces at its edges.
 *   · SCROLL: leafTL +42 against leafTR −43, treeL +43 against treeR −43 —
 *     the edges CONVERGE, so the scene scales DOWN as it rises. Not a push-in;
 *     I had that backwards too. The wordmark travels at its own rate (−30,+24
 *     while the scene goes −34).
 *   · IDLE: mean |dL| 0.06–0.19 over 2.5s. The painting does not breathe, so
 *     no drift is faked onto it.
 *
 *  So the scene is REAL DEPTH under one rotating camera, not a moving picture:
 *      far   the painting        z −260   (behind the pivot)
 *      mid   Venus + the coins   z    0   (the pivot — and the coins must
 *                                          share her depth or they slide off
 *                                          the hand they are thrown from)
 *      near  the hairline web    z +140   (in front, so it counter-moves)
 *  Both fixed layers carry the SAME rotation with their own translateZ, which
 *  is arithmetically one scene: `perspective` is per-element, but both boxes
 *  are inset:0 fixed, so their perspective origins coincide exactly. */
const PERSP = 1100;
const FAR_Z = -260;
const NEAR_Z = 140;
/** a plane at z appears scaled by P/(P−z); this undoes it so each layer keeps
 *  its intended size and only its MOTION differs */
const zScale = (z: number) => (PERSP - z) / PERSP;
const YAW = 5; // deg at full cursor throw — gives ~35px of near/far opposition
const PITCH = 3.4;
const SWAY_X = 14; // the small uniform lean that rides on top of the orbit
const SWAY_Y = 8;
const EASE = 0.055; // exponential chase toward the cursor
/** covers what the orbit and the shrink would otherwise expose. MEASURED, not
 *  guessed: at 1.1 the right edge finished 14px INSIDE the viewport at full
 *  scroll and full sway, i.e. a visible strip of void. */
const OVERSCAN = 1.22;
const SHRINK = 0.05; // scroll scales the scene DOWN — measured, see above
const TURN = 1.4; // deg of rotateX across the scroll

export default function CartPlate() {
  const box = useRef<HTMLDivElement>(null);
  const far = useRef<HTMLDivElement>(null);
  const mid = useRef<HTMLDivElement>(null);
  const space = useRef<HTMLDivElement>(null);
  /** NOTHING IS RENDERED until the gate passes. Hiding the layers with CSS was
   *  not enough: a phone still fetched plate.webp, plate-sm.webp AND
   *  venus.webp — most of a megabyte of painting for a scene it never shows.
   *  Gate in one effect, build in another keyed on it; setting state and
   *  reading the refs in the same effect would read refs that do not exist
   *  yet. */
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (window.matchMedia(DESKTOP).matches) setLive(true);
  }, []);

  useEffect(() => {
    if (!live) return;
    const el = box.current;
    const farCam = far.current;
    const midCam = mid.current;
    const stage = space.current;
    if (!el || !farCam || !midCam || !stage) return;
    const webEl = stage.querySelector<SVGSVGElement>(".ap-plate__web");

    const root = document.querySelector<HTMLElement>(".ap-cart");
    root?.setAttribute("data-plate", "");
    el.dataset.on = "";

    const coins = Array.from(stage.querySelectorAll<HTMLElement>(".ap-plate__coin"));

    /** Lay the plate-space box exactly over the drawn painting. PURE MATHS,
     *  no DOM read: both layers now carry a per-frame transform, and reading
     *  a rect that includes your own transform is a feedback loop — the
     *  mapping would chase the sway it causes. The layers are inset:0 fixed,
     *  so the box IS the viewport, and cover geometry follows from that. */
    const measure = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const k = Math.max(vw / PLATE_W, vh / PLATE_H);
      const ox = (vw - PLATE_W * k) / 2;
      const oy = (vh - PLATE_H * k) / 2;
      stage.style.transform = `translate(${ox}px, ${oy}px) scale(${k})`;
    };

    // one quadratic Bézier, hand to hand, over the top — see CTRL
    const [ax, ay] = HAND_A;
    const [bx, by] = HAND_B;
    const [cx, cy] = CTRL;

    // where the cursor is, normalised to [-1, 1] from the middle of the frame
    let tx = 0, ty = 0;
    // where the camera has eased to
    let sx = 0, sy = 0;
    const onPoint = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
    };

    // how far the title's band has been scrolled away — drives the push-in
    const range = () => window.innerHeight * 0.66;

    let raf = 0;
    let t0 = 0;
    const frame = (now: number) => {
      if (!t0) t0 = now;
      const t = (now - t0) / 1000;

      // ---- the camera -------------------------------------------------
      sx += (tx - sx) * EASE;
      sy += (ty - sy) * EASE;
      const p = Math.min(1, Math.max(0, window.scrollY / range()));
      // ONE rotation, shared. The depth is what differs, and depth is what
      // makes the near foliage and the far sky move against each other.
      const rot =
        `translate3d(${(sx * SWAY_X).toFixed(2)}px, ${(sy * SWAY_Y).toFixed(2)}px, 0) ` +
        `rotateY(${(sx * YAW).toFixed(3)}deg) rotateX(${(-sy * PITCH - p * TURN).toFixed(3)}deg) ` +
        `scale(${(1 - p * SHRINK).toFixed(4)})`;
      const at = (z: number, extra = 1) =>
        `${rot} translateZ(${z}px) scale(${(zScale(z) * extra).toFixed(4)})`;
      farCam.style.transform = at(FAR_Z, OVERSCAN);
      midCam.style.transform = at(0);
      if (webEl) webEl.style.transform = `translateZ(${NEAR_Z}px) scale(${zScale(NEAR_Z).toFixed(4)})`;

      // ---- the coins --------------------------------------------------
      for (let i = 0; i < coins.length; i++) {
        const p = (t / CROSS + i / coins.length) % 1;
        const u = 1 - p;
        const x = u * u * ax + 2 * u * p * cx + p * p * bx;
        const y = u * u * ay + 2 * u * p * cy + p * p * by;
        // Spin about the horizontal axis — this is what makes a coin read as
        // a coin rather than a dot: it collapses to a line twice a turn.
        const spin = (t * 210 + i * 137) % 360;
        // nearer the eye at the top of the throw
        const near = 1 + Math.sin(Math.PI * p) * 0.22;
        // a handful of coins, not a machine: each its own size and lean
        const own = 0.78 + ((i * 37) % 11) / 22;
        // leaves the palm and arrives in the other hand rather than popping
        // into being mid-air
        const fade = Math.min(1, Math.sin(Math.PI * p) * 3.2);
        const c = coins[i];
        c.style.transform = `translate3d(${x}px, ${y}px, 0) rotateZ(${((i * 23) % 40) - 20}deg) rotateX(${spin}deg) scale(${near * own})`;
        c.style.opacity = String(fade);
      }
      raf = requestAnimationFrame(frame);
    };

    measure();
    raf = requestAnimationFrame(frame);
    const onResize = () => measure();
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("pointermove", onPoint, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPoint);
      root?.removeAttribute("data-plate");
      delete el.dataset.on;
    };
  }, [live]);

  // no markup at all off the gate — see the note beside `live`
  if (!live) return null;

  return (
    <>
      <div className="ap-plate" ref={box} aria-hidden="true">
        <div className="ap-plate__cam" ref={far}>
        <img
          className="ap-plate__img"
          src="/cart/plate.webp"
          srcSet="/cart/plate-sm.webp 800w, /cart/plate.webp 1600w"
          sizes="100vw"
          alt=""
          width={PLATE_W}
          height={PLATE_H}
          decoding="async"
        />
        </div>
      </div>

      {/* IN FRONT OF THE TITLE. Everything in here is in plate coordinates —
          the stage below is a 1600x1000 box the effect scales and offsets onto
          the painting, so a coin at (620, 380) is at Venus's raised hand at
          every window size, with no per-frame arithmetic. */}
      <div className="ap-plate__front" aria-hidden="true">
        <div className="ap-plate__cam" ref={mid}>
        <div className="ap-plate__space" ref={space}>
          {/* the hairline web the live page lays over its sky */}
          <svg className="ap-plate__web" viewBox={`0 0 ${PLATE_W} ${PLATE_H}`} width={PLATE_W} height={PLATE_H}>
            <path d="M40 210 L620 380 L1180 96 M620 380 L977 760 L1540 520 M120 660 L620 380 M977 760 L430 940 M1180 96 L1540 520" />
            <circle cx="620" cy="380" r="4" />
            <circle cx="977" cy="760" r="4" />
          </svg>

          {/* Venus, cut out, so the title passes behind her */}
          <img
            className="ap-plate__fig"
            src="/cart/venus.webp"
            alt=""
            width={660}
            height={1125}
            style={{ left: FIG.x, top: FIG.y, width: FIG.w }}
            decoding="async"
          />

          <div className="ap-plate__coins">
            {Array.from({ length: COINS }, (_, i) => (
              <span className="ap-plate__coin" key={i}>
                <i>֏</i>
              </span>
            ))}
          </div>
        </div>
        </div>
      </div>
    </>
  );
}
