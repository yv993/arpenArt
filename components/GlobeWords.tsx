"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";

// ============================================================================
// HER SEVEN WORDS INSIDE THE GLOBE (client, change 5.pdf p2, 2026-11-04:
// «Արի մի 2 տեքստ ավելացնենք էս գնդի մեջ, նկարի նման» — let us add a couple
// of texts inside this sphere, like in the picture).
//
// The lettering is HERS: the seven white-on-transparent PNGs of her Drive
// folder «words», copied byte for byte to public/globe/word-*.png. Nothing is
// typeset here — her face (Fraternité) is not a site font, and drei <Text>
// would fetch a default font from a CDN the CSP blocks. Each phrase keeps her
// own line breaks and has no "!" (the \u0000 after "Color" and "More" in the
// PDF's text layer is a zero-width glyph, not punctuation).
//
// How they live in the scene:
//  - THREE.Sprite billboards, so a word always faces the reader upright.
//  - On an inner shell, R_IN 6.3, inside the cards' shell at radius 9: every
//    point of her lettering stays within 8.61 of the centre even at phone size
//    (6.3 plus the widest phrase's half-diagonal), so it is on the inner side
//    of every card's plane, and a card on the near side is ALWAYS in front of
//    a word by plain depth testing. A word never prints over a near picture;
//    it can pass behind one.
//  - Each texture is a CanvasTexture: a soft halo in the band's own navy
//    (--ink-indigo) drawn from her lettering's shape, then her lettering on
//    top, so a word that passes over a light far-side card still reads.
//    The halos are drawn in the browser's idle time, a pass at a time, and
//    each word fades in once its own is ready (haloSteps, the builder).
//  - They fade by depth (a word turning to the far side goes out before it
//    lies over the far cards) and fade out while a card is picked.
//  - No raycast: r3f only tests objects that carry handlers, and these carry
//    none; `raycast` is a no-op as well, so a press on a word reaches the
//    card behind it or the "missed" handler, exactly as before. Nothing is in
//    the DOM, so nothing reaches the accessibility tree.
//  - The shell turns at TURN (0.35) of the globe's turn, so the words drift
//    slowly against the cards instead of riding with them — but on a BOUNDED
//    path (shellYaw below): it goes no further than ±63° and turns back, so
//    no throw, drag, key run or idle drift can carry all seven round the back.
//    imgss/change5-2026-11-04/review/fix2-p5/drift-sim.cjs, over five globe
//    turns each way, idle tilt included: at least 6 of the 7 have opacity
//    > 0.5 at ANY globe yaw (5 at the steepest pitch the visitor can drag
//    to), mean 6.3. Riding 0.35 × the globe's raw yaw total, as before, it
//    was 0 at worst and ≤ 1 for 44% of those turns — one phone flick (yaw
//    0.8 → 8.8) left none for ~3 minutes.
//  - A word whose file fails to load is left out on its own (WordLoader
//    below); the other words, the cards and the globe carry on.
//
// Imported ONLY by ParticleSphere, which lives in the GlobeCanvas chunk, so
// three.js stays out of the home route's own chunk.
// ============================================================================

type Word = {
  /** what the lettering says, her breaks as " / " — for the dev hook only */
  phrase: string;
  src: string;
  /** her PNG's pixel size */
  w: number;
  h: number;
  /** degrees on the inner shell, +lat up, +lon toward the reader's right */
  lat: number;
  lon: number;
  /** the two she set smaller in her picture (9.07 pt against 12 pt) */
  small?: boolean;
};

/** PLACES RE-FITTED FOR THE 24-CARD GLOBE (change 5 step f, 2026-11-08).
 *  Each phrase starts where she put it in her picture (p2), then moves into
 *  the nearest opening between the near cards of the 24-card lattice, the
 *  seven kept clear of each other on screen. imgss/change5-2026-11-04/build/
 *  f/phrase-sim3-24.cjs (the analysis' phrase-sim3.cjs on the new lattice,
 *  with this file's TURN and the idle tilt in its first-sight test, plus a
 *  joint search so no phrase is squeezed): the share of each phrase behind a
 *  near card over the first ~5 s is 0–4% on the 1440 canvas and 2–10% on the
 *  390 one (words ×1.3). Re-run it if the globe's cards change. */
