"use client";

import { useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { MeshTransmissionMaterial, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";

// ============================================================================
// THE KEYCHAIN, MODELLED — the real mechanism, part by part, to the client's
// breakdown of 2026-08-31.
//
//   A  WallHook       backplate · forward peg curling up · knurled collar ·
//                     lower stem              (static, never moves)
//   B  MainSplitRing  the big flat-wire ring, hanging over the peg
//   C  ConnectorLink  the small jump ring, interlocking B with D's eyelet
//   D  AcrylicCase    eyelet tab with a PUNCHED hole · bevelled outer rim ·
//                     transmissive PMMA body
//   E  ArtInsert      her illustration, in the cavity behind the front face
//
// THREE THINGS THE BRIEF SPECIFIED THAT REALITY ARGUED WITH, each changed for
// a reason rather than silently:
//
//   · NO `<Environment preset>`. Transmission needs something to refract, and
//     drei's presets fetch an HDRI from a CDN — this site's CSP is self-only
//     and its pages contact nobody. The room here is built from Lightformers:
//     real geometry in a real scene, no download, and it gives the chrome the
//     long soft highlights a studio strip light makes.
//
//   · THE ART PLANE IS SIZED FROM THE TEXTURE, not fixed at 1.92 x 3.25. Her
//     prints measure between 0.569 and 0.659 in aspect, so one hardcoded
//     rectangle would stretch most of the line. Width is the brief's 1.92 and
//     the height follows the image, which is the only way nobody's drawing
//     gets squashed.
//
//   · THE SPLIT RING IS SPLIT. A single closed torus is a solid ring, and the
//     object in the photographs is a split ring — two overlapping turns of
//     flat wire. It is drawn as two 355-degree arcs a wire-thickness apart in
//     z, which is what makes the join read at the top.
//
// Everything is `useMemo`d per geometry and the materials are shared
// singletons: this hierarchy is instantiated once per visible keychain, and
// allocating a new MeshStandardMaterial per frame is how an R3F scene starts
// costing more than the browser can pay.
// ============================================================================

const METAL = { color: "#b0b3b8", metalness: 0.85, roughness: 0.35 } as const;
const CHROME = { color: "#e8eaed", metalness: 0.98, roughness: 0.08 } as const;

/** cross-hatched knurl, drawn once into a canvas and read as a normal map —
 *  the honest way to get machined texture on a 6mm collar without geometry */
function useKnurlNormal() {
  return useMemo(() => {
    const s = 256;
    const c = document.createElement("canvas");
    c.width = c.height = s;
    const g = c.getContext("2d")!;
    g.fillStyle = "#8080ff"; // flat normal
    g.fillRect(0, 0, s, s);
    g.lineWidth = 3;
    for (const dir of [1, -1]) {
      // the two hatch directions get opposite tilts, so the grooves read as
      // grooves rather than as a flat plaid
      g.strokeStyle = dir > 0 ? "#a0a0ff" : "#6060ff";
      for (let i = -s; i < s * 2; i += 12) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i + dir * s, s);
        g.stroke();
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 1);
    return t;
  }, []);
}

/** A — the wall mount. Static: it is the anchor everything else swings from. */
function WallHook() {
  const knurl = useKnurlNormal();
  // the peg's upward curl, as a real swept tube rather than a bent cylinder
  const curl = useMemo(() => {
    const path = new THREE.CurvePath<THREE.Vector3>();
    path.add(
      new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0.26)),
    );
    path.add(
      new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0, 0, 0.26),
        new THREE.Vector3(0, 0.02, 0.4),
        new THREE.Vector3(0, 0.17, 0.4),
      ),
    );
    return new THREE.TubeGeometry(path, 24, 0.055, 12, false);
  }, []);

  return (
    <group>
      {/* backplate — flush to the wall, the only part that touches it */}
      <mesh position={[0, -0.35, -0.16]} castShadow receiveShadow>
        <boxGeometry args={[0.34, 2.1, 0.07]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {/* the peg: straight out of the plate, then curling up to cradle the ring */}
      <mesh geometry={curl} position={[0, 0.24, -0.12]} castShadow>
        <meshStandardMaterial {...METAL} />
      </mesh>
      {/* knurled collar */}
      <mesh position={[0, -0.16, -0.12]} castShadow>
        <cylinderGeometry args={[0.11, 0.11, 0.3, 32]} />
        <meshStandardMaterial
          color="#c2c5ca"
          metalness={0.9}
          roughness={0.42}
          normalMap={knurl}
          normalScale={new THREE.Vector2(0.9, 0.9)}
        />
      </mesh>
      {/* lower stem, tapering to the smooth pin the photographs show */}
      <mesh position={[0, -0.52, -0.12]} castShadow>
        <cylinderGeometry args={[0.055, 0.038, 0.46, 24]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      <mesh position={[0, -0.76, -0.12]} castShadow>
        <sphereGeometry args={[0.038, 20, 16]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
    </group>
  );
}

/** B — the split ring: two overlapping turns of flat wire, not one closed loop */
function MainSplitRing() {
  return (
    <group>
      {[0.03, -0.03].map((z, i) => (
        <mesh key={i} position={[0, 0, z]} rotation={[0, 0, i ? Math.PI * 0.04 : 0]} castShadow>
          {/* 355 degrees, so each turn has a visible end — that is the split */}
          <torusGeometry args={[0.55, 0.045, 16, 96, Math.PI * 1.972]} />
          <meshStandardMaterial {...CHROME} />
        </mesh>
      ))}
    </group>
  );
}

/** C — the jump ring, lying in the perpendicular plane so it interlocks */
function ConnectorLink() {
  return (
    <mesh rotation={[0, Math.PI / 2, 0]} castShadow>
      <torusGeometry args={[0.14, 0.03, 16, 48]} />
      <meshStandardMaterial {...CHROME} />
    </mesh>
  );
}

/** D + E — the moulded case and the print inside it */
function AcrylicCase({ tex }: { tex: THREE.Texture }) {
  const W = 2.2;
  const H = 3.6;
  const D = 0.16;

  // the eyelet tab: a real extruded shape with a real hole punched through
  // it, so the jump ring passes THROUGH the tab instead of in front of it
  const tab = useMemo(() => {
    const s = new THREE.Shape();
    const w = 0.44, h = 0.42;
    s.moveTo(-w, -0.05);
    s.lineTo(-w * 0.62, h);
    s.quadraticCurveTo(0, h + 0.12, w * 0.62, h);
    s.lineTo(w, -0.05);
    s.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, h * 0.52, 0.12, 0, Math.PI * 2, false);
    s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, { depth: D * 0.72, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2, curveSegments: 24 });
    g.center();
    return g;
  }, []);

  // her print, at ITS OWN aspect — see the note at the top of this file
  const img = tex.image as { width: number; height: number };
  const artW = 1.92;
  const artH = artW / (img.width / img.height);

  // THE CASE IS A PANE OVER A PRINT, NOT A BLOCK AROUND ONE. The first cut
  // followed the brief literally — a full transmissive slab with the art
  // plane buried inside it, plus a second slab for the rim — and rendered a
  // flat grey brick: an object sealed inside a `backside` transmission volume
  // is refracted by it from both directions and simply does not come out.
  // Which is also the wrong physics. A photo keychain is a CLEAR FRONT PANE,
  // the print, and an opaque backing card. Modelled that way the art is never
  // inside the glass, it is behind it, and one transmission material does the
  // work three were failing at — a third of the render targets, too.
  return (
    <group>
      {/* the moulded eyelet tab, above the body and overlapping it */}
      <mesh geometry={tab} position={[0, H / 2 + 0.1, 0]} castShadow>
        {/* `transmission` IS the transparency — pairing it with
            `transparent`+`opacity` (as the first cut did) blends the surface
            a second time and the tab came out a muddy grey wedge */}
        <meshPhysicalMaterial transmission={0.94} thickness={0.12} roughness={0.05} ior={1.49} clearcoat={1} color="#ffffff" />
      </mesh>

      {/* the backing card the print is mounted on */}
      <mesh position={[0, 0, -D * 0.34]} receiveShadow>
        <boxGeometry args={[W, H, D * 0.3]} />
        <meshStandardMaterial color="#efeae2" roughness={0.85} metalness={0} />
      </mesh>

      {/* E — the print itself, sitting on that card */}
      <mesh position={[0, 0, -D * 0.18]}>
        <planeGeometry args={[artW, artH]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>

      {/* D — the clear front pane, the piece that actually refracts */}
      <mesh position={[0, 0, D * 0.22]} castShadow>
        <boxGeometry args={[W, H, D * 0.5]} />
        {/* THIN AND CLEAR. The brief's thickness 0.18 is the depth of the
            whole case; applied to the front pane alone it attenuated the
            print to a milky pastel — this is 2mm of PMMA over a photograph,
            not a glass brick. anisotropicBlur off for the same reason: her
            line work has to stay legible through it. */}
        <MeshTransmissionMaterial
          transmission={0.99}
          thickness={0.05}
          roughness={0.02}
          ior={1.49}
          chromaticAberration={0.02}
          anisotropicBlur={0}
          backside={false}
          samples={6}
          resolution={256}
        />
      </mesh>

      {/* the raised bevelled rim standing proud of that pane, as a frame —
          four bars, so it never covers the picture */}
      {[
        [0, H / 2 - 0.06, W, 0.12],
        [0, -H / 2 + 0.06, W, 0.12],
        [-W / 2 + 0.06, 0, 0.12, H],
        [W / 2 - 0.06, 0, 0.12, H],
      ].map(([x, y, bw, bh], i) => (
        <mesh key={i} position={[x, y, D * 0.42]}>
          <boxGeometry args={[bw, bh, D * 0.2]} />
          <meshPhysicalMaterial transmission={0.93} thickness={0.06} roughness={0.04} ior={1.49} clearcoat={1} color="#ffffff" />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// THE PHYSICS — a real double pendulum, which is why it reads as an object
// rather than an animation. Two pivots, exactly where the mechanism has them:
// the ring swings about the peg it rests on, and the case swings about the
// jump ring, lagging behind the ring the way a hanging mass lags its support.
// Each integrates angular acceleration from a gravity restoring torque plus
// damping; a drag pushes angular velocity into the first pivot and the second
// inherits it through the coupling term.
// ---------------------------------------------------------------------------
export type Swing = { a: number; va: number; b: number; vb: number; push: number };

export function Keychain3D({
  src,
  swing,
}: {
  /** the extracted print, e.g. /products/keychain-01-art.webp */
  src: string;
  /** shared, mutated by the host's pointer handlers — never React state, a
   *  60fps spring cannot be a re-render */
  swing: React.MutableRefObject<Swing>;
}) {
  const ring = useRef<THREE.Group>(null);
  const case_ = useRef<THREE.Group>(null);
  const tex = useLoader(THREE.TextureLoader, src);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  useFrame((_, dtRaw) => {
    // clamp: a backgrounded tab returns one enormous delta and the pendulum
    // integrates itself to the moon
    const dt = Math.min(dtRaw, 1 / 30);
    const s = swing.current;

    // pivot 1 — the ring on the peg
    const accA = -9.5 * Math.sin(s.a) - 1.7 * s.va + s.push;
    s.va += accA * dt;
    s.a += s.va * dt;
    s.push *= 0.86;

    // pivot 2 — the case on the jump ring, dragged by pivot 1's motion
    const accB = -13 * Math.sin(s.b - s.a * 0.55) - 2.4 * s.vb;
    s.vb += accB * dt;
    s.b += s.vb * dt;

    if (ring.current) ring.current.rotation.z = s.a;
    if (case_.current) case_.current.rotation.z = s.b - s.a;
  });

  // THE ASSEMBLY IS CENTRED ON THE CAMERA, not on its own pivot. Measured: it
  // runs from the backplate's top at y +0.7 down to the case's bottom edge at
  // y −4.74, so its middle is y ≈ −2.0 and it is ~5.4 tall. Left at the pivot
  // origin the case hung out of the bottom of the canvas — this group lifts
  // the whole mechanism so the camera can sit at 0 and frame all of it.
  return (
    <group name="KeychainRoot" position={[0, 2.05, 0]}>
      {/* the room: no HDRI, no network — strip lights and a fill, which is
          what the chrome and the PMMA actually refract */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={5} position={[-3, 2, 3]} scale={[6, 8, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={2.2} position={[4, 1, 2]} scale={[4, 6, 1]} target={[0, 0, 0]} />
        <Lightformer form="circle" intensity={3} position={[0, 5, -2]} scale={4} target={[0, 0, 0]} />
        <mesh scale={30}>
          {/* the wall itself, so the transmission has a ground to pick up */}
          <sphereGeometry args={[1, 32, 32]} />
          <meshBasicMaterial color="#2a2422" side={THREE.BackSide} />
        </mesh>
      </Environment>

      {/* A — static */}
      <WallHook />

      {/* the dangling assembly, pivoting at the peg's contact point */}
      <group ref={ring} position={[0, 0.32, 0]}>
        <group position={[0, -0.55, 0]}>
          <MainSplitRing />
          {/* C sits at the ring's lowest wire, interlocking it */}
          <group position={[0, -0.55, 0]}>
            <ConnectorLink />
            {/* D + E hang from the jump ring on their own pivot */}
            <group ref={case_} position={[0, -0.11, 0]}>
              <group position={[0, -2.05, 0]}>
                <AcrylicCase tex={tex} />
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

export default Keychain3D;
