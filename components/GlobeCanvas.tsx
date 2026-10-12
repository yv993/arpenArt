"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { ParticleSphere } from "./ParticleSphere";
import { CAMERA_Z, type Spin } from "./sphereSpin";

// ============================================================================
// THE SPHERE'S CANVAS, IN ITS OWN CHUNK (2026-10-05 package, done 2026-10-07).
//
// This subtree used to sit inline in Gallery.tsx, which made three.js and
// @react-three/fiber static imports of the home route: a phone at 390x844
// evaluated them at scrollY 0 (window.__THREE__ = "171", WebGLRenderer in the
// route's page.js) though the gallery is two screens down and the canvas only
// ever mounts once the section is near. Gallery now loads this module with
// next/dynamic when — and only when — it mounts the canvas, and warms the
// chunk in idle time on the desktop moved layer, so a 1440 visitor's sphere
// is ready exactly as before. Props and the Canvas's camera, dpr and gl are
// the ones Gallery passed, unchanged.
// ============================================================================

export default function GlobeCanvas({
  images,
  spin,
  chosenRef,
  onPick,
  onPointerMissed,
}: {
  images: string[];
  spin: React.RefObject<Spin>;
  chosenRef: React.RefObject<number | null>;
  onPick: (i: number) => void;
  onPointerMissed: () => void;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, CAMERA_Z], fov: 50 }}
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={onPointerMissed}
    >
      <Suspense fallback={null}>
        <ParticleSphere images={images} spin={spin} chosenRef={chosenRef} onPick={onPick} />
      </Suspense>
    </Canvas>
  );
}
