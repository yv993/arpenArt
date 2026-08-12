"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import geo from "@/lib/armenia.json";
import terrain from "@/lib/terrain-meta.json";
import type { Stockist } from "@/lib/content";

// ============================================================================
// THE MAP — Armenia as it actually is, now in RELIEF (client 2026-08-12,
// from a physical-map reference: real mountains, real imagery, Sevan dark).
//
// Everything is REAL open data, vendored at build time so nothing is fetched
// at runtime (the site's CSP is self-only anyway):
//   outline + enclaves   geoBoundaries gbOpen ARM ADM0 (simplified) — the
//                        enclave holes and the exclave stay, because leaving
//                        them out would be redrawing a border
//   elevation            SRTM (NASA/USGS, public domain) via AWS terrain
//                        tiles, baked into /map/height.png
//   surface              Landsat imagery (NASA/USGS, public domain) baked
//                        into /map/relief.jpg — the lake, the forests and
//                        the bare volcanic west are photographed, not drawn
//
// THE THREE RASTERS SHARE ONE GRID: equirectangular over the SAME bbox the
// vector border uses, rows linear in latitude. The mercator tiles both
// sources ship as were resampled per-pixel at bake time — pasted unprojected
// they would slide Lake Sevan several kilometres against the vector border,
// and the mask cut would shave one bank of the lake while leaving land
// outside the other.
//
// It is a model, not an instrument: heights are exaggerated the way any
// physical relief model exaggerates (a true-scale Aragats would be one
// millimetre tall on a table-sized country), and the towns sit at their true
// coordinates ON the relief.
// ============================================================================

/** The drawing's longest side, in scene units. A ground plane is foreshortened
 *  unevenly — the near (southern) end is magnified — so this is not simply
 *  "as big as the camera can see": at 7.2 with the old low camera the Syunik
 *  tail ran off the bottom. With the camera raised to [0,13,7.6] the country
 *  measured only 54% of the stage, so it is scaled to fill about three
 *  quarters, which the label chips still clear. */
const FIT = 9.6;

// Where the land's SEA LEVEL sits, vertically. The relief rises from here.
const TOP = -0.25;

// HOW TALL THE MOUNTAINS ARE. At true scale Aragats would rise 0.13 scene
// units over a 9.6-unit country — a millimetre on a table-sized model, i.e.
// invisible, which is why every physical relief map ever cast exaggerates.
// 5.5x reads as mountains without turning the Ararat plain into a wall.
const EXAGGERATION = 5.5;
// scene units per metre of real elevation: SCALE is units per degree of
// latitude, and a degree of latitude is 111.32 km everywhere
const ELEV_MIN = terrain.elevMin as number;
const ELEV_MAX = terrain.elevMax as number;

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

// ---------------------------------------------------------------------------
// THE RELIEF. /map/height.png is real SRTM elevation and /map/mask.png is the
// country's outline, both in the same equirectangular grid as the imagery.
// They are decoded ONCE into Float32 grids: the same numbers build the mesh,
// stand every pin at its town's true altitude, and clamp the outside world.
// ---------------------------------------------------------------------------

type HeightField = {
  /** elevation, normalized 0..1 over [ELEV_MIN, ELEV_MAX] */
  h: Float32Array;
  /** inside-the-border, 0..1 */
  m: Float32Array;
  w: number;
  rows: number;
};

function decode(url: string): Promise<{ v: Float32Array; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return reject(new Error("2d"));
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const v = new Float32Array(c.width * c.height);
      for (let i = 0; i < v.length; i++) v[i] = d[i * 4] / 255;
      resolve({ v, w: c.width, h: c.height });
    };
    img.onerror = () => reject(new Error(url));
    img.src = url;
  });
}

function useHeightField(): HeightField | null {
  const [hf, setHf] = useState<HeightField | null>(null);
  useEffect(() => {
    let dead = false;
    Promise.all([decode("/map/height.png"), decode("/map/mask.png")]).then(([he, ma]) => {
      if (dead) return;
      setHf({ h: he.v, m: ma.v, w: he.w, rows: he.h });
    });
    // no catch on purpose: if the rasters ever fail the map keeps its shadow
    // and pins render flat — verified below by gating on hf
    return () => {
      dead = true;
    };
  }, []);
  return hf;
}