const WORDS: Word[] = [
  { phrase: "Feel / Armenia", src: "/globe/word-feel-armenia.png", w: 210, h: 143, lat: 39, lon: 9 },
  { phrase: "Dream / in / Color", src: "/globe/word-dream-in-color.png", w: 169, h: 217, lat: 46, lon: 69 },
  { phrase: "Create / Magic", src: "/globe/word-create-magic.png", w: 159, h: 143, lat: 11, lon: -10, small: true },
  { phrase: "BE / INSPIRED", src: "/globe/word-be-inspired.png", w: 262, h: 143, lat: -8, lon: -10 },
  { phrase: "Keep / Exploring", src: "/globe/word-keep-exploring.png", w: 236, h: 143, lat: -33, lon: 22 },
  { phrase: "Imagine / More", src: "/globe/word-imagine-more.png", w: 192, h: 143, lat: 6, lon: -75 },
  { phrase: "Wonder / More", src: "/globe/word-wonder-more.png", w: 197, h: 143, lat: -42, lon: -13, small: true },
];
const URLS = WORDS.map((w) => w.src);

/** A WORD THAT FAILS TO LOAD IS LEFT OUT, AND TAKES NOTHING WITH IT (review
 *  fix L4-globe-words#2 / L8-hostile-code#3, 2026-11-12). useLoader loads the
 *  seven as one batch and rejects the whole batch when any one file fails;
 *  thrown inside the canvas, that rejection reached Gallery's MapBoundary, so
 *  one 6 KB PNG cut off mid-load (a flaky phone connection) swapped the globe
 *  and all 24 cards for the link grid. This loader settles a failed word as
 *  null instead of an error, so the batch always resolves: GlobeWords leaves
 *  that word out, the rest show, and the console gets one warning per page.
 *  Settled, not thrown and caught: R3F 9 gives its root `reportError` as the
 *  handler for CAUGHT errors too, so even a caught failure would print as an
 *  uncaught error — too loud for a missing decoration. ParticleSphere wraps
 *  the words in their own error boundary as well, for anything ELSE that
 *  throws in here.
 *  A Loader of its own (not an ImageLoader subclass): its result is honestly
 *  "an image or null", so useLoader types it that way. */
class WordLoader extends THREE.Loader<HTMLImageElement | null> {
  private readonly images = new THREE.ImageLoader(this.manager);
  override load(url: string, onLoad: (img: HTMLImageElement | null) => void, onProgress?: (e: ProgressEvent) => void) {
    this.images.setPath(this.path).setCrossOrigin(this.crossOrigin).load(url, onLoad, onProgress, () => onLoad(null));
  }
}
/** one console line per page, however many words failed and however often
 *  the canvas mounts (the failed result stays in useLoader's cache) */
let reported = false;

const R_IN = 6.3;
/** World units per pixel of her PNG: a two-line phrase (143 px) stands 1.7
 *  units tall, ~60–75 px on the 1440 globe — the size her picture gives a
 *  phrase on a globe that size. Her PNGs are then close to 1:1 on screen. */
const UNIT = 1.7 / 143;
/** her small tier, 9.07 pt / 12 pt */
const SMALL = 0.756;
/** On a narrow canvas the globe is ~420 px tall, so the words grow by this
 *  much to stay readable (the same `wide` test the cards use). */
const PHONE = 1.3;
/** the words' turn as a share of the globe's */
const TURN = 0.35;
/** THE SHELL'S YAW FOR A GLOBE YAW (review fix L4-globe-words#1, 2026-11-11).
 *  The globe's yaw is a running total — every throw, drag, arrow key and
 *  the idle drift add to it, and nothing wraps it — and
 *  her seven words all sit on one side of the shell (lon −75°…+69°, where her
 *  picture puts them). TURN × that total therefore marched them round the
 *  back and left them there. Instead the shell follows a TRIANGLE WAVE of the
 *  globe's yaw: slope ±TURN (the drift is always 0.35 of the globe's speed),
 *  peaks at ±TURN·π (±63°), one period every two globe turns. On −π…π it IS
 *  TURN × yaw, so first sight and the first half turn either way are exactly
 *  as before; past that the drift turns back at the same rate instead of
 *  carrying on. Continuous — no jump at any yaw — and it never accumulates. A
 *  bounded path has to turn back somewhere: the words cannot keep drifting
 *  one way forever without going round the back. (A 2π-periodic triangle
 *  with this slope would have to turn back at ±31.5°, halving the drift from
 *  a quarter turn on.) */
