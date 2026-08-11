"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import geo from "@/lib/armenia.json";
import type { Stockist } from "@/lib/content";

// ============================================================================
// THE MAP — Armenia as it actually is.
//
// The outline is REAL open data, vendored into lib/armenia.json at build time
// so nothing is fetched at runtime (the site's CSP is self-only anyway):
//   country + provinces  geoBoundaries gbOpen ARM ADM0/ADM1 (simplified)
//   Lake Sevan           Natural Earth 50m lakes
// It keeps the country's real enclaves as holes and its exclave as a separate
// piece, because leaving them out would be redrawing a border.
//
// It is a drawing, not an instrument: simplified to ~11 m and stated as such
// in the data file. The towns sit at their true coordinates on top of it.
// ============================================================================

/** The drawing's longest side, in scene units. A ground plane is foreshortened
 *  unevenly — the near (southern) end is magnified — so this is not simply
 *  "as big as the camera can see": at 7.2 with the old low camera the Syunik
 *  tail ran off the bottom. With the camera raised to [0,13,7.6] the country
 *  measured only 54% of the stage, so it is scaled to fill about three
 *  quarters, which the label chips still clear. */
const FIT = 9.6;

// Where the land actually is, vertically. ExtrudeGeometry runs along +Z and
// the rotateX(90°) below turns that into −Y, so the slab hangs BELOW its own
// origin — but the bevel also lifts the top face by bevelThickness above it.
// Anything laid on the map (the lake, the province lines, the pins) must sit
// on SURFACE, not on TOP: at TOP they are inside the solid and vanish, which
// is exactly how the lake and the borders disappeared.
const TOP = -0.25;
const BEVEL = 0.05;
const SURFACE = TOP + BEVEL;

type Ring = [number, number][];
type Part = { outer: Ring; holes: Ring[] };

const BB = geo.bbox as [number, number, number, number];
const LNG0 = (BB[0] + BB[2]) / 2;
const LAT0 = (BB[1] + BB[3]) / 2;
/** longitude degrees are shorter than latitude ones this far north */
const KX = Math.cos((LAT0 * Math.PI) / 180);
const SCALE =
  FIT / Math.max((BB[2] - BB[0]) * KX, BB[3] - BB[1]);

/** lng/lat → the ground plane (x east, z south) */
export function project(lng: number, lat: number): [number, number] {
  return [(lng - LNG0) * KX * SCALE, -(lat - LAT0) * SCALE];
}

const toShape = (p: Part) => {
  const s = new THREE.Shape(p.outer.map(([x, y]) => new THREE.Vector2(...project(x, y))));
  for (const h of p.holes) {
    s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(...project(x, y)))));
  }
  return s;
};

function Country() {
  const { land, shadow, provinces, lake } = useMemo(() => {
    const shapes = (geo.country as Part[]).map(toShape);
    const land = new THREE.ExtrudeGeometry(shapes, {
      depth: 0.5,
      bevelEnabled: true,
      bevelSize: 0.05,
      bevelThickness: BEVEL,
      bevelSegments: 2,
    });
    land.rotateX(Math.PI / 2);
    land.computeVertexNormals();

    // the country's own silhouette, flattened and darkened underneath — a
    // drop shadow that costs one draw call instead of a shadow map
    const shadow = new THREE.ShapeGeometry(shapes);
    shadow.rotateX(Math.PI / 2);

    // provinces are hairlines ON the surface: y just above the top face
    const provinces = (geo.provinces as Array<{ name: string; ring: Ring }>).map((p) => {
      const pts = p.ring.map(([x, y]) => {
        const [px, pz] = project(x, y);
        return new THREE.Vector3(px, 0.001, pz);
      });
      return { name: p.name, g: new THREE.BufferGeometry().setFromPoints(pts) };
    });

    const lakeRing = geo.lake as Ring;
    let lake: THREE.BufferGeometry | null = null;
    if (lakeRing.length > 3) {
      const s = new THREE.Shape(lakeRing.map(([x, y]) => new THREE.Vector2(...project(x, y))));
      lake = new THREE.ShapeGeometry(s);
      lake.rotateX(Math.PI / 2);
    }
    return { land, shadow, provinces, lake };
  }, []);

  // A flat ShapeGeometry rotated with the ground points its normal DOWNWARD,
  // so the lake and the shadow are double-sided or they render as nothing.
  return (
    <group>
      <mesh geometry={shadow} position={[0.12, TOP - 0.42, 0.16]}>
        <meshBasicMaterial color="#0d1526" transparent opacity={0.45} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={land} position={[0, TOP, 0]}>
        <meshLambertMaterial color="#f3e2cb" />
      </mesh>
      {/* Lake Sevan — the one feature that makes the shape unmistakable */}
      {lake && (
        <mesh geometry={lake} position={[0, SURFACE + 0.006, 0]}>
          <meshBasicMaterial color="#568FC3" side={THREE.DoubleSide} />
        </mesh>
      )}
      <group position={[0, SURFACE + 0.012, 0]}>
        {provinces.map((p) => (
          <lineLoop key={p.name} geometry={p.g}>
            <lineBasicMaterial color="#232834" transparent opacity={0.24} />
          </lineLoop>
        ))}
      </group>
    </group>
  );
}

