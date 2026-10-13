"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import type { FloatCat } from "./FloatShop";

// ============================================================================
// THE FLOAT SHOP'S ROOM, IN ITS OWN CHUNK (2026-10-05 package, done
// 2026-10-07).
//
// Everything here needs three.js, and it all used to live in FloatShop.tsx —
// a static import of the home route — although its Canvas only ever mounts
// on the desktop moved layer (FloatShop's `live`). So every phone evaluated
// three for a room it never shows. FloatShop now loads this module with
// next/dynamic when `live` turns true and warms it in idle time on the moved
// layer; the Canvas, the scene and the cards are byte-for-byte what they
// were, only moved. The notes below travelled with them.
// ============================================================================

const RING_R = 6.2;
const HELIX_R = 6.4;
const HELIX_RISE = 0.78;
const CARD_W = 2.0;
/** How far the whole arrangement turns across the pin. A FULL turn, so every
 *  card reaches the centre position exactly once on the way down — at 1.5π
 *  the last quarter of the catalogue never came round. */
const TURN = Math.PI * 2;

/** Each card's SCREEN spot for the wheel gate — centre and projected
 *  half-height, in canvas pixels. FloatShop reads these to decide whether a
 *  wheel is on the pictures (see SPOT_PAD there). */
export type Spot = {
  x: number;
  y: number;
  r: number;
  /** HOW THIS CARD ANSWERS A TURN, for the grab (2026-10-13): pixels of
   *  sideways screen travel per radian the rig turns, signed. Positive on the
   *  near side of the ring (the card goes the way the near side goes),
   *  negative round the back, and zero at the silhouette, where a turning
   *  card is moving straight toward or away from the eye. FloatShop divides a
   *  hand's travel by this to keep the card it took under that hand. */
  g: number;
};

/** What a GRAB hands the frame loop (2026-10-13 — see the handlers in
 *  FloatShop.tsx). `v` is the room's own speed in TURNS PER SECOND, carried
 *  out of a release as a throw and bled off here; `held` is true while a
 *  hand has the room, and nothing but that hand may turn it then. */
export type RoomSpin = { v: number; held: boolean };
/** The sketch's idle ROTATION_SPEED_Y (0.0005/frame ≈ 0.03 rad/s). */
const IDLE = 0.03;
/** How fast a throw dies, per second: speed falls to 1/e in ~0.4s, so a
 *  brisk flick (half a turn a second) coasts about two cards further and a
 *  hard one never more than two thirds of the way round. */
const FRICTION = 2.4;
const TAN_HALF_FOV = Math.tan((50 * Math.PI) / 360); // the Canvas below is fov 50
const SPOT_V = new THREE.Vector3();

/** The warm haze from the client's ParticleSphere sketch, kept to the same
 *  three-change policy as the gallery port: their 1,500 separate <mesh>
 *  spheres (1,500 draw calls) are ONE THREE.Points cloud; the shell follows
 *  their spiral-phyllotaxis distribution and radius jitter; the hue range is
 *  theirs, but re-lit darker — their 0.6–0.9 lightness glow is built for a
 *  dark room, and this room is paper. */
