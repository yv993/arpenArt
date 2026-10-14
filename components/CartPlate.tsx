"use client";

import { useEffect, useRef, useState } from "react";
import { REPAINT } from "@/lib/textfx";

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
// re-posed: her hands are where she painted them. The two files and EVERY
// number below (FIG, FAR, HAND_A, HAND_B, the cut-out's size) come out of
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
 *  the crop by the asset script. Venus's were [620,380] / [977,760].
 *  THE LOWERED HAND IS BELOW THE WINDOW in every window (`measure` keeps
 *  the plate's foot under the window's, and B is 52px above that foot): the
 *  coins are seen leaving her raised hand and falling behind the cart, or
 *  out of the foot of the window — not arriving. Her hands are where she
 *  painted them. */
const HAND_A = [602, 452];
const HAND_B = [1212, 948];
/** Where the cut-out figure sits in the plate, and how wide — the cut-out's
 *  bbox through the same crop arithmetic (the asset script prints it). The
 *  file is 1376×1604, twice her own pixels, so the browser only ever scales
 *  it down. Her crown is at y 9: her file has no sky above her head, which
 *  is why `measure` below anchors the plate to the top of the window. x is
 *  563 since 2026-10-14: her fingertips were given back to the cut-out (the
 *  asset script, HER RAISED HAND), and the leftmost one is the bbox's edge.
 *  `measure` keeps the title's end clear of exactly this x. */
const FIG = { x: 563, y: 9, w: 851 };
/** THE COINS APPEAR ONCE THEY HAVE CLEARED HER FINGERS (2026-10-14 — Vardan,
 *  on a crop of her hand: «improve hand fingers»). A coin used to fade in
 *  from the middle of her palm, so for the first stretch of the throw half
 *  a coin's gold lay over her fingers — an orange smudge on the fingertips.
 *  Now it is unseen until its whole disc, at its largest, has left her hand
 *  (the asset script prints that point of the throw, COIN_CLEAR) and fades
 *  in over the next stretch, just above her fingertips: tossed from the
 *  hand, not painted on it. */
const COIN_IN = [0.065, 0.1];
/** THE FAR PLATE, in plate pixels (the asset script prints it): her WHOLE
 *  painting at the plate's own scale — 189px of it lie left of the plate
 *  window and 651 right of it. Where she painted no more it is mirrored:
 *  360 further left, 260 rows above, 110 below. See THE FAR PLATE IS IN
 *  REGISTER, and `seen` for why these margins are what they are. */
const FAR = { x: -549, y: -260, w: 2800, h: 1370 };
/** how far HER OWN painting runs left of the plate window, plate px — the
 *  mirror begins past it, and the scene leans on what she painted before it
 *  leans on the mirror (see `measure`) */
const REAL_L = 189;
/** the right edge of her face, plate px: in the ending the scene may move
 *  her right to clear the panel, never so far that her face leaves */
const FACE_R = 1100;
/** the lowest skin of her raised forearm, plate y — what should stay above
 *  the cart's panel; see `measure`. Read off the cut-out file (its row 968
 *  → 9 + 968·851/1376 = 607.7). It was 580, where the forearm's outline
 *  meets the cloak, and the last of the forearm went under the panel. */
const ARM_Y = 608;
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
/** THE SCROLL IS PAID OUT TO THE COINS, NOT READ RAW. A wheel notch is a
 *  100px jump, and Home / End, a click in the scrollbar, a focus that brings
 *  a field into view or the browser restoring a position are jumps of whole
 *  windows — and a coin that jumps is a coin that teleports. So what has
 *  been scrolled is OWED to the coins and paid out smoothly:
 *    · SCROLL_RATE  the share of the debt paid per second (an exponential
 *                   chase; 9 is what 14% a frame was at 60 frames a second —
 *                   it was per FRAME, so a 144Hz screen ran it 2.4× faster);
 *    · SCROLL_MAX   but never more than this many crossings a second, so the
 *                   fastest scroll is a quick throw, never a blur;
 *    · SCROLL_OWED  and never more than this many crossings held in debt —
 *                   a jump of several windows is forgiven beyond it, or the
 *                   coins would run on for seconds after the page stopped.
 *  And a turn of the wheel THE OTHER WAY cancels what was still owed: the
 *  coins answer the hand at once, they do not finish the last gesture first.
 *  (So «one window = SCROLL_CROSS crossings» is exact for a scroll slower
 *  than SCROLL_MAX — three quarters of a window a second — and a faster one
 *  is a little less than its due.) */
