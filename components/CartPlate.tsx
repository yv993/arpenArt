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
// THE PAINTING IS HERS (client, change 4.pdf p18, 2026-10-12: «նկարը փոխենք,
// կոպեկներդ նույն ձևով» — change the picture, your coins the same way). Her
// own figure in a white dress and a red cloak among green branches, right
// hand raised (drive/cart/IMG_7665.png, 1973×809), replaces Botticelli's
// Venus, who stood here from 2026-08 (that plate is kept under
// imgss/redesign-2026-10-12/verify/pages/old/). Nothing is repainted or
// re-posed: her hands are where she painted them. The three files and EVERY
// number below (FIG, HAND_A, HAND_B, the cut-out's size) come out of
// scratchpad/assets-1012-cart.cjs, read off the written files, never typed —
// verify/p15-p18/assets/numbers.json is its print-out.
//
// LAYERS, and the order is the point:
//     .ap-plate        z 0   her painting, with her figure painted out of it
//     .ap-sec__head    z 1   the giant title  ← in CartView, between the two
//     .ap-plate__front z 2   her figure, cut out, + the web + the coins
//     .ap-cart__grid   z 3   the line items, on opaque paper
// .ap-cart therefore must NOT set a z-index of its own: a stacking context
// there would trap its children below the front layer and her figure would
// be painted over the numbers.
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
/** Her hands (2026-10-12, change 4.pdf p18 — «the coins the same way», so
 *  the throw is re-anchored to HER hands). A = the MIDDLE of the raised right
 *  hand (2026-10-13: the first reading, source 657,360, sat on the hand's
 *  outer edge and the coins left from beside it); B = the lowered left hand
 *  holding the cloak, at the bottom edge of her picture. Measured on 4×
 *  gridded crops of her file (source 640,366 / 1133,767), carried through
 *  the crop by the asset script. Venus's were [620,380] / [977,760]. */
const HAND_A = [602, 452];
const HAND_B = [1212, 948];
/** Where the cut-out figure sits in the plate, and how wide — the cut-out's
 *  bbox through the same crop arithmetic (the asset script prints it). The
 *  file is 1360×1604, twice her own pixels, so the browser only ever scales
 *  it down. Her crown is at y 9: her file has no sky above her head, which
 *  is why `measure` below anchors the plate to the top of the window. */
const FIG = { x: 572, y: 9, w: 841 };
/** THE FAR PLATE, in plate pixels (the asset script prints it): her WHOLE
 *  painting at the plate's own scale — 189px of it lie left of the plate
 *  window and 651 right of it, and 190 / 110 mirrored rows stand above and
 *  below, where she painted no more. See THE FAR PLATE IS IN REGISTER. */
const FAR = { x: -189, y: -190, w: 2440, h: 1300 };
/** where her forearm meets the cloak, plate y — the lowest part of the
 *  raised arm that should stay above the cart's panel; see `measure` */
const ARM_Y = 580;
/** The throw's control point, in plate pixels — ABOVE the top of the plate on
 *  purpose. A Bézier only travels half way to its control point, so an apex up
 *  in the sky needs the handle well outside the frame. Deriving it
 *  perpendicular to the chord instead (the first version, 2026-08) bulged the
 *  arc across her chest and the coins read as spilling down her gown rather
 *  than being thrown. RE-DERIVED 2026-10-12 for her chord — Venus's handle
 *  [760,-300] was tuned to a 357×380 chord, hers is 589×503 and her lowered
 *  hand is at the foot of the frame: with (A+2C+B)/4 the highest coin now
 *  sits at about (882, 198), 247 above her raised palm (Venus's was 245
 *  above hers), just left of her hair at ear height — so the coins pass
 *  beside her face, not across it, and fall over her shoulder into the
 *  lowered hand. */
const CTRL = [840, -300];