/** bilinear sample of a grid in unit UV space, v measured from the north */
function sample(g: Float32Array, w: number, rows: number, u: number, v: number) {
  const x = Math.min(Math.max(u, 0), 1) * (w - 1);
  const y = Math.min(Math.max(v, 0), 1) * (rows - 1);
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, rows - 1);
  const fx = x - x0, fy = y - y0;
  const a = g[y0 * w + x0], b = g[y0 * w + x1], c = g[y1 * w + x0], d = g[y1 * w + x1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

/** scene height of the terrain surface at a real coordinate */
function surfaceY(hf: HeightField, lng: number, lat: number) {
  const u = (lng - BB[0]) / (BB[2] - BB[0]);
  const v = (BB[3] - lat) / (BB[3] - BB[1]);
  const exag = ((ELEV_MAX - ELEV_MIN) * SCALE * EXAGGERATION) / 111320;
  return TOP + sample(hf.h, hf.w, hf.rows, u, v) * exag;
}

function Terrain({ hf }: { hf: HeightField }) {
  const [relief, alpha] = useLoader(THREE.TextureLoader, ["/map/relief.webp", "/map/mask.png"]);

  const geom = useMemo(() => {
    relief.colorSpace = THREE.SRGBColorSpace;
    relief.anisotropy = 8;

    const cols = 320;
    const rows = 322;
    const exag = ((ELEV_MAX - ELEV_MIN) * SCALE * EXAGGERATION) / 111320;
    const pos = new Float32Array((cols + 1) * (rows + 1) * 3);
    const uv = new Float32Array((cols + 1) * (rows + 1) * 2);
    const col = new Float32Array((cols + 1) * (rows + 1) * 3);
    const BASE = TOP - 0.42;
    let p = 0, t = 0, ci = 0;
    for (let r = 0; r <= rows; r++) {
      const vf = r / rows;
      const lat = BB[3] - vf * (BB[3] - BB[1]);
      for (let c = 0; c <= cols; c++) {
        const uf = c / cols;
        const lng = BB[0] + uf * (BB[2] - BB[0]);
        const [x, z] = project(lng, lat);
        // THE CLIFF IS THE CLAMP. Terrain outside the border dives to the
        // shadow plane, so the border becomes the model's cut side — without
        // it the alpha cut left the terrain edge floating, an open seam you
        // could see the page through wherever the border stands high.
        // SMOOTHLY, not as a step: a binary in/out test at vertex granularity
        // turned every diagonal stretch of border into alternating spikes —
        // dragon teeth all down the Araks valley. Sliding vertices down over
        // the mask's own 2-texel transition band hangs one continuous
        // curtain instead.
        const m = sample(hf.m, hf.w, hf.rows, uf, vf);
        const k = Math.min(Math.max((m - 0.25) / 0.5, 0), 1);
        const s = k * k * (3 - 2 * k);
        const y = BASE + (TOP + sample(hf.h, hf.w, hf.rows, uf, vf) * exag - BASE) * s;
        pos[p++] = x; pos[p++] = y; pos[p++] = z;
        uv[t++] = uf; uv[t++] = 1 - vf;
        // the cut side in shadow: curtain vertices darken as they descend,
        // so the smeared edge texture reads as shaded rock face, the way a
        // cast relief model's sides fall into shade — not as bright streaks
        const shade = 0.45 + 0.55 * s;
        col[ci++] = shade; col[ci++] = shade; col[ci++] = shade;
      }
    }
    const idx = new Uint32Array(cols * rows * 6);
    let q = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = r * (cols + 1) + c;
        const b = a + 1;
        const d = a + (cols + 1);
        const e = d + 1;
        idx[q++] = a; idx[q++] = d; idx[q++] = b;
        idx[q++] = b; idx[q++] = d; idx[q++] = e;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    return g;
  }, [hf, relief]);

  return (
    <mesh geometry={geom}>
      {/* the cut runs at the mask's own resolution, not the grid's: the
          fragment test keeps the silhouette crisp between vertices. The
          threshold is LOW on purpose — the curtain's fragments sit a texel
          or two outside the border in UV, and a 0.35 test amputated the
          wall's foot, reopening the seam the curtain exists to close. */}
      <meshStandardMaterial
        map={relief}
        alphaMap={alpha}
        alphaTest={0.12}
        roughness={1}
        metalness={0}
        vertexColors
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Country({ hf }: { hf: HeightField | null }) {
  const shadow = useMemo(() => {
    const shapes = (geo.country as Part[]).map(toShape);
    // the country's own silhouette, flattened and darkened underneath — a
    // drop shadow that costs one draw call instead of a shadow map
    const s = new THREE.ShapeGeometry(shapes);
    s.rotateX(Math.PI / 2);
    return s;
  }, []);

  return (
    <group>
      <mesh geometry={shadow} position={[0.12, TOP - 0.44, 0.16]}>
        <meshBasicMaterial color="#0d1526" transparent opacity={0.45} side={THREE.DoubleSide} />
      </mesh>
      {hf && <Terrain hf={hf} />}
    </group>
  );
}

function Pin({
  s,
  on,
  idx,
  ground,
  onPick,
}: {
  s: Stockist;
  on: boolean;
  /** used only to stagger the labels: Vanadzor, Dilijan and Sevan are ~40km
   *  apart and their names collided at this zoom */
  idx: number;
  /** the terrain's surface height under this town — a pin on a relief map
   *  stands on its mountain, not on sea level */
  ground: number;
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
    g.position.y = 0.5 + (on ? 0.42 : 0) + Math.sin(t * 1.4 + phase) * 0.05;
    const want = on ? 1.35 : 1;
    g.scale.x += (want - g.scale.x) * 0.12;
    g.scale.y = g.scale.z = g.scale.x;
  });

  return (
    <group position={[x, ground, z]}>
      <mesh position={[0, 0.19, 0]}>
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
        {/* pointerEvents none ON THE WRAPPER, not only the chip: drei's
            centering div is an invisible ~70x20px box sitting exactly over
            the pin head, and with default pointer-events it swallowed the
            very clicks the head exists for — the chip's own CSS `none`
            never covered the box around it */}
        <Html center distanceFactor={13} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
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
  hf,
  onPick,
  spin,
}: {
  towns: Stockist[];
  sel: string | null;
  hf: HeightField | null;
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
      <Country hf={hf} />
      {/* the pins wait for the relief: dropped at sea level first they would
          visibly leap uphill the moment the heightfield decoded */}
      {hf &&
        towns.map((s, i) => (
          <Pin
            key={s.id}
            s={s}
            idx={i}
            on={sel === s.id}
            ground={surfaceY(hf, s.lng, s.lat)}
            onPick={onPick}
          />
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
  const last = useRef<{
    x: number;
    start: number;
    sens: number;
    id: number;
    captured: boolean;
    el: HTMLDivElement | null;
  }>({ x: 0, start: 0, sens: 0.006, id: 0, captured: false, el: null });
  // decoded outside the Canvas: the rasters are plain <img> work, and the
  // shadow renders immediately while they arrive
  const hf = useHeightField();

  // POINTER CAPTURE IS DEFERRED UNTIL THE HAND ACTUALLY MOVES. Capturing on
  // pointerdown — the obvious way to keep a drag alive outside the stage —
  // RETARGETS the following pointerup to this div, so the three.js canvas
  // underneath never hears it, and a click is a down THE CANVAS GOT plus an
  // up IT DID NOT: every pin on the map was unclickable, silently, while the
  // drag felt fine. Capture now starts only after 4px of real movement —
  // a still press stays a click for the pin, a moving one becomes the drag
  // it always was (and keeps working outside the stage, which is what the
  // capture is for).
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    last.current = {
      x: e.clientX,
      start: e.clientX,
      sens: (Math.PI * 1.2) / Math.max(1, el.clientWidth),
      id: e.pointerId,
      captured: false,
      el,
    };
    spin.current.dragging = true;
    spin.current.v = 0;
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = spin.current;
    if (!s.dragging) return;
    const L = last.current;
    if (!L.captured && Math.abs(e.clientX - L.start) > 4) {
      try {
        L.el?.setPointerCapture(L.id);
      } catch {}
      L.captured = true;
    }
    const d = (e.clientX - L.x) * L.sens;
    s.yaw += d;
    s.v = s.v * 0.7 + d * 0.3;
    L.x = e.clientX;
  };
  const onUp = () => {
    spin.current.dragging = false;
    last.current.captured = false;
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
        {/* lit like a relief model on a table: one warm key from the
            north-west so the ranges cast their shading south-east (the
            direction the satellite photo's own faint shading already leans),
            ambient high enough that valleys stay readable on the navy page */}
        <ambientLight intensity={1.35} />
        <directionalLight position={[-5, 9, -4]} intensity={1.7} color="#fff4e0" />
        <directionalLight position={[6, 5, 5]} intensity={0.5} color="#9fb4e8" />
        <Suspense fallback={null}>
          <Scene towns={towns} sel={sel} hf={hf} onPick={onPick} spin={spin} />
        </Suspense>
      </Canvas>
      {cue && (
        <p className="ap-map__cue" aria-hidden="true">
          {cue}
        </p>
      )}
    </div>
  );
}