const SCROLL_RATE = 9;
const SCROLL_MAX = 1.2;
const SCROLL_OWED = 0.6;

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
/** THE YAW STOPS GROWING PAST 1920 (2026-10-13). What the turned plane
 *  exposes at its far side grows with the window (`seen`), and in windows
 *  wider than about 2.6:1 — a browser maximised on a 21:9 or 32:9 screen —
 *  covering it outranked her arm and the panel cut it again. Past this width
 *  the pointer's throw is scaled down by LEAN_REF / width: the same turn in
 *  pixels of travel, not a bigger one. */
const LEAN_REF = 1920;
const PITCH = 3.4;
const SWAY_X = 14; // the small uniform lean that rides on top of the orbit
const SWAY_Y = 8;
const EASE = 0.055; // exponential chase toward the cursor, per 1/60s
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
 *  turns — that is the depth — and what shows in the gap is foliage. */
const SHRINK = 0.05; // scroll scales the scene DOWN — measured, see above
const TURN = 1.4; // deg of rotateX across the scroll

/** THE CAMERA'S TRANSFORM for a layer at depth z: where the pointer is
 *  (sx, sy in −1…1), how far the title's band is scrolled away (p in 0…1)
 *  and the drop under the nav. ONE string, used by the frame loop and by
 *  `seen` below, so what is drawn and what is measured cannot disagree.
 *  THE DROP IS GIVEN IN THE CAMERA'S SPACE, so the far plane, behind the
 *  pivot, takes 1100/1360 of it on screen and sits ~18px higher than the
 *  figure at rest. That is deliberate (2026-10-13, both ways tried): her
 *  figure is painted out of the far plate with a margin, so the offset
 *  shows nothing, while giving the far plane the full drop brought the seam
 *  of its mirrored top rows 10–75px down out from under the bar. */
const pose = (sx: number, sy: number, p: number, drop: number, z: number) =>
  `translate3d(${(sx * SWAY_X).toFixed(2)}px, ${(sy * SWAY_Y + drop).toFixed(2)}px, 0) ` +
  `rotateY(${(sx * YAW).toFixed(3)}deg) rotateX(${(-sy * PITCH - p * TURN).toFixed(3)}deg) ` +
  `scale(${(1 - p * SHRINK).toFixed(4)}) translateZ(${z}px) scale(${zScale(z).toFixed(4)})`;

/** WHAT THE CAMERA CAN SEE OF THE FAR PLANE (2026-10-13). How far past each
 *  edge of the window the far plate must reach, in the camera box's own px,
 *  for the window to stay covered wherever the pointer is and however far
 *  the page is scrolled.
 *
 *  This was a constant (EDGE, 7% of the width) and it was wrong: a yawed
 *  plane is foreshortened in proportion to how far it reaches, and the
 *  perspective is a fixed 1100px, so the share GROWS with the window — 7.6%
 *  at 1280 wide, 9.8% at 1920, 12% at 2560, 15% at 3440 — and the pitch and
 *  the scroll's shrink compound it in the corners. With the pointer in a
 *  corner the painting's left edge came inside the window and the page's
 *  paper showed beside it: a 27px wedge at 1920×940, a band the height of
 *  the window at 2560×1080. (My own check had passed because it read
 *  getBoundingClientRect — the bounding box of a trapezoid.)
 *
 *  So it is computed, exactly: each corner of the window is carried back
 *  through the camera onto the far plane, at the camera's extremes. The map
 *  from the plane to the window is a homography — the three columns of the
 *  camera's matrix that a point with z = 0 touches — and its inverse takes a
 *  window corner to the place on the plane that is drawn there. Eighteen
 *  poses (pointer left / middle / right × top / middle / bottom × the scroll
 *  at its two ends) bound it: a 9×9×9 sweep finds nothing further out, and
 *  a checker's 845-pose sweep at 21 more windows found its worst pose among
 *  these eighteen every time. `lean` is the pointer's horizontal throw
 *  (LEAN_REF). */