function Haze() {
  const geo = useMemo(() => {
    const N = 900;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const phi = Math.acos(-1 + (2 * i) / N);
      const theta = Math.sqrt(N * Math.PI) * phi;
      const r = 7.4 + (Math.random() - 0.5) * 2.6;
      pos[i * 3] = r * Math.cos(theta) * Math.sin(phi);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(theta) * Math.sin(phi);
      c.setHSL(0.03 + Math.random() * 0.1, 0.74, 0.36 + Math.random() * 0.22);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, []);
  const sprite = useMemo(() => {
    const s = 64;
    const cv = document.createElement("canvas");
    cv.width = cv.height = s;
    const ctx = cv.getContext("2d");
    if (ctx) {
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.55, "rgba(255,255,255,0.6)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <points geometry={geo}>
      <pointsMaterial map={sprite} size={0.07} vertexColors sizeAttenuation transparent opacity={0.55} depthWrite={false} alphaTest={0.01} />
    </points>
  );
}

function Card({
  cat,
  index,
  total,
  view,
  spots,
  onPick,
  onPress,
  onHover,
}: {
  cat: FloatCat;
  index: number;
  total: number;
  view: React.RefObject<number>;
  spots: React.RefObject<Spot[]>;
  onPick: (c: FloatCat) => void;
  /** a press landed on this card: its index, and which pointer event it was */
  onPress: (i: number, pointerId: number, timeStamp: number) => void;
  onHover: (c: FloatCat | null) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const texture = useLoader(THREE.TextureLoader, cat.tex);
  const hover = useRef(0);
  const hovered = useRef(false);

  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
  }, [texture]);

  // both arrangements, computed once — the frame loop only blends them.
  // The RING is the client's sketch verbatim: cards on a y=0 orbit, each
  // turned to face outward from the centre.
  const home = useMemo(() => {
    const th = (index / total) * Math.PI * 2;
    const ringPos = new THREE.Vector3(Math.cos(th) * RING_R, 0, Math.sin(th) * RING_R);
    const out = ringPos.clone().normalize();
    const ringQ = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().lookAt(ringPos, ringPos.clone().add(out), new THREE.Vector3(0, 1, 0)),
    );
    const helixPos = new THREE.Vector3(Math.sin(th) * HELIX_R, (index - (total - 1) / 2) * HELIX_RISE, Math.cos(th) * HELIX_R);
    const helixQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, th, 0));
    return { ringPos, ringQ, helixPos, helixQ, phase: index * 2.1 };
  }, [index, total]);

  const size = useMemo(() => {
    const ratio = cat.h / cat.w;
    return [CARD_W, CARD_W * Math.min(1.42, Math.max(0.68, ratio))] as const;
  }, [cat.w, cat.h]);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const v = view.current ?? 0;
    g.position.lerpVectors(home.ringPos, home.helixPos, v);
    // the float the reference never switches off
    g.position.y += Math.sin(state.clock.elapsedTime * 0.7 + home.phase) * 0.07;
    g.quaternion.slerpQuaternions(home.ringQ, home.helixQ, v);
    hover.current += ((hovered.current ? 1 : 0) - hover.current) * 0.12;
    const s = 1 + hover.current * 0.14;
    g.scale.set(s, s, s);
    // the card's screen spot for the wheel gate — centre and projected
    // half-height in canvas pixels (a perspective camera: size falls off
    // with distance, so a near card claims a wider circle than a far one)
    g.getWorldPosition(SPOT_V);
    const dist = SPOT_V.distanceTo(state.camera.position);
    const spot = (spots.current[index] ??= { x: 0, y: 0, r: 0, g: 0 });
    // The card's sideways screen travel per radian of rig turn (see Spot.g).
    // The camera looks straight down −z from (0, 0, cz), so a point (x, ·, z)
    // lands at screen x = k · x / (cz − z), k = (height / 2) / tan(fov / 2).
    // The rig turns about the world's y axis, which carries the point by
    // (dx, dz) = (z, −x) per radian; differentiate and that is
    // k · (z · (cz − z) − x²) / (cz − z)². Taken BEFORE project() below,
    // which overwrites the vector.
    const depth = Math.max(0.01, state.camera.position.z - SPOT_V.z);
    spot.g = ((state.size.height / 2 / TAN_HALF_FOV) * (SPOT_V.z * depth - SPOT_V.x * SPOT_V.x)) / (depth * depth);
    SPOT_V.project(state.camera);
    spot.x = ((SPOT_V.x + 1) / 2) * state.size.width;
    spot.y = ((1 - SPOT_V.y) / 2) * state.size.height;
    spot.r = ((size[1] / 2) * s * (state.size.height / 2)) / Math.max(0.01, dist * TAN_HALF_FOV);
  });

  return (
    // The pointer handlers live on the GROUP, not the front mesh: on the far
    // side of the ring a card presents its BACK plane, and with the handlers
    // on the front mesh only, half the ring never named itself on hover.
    // A group event fires for a raycast against either child, so both sides
    // of the card answer — and the hover grow scales the group, so whichever
    // face you are looking at is the one that swells.
    <group
      ref={group}
      onPointerOver={(e) => {
        e.stopPropagation();
        hovered.current = true;
        onHover(cat);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        hovered.current = false;
        onHover(null);
        document.body.style.cursor = "";
      }}
      // WHICH CARD A PRESS IS ON, for the grab (2026-10-13). r3f raycasts
      // every pointerdown, nearest hit first; stopPropagation keeps a card
      // behind this one from answering too. FloatShop matches the pointer
      // and the timestamp against its own pointerdown, which runs after
      // this (r3f listens on its div, inside the stage) — so a finger, which
      // has no hover before it lands, is told its card as surely as a mouse.
      onPointerDown={(e) => {
        e.stopPropagation();
        onPress(index, e.pointerId, e.nativeEvent.timeStamp);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onPick(cat);
      }}
    >
      <mesh>
        <planeGeometry args={[size[0], size[1]]} />
        {/* alphaTest, or the keyed-out background of a product cutout renders
            as solid black — and unlike `transparent`, a cutout cannot lose the
            depth-sort against seventeen other floating planes */}
        <meshBasicMaterial map={texture} toneMapped={false} alphaTest={0.5} />
      </mesh>
      {/* the far side of the card, as a rigid rotation — DoubleSide shows the
          back MIRRORED, and a mug's lettering read backwards through the
          arrangement. Same trap, same fix as the gallery sphere. */}
      <mesh rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[size[0], size[1]]} />
        <meshBasicMaterial map={texture} toneMapped={false} alphaTest={0.5} />
      </mesh>
    </group>
  );
}

