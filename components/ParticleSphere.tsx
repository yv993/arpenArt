"use client";

import { useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";

// ============================================================================
// A slowly turning sphere of Arpine's illustrations, held in a haze of warm
// particles. Built from the sketch supplied by the client, with three changes
// made for a page that has to ship:
//
//  1. The particles were 1,500 separate <mesh> nodes — 1,500 draw calls, which
//     stalls on a laptop. They are now a single THREE.Points cloud: one call.
//  2. The artwork planes sat at y = 0, so they formed a flat ring. With 57
//     pictures a ring reads as a line; they are distributed over the sphere on
//     a Fibonacci lattice instead, each still turned to face outward.
//  3. Textures load through useLoader with the small (600px) files, and colour
//     space is set explicitly so the gouache does not come out washed out.
//
// Everything else — the radius, the drift, the outward-facing planes — follows
// the original.
// ============================================================================

const SPHERE_RADIUS = 9;
const PARTICLE_COUNT = 1500;
const POSITION_RANDOMNESS = 4;
const ROTATION_SPEED_Y = 0.0005;
/** THE CARD SIZE FOLLOWS THE COUNT. 2.6 units was right for sixty product
 *  photographs; her own set (change.pdf p3, 2026-09-21) is sixteen, and
 *  sixteen cards of 2.6 on a radius-9 ball are specks in a snow-globe. The
 *  size grows as the count falls so the ball keeps roughly the same share
 *  of its surface under pictures — sixteen cards at 4.4 cover ~30%, sixty
 *  at 2.6 covered ~40% — capped where the crown would leave the frame
 *  (CAMERA_Z below is measured for 4.4). */
const imageSize = (n: number) => Math.min(4.4, Math.max(2.6, 2.6 * Math.sqrt(60 / Math.max(1, n))));

/** How far the sphere may be tipped, in radians. Past about this the lattice
 *  starts showing its poles and it stops reading as a globe. */
const PITCH_LIMIT = 1.05;
/** Per-frame decay applied to the throw, normalised to 60fps below. */
const FRICTION = 0.94;
/** Under this the throw is spent and the ambient drift takes back over. */
const REST = 0.00016;

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
 *  exactly on a pole (that one lies flat and reads as nothing). */
export const CAMERA_Z = 26;

/** Evenly spaced points on a sphere — avoids the clumping of naive random. */
function fibonacciSphere(n: number, radius: number) {
  const pts: THREE.Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - ((i + 0.5) / Math.max(1, n)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    pts.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r).multiplyScalar(radius));
  }
  return pts;
}