const COINS = 7;
/** seconds for one coin to cross */
const CROSS = 3.4;
/** THE COINS MOVE WITH THE SCROLL (Vardan, 2026-10-13: «coins must move with
 *  scroll»). They kept their own slow throw whatever the page did; now the
 *  scroll drives the same throw as well: one window-height of scroll carries
 *  every coin this many crossings further along the arc — forwards scrolling
 *  down, back up the arc scrolling up — and turns them as it goes. The idle
 *  throw stays underneath it (an empty cart has nothing to scroll, and coins
 *  hung still in the air would read as a broken page). */
const SCROLL_CROSS = 1.6;
/** degrees of coin spin per pixel scrolled */
const SCROLL_SPIN = 1.1;
/** the scroll is chased, not read raw: a wheel notch is a 100px jump, and a
 *  coin that jumps is a coin that teleports */
const SCROLL_EASE = 0.14;

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
/** THE FAR PLATE IS IN REGISTER WITH THE FIGURE (2026-10-13 — Vardan, on a
 *  screenshot: «improve girl hand part»). Until then the far layer was the
 *  plate ENLARGED ×1.38 to cover what the orbit and the shrink expose, with
 *  her figure blotted to a dark silhouette so a second, bigger copy of her
 *  would not show beside the cut-out. In Botticelli's black grove the blot
 *  vanished; on her green leaves it stood beside her raised hand as a black
 *  slab and blacked out the right third of the frame. Now the far layer is
 *  her painting at ITS OWN scale, under the same stage transform as the
 *  figure, and what covers the orbit is more of her painting (FAR above),
 *  not an enlargement; her figure is painted out of it with the leaves
 *  around her. The two layers still part by a few pixels as the camera
 *  turns — that is the depth — and what shows in the gap is foliage.
 *  EDGE is how far the orbit can pull one side of the far plane inward, as
 *  a share of the window's width: the yawed plane loses ~5.7% on its far
 *  side, the shrink 2.5%, the sway a little more. */
const EDGE = 0.07;
const SHRINK = 0.05; // scroll scales the scene DOWN — measured, see above
const TURN = 1.4; // deg of rotateX across the scroll
/** HER FACE WAS UNDER THE NAV (client 2026-08-11). Venus's crown sat at y≈85
 *  against a bar that ends at 65 — the first thing a visitor met of the figure
 *  was her chin. The whole scene drops by this fraction of the viewport, in the
 *  SHARED rotation string, so the far plate and the cut-out figure move as one
 *  and the coins stay on the hand they are thrown from. 0.105 since
 *  2026-10-13 (it was 0.14 for Venus): HER crown is at plate y 9 — her file
 *  has no sky above her head — so she needs less, and every pixel given back
 *  lifts her raised hand further clear of the cart's panel. The rows this
 *  uncovers above her painting are the mirrored ones in FAR. Never less than
 *  the bar itself plus a breath (DROP_MIN), in a short window. */
const DROP = 0.105;
const DROP_MIN = 86;