const SEEN_PAD = 3; // px beyond the arithmetic: rounding, and a pixel of raster
function seen(vw: number, vh: number, drop: number, lean: number) {
  let l = 0, r = 0, t = 0, b = 0;
  if (typeof DOMMatrix === "undefined") return { l: vw * 0.2, r: vw * 0.2, t: vh * 0.3, b: vh * 0.2 };
  const cx = vw / 2;
  const cy = vh / 2;
  const lens = new DOMMatrix(`perspective(${PERSP}px)`);
  for (const sx of [-lean, 0, lean])
    for (const sy of [-1, 0, 1])
      for (const p of [0, 1]) {
        // perspective-origin and transform-origin are both the middle of the
        // window (the layers are fixed, inset 0)
        const m = new DOMMatrix().translate(cx, cy).multiply(lens).multiply(new DOMMatrix(pose(sx, sy, p, drop, FAR_Z))).translate(-cx, -cy);
        const h11 = m.m11, h12 = m.m21, h13 = m.m41;
        const h21 = m.m12, h22 = m.m22, h23 = m.m42;
        const h31 = m.m14, h32 = m.m24, h33 = m.m44;
        for (const [X, Y] of [[0, 0], [vw, 0], [0, vh], [vw, vh]]) {
          const w = (h21 * h32 - h22 * h31) * X + (h12 * h31 - h11 * h32) * Y + (h11 * h22 - h12 * h21);
          const a = ((h22 * h33 - h23 * h32) * X + (h13 * h32 - h12 * h33) * Y + (h12 * h23 - h13 * h22)) / w;
          const c = ((h23 * h31 - h21 * h33) * X + (h11 * h33 - h13 * h31) * Y + (h13 * h21 - h11 * h23)) / w;
          l = Math.max(l, -a);
          r = Math.max(r, a - vw);
          t = Math.max(t, -c);
          b = Math.max(b, c - vh);
        }
      }
  return { l: l + SEEN_PAD, r: r + SEEN_PAD, t: t + SEEN_PAD, b: b + SEEN_PAD };
}
/** HER FACE WAS UNDER THE NAV (client 2026-08-11). Venus's crown sat at y≈85
 *  against a bar that ends at 65 — the first thing a visitor met of the figure
 *  was her chin. The whole scene drops by this fraction of the viewport, in the
 *  SHARED rotation string, so the far plate and the cut-out figure move as one
 *  and the coins stay on the hand they are thrown from. 0.105 since
 *  2026-10-13 (it was 0.14 for Venus): HER crown is at plate y 9 — her file
 *  has no sky above her head — so she needs less, and every pixel given back
 *  lifts her raised hand further clear of the cart's panel. The rows this
 *  uncovers above her painting are the mirrored ones in FAR. Never less than
 *  the bar itself plus a breath (DROP_MIN), in a short window. (The drop is
 *  given through `pose`, in the camera's space.) */
const DROP = 0.105;
const DROP_MIN = 86;