function Particles() {
  const geo = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const c = new THREE.Color();
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const phi = Math.acos(-1 + (2 * i) / PARTICLE_COUNT);
      const theta = Math.sqrt(PARTICLE_COUNT * Math.PI) * phi;
      const rr = SPHERE_RADIUS + (Math.random() - 0.5) * POSITION_RANDOMNESS;
      positions[i * 3] = rr * Math.cos(theta) * Math.sin(phi);
      positions[i * 3 + 1] = rr * Math.cos(phi);
      positions[i * 3 + 2] = rr * Math.sin(theta) * Math.sin(phi);
      // the marigold-to-coral range the illustrations are painted in
      c.setHSL(Math.random() * 0.1 + 0.05, 0.8, 0.6 + Math.random() * 0.3);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, []);

  // a soft round sprite so the particles are dots, not squares
  const sprite = useMemo(() => {
    const s = 64;
    const cv = document.createElement("canvas");
    cv.width = cv.height = s;
    const ctx = cv.getContext("2d");
    if (ctx) {
      const grad = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.5, "rgba(255,255,255,0.5)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, s, s);
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  return (
    <points geometry={geo}>
      <pointsMaterial
        size={0.14}
        map={sprite}
        vertexColors
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

/** Scratch objects for the frame loop — allocated once, shared by every card
 *  (the loop is sequential, nothing races). */
const TMP_V = new THREE.Vector3();
const TMP_Q = new THREE.Quaternion();

/** The chosen picture presents at z = 12 — in front of the particles' outer
 *  jitter (radius 9 ± 2) so nothing sparkles through it. Its size and seat
 *  are computed per frame from the real viewport: on a wide screen it
 *  stands ~70% of the view tall, seated left of centre so the info panel
 *  reads beside it like a museum label; on a phone it stays centred and
 *  smaller, with the info below. */
const VIEW_Z = 12;
const VIEW_DIST = CAMERA_Z - VIEW_Z; // the camera sits at CAMERA_Z
const VIS_H = 2 * VIEW_DIST * Math.tan((50 * Math.PI) / 360); // fov 50

function ArtCard({
  texture,
  i,
  home,
  size,
  chosenRef,
  onPick,
}: {
  texture: THREE.Texture;
  i: number;
  home: { pos: THREE.Vector3; quat: THREE.Quaternion };
  /** the card's box — the sphere's card size for this count */
  size: number;
  chosenRef: React.RefObject<number | null>;
  onPick: (i: number) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const matA = useRef<THREE.MeshBasicMaterial>(null);
  const matB = useRef<THREE.MeshBasicMaterial>(null);
  const dim = useRef(1);

  // THE PLANE TAKES THE PICTURE'S SHAPE. Square planes were fine for sixty
  // photographs of similar proportion; her cut-outs run from a 276×640
  // keychain to a 640×493 scarf, and a square would stretch the keychain to
  // more than twice its width. Each plane fits the picture inside the card's
  // box instead — its own ratio, never larger than the box.
  const [planeW, planeH] = useMemo(() => {
    const img = texture.image as { width?: number; height?: number } | undefined;
    const ar = img?.width && img?.height ? img.width / img.height : 1;
    return ar >= 1 ? [size, size / ar] : [size * ar, size];
  }, [texture, size]);

  useFrame((state) => {
    const g = group.current;
    if (!g || !g.parent) return;
    const chosen = chosenRef.current;
    const isChosen = chosen === i;
    const wide = state.size.width > 860;
    let wantScale = 1;
    if (isChosen) {
      const visW = VIS_H * (state.size.width / Math.max(1, state.size.height));
      // The target lives in WORLD space; the card lives inside the spinning
      // group — so the target is pulled into parent space every frame, and
      // the sphere keeps turning underneath while the card holds still.
      // phone: higher and a notch smaller, or the info panel at the canvas
      // bottom prints straight over the picture's lower third
      TMP_V.set(wide ? -visW * 0.17 : 0, wide ? 0.05 : 1.0, VIEW_Z);
      g.parent.worldToLocal(TMP_V);
      g.position.lerp(TMP_V, 0.14);
      g.parent.getWorldQuaternion(TMP_Q).invert();
      g.quaternion.slerp(TMP_Q, 0.16);
      // sized by the plane's own height, so a wide scarf and a tall keychain
      // both present at the same share of the view
      wantScale = ((wide ? 0.7 : 0.42) * VIS_H) / planeH;
    } else {
      g.position.lerp(home.pos, 0.1);
      g.quaternion.slerp(home.quat, 0.12);
    }
    const s = g.scale.x + (wantScale - g.scale.x) * 0.12;
    g.scale.setScalar(s);
    // everyone else steps back into shadow — by COLOUR, not opacity: 57
    // transparent planes cannot win the depth sort against each other
    const want = chosen !== null && !isChosen ? 0.3 : 1;
    dim.current += (want - dim.current) * 0.1;
    matA.current?.color.setScalar(dim.current);
    matB.current?.color.setScalar(dim.current);
  });

  return (
    // Two single-sided planes back to back rather than one DoubleSide one.
    // A back face shows its texture MIRRORED, so every card on the far side
    // of the sphere had Arpine's lettering running backwards — ARMENIA read
    // AIN3MRA. Turning the second plane 180° about Y is a rigid rotation,
    // not a mirror, so the picture reads correctly from behind too: a
    // postcard printed on both sides, which is what it is.
    <group
      ref={group}
      position={home.pos}
      quaternion={home.quat}
      onClick={(e) => {
        e.stopPropagation();
        onPick(i);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
    >
      {/* alphaTest, NOT `transparent`. The sphere used to carry the 57
          illustrations, every one of them a solid rectangle; it carries the
          SHOP now, and seven of those photographs have a keyed-out
          background. An opaque material paints those cut-out pixels BLACK —
          a scarf floating in a black box. `transparent` would fix the colour
          and break the depth sort, which is the same trade the float-shop
          room already lost once: alpha-blended planes have no reliable order
          against each other, so cards would flicker through one another.
          alphaTest DISCARDS the fragment instead, so depth still writes and
          the cut-outs are simply not there. */}
      <mesh>
        <planeGeometry args={[planeW, planeH]} />
        <meshBasicMaterial ref={matA} map={texture} toneMapped={false} alphaTest={0.5} />
      </mesh>
      <mesh rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[planeW, planeH]} />
        <meshBasicMaterial ref={matB} map={texture} toneMapped={false} alphaTest={0.5} />
      </mesh>
    </group>
  );
}

function Artworks({
  images,
  chosenRef,
  onPick,
}: {
  images: string[];
  chosenRef: React.RefObject<number | null>;
  onPick: (i: number) => void;
}) {
  const textures = useLoader(THREE.TextureLoader, images);
  useMemo(() => {
    for (const t of textures) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
    }
  }, [textures]);

  const placed = useMemo(() => {
    const pts = fibonacciSphere(images.length, SPHERE_RADIUS);
    return pts.map((p) => {
      // turn each plane to face directly away from the centre
      const m = new THREE.Matrix4();
      m.lookAt(p, p.clone().multiplyScalar(2), new THREE.Vector3(0, 1, 0));
      return { pos: p, quat: new THREE.Quaternion().setFromRotationMatrix(m) };
    });
  }, [images.length]);

  const size = imageSize(images.length);

  return (
    <>
      {placed.map((home, i) => (
        <ArtCard key={i} texture={textures[i]} i={i} home={home} size={size} chosenRef={chosenRef} onPick={onPick} />
      ))}
    </>
  );
}

export function ParticleSphere({
  images,
  spin,
  chosenRef,
  onPick,
}: {
  images: string[];
  spin: React.RefObject<Spin>;
  chosenRef: React.RefObject<number | null>;
  onPick: (i: number) => void;
}) {
  const group = useRef<THREE.Group>(null);
  /** how much of the idle tilt to apply — driven to 0 the moment the visitor
   *  takes hold, and eased back once they have let go and it has settled, so
   *  the sphere never wobbles under a hand that is steering it */
  const breath = useRef(1);

  useFrame((state, delta) => {
    const g = group.current;
    const s = spin.current;
    if (!g || !s) return;

    // normalise to 60fps so a 144Hz screen does not spin faster than a 60Hz one
    const step = Math.min(delta, 1 / 20) * 60;

    if (!s.dragging) {
      // coast: carry the throw, then hand back to the ambient drift
      s.yaw += s.vYaw * step;
      s.pitch += s.vPitch * step;
      const decay = Math.pow(FRICTION, step);
      s.vYaw *= decay;
      s.vPitch *= decay;
      if (Math.abs(s.vYaw) < REST) s.vYaw = 0;
      if (Math.abs(s.vPitch) < REST) s.vPitch = 0;
      if (s.vYaw === 0) s.yaw += ROTATION_SPEED_Y * step;
    }

    s.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, s.pitch));

    const want = s.dragging || s.vYaw !== 0 || s.vPitch !== 0 ? 0 : 1;
    breath.current += (want - breath.current) * (1 - Math.pow(0.97, step));

    g.rotation.y = s.yaw;
    g.rotation.x = s.pitch + Math.sin(state.clock.elapsedTime * 0.12) * 0.14 * breath.current;
  });

  return (
    <group ref={group}>
      <Particles />
      <Artworks images={images} chosenRef={chosenRef} onPick={onPick} />
    </group>
  );
}