/** Shortest signed distance between two angles. */
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

function Scene({
  cats,
  view,
  scrollP,
  spin,
  spots,
  onPick,
  onPress,
  onHover,
  onFocus,
}: {
  cats: FloatCat[];
  view: React.RefObject<number>;
  scrollP: React.RefObject<number>;
  spin: React.RefObject<RoomSpin>;
  spots: React.RefObject<Spot[]>;
  onPick: (c: FloatCat) => void;
  /** a press landed on this card: its index, and which pointer event it was */
  onPress: (i: number, pointerId: number, timeStamp: number) => void;
  onHover: (c: FloatCat | null) => void;
  /** which card currently holds the centre — the one nearest the camera */
  onFocus: (i: number) => void;
}) {
  const rig = useRef<THREE.Group>(null);
  const lastFocus = useRef(-1);
  /** the idle drift, summed here instead of read off the clock so that it can
   *  STOP while a hand holds the room: at 0.03 rad/s the near card slid ~22px
   *  a second out from under a pointer that was holding it still */
  const idle = useRef(0);

  useFrame((state, delta) => {
    const g = rig.current;
    if (!g) return;
    // a tab that was hidden comes back with one enormous delta; nothing here
    // should jump for it (a tenth of a second is still a whole frame on a
    // machine that manages ten a second, so a slow one is not slowed further)
    const dt = Math.min(delta, 0.1);
    const sp = spin.current;
    if (!sp.held) {
      // nobody is holding it: the gentle idle turn, plus whatever a release
      // threw into it, bleeding off (friction, never a hard stop)
      idle.current += dt * IDLE;
      if (sp.v) {
        const p = (scrollP.current ?? 0) + sp.v * dt;
        scrollP.current = p - Math.floor(p);
        sp.v *= Math.exp(-dt * FRICTION);
        // let it die well below the idle drift it hands over to (0.03
        // rad/s is 0.0048 turns/s): cut at 0.004 the last frame took away a
        // speed as large as the drift itself, a visible step
        if (Math.abs(sp.v) < 0.0004) sp.v = 0;
      }
    }
    // the wheel, a drag and a throw all write the same `scrollP`, a wrapped
    // fraction of a turn; the idle drift rides on top of it
    const rotY = -(scrollP.current ?? 0) * TURN - idle.current;
    g.rotation.y = rotY;

    // Which card is at the CENTRE POSITION — i.e. nearest the camera. Solved
    // on paper rather than by projecting nine world positions every frame:
    // a rig rotation of `a` maps the ring's card i (cos th, sin th in x/z) to
    // world angle th − a, so its z is greatest at th − a ≡ π/2. The helix
    // seats its cards from +z instead (sin th, cos th), which peaks at
    // th + a ≡ 0. Blend follows the pill, so use whichever side we are on.
    const n = cats.length;
    if (!n) return;
    const helix = (view.current ?? 0) >= 0.5;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2;
      const d = Math.abs(wrap(helix ? th + rotY : th - rotY - Math.PI / 2));
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best !== lastFocus.current) {
      lastFocus.current = best;
      onFocus(best);
    }
  });

  return (
    <group ref={rig}>
      {/* tilted like an orbit seen from above: the near card passes low, the
          far cards ride high, and the centre band stays clear for the name */}
      <group rotation={[0.3, 0, 0]}>
        <Haze />
        {cats.map((c, i) => (
          <Card key={c.slug} cat={c} index={i} total={cats.length} view={view} spots={spots} onPick={onPick} onPress={onPress} onHover={onHover} />
        ))}
      </group>
    </group>
  );
}

export default function FloatShopCanvas({
  cats,
  view,
  scrollP,
  spin,
  spots,
  onPick,
  onPress,
  onHover,
  onFocus,
}: {
  cats: FloatCat[];
  view: React.RefObject<number>;
  scrollP: React.RefObject<number>;
  spin: React.RefObject<RoomSpin>;
  spots: React.RefObject<Spot[]>;
  onPick: (c: FloatCat) => void;
  /** a press landed on this card: its index, and which pointer event it was */
  onPress: (i: number, pointerId: number, timeStamp: number) => void;
  onHover: (c: FloatCat | null) => void;
  onFocus: (i: number) => void;
}) {
  return (
    <Canvas camera={{ position: [0, 0, 13.4], fov: 50 }} dpr={[1, 1.6]} gl={{ antialias: true, alpha: true }}>
      <Suspense fallback={null}>
        <Scene cats={cats} view={view} scrollP={scrollP} spin={spin} spots={spots} onPick={onPick} onPress={onPress} onHover={onHover} onFocus={onFocus} />
      </Suspense>
    </Canvas>
  );
}