function Pin({
  s,
  on,
  idx,
  onPick,
}: {
  s: Stockist;
  on: boolean;
  /** used only to stagger the labels: Vanadzor, Dilijan and Sevan are ~40km
   *  apart and their names collided at this zoom */
  idx: number;
  onPick: (id: string) => void;
}) {
  const head = useRef<THREE.Group>(null);
  const [x, z] = useMemo(() => project(s.lng, s.lat), [s.lng, s.lat]);
  const confirmed = s.shop.trim().length > 0;
  const phase = useMemo(() => (s.lat * 7 + s.lng * 3) % (Math.PI * 2), [s.lat, s.lng]);

  useFrame((state) => {
    const g = head.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    // the head rides on top of a 0.38 stalk that stands on the land
    g.position.y = SURFACE + 0.5 + (on ? 0.42 : 0) + Math.sin(t * 1.4 + phase) * 0.05;
    const want = on ? 1.35 : 1;
    g.scale.x += (want - g.scale.x) * 0.12;
    g.scale.y = g.scale.z = g.scale.x;
  });

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, SURFACE + 0.19, 0]}>
        <cylinderGeometry args={[0.028, 0.028, 0.38, 8]} />
        <meshLambertMaterial color="#374897" />
      </mesh>
      <group
        ref={head}
        onClick={(e) => {
          e.stopPropagation();
          onPick(s.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <mesh>
          <sphereGeometry args={[0.15, 18, 18]} />
          {/* hollow while no shop is confirmed there — the map never shows a
              solid marker for a place you cannot actually go */}
          <meshLambertMaterial
            color={on ? "#EFAB23" : confirmed ? "#D1622D" : "#9d8b73"}
            wireframe={!confirmed}
          />
        </mesh>
        <Html center distanceFactor={13} zIndexRange={[20, 0]}>
          <span
            className={`ap-map__tag${on ? " on" : ""}`}
            style={
              {
                // stacked AND fanned: a vertical stagger alone still let
                // Dilijan and Sevan print over each other
                "--lift": `${-22 - (idx % 3) * 16}px`,
                "--shift": `${idx % 2 ? -26 : 26}px`,
              } as React.CSSProperties
            }
          >
            {s.town}
          </span>
        </Html>
      </group>
    </group>
  );
}

type Spin = { yaw: number; v: number; dragging: boolean };

function Scene({
  towns,
  sel,
  onPick,
  spin,
}: {
  towns: Stockist[];
  sel: string | null;
  onPick: (id: string) => void;
  spin: React.RefObject<Spin>;
}) {
  const rig = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    const g = rig.current;
    const s = spin.current;
    if (!g || !s) return;
    const step = Math.min(delta, 1 / 20) * 60;
    if (!s.dragging) {
      s.yaw += s.v * step;
      s.v *= Math.pow(0.94, step);
      if (Math.abs(s.v) < 0.0002) s.v = 0;
    }
    // A locator map that spins is unreadable — the country turns back and
    // forth by about ten degrees instead, and a drag still turns it freely.
    g.rotation.y = s.yaw + Math.sin(state.clock.elapsedTime * 0.16) * 0.17;
    g.rotation.x = Math.sin(state.clock.elapsedTime * 0.11) * 0.035;
  });

  return (
    // A group transforms T·R·S, so this offset moves the drawing without
    // moving the pivot the sway turns about. Measured, not guessed: at FIT 8.8
    // the country sat with 148px of stage to its left and 101px to its right,
    // 118 above and 87 below — a ground plane's centroid does not land on the
    // screen centre just because its bbox is centred on the origin.
    <group ref={rig} position={[-0.42, 0, -0.56]}>
      <Country />
      {towns.map((s, i) => (
        <Pin key={s.id} s={s} idx={i} on={sel === s.id} onPick={onPick} />
      ))}
    </group>
  );
}

export default function ArmeniaMap({
  towns,
  sel,
  cue,
  onPick,
}: {
  towns: Stockist[];
  sel: string | null;
  /** rendered INSIDE the stage — as a sibling it was clipped by the stage's
   *  own bottom edge */
  cue?: string;
  onPick: (id: string) => void;
}) {
  const spin = useRef<Spin>({ yaw: 0, v: 0, dragging: false });
  const last = useRef({ x: 0, sens: 0.006 });

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {}
    last.current = { x: e.clientX, sens: (Math.PI * 1.2) / Math.max(1, el.clientWidth) };
    spin.current.dragging = true;
    spin.current.v = 0;
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = spin.current;
    if (!s.dragging) return;
    const d = (e.clientX - last.current.x) * last.current.sens;
    s.yaw += d;
    s.v = s.v * 0.7 + d * 0.3;
    last.current.x = e.clientX;
  };
  const onUp = () => {
    spin.current.dragging = false;
  };

  return (
    <div
      className="ap-map__stage"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {/* higher and less oblique than a first pass at [0,10.6,9.4]: the more
          top-down the camera, the less the near end is magnified, and the
          whole country fits without shrinking it further */}
      <Canvas camera={{ position: [0, 13, 7.6], fov: 40 }} dpr={[1, 1.6]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={1.55} />
        <directionalLight position={[6, 10, 5]} intensity={1.5} />
        <directionalLight position={[-6, 5, -4]} intensity={0.4} color="#9fb4e8" />
        <Scene towns={towns} sel={sel} onPick={onPick} spin={spin} />
      </Canvas>
      {cue && (
        <p className="ap-map__cue" aria-hidden="true">
          {cue}
        </p>
      )}
    </div>
  );
}
