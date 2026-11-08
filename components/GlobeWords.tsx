"use client";

import { useEffect, useMemo, useRef } from "react";
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
//  - They fade by depth (a word turning to the far side goes out before it
//    lies over the far cards) and fade out while a card is picked.
//  - No raycast: r3f only tests objects that carry handlers, and these carry
//    none; `raycast` is a no-op as well, so a press on a word reaches the
//    card behind it or the "missed" handler, exactly as before. Nothing is in
//    the DOM, so nothing reaches the accessibility tree.
//  - The shell turns at TURN (0.35) of the globe: the words drift slowly
//    against the cards instead of riding with them. Measured over the globe's
//    first full turn: 0.35 keeps 7/7/6/5 words in front at yaw 0/90/180/270
//    (riding rigidly: 7/5/0/6).
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

/** her lettering, with a navy halo drawn from its own shape behind it */
function haloTexture(img: HTMLImageElement): THREE.Texture {
  const cv = document.createElement("canvas");
  cv.width = img.naturalWidth + PAD * 2;
  cv.height = img.naturalHeight + PAD * 2;
  const ctx = cv.getContext("2d");
  if (!ctx) {
    const t = new THREE.Texture(img);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }
  // The halo is the lettering's SHADOW with the lettering itself drawn off
  // the canvas (offset back by the shadow's own offset), so only the soft
  // shape lands — drawing the white glyphs once per pass would thicken their
  // antialiased edges. A wide pass for the glow, a tight one for the rim.
  const off = cv.width * 2;
  ctx.shadowColor = HALO;
  ctx.shadowOffsetX = off;
  for (const blur of [22, 22, 8]) {
    ctx.shadowBlur = blur;
    ctx.drawImage(img, PAD - off, PAD);
  }
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.drawImage(img, PAD, PAD);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
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
  const images = useLoader(THREE.ImageLoader, URLS);
  const textures = useMemo(() => images.map(haloTexture), [images]);
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);

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
  /** dev hook only: hold the words hidden (the pixel test diffs with/without) */
  const forceHide = useRef(false);

  useFrame((state, delta) => {
    const g = shell.current;
    const turning = globe.current;
    if (!g || !turning) return;
    const step = Math.min(delta, 1 / 20) * 60;
    g.rotation.set(turning.rotation.x * TURN, turning.rotation.y * TURN, 0);
    const want = chosenRef.current === null && !forceHide.current ? 1 : 0;
    show.current += (want - show.current) * (1 - Math.pow(0.88, step));
    if (forceHide.current) show.current = 0;
    const k = state.size.width > 860 ? 1 : PHONE;
    for (let i = 0; i < WORDS.length; i++) {
      const sp = sprites.current[i];
      if (!sp) continue;
      TMP.copy(homes[i]).applyEuler(g.rotation);
      const a = smooth(TMP.z) * show.current;
      sp.visible = a > 0.01;
      (sp.material as THREE.SpriteMaterial).opacity = a;
      sp.scale.set(sizes[i].w * k, sizes[i].h * k, 1);
    }
  });

  // DEV-ONLY PROBE (the verification harness reads it; `next build` drops it,
  // as Puzzle.tsx's __pz): each word's opacity, its lettering's box on the
  // canvas in CSS px, and the share of that box a card covers, by casting rays
  // from the camera against the card planes.
  const { camera, gl, scene } = useThree();
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
    const pose = () => ({ yaw: +(globe.current?.rotation.y ?? 0).toFixed(4), pitch: +(globe.current?.rotation.x ?? 0).toFixed(4) });
    const probe = { read, cards, pose, hide: (v: boolean) => (forceHide.current = v) };
    (window as unknown as { __apGlobeWords?: typeof probe }).__apGlobeWords = probe;
    return () => {
      delete (window as unknown as { __apGlobeWords?: typeof probe }).__apGlobeWords;
    };
  }, [camera, gl, scene, sizes, globe]);

  return (
    <group ref={shell}>
      {WORDS.map((w, i) => (
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
          <spriteMaterial map={textures[i]} transparent depthWrite={false} toneMapped={false} opacity={0} />
        </sprite>
      ))}
    </group>
  );
}
