// ============================================================================
// THE SPHERE'S SHARED NUMBERS, WITHOUT THREE.JS.
//
// THREE.JS WAS ON EVERY PHONE'S CRITICAL PATH (2026-10-05 package, measured
// 2026-10-07). Gallery.tsx imported CAMERA_Z and newSpin from
// ParticleSphere.tsx, and ParticleSphere imports three and @react-three/
// fiber — so the home route's own chunk carried WebGLRenderer, and a phone at
// 390x844 had window.__THREE__ = "171" at scrollY 0, before the reader was
// anywhere near the gallery (the live /privacy had it too, through the Link
// prefetch of "/": 438 KB of JS, synthesis/v4-live.json). What Gallery needs
// at render time is two numbers and a type; they live here now, in a module
// that imports nothing, and the canvas itself (GlobeCanvas.tsx) is loaded
// only when the sphere is about to be seen.
// ============================================================================

/** The one piece of mutable state the DOM handlers and the render loop share.
 *  Kept in a ref and written to directly: a drag updates on every pointer move,
 *  and routing that through React state would re-render the tree ~120 times a
 *  second for a value only the frame loop reads. */
export type Spin = {
  yaw: number;
  pitch: number;
  /** radians per frame, carried out of a release as momentum */
  vYaw: number;
  vPitch: number;
  dragging: boolean;
};

export const newSpin = (): Spin => ({ yaw: 0, pitch: 0, vYaw: 0, vPitch: 0, dragging: false });

/** THE GLOBE WAS BEING SLICED BY THE CAMERA, NOT BY ITS LATTICE (client,
 *  change.pdf p3, 2026-09-15: «the globe's polar parts are cut off with a
 *  straight line — make it a normal round»; Vardan the same evening with a
 *  screenshot of the crown: «globe must be circle in top»). The first fix
 *  capped the lattice at ±0.84 of the axis and changed nothing she could see,
 *  because the straight line is the top of the FRUSTUM: the camera sat at
 *  z 20 with a 50° fov, and a card on the NEAR side of a radius-9 ball is
 *  only ~15 units away, where the view is 7 units tall — so its corners
 *  projected past the frame at every viewport (worst corner measured at
 *  110.6% of the half-height, scratchpad/plate-and-fit.cjs). The camera
 *  now sits at CAMERA_Z, where the worst corner of a FULL lattice lands
 *  inside the canvas with a margin: with her sixteen 4.4-unit cards it is
 *  84.1% (24 gave 92.6%, a whisker from the crown clipping again — 24 was
 *  right for the sixty small cards; the size of the ball on screen comes
 *  from the canvas, .ap-gal__canvas in globals.css, which takes most of the
 *  viewport). The lattice is full, on the half-step formula so no card sits
 *  exactly on a pole (that one lies flat and reads as nothing). Re-measured
 *  2026-10-12 for her twenty-six cards at 3.95 (change 4.pdf p2): the worst
 *  corner over every yaw and the full pitch range is 83.4% — the same margin
 *  as the sixteen, because the smaller card gives back what the fuller
 *  lattice takes. */
export const CAMERA_Z = 26;