export default function CartPlate() {
  const box = useRef<HTMLDivElement>(null);
  const front = useRef<HTMLDivElement>(null);
  const far = useRef<HTMLDivElement>(null);
  const mid = useRef<HTMLDivElement>(null);
  const space = useRef<HTMLDivElement>(null);
  const farSpace = useRef<HTMLDivElement>(null);
  /** NOTHING IS RENDERED until the gate passes. Hiding the layers with CSS was
   *  not enough: a phone still fetched the plate AND the cut-out — most of
   *  a megabyte of painting, then, for a scene it never shows.
   *  Gate in one effect, build in another keyed on it; setting state and
   *  reading the refs in the same effect would read refs that do not exist
   *  yet. */
  const [live, setLive] = useState(false);
  // THE GATE IS FOLLOWED, not read once (2026-10-13). A window narrowed
  // under 861px, a tablet turned to portrait, a reader who switches reduced
  // motion on after the page loaded: the scene kept running under a phone
  // layout it was never meant to stand behind. It unmounts now (the cleanup
  // below takes data-plate with it) and mounts again when the gate reopens.
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const follow = () => setLive(mq.matches);
    follow();
    mq.addEventListener("change", follow);
    return () => mq.removeEventListener("change", follow);
  }, []);

  useEffect(() => {
    if (!live) return;
    const el = box.current;
    const frontEl = front.current;
    const farCam = far.current;
    const midCam = mid.current;
    const stage = space.current;
    const farStage = farSpace.current;
    if (!el || !frontEl || !farCam || !midCam || !stage || !farStage) return;
    const webEl = stage.querySelector<SVGSVGElement>(".ap-plate__web");

    const root = document.querySelector<HTMLElement>(".ap-cart");
    root?.setAttribute("data-plate", "");
    el.dataset.on = "";
    frontEl.dataset.on = "";
    // the title's letters were painted for the ground they stood on, and
    // that ground has just changed — see REPAINT in lib/textfx
    window.dispatchEvent(new Event(REPAINT));

    const coins = Array.from(stage.querySelectorAll<HTMLElement>(".ap-plate__coin"));

    /** the scene's drop under the nav, px — see DROP */
    let drop = 0;
    /** where the cart's panel began, in the page, last time the cart was not
     *  at its ending — kept for the ending, see `measure` */
    let heldTop: number | null = null;
    /** the pointer's horizontal throw for this window — see LEAN_REF */
    let lean = 1;

    /** Lay the plate-space box over the window — both layers, the same
     *  transform, so the far painting and the cut-out are one picture at
     *  rest. NO read of the layers' own rects: they carry a per-frame
     *  transform, and reading a rect that includes your own transform is a
     *  feedback loop — the mapping would chase the sway it causes. What IS
     *  read is the cart's own page layout (untransformed): where the panel
     *  begins, and where the title ends. Both are looked up afresh each
     *  time — the cart swaps its children between its states, and a node
     *  remembered from the first one is another element by the last. */
    const measure = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      drop = Math.max(vh * DROP, DROP_MIN);
      lean = Math.min(1, LEAN_REF / vw);
      const cover = Math.max(vw / PLATE_W, vh / PLATE_H);
      const word = root?.querySelector<HTMLElement>(".ap-sec__head .ap-h2") ?? null;
      const panel = root?.querySelector<HTMLElement>(".ap-cart__grid, .ap-cart__empty, .ap-cart__done") ?? null;
      /** the ending («Order received»): no title, one tall panel from the
       *  top of the page */
      const ended = !!panel?.matches(".ap-cart__done");
      let k = cover;
      // HER ARM STAYS ABOVE THE PANEL (2026-10-13). In a wide, short window
      // (1851×824 in the screenshot) the cover scale is set by the WIDTH, the
      // plate is far taller than the window, and the cart's panel cut her
      // raised arm off at the wrist — a hand standing on the panel's edge.
      // The far plate does not need the plate box to span the window (it
      // carries her painting far past it on both sides), so the scene may be
      // smaller than "cover": small enough that the last skin of her forearm
      // is above the panel's top edge.
      // The panel is whichever of the cart's states is showing (lines or
      // empty); before the cart has drawn one, the foot of the head stands
      // in — it is a little above where the panel will be, so the first
      // frame errs small, never cut. THE ENDING keeps the edge the cart had:
      // its panel starts at the top of the page, no scale could lift her arm
      // over it, and a scene that shrank as the order went would be the
      // painting flinching.
      if (!ended) {
        const head = root?.querySelector<HTMLElement>(".ap-sec__head") ?? null;
        const edgeOf = panel ? panel.getBoundingClientRect().top : head ? head.getBoundingClientRect().bottom : null;
        heldTop = edgeOf === null ? null : edgeOf + window.scrollY;
      }
      if (heldTop !== null) k = Math.min(k, (heldTop - drop - 12) / ARM_Y);
      // …but never so small that the scene stops filling the window. Her
      // skirt's foot must stay under the window's (a short panel leaves it
      // in view beside it), and the far plate must reach as far as the
      // camera can see on every side — see `seen`. These are floors: a
      // window's own shape may put them above the arm's wish (a very short
      // one) or, at the far end, above "cover" itself.
      const see = seen(vw, vh, drop, lean);
      k = Math.max(
        k,
        (vh * 1.05 - drop) / PLATE_H,
        (vw + see.l + see.r) / FAR.w,
        see.t / -FAR.y,
        (vh + see.b) / (FAR.y + FAR.h),
      );
      // centred, as it always was — but not so far right that the camera's
      // turn would show the mirrored strip left of her own painting (a
      // second trunk, a butterfly of leaves: it reads as a mirror the moment
      // it is seen). Her painting runs 651 plate px past the plate window on
      // the right and only 189 on the left, so where centring would reach
      // the mirror the scene moves left onto what she painted instead…
      let ox = Math.min((vw - PLATE_W * k) / 2, REAL_L * k - see.l);
      // …but the title runs BEHIND her, and its last letter must clear her
      // fingertips (shop.css sizes it for that at the cover scale; a smaller
      // scene brings her hand left). In the ending it is the panel she
      // stands clear of: her hand behind it, and a forearm coming out of its
      // edge, is the wrong last picture — though not at the price of her
      // face: in a narrow window that push took it out of the window, and
      // there her face stays and her hand may go behind the panel.
      let end: number | null = null;
      if (ended && panel) end = panel.getBoundingClientRect().right;
      else if (word) {
        const r = document.createRange();
        r.selectNodeContents(word);
        end = r.getBoundingClientRect().right;
      }
      if (end !== null) {
        let push = end + vw * 0.012 - FIG.x * k;
        if (ended) push = Math.min(push, vw - FACE_R * k - 16);
        ox = Math.max(ox, push);
      }
      // and never past what the far plate covers, on either side (where her
      // own painting is not enough, this is where the mirror is reached)
      ox = Math.min(Math.max(ox, vw + see.r - (FAR.x + FAR.w) * k), -FAR.x * k - see.l);
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
    // clamped: a drag that leaves the window (a text selection, a captured
    // pointer) reports positions outside it, and `seen` promises the far
    // plate only as far as the window's own edges
    const unit = (v: number) => Math.min(1, Math.max(-1, v));
    const onPoint = (e: PointerEvent) => {
      tx = unit((e.clientX / window.innerWidth) * 2 - 1);
      ty = unit((e.clientY / window.innerHeight) * 2 - 1);
    };

    // how far the title's band has been scrolled away — drives the push-in
    const range = () => window.innerHeight * 0.66;

    // the scroll as the coins see it — see THE SCROLL IS PAID OUT
    let scrolled = window.scrollY; // where the page was last frame
    let owed = 0; // crossings scrolled and not yet given to the coins
    let given = 0; // crossings given
    let turned = 0; // degrees of spin given with them

    let raf = 0;
    let last = 0;
    let thrown = 0; // crossings of the coins' own throw
    let spun = 0; // degrees of their own spin
    const frame = (now: number) => {
      // TIME IS INTEGRATED, AND A FRAME COUNTS FOR AT MOST 1/30s. A tab
      // left and come back to, or a frame the browser stalled on (the first
      // wheel turn after a load took 160ms), is one long frame — taken whole
      // it carried a coin from the foot of its arc past its fade and back
      // into her hand, still half seen. Capped, a stall is a slower frame.
      const dt = last ? Math.min(1 / 30, (now - last) / 1000) : 0;
      last = now;
      thrown += dt / CROSS;
      spun += dt * 210;

      const y = window.scrollY;
      const vh = window.innerHeight;
      const moved = y - scrolled;
      scrolled = y;
      const more = (moved / vh) * SCROLL_CROSS;
      if (more * owed < 0) owed = 0;
      owed = Math.min(SCROLL_OWED, Math.max(-SCROLL_OWED, owed + more));
      const most = SCROLL_MAX * dt;
      const pay = Math.min(most, Math.max(-most, owed * (1 - Math.exp(-SCROLL_RATE * dt))));
      owed -= pay;
      given += pay;
      turned += ((pay * vh) / SCROLL_CROSS) * SCROLL_SPIN;

      // ---- the camera -------------------------------------------------
      const ease = 1 - Math.pow(1 - EASE, dt * 60);
      sx += (tx - sx) * ease;
      sy += (ty - sy) * ease;
      const p = Math.min(1, Math.max(0, y / range()));
      // ONE rotation, shared — see `pose`. The depth is what differs, and
      // depth is what makes the near foliage and the far sky move against
      // each other.
      farCam.style.transform = pose(sx * lean, sy, p, drop, FAR_Z);
      midCam.style.transform = pose(sx * lean, sy, p, drop, 0);
      if (webEl) webEl.style.transform = `translateZ(${NEAR_Z}px) scale(${zScale(NEAR_Z).toFixed(4)})`;

      // ---- the coins --------------------------------------------------
      // their own throw, plus the scroll's — see SCROLL_CROSS. `along` may
      // run backwards (scrolling up faster than the throw), hence the
      // double modulo.
      const along = thrown + given;
      for (let i = 0; i < coins.length; i++) {
        const p = (((along + i / coins.length) % 1) + 1) % 1;
        const u = 1 - p;
        const x = u * u * ax + 2 * u * p * cx + p * p * bx;
        const y = u * u * ay + 2 * u * p * cy + p * p * by;
        // Spin about the horizontal axis — this is what makes a coin read as
        // a coin rather than a dot: it collapses to a line twice a turn.
        const spin = (spun + turned + i * 137) % 360;
        // nearer the eye at the top of the throw
        const near = 1 + Math.sin(Math.PI * p) * 0.22;
        // a handful of coins, not a machine: each its own size and lean
        const own = 0.78 + ((i * 37) % 11) / 22;
        // appears above her fingers (COIN_IN) and fades as it drops toward
        // the lowered hand, rather than popping into being mid-air
        const rise = Math.min(1, Math.max(0, (p - COIN_IN[0]) / (COIN_IN[1] - COIN_IN[0])));
        const fade = p < 0.5 ? rise * rise * (3 - 2 * rise) : Math.min(1, Math.sin(Math.PI * p) * 3.2);
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
    // the cart's own box changes when the panel changes state (empty →
    // lines → sent) — `measure` reads the panel and the title
    const ro = "ResizeObserver" in window ? new ResizeObserver(measure) : null;
    if (ro && root) ro.observe(root);
    // …and the title's END moves when the display face lands, without any
    // box changing size (the line keeps its height): with the face held
    // back four seconds the scene stood 26px right of where it belonged
    const fonts = document.fonts;
    let alive = true;
    const onFonts = () => {
      if (alive) measure();
    };
    fonts?.ready.then(onFonts);
    fonts?.addEventListener?.("loadingdone", onFonts);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      fonts?.removeEventListener?.("loadingdone", onFonts);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPoint);
      root?.removeAttribute("data-plate");
      delete el.dataset.on;
      delete frontEl.dataset.on;
      window.dispatchEvent(new Event(REPAINT));
    };
  }, [live]);

  // no markup at all off the gate — see the note beside `live`
  if (!live) return null;

  // THE PLATE ENDS WHERE THE PAGE DOES (2026-10-13). On every other page the
  // footer is revealed as <main> lifts off it (FootReveal: the footer is
  // fixed beneath, main is the curtain). Here the plate is two fixed layers
  // the size of the window INSIDE main, and they painted over the footer:
  // the last 407px of the cart scrolled past nothing but painting, its links
  // clickable under the leaves, since the plate first arrived. Each layer now
  // stands in a box that fills main and clips (clip-path, see shop.css): a
  // clip-path box clips its fixed children and scrolls with main on the
  // compositor, so the painting ends exactly at main's lower edge on every
  // frame. (A clip written from the frame loop was a frame late: a band of
  // paper flickered under the painting while scrolling back up.)
  return (
    <>
      <div className="ap-plate__clip ap-plate__clip--far" aria-hidden="true">
      <div className="ap-plate" ref={box}>
        <div className="ap-plate__cam" ref={far}>
        {/* the same plate-space box as the front layer's, under the same
            transform: her painting behind her, in register (2026-10-13) */}
        <div className="ap-plate__space" ref={farSpace}>
        <img
          className="ap-plate__img"
          src="/cart/plate.webp"
          alt=""
          width={FAR.w}
          height={FAR.h}
          style={{ left: FAR.x, top: FAR.y, width: FAR.w }}
          decoding="async"
        />
        </div>
        </div>
      </div>
      </div>

      {/* IN FRONT OF THE TITLE. Everything in here is in plate coordinates —
          the stage below is a 1600x1000 box the effect scales and offsets onto
          the painting, so a coin at (602, 452) is in her raised hand at
          every window size, with no per-frame arithmetic. */}
      <div className="ap-plate__clip ap-plate__clip--front" aria-hidden="true">
      <div className="ap-plate__front" ref={front}>
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
              the title passes behind her; 1376×1604 is the file's own size */}
          <img
            className="ap-plate__fig"
            src="/cart/figure.webp"
            alt=""
            width={1376}
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
      </div>
    </>
  );
}