export default function CartPlate() {
  const box = useRef<HTMLDivElement>(null);
  const far = useRef<HTMLDivElement>(null);
  const mid = useRef<HTMLDivElement>(null);
  const space = useRef<HTMLDivElement>(null);
  const farSpace = useRef<HTMLDivElement>(null);
  /** NOTHING IS RENDERED until the gate passes. Hiding the layers with CSS was
   *  not enough: a phone still fetched plate.webp, plate-sm.webp AND the
   *  cut-out — most of a megabyte of painting for a scene it never shows.
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
    const farStage = farSpace.current;
    if (!el || !farCam || !midCam || !stage || !farStage) return;
    const webEl = stage.querySelector<SVGSVGElement>(".ap-plate__web");

    const root = document.querySelector<HTMLElement>(".ap-cart");
    root?.setAttribute("data-plate", "");
    el.dataset.on = "";

    const coins = Array.from(stage.querySelectorAll<HTMLElement>(".ap-plate__coin"));

    const head = root?.querySelector<HTMLElement>(".ap-sec__head") ?? null;
    const word = head?.querySelector<HTMLElement>(".ap-h2") ?? null;
    /** the scene's drop under the nav, px — see DROP */
    let drop = 0;

    /** Lay the plate-space box over the window — both layers, the same
     *  transform, so the far painting and the cut-out are one picture at
     *  rest. NO read of the layers' own rects: they carry a per-frame
     *  transform, and reading a rect that includes your own transform is a
     *  feedback loop — the mapping would chase the sway it causes. What IS
     *  read is the cart's head (untransformed page layout): where the panel
     *  begins, and where the title ends. */
    const measure = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      drop = Math.max(vh * DROP, DROP_MIN);
      const cover = Math.max(vw / PLATE_W, vh / PLATE_H);
      let k = cover;
      // HER ARM STAYS ABOVE THE PANEL (2026-10-13). In a wide, short window
      // (1851×824 in the screenshot) the cover scale is set by the WIDTH, the
      // plate is far taller than the window, and the cart's panel cut her
      // raised arm off at the wrist — a hand standing on the panel's edge.
      // The far plate no longer needs the plate box to span the window (it
      // carries her painting 189px further left and 651 further right), so
      // the scene may be smaller than "cover": small enough that the place
      // her forearm meets the cloak is above the panel's top edge.
      // The panel is whichever of the cart's three states is showing (lines,
      // empty, sent); before the cart has drawn one, the foot of the head
      // stands in — it is a little above where the panel will be, so the
      // first frame errs small, never cut.
      const panel = root?.querySelector<HTMLElement>(".ap-cart__grid, .ap-cart__empty, .ap-cart__done") ?? null;
      const edgeOf = panel ? panel.getBoundingClientRect().top : head ? head.getBoundingClientRect().bottom : null;
      if (edgeOf !== null) {
        const panelTop = edgeOf + window.scrollY;
        k = Math.min(k, (panelTop - drop - 12) / ARM_Y);
      }
      // …but never so small that the painting stops covering the window: its
      // foot must stay under the window's (a short panel leaves her skirt in
      // view beside it), and its real width, less what the orbit can pull
      // in on each side, must span it.
      const edge = vw * EDGE;
      k = Math.max(k, (vh * 1.05 - drop) / PLATE_H, (vw + 2 * edge) / FAR.w);
      k = Math.min(k, cover);
      // centred when the plate is wider than the window (as it always was);
      // when it is narrower, as far towards centred as the painting's left
      // margin allows
      let ox = Math.min((vw - PLATE_W * k) / 2, -FAR.x * k - edge);
      // the title runs BEHIND her, and its last letter must clear her
      // fingertips (shop.css sizes it for that at the cover scale): a
      // smaller scene brings her hand left, so it is held off the word
      if (word) {
        const r = document.createRange();
        r.selectNodeContents(word);
        const end = r.getBoundingClientRect().right;
        const lack = end + vw * 0.012 - (ox + FIG.x * k);
        if (lack > 0) ox = Math.min(ox + lack, -FAR.x * k - edge);
      }
      // TOP-ANCHORED, NOT CENTRED (2026-10-12, change 4.pdf p18). Her file
      // has no sky above her head — the crown is at plate y 9 — so in a
      // window wider than 16:10 centring the plate pushed its excess half
      // up: at 1886×835 the crown landed above the top and her eyes under
      // the nav, the complaint of 2026-08-11 again.
      const to = `translate(${ox.toFixed(2)}px, 0px) scale(${k.toFixed(5)})`;
      stage.style.transform = to;
      farStage.style.transform = to;
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

    // the scroll as the coins see it — chased, see SCROLL_EASE
    let flow = window.scrollY;

    let raf = 0;
    let t0 = 0;
    const frame = (now: number) => {
      if (!t0) t0 = now;
      const t = (now - t0) / 1000;
      flow += (window.scrollY - flow) * SCROLL_EASE;

      // ---- the camera -------------------------------------------------
      sx += (tx - sx) * EASE;
      sy += (ty - sy) * EASE;
      const p = Math.min(1, Math.max(0, window.scrollY / range()));
      // ONE rotation, shared. The depth is what differs, and depth is what
      // makes the near foliage and the far sky move against each other.
      const rot =
        `translate3d(${(sx * SWAY_X).toFixed(2)}px, ${(sy * SWAY_Y + drop).toFixed(2)}px, 0) ` +
        `rotateY(${(sx * YAW).toFixed(3)}deg) rotateX(${(-sy * PITCH - p * TURN).toFixed(3)}deg) ` +
        `scale(${(1 - p * SHRINK).toFixed(4)})`;
      const at = (z: number) => `${rot} translateZ(${z}px) scale(${zScale(z).toFixed(4)})`;
      farCam.style.transform = at(FAR_Z);
      midCam.style.transform = at(0);
      if (webEl) webEl.style.transform = `translateZ(${NEAR_Z}px) scale(${zScale(NEAR_Z).toFixed(4)})`;

      // ---- the coins --------------------------------------------------
      // their own throw, plus the scroll's — see SCROLL_CROSS. `along` may
      // run backwards (scrolling up faster than the throw), hence the
      // double modulo.
      const along = t / CROSS + (flow / window.innerHeight) * SCROLL_CROSS;
      for (let i = 0; i < coins.length; i++) {
        const p = (((along + i / coins.length) % 1) + 1) % 1;
        const u = 1 - p;
        const x = u * u * ax + 2 * u * p * cx + p * p * bx;
        const y = u * u * ay + 2 * u * p * cy + p * p * by;
        // Spin about the horizontal axis — this is what makes a coin read as
        // a coin rather than a dot: it collapses to a line twice a turn.
        const spin = (t * 210 + flow * SCROLL_SPIN + i * 137) % 360;
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
    // the head's box moves when the display face lands, and the panel's top
    // with it; the cart's own box changes when the panel changes state
    // (empty → lines → sent) — `measure` reads the head and the panel
    const ro = "ResizeObserver" in window ? new ResizeObserver(measure) : null;
    if (ro && head) ro.observe(head);
    if (ro && root) ro.observe(root);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
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
        {/* the same plate-space box as the front layer's, under the same
            transform: her painting behind her, in register (2026-10-13) */}
        <div className="ap-plate__space" ref={farSpace}>
        <img
          className="ap-plate__img"
          src="/cart/plate.webp"
          srcSet="/cart/plate-sm.webp 1220w, /cart/plate.webp 2440w"
          sizes="160vw"
          alt=""
          width={FAR.w}
          height={FAR.h}
          style={{ left: FAR.x, top: FAR.y, width: FAR.w }}
          decoding="async"
        />
        </div>
        </div>
      </div>

      {/* IN FRONT OF THE TITLE. Everything in here is in plate coordinates —
          the stage below is a 1600x1000 box the effect scales and offsets onto
          the painting, so a coin at (602, 452) is in her raised hand at
          every window size, with no per-frame arithmetic. */}
      <div className="ap-plate__front" aria-hidden="true">
        <div className="ap-plate__cam" ref={mid}>
        <div className="ap-plate__space" ref={space}>
          {/* the hairline web the live page lays over its sky — its two
              knots are the hands (HAND_A, HAND_B), re-tied 2026-10-12 */}
          <svg className="ap-plate__web" viewBox={`0 0 ${PLATE_W} ${PLATE_H}`} width={PLATE_W} height={PLATE_H}>
            <path d={`M40 210 L${HAND_A[0]} ${HAND_A[1]} L1180 96 M${HAND_A[0]} ${HAND_A[1]} L${HAND_B[0]} ${HAND_B[1]} L1540 520 M120 660 L${HAND_A[0]} ${HAND_A[1]} M${HAND_B[0]} ${HAND_B[1]} L430 940 M1180 96 L1540 520`} />
            <circle cx={HAND_A[0]} cy={HAND_A[1]} r="4" />
            <circle cx={HAND_B[0]} cy={HAND_B[1]} r="4" />
          </svg>

          {/* her figure, cut out of her own picture (change 4.pdf p18), so
              the title passes behind her; 1360×1604 is the file's own size */}
          <img
            className="ap-plate__fig"
            src="/cart/figure.webp"
            alt=""
            width={1360}
            height={1604}
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