const shellYaw = (yaw: number) => 2 * TURN * Math.asin(Math.sin(yaw / 2));
/** halo room around the lettering, in texture pixels */
const PAD = 26;
/** --ink-indigo's day value: the gallery band's own navy (the band is dark
 *  in both themes; the halo only has to be darker than her white) */
const HALO = "rgba(27, 43, 76, 0.9)";
/** Depth fade, in world z (the camera looks down −z from +26): out at the
 *  back edge of the near half, fully in a little in front of the centre. */
const FADE_FROM = -1.5;
const FADE_TO = 1.0;

const noRaycast = () => {};

/** HER LETTERING, WITH A NAVY HALO DRAWN FROM ITS OWN SHAPE BEHIND IT — one
 *  drawing pass per step. The builder in GlobeWords runs the steps in the
 *  browser's idle time, so no pass lands in a render or a frame (review fix
 *  L4-globe-words#3, below). Each step yields whether the builder must end
 *  its slice there. Returns what the word's texture shows: the canvas, or
 *  her bare PNG where there is no 2D context. */
function* haloSteps(img: HTMLImageElement): Generator<boolean, HTMLCanvasElement | HTMLImageElement, void> {
  const cv = document.createElement("canvas");
  cv.width = img.naturalWidth + PAD * 2;
  cv.height = img.naturalHeight + PAD * 2;
  const ctx = cv.getContext("2d");
  if (!ctx) return img;
  // The halo is the lettering's SHADOW with the lettering itself drawn off
  // the canvas (offset back by the shadow's own offset), so only the soft
  // shape lands — drawing the white glyphs once per pass would thicken their
  // antialiased edges. A wide pass for the glow, a tight one for the rim.
  // The context keeps these settings between steps; nothing else draws here.
  const off = cv.width * 2;
  ctx.shadowColor = HALO;
  ctx.shadowOffsetX = off;
  for (const blur of [22, 22, 8]) {
    ctx.shadowBlur = blur;
    ctx.drawImage(img, PAD - off, PAD);
    yield false;
  }
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.drawImage(img, PAD, PAD);
  // End the slice: the texture is made and uploaded in the next one, once
  // the GPU has drawn these passes. Uploaded right behind them, in the same
  // task, the upload waited for the GPU — 3–6 ms a word at 4× CPU throttle
  // where the slices are forced (fix3-o8/after1-prod), against 0.4–1.2 ms
  // a word a slice later (fix3-o8/after-prod2).
  yield true;
  return cv;
}

function toTexture(src: HTMLCanvasElement | HTMLImageElement): THREE.Texture {
  let t: THREE.Texture;
  // a CanvasTexture is born needing its upload; a plain Texture is not
  if (src instanceof HTMLCanvasElement) t = new THREE.CanvasTexture(src);
  else {
    t = new THREE.Texture(src);
    t.needsUpdate = true;
  }
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** THE BUILDER'S TIME BUDGET. A slice runs steps for at most SLICE ms, and
 *  stops early when the idle period has less than ROOM ms left. IDLE_WAIT:
 *  if the main thread never goes idle (a slow phone, where each frame of the
 *  globe takes longer than the frame itself), the browser runs the next
 *  slice after this long anyway — the same bounded slice. At 4× CPU throttle
 *  that is every slice, and the seven words come in over ~1–2.5 s
 *  (fix3-o8/after-prod2); with idle time, well under a second. */
const SLICE = 8;
const ROOM = 2;
const IDLE_WAIT = 100;
type Idle = { timeRemaining(): number; didTimeout: boolean };
/** run `cb` in idle time — or, where there is no requestIdleCallback
 *  (Safari), just after the next frame with a SLICE-long deadline; returns
 *  the cancel */
function whenIdle(cb: (d: Idle) => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(cb, { timeout: IDLE_WAIT });
    return () => window.cancelIdleCallback(id);
  }
  let t = 0;
  const f = requestAnimationFrame(() => {
    t = window.setTimeout(() => {
      const end = performance.now() + SLICE;
      cb({ timeRemaining: () => Math.max(0, end - performance.now()), didTimeout: false });
    }, 0);
  });
  return () => {
    cancelAnimationFrame(f);
    window.clearTimeout(t);
  };
}

const smooth = (z: number) => {
  const t = Math.min(1, Math.max(0, (z - FADE_FROM) / (FADE_TO - FADE_FROM)));
  return t * t * (3 - 2 * t);
};

const TMP = new THREE.Vector3();

export function GlobeWords({
  globe,
  chosenRef,
}: {
  /** the turning group of cards — the words follow a share of its turn */
  globe: React.RefObject<THREE.Group | null>;
  chosenRef: React.RefObject<number | null>;
}) {
  // null where a word's file failed (WordLoader)
  const images = useLoader(WordLoader, URLS);
  const { camera, gl, scene } = useThree();

  // THE HALOS ARE BUILT IN IDLE TIME, NOT IN THE RENDER (review fix
  // L4-globe-words#3, 2026-11-13). They were built in a useMemo: 21 shadow-
  // blur passes and 7 plain ones in the one task that rendered the words —
  // on a remount (the canvas comes back each time the gallery is scrolled
  // near) the same task that mounts the whole globe. Now each drawing pass is
  // one step, the steps run in idle slices of at most SLICE ms, and a word's
  // texture is uploaded in the slice after its last pass (gl.initTexture), so
  // neither the render nor a frame carries the build or the upload. Each
  // word mounts as its texture is ready and fades in on its own (`born`).
  // The same calls, the same canvases, the same texture settings: the words
  // look exactly as before (imgss/change5-2026-11-04/review/fix3-o8, the held
  // globe diffed pixel for pixel).
  const [textures, setTextures] = useState<(THREE.Texture | null)[]>(() => WORDS.map(() => null));
  // a step that throws is handed to the render (thrown at the end of this
  // component), so the words' own error boundary in ParticleSphere still
  // takes it, as when the build ran in the render
  const [failed, setFailed] = useState<{ error: unknown } | null>(null);
  useEffect(() => {
    const jobs = images.flatMap((img, i) => (img ? [{ i, steps: haloSteps(img) }] : []));
    const made: THREE.Texture[] = [];
    let k = 0;
    let cancel = () => {};
    const work = (d: Idle) => {
      const until = performance.now() + SLICE;
      try {
        do {
          const job = jobs[k];
          const r = job.steps.next();
          if (!r.done) {
            if (r.value) break;
            continue;
          }
          const t = toTexture(r.value);
          made.push(t);
          gl.initTexture(t);
          setTextures((prev) => prev.map((x, i) => (i === job.i ? t : x)));
          k++;
        } while (k < jobs.length && performance.now() < until && (d.didTimeout || d.timeRemaining() > ROOM));
      } catch (error) {
        setFailed({ error });
        return;
      }
      if (k < jobs.length) cancel = whenIdle(work);
    };
    if (jobs.length) cancel = whenIdle(work);
    return () => {
      cancel();
      made.forEach((t) => t.dispose());
    };
  }, [images, gl]);
  useEffect(() => {
    const missing = WORDS.filter((_, i) => !images[i]).map((w) => w.src);
    if (!missing.length || reported) return;
    reported = true;
    console.warn(`Globe words left out, their files did not load: ${missing.join(", ")}`);
  }, [images]);

  // each word's home on the inner shell (same convention as the cards:
  // +z toward the camera at rest)
  const homes = useMemo(
    () =>
      WORDS.map((w) => {
        const la = (w.lat * Math.PI) / 180;
        const lo = (w.lon * Math.PI) / 180;
        return new THREE.Vector3(Math.sin(lo) * Math.cos(la), Math.sin(la), Math.cos(lo) * Math.cos(la)).multiplyScalar(R_IN);
      }),
    [],
  );
  // the sprite's size in world units: her lettering at UNIT, plus the halo room
  const sizes = useMemo(
    () =>
      WORDS.map((w) => {
        const k = UNIT * (w.small ? SMALL : 1);
        return { w: (w.w + PAD * 2) * k, h: (w.h + PAD * 2) * k };
      }),
    [],
  );

  const shell = useRef<THREE.Group>(null);
  const sprites = useRef<(THREE.Sprite | null)[]>([]);
  /** 0 → 1: fades the words in once they have loaded, and out while a card
   *  is picked */
  const show = useRef(0);
  /** 0 → 1 per word, from the frame its texture is ready: a word built a few
   *  slices after the others fades in on its own instead of popping in at
   *  `show`'s level. A word shows at the lesser of the two, so once built it
   *  follows `show` exactly as before (out while a card is picked, back in). */
  const born = useRef(WORDS.map(() => 0));
  /** dev hook only: hold the words hidden (the pixel test diffs with/without) */
  const forceHide = useRef(false);

  /** One frame's placement for a globe pose: the shell's turn, each word's
   *  opacity and size. `delta` 0 places without easing anything (the dev
   *  hold below re-places at a held pose just before the render). */
  const place = useCallback(
    (pitch: number, yaw: number, delta: number, width: number) => {
      const g = shell.current;
      if (!g) return;
      const step = Math.min(delta, 1 / 20) * 60;
      // pitch is already clamped by ParticleSphere (±1.05 plus the idle tilt),
      // so a straight share of it stays bounded; the yaw is not (shellYaw)
      g.rotation.set(pitch * TURN, shellYaw(yaw), 0);
      const want = chosenRef.current === null && !forceHide.current ? 1 : 0;
      const ease = 1 - Math.pow(0.88, step);
      show.current += (want - show.current) * ease;
      if (forceHide.current) show.current = 0;
      const k = width > 860 ? 1 : PHONE;
      for (let i = 0; i < WORDS.length; i++) {
        const sp = sprites.current[i];
        if (!sp) continue;
        born.current[i] += (1 - born.current[i]) * ease;
        TMP.copy(homes[i]).applyEuler(g.rotation);
        const a = smooth(TMP.z) * Math.min(show.current, born.current[i]);
        sp.visible = a > 0.01;
        (sp.material as THREE.SpriteMaterial).opacity = a;
        sp.scale.set(sizes[i].w * k, sizes[i].h * k, 1);
      }
    },
    [chosenRef, homes, sizes],
  );

  useFrame((state, delta) => {
    const turning = globe.current;
    if (!turning) return;
    place(turning.rotation.x, turning.rotation.y, delta, state.size.width);
  });

  // DEV-ONLY PROBE (the verification harness reads it; `next build` drops it,
  // as Puzzle.tsx's __pz): each word's opacity, its lettering's box on the
  // canvas in CSS px, and the share of that box a card covers, by casting rays
  // from the camera against the card planes.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const ray = new THREE.Raycaster();
    const read = (detail = false) => {
      const r = gl.domElement.getBoundingClientRect();
      const cards: THREE.Object3D[] = [];
      scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) cards.push(o);
      });
      return WORDS.map((w, i) => {
        const sp = sprites.current[i];
        if (!sp) return { phrase: w.phrase, mounted: false };
        const c = sp.getWorldPosition(new THREE.Vector3());
        const k = (w.small ? SMALL : 1) * UNIT * (sp.scale.x / sizes[i].w);
        const lw = w.w * k;
        const lh = w.h * k;
        const px = (v: THREE.Vector3) => {
          const p = v.clone().project(camera);
          return [((p.x + 1) / 2) * r.width, ((1 - p.y) / 2) * r.height];
        };
        const [x0, y1] = px(new THREE.Vector3(c.x - lw / 2, c.y - lh / 2, c.z));
        const [x1, y0] = px(new THREE.Vector3(c.x + lw / 2, c.y + lh / 2, c.z));
        let hit = 0;
        let n = 0;
        const samples: number[][] = [];
        for (let a = 0; a < 9; a++)
          for (let b = 0; b < 7; b++) {
            const pt = new THREE.Vector3(c.x + ((a + 0.5) / 9 - 0.5) * lw, c.y + ((b + 0.5) / 7 - 0.5) * lh, c.z);
            const dir = pt.clone().sub(camera.position);
            const dist = dir.length();
            ray.set(camera.position, dir.normalize());
            const first = ray.intersectObjects(cards, false)[0];
            n++;
            const covered = !!first && first.distance < dist;
            if (covered) hit++;
            if (detail) samples.push([...px(pt).map((v) => Math.round(v)), covered ? 1 : 0]);
          }
        return {
          phrase: w.phrase,
          mounted: true,
          visible: sp.visible,
          opacity: +(sp.material as THREE.SpriteMaterial).opacity.toFixed(3),
          fade: +born.current[i].toFixed(3),
          z: +c.z.toFixed(2),
          rect: [x0, y0, x1, y1].map((v) => Math.round(v)),
          covered: +(hit / n).toFixed(3),
          ...(detail ? { samples } : {}),
        };
      });
    };
    // the cards' centres on the canvas, nearest first — where the harness
    // presses to prove a press on a word still picks the card behind it
    const cards = () => {
      const r = gl.domElement.getBoundingClientRect();
      const seen = new Set<THREE.Object3D>();
      const out: { x: number; y: number; z: number }[] = [];
      scene.traverse((o) => {
        if (!(o as THREE.Mesh).isMesh || !o.parent || seen.has(o.parent)) return;
        seen.add(o.parent);
        const c = o.parent.getWorldPosition(new THREE.Vector3());
        const p = c.clone().project(camera);
        out.push({ x: Math.round(((p.x + 1) / 2) * r.width), y: Math.round(((1 - p.y) / 2) * r.height), z: +c.z.toFixed(2) });
      });
      return out.sort((a, b) => b.z - a.z);
    };
    const pose = () => ({
      yaw: +(globe.current?.rotation.y ?? 0).toFixed(4),
      pitch: +(globe.current?.rotation.x ?? 0).toFixed(4),
      shellYaw: +(shell.current?.rotation.y ?? 0).toFixed(4),
    });
    // HOLD (review fix L4-globe-words#3, for the pixel test): pin the globe to
    // a pose so two builds can be shot frame for frame. Applied just before
    // each render, after every frame callback (whatever order they ran in):
    // the globe group takes the held pose, the words are re-placed for it,
    // and the world matrices are brought up to date. `withHaze` false hides
    // the particle haze, whose dots are random per mount.
    let held: { yaw: number; pitch: number } | null = null;
    const ownBefore = scene.onBeforeRender;
    scene.onBeforeRender = (...a) => {
      ownBefore.apply(scene, a);
      const turning = globe.current;
      if (!held || !turning) return;
      turning.rotation.set(held.pitch, held.yaw, 0);
      place(held.pitch, held.yaw, 0, gl.domElement.clientWidth);
      scene.updateMatrixWorld();
    };
    const haze = (v: boolean) =>
      scene.traverse((o) => {
        if ((o as THREE.Points).isPoints) o.visible = v;
      });
    const hold = (yaw: number | null, pitch = 0, withHaze = true) => {
      held = yaw === null ? null : { yaw, pitch };
      haze(held === null || withHaze);
    };
    const probe = { read, cards, pose, hold, hide: (v: boolean) => (forceHide.current = v) };
    (window as unknown as { __apGlobeWords?: typeof probe }).__apGlobeWords = probe;
    return () => {
      scene.onBeforeRender = ownBefore;
      haze(true);
      delete (window as unknown as { __apGlobeWords?: typeof probe }).__apGlobeWords;
    };
  }, [camera, gl, scene, sizes, globe, place]);

  if (failed) throw failed.error;
  return (
    <group ref={shell}>
      {WORDS.map((w, i) => {
        const map = textures[i];
        // a word whose file failed is simply not there; the frame loop and
        // the dev probe already skip an empty slot
        if (!map) return null;
        return (
          <sprite
            key={w.src}
            ref={(el) => {
              sprites.current[i] = el;
            }}
            position={homes[i]}
            raycast={noRaycast}
            // first among the see-through things, so the additive haze adds its
            // dots over a word like stars in front of it; the cards are opaque
            // and drawn before anything see-through, so depth testing still
            // puts every near card in front
            renderOrder={-1}
            visible={false}
          >
            <spriteMaterial map={map} transparent depthWrite={false} toneMapped={false} opacity={0} />
          </sprite>
        );
      })}
    </group>
  );
}
