"use client";

import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { POOL, settle } from "@/lib/textfx";

/** Pins must be torn down in a LAYOUT effect — see the note in MorphHero.
 *  SSR has no window and useLayoutEffect warns there, so it swaps in only
 *  on the client. */
const useLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

// ============================================================================
// FLOAT SHOP — the shop categories as pahari.vercel.app's floating gallery.
//
// The reference was probed, not eyeballed: it is ONE viewport tall, a single
// WebGL canvas (no DOM images at all), Lenis virtual scroll turning the
// arrangement, a serif title dead-centre in the room, and a pill that morphs
// the layout between a SPHERE (cards strewn around you, rim ones steeply
// foreshortened) and a CYLINDER (a rising helix of cards). Everything floats
// gently the whole time.
//
// Kept: the fixed stage, both arrangements and the animated morph between
// them, scroll-driven rotation, the centre title, the pill, the float.
// Changed, deliberately:
//   · honest scroll — the reference hijacks the wheel through Lenis on a
//     900px document; here a pinned ScrollTrigger drives the same rotation
//     and the page continues to the categories' real grid below
//   · the cards are CATEGORIES with names and prices — hover names them,
//     click goes to the category. The reference's paintings are mute.
//   · the DOM grid stays in the document as the accessible layer: sr-only
//     while the canvas runs, a visible bottom sheet the moment keyboard
//     focus enters it, and the whole experience on phones / reduced motion /
//     no WebGL. A shop must not be locked inside a canvas.
// ============================================================================

export type FloatCat = {
  slug: string;
  name: string;
  from: number;
  status: "open" | "soon";
  tex: string;
  w: number;
  h: number;
};

const DESKTOP = "(min-width: 861px) and (prefers-reduced-motion: no-preference)";

const RING_R = 6.2;
const HELIX_R = 6.4;
const HELIX_RISE = 0.78;
const CARD_W = 2.0;
/** How far the whole arrangement turns across the pin. A FULL turn, so every
 *  card reaches the centre position exactly once on the way down — at 1.5π
 *  the last quarter of the catalogue never came round. */
const TURN = Math.PI * 2;
/** Viewports of scroll the room holds, per product. Nine categories × 0.42
 *  ≈ 3.8 screens: long enough to read each name as it arrives, short enough
 *  that the page still feels like it is going somewhere. */
const PIN_PER_CARD = 0.42;

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
  onPick,
  onHover,
}: {
  cat: FloatCat;
  index: number;
  total: number;
  view: React.RefObject<number>;
  onPick: (c: FloatCat) => void;
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
  onPick,
  onHover,
  onFocus,
}: {
  cats: FloatCat[];
  view: React.RefObject<number>;
  scrollP: React.RefObject<number>;
  onPick: (c: FloatCat) => void;
  onHover: (c: FloatCat | null) => void;
  /** which card currently holds the centre — the one nearest the camera */
  onFocus: (i: number) => void;
}) {
  const rig = useRef<THREE.Group>(null);
  const lastFocus = useRef(-1);

  useFrame((state) => {
    const g = rig.current;
    if (!g) return;
    // scroll turns the room; the sketch's idle ROTATION_SPEED_Y (0.0005/frame
    // ≈ 0.03 rad/s) keeps it turning gently even when nobody scrolls
    const rotY = -(scrollP.current ?? 0) * TURN - state.clock.elapsedTime * 0.03;
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
          <Card key={c.slug} cat={c} index={i} total={cats.length} view={view} onPick={onPick} onHover={onHover} />
        ))}
      </group>
    </group>
  );
}

// ============================================================================
// The centre's appearance repertoire. Naming a category is not one animation
// but three, taken in turn on every change:
//   flip      the whole centre panel turns over (the original)
//   rise      the name climbs letter by letter out of its own line
//   decipher  the name settles out of Armenian letterforms, left to right
// GSAP drives all three — a CSS transition on `transform` would ease every
// per-frame write and turn the other two logics to soup.
//
// The centre names whatever holds the CENTRE POSITION as the room turns, and
// a hover overrides it — so there is always a product named there and every
// change is an entrance. That is why there is no conceal: nothing ever
// leaves, it is only replaced.
// ============================================================================

type FxKind = "flip" | "rise" | "decipher";

/** ONE logic, every time (client 2026-08-06: "this part all text appearance
 *  must be like skirts text appeared").
 *
 *  Which one that is was MEASURED, not guessed: the cycle used to advance once
 *  per change, so walking the pin from a fresh load and reading the panel's own
 *  `data-fx` marker gives the order deterministically — Skirts came up seventh
 *  and drew `rise`. (The screenshot the client sent showed SCARVES, which had
 *  landed on `decipher` — the scramble — which is the contrast they were
 *  reacting to.) `rise` is also the only one of the three that animates ALL
 *  the panel's text rather than just the name: the letters climb and the
 *  kicker and price line follow it up.
 *
 *  The other two timelines are kept below rather than deleted: this project is
 *  not under version control, and restoring the old behaviour should stay a
 *  one-word edit here. Site-wide variety is unaffected — lib/textfx.ts still
 *  runs six different logics across the other sections. */
const FX_ALWAYS: FxKind = "rise";

type FxEls = {
  panel: HTMLElement;
  chars: HTMLElement[];
  lines: HTMLElement[];
};

function grabFxEls(root: HTMLElement): FxEls | null {
  const panel = root.querySelector<HTMLElement>(".ap-fs__panel");
  if (!panel) return null;
  return {
    panel,
    chars: Array.from(panel.querySelectorAll<HTMLElement>(".ap-fs__ch")),
    lines: Array.from(panel.querySelectorAll<HTMLElement>(".ap-kicker, .ap-fs__from")),
  };
}

/** The decipher core: a proxy tween shuffles every unsettled span through the
 *  Armenian pool and locks them to their real glyph left to right. */
function scrambleTo(tl: gsap.core.Timeline, chars: HTMLElement[], at: number, dur: number) {
  const run = { p: 0 };
  tl.to(
    run,
    {
      p: 1,
      duration: dur,
      ease: "power1.inOut",
      onUpdate: () => {
        const done = Math.floor(run.p * chars.length);
        chars.forEach((c, i) => {
          c.textContent = i < done ? (c.dataset.ch ?? "") : POOL[(Math.random() * POOL.length) | 0];
        });
      },
      onComplete: () => settle(chars),
    },
    at,
  );
}

/** Every change of the named category is an ENTRANCE of the new name —
 *  React has already written the text by the time these run, so there is
 *  nothing to animate out. `rise` is the one that ships; see FX_ALWAYS. */
const CHANGE: Record<FxKind, (els: FxEls) => gsap.core.Timeline> = {
  // the panel turns over on its own hinge and arrives face-on
  flip: ({ panel, chars, lines }) => {
    settle(chars);
    const tl = gsap.timeline();
    tl.set(chars, { clearProps: "all" }, 0)
      .set(lines, { clearProps: "all" }, 0)
      .fromTo(
        panel,
        { rotationX: -94, autoAlpha: 0, transformPerspective: 1100, transformOrigin: "50% 50%" },
        { rotationX: 0, autoAlpha: 1, duration: 0.72, ease: "power3.out" },
        0,
      );
    return tl;
  },
  // the letters climb out of their own line, the two small lines follow
  rise: ({ panel, chars, lines }) => {
    settle(chars);
    const tl = gsap.timeline();
    tl.set(panel, { clearProps: "transform", autoAlpha: 1 }, 0)
      .fromTo(chars, { yPercent: 135, autoAlpha: 1 }, { yPercent: 0, duration: 0.7, ease: "power4.out", stagger: 0.03 }, 0)
      .fromTo(lines, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: "power3.out", stagger: 0.1 }, 0.12);
    return tl;
  },
  // the name settles out of Armenian letterforms, left to right
  decipher: ({ panel, chars, lines }) => {
    settle(chars);
    const tl = gsap.timeline();
    tl.set(panel, { clearProps: "transform", autoAlpha: 1 }, 0)
      .set(chars, { yPercent: 0 }, 0)
      .fromTo(chars, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.22, ease: "none", stagger: 0.02 }, 0)
      .fromTo(lines, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, stagger: 0.1 }, 0.35);
    scrambleTo(tl, chars, 0.04, Math.max(0.6, chars.length * 0.055));
    return tl;
  },
};

export default function FloatShop({
  cats,
  kicker,
  name,
  copy,
}: {
  cats: FloatCat[];
  kicker: string;
  /** the section's name — it stands in the room's top-left corner */
  name: string;
  copy: string;
}) {
  const root = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const [live, setLive] = useState(false);
  const [mode, setMode] = useState<"sphere" | "cylinder">("sphere");
  /** what the pointer is on — overrides the centre while it lasts */
  const [hovered, setHovered] = useState<FloatCat | null>(null);
  /** which card the turning room has brought to the centre position */
  const [focusI, setFocusI] = useState(0);

  // refs shared with the frame loop — a pill click is state, 60fps is not
  const view = useRef(0);
  const scrollP = useRef(0);

  // Gate check only — the pin must NOT be created here. setLive is async, so
  // a ScrollTrigger created in the same effect measures the 295px plain-layer
  // box and locks it into the pin's inline styles before the [data-live] CSS
  // has ever laid out the 100svh room. Found the hard way.
  useEffect(() => {
    let webgl = false;
    try {
      const c = document.createElement("canvas");
      webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {}
    if (webgl && window.matchMedia(DESKTOP).matches && window.matchMedia("(scripting: enabled)").matches) {
      setLive(true);
    }
  }, []);

  // Pin after the live re-render, when the room is at its real size. The
  // section attribute is what hides the sibling grid — a CSS `+` selector
  // cannot do it, because the pin wraps this element in a pin-spacer and the
  // grid's sibling becomes the spacer, not us.
  // LAYOUT effect, not passive — a pin reparents this element into a
  // pin-spacer, and only a layout cleanup un-pins before React removes the
  // node. See the note at the top of MorphHero for the whole story.
  useLayout(() => {
    const el = root.current;
    if (!el || !live) return;
    const section = el.closest("#shop");
    section?.setAttribute("data-float", "");
    gsap.registerPlugin(ScrollTrigger);
    const st = ScrollTrigger.create({
      trigger: el,
      start: "top top",
      // scaled to the CATALOGUE, not to a fixed number of screens: add a
      // category and the room gets the scroll to show it
      end: () => "+=" + window.innerHeight * PIN_PER_CARD * Math.max(1, cats.length),
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        scrollP.current = self.progress;
      },
    });
    return () => {
      // kill(TRUE) — revert the pin, so the pin-spacer stops wrapping a node
      // React owns before React unmounts it. See the note in MorphHero.
      st.kill(true);
      section?.removeAttribute("data-float");
    };
  }, [live, cats.length]);

  // the pill's morph — chase, so it eases exactly like the reference's
  useEffect(() => {
    const target = mode === "cylinder" ? 1 : 0;
    const tween = gsap.to(view, { current: target, duration: 1.1, ease: "power2.inOut" });
    return () => {
      tween.kill();
    };
  }, [mode]);

  const onPick = useCallback(
    (c: FloatCat) => {
      router.push(c.status === "open" ? `/shop/${c.slug}` : "/shop");
    },
    [router],
  );
  const onHover = useCallback((c: FloatCat | null) => setHovered(c), []);
  // the frame loop calls this on every change of the centre card; React
  // bails out of the re-render when the index has not actually moved
  const onFocus = useCallback((i: number) => setFocusI(i), []);

  // The centre always names something: whatever the room has brought to the
  // centre position, unless a pointer is on a card, which wins.
  const shown = hovered ?? cats[focusI] ?? cats[0] ?? null;

  // ---- the centre's entrance ----------------------------------------------
  // Every change of the named category replays the same logic. Runs after
  // React has committed the new name, so the letter spans the timeline
  // animates are the ones on screen.
  const fxTl = useRef<gsap.core.Timeline | null>(null);
  const prevSlug = useRef<string | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || !live || !shown) return;
    if (shown.slug === prevSlug.current) return;
    prevSlug.current = shown.slug;
    const els = grabFxEls(el);
    if (!els) return;
    const kind = FX_ALWAYS;
    els.panel.dataset.fx = kind; // a marker for tests, not a style hook
    fxTl.current?.kill();
    fxTl.current = CHANGE[kind](els);
  }, [shown, live]);

  useEffect(
    () => () => {
      fxTl.current?.kill();
    },
    [],
  );

  return (
    <div className="ap-fs" ref={root} data-live={live || undefined}>
      <div className="ap-fs__stage" aria-hidden="true">
        {live && (
          <Canvas camera={{ position: [0, 0, 13.4], fov: 50 }} dpr={[1, 1.6]} gl={{ antialias: true, alpha: true }}>
            <Suspense fallback={null}>
              <Scene cats={cats} view={view} scrollP={scrollP} onPick={onPick} onHover={onHover} onFocus={onFocus} />
            </Suspense>
          </Canvas>
        )}
      </div>

      {/* The section's own name sits in the room's TOP-LEFT corner and never
          moves — the middle belongs to the products. On the plain layer
          this is the whole section, in ordinary flow. */}
      <div className="ap-fs__head">
        <p className="ap-kicker">{kicker}</p>
        <h2 className="ap-fs__big">{name}</h2>
        <p className="ap-lede">{copy}</p>
      </div>

      {/* The centre carries ONLY product text: whatever the turning room has
          brought to the centre position, or the card under the pointer. Every
          name arrives the same way now — the rise above, letters climbing with
          the kicker and price line behind them. The name is split into spans
          so the letter logic has letters; spaces stay text nodes so the name
          can still wrap. */}
      <div className="ap-fs__now">
        <div className="ap-fs__panel" aria-hidden="true">
          <p className="ap-kicker">{hovered ? "(You are looking at)" : "(In the middle)"}</p>
          <p className="ap-fs__prod">
              {/* words are atomic inline-blocks — bare char spans would let
                  the browser break "HOODIES" in half mid-word */}
              {(shown?.name ?? "").split(/(\s+)/).map((part, i) =>
                /\s/.test(part) ? (
                  " "
                ) : part ? (
                  <span className="ap-fs__w" key={`${i}${part}`}>
                    {Array.from(part).map((ch, j) => (
                      <span className="ap-fs__ch" data-ch={ch} key={`${j}${ch}`}>
                        {ch}
                      </span>
                    ))}
                  </span>
                ) : null,
              )}
          </p>
          <p className="ap-fs__from">
            {shown ? (shown.status === "open" ? `from ${shown.from.toLocaleString()} ֏ — click to open` : "coming soon") : ""}
          </p>
        </div>
      </div>

      {/* The announcement for readers who cannot see the room. Only the
          POINTED-AT card is announced: the centre also renames itself as the
          ring turns, and narrating that on a timer would be noise. */}
      <p className="ap-sr" role="status">
        {hovered
          ? `${hovered.name} — ${hovered.status === "open" ? `from ${hovered.from.toLocaleString()} ֏` : "soon"}`
          : ""}
      </p>

      {/* how far through the catalogue the room has turned — it also says
          plainly that there are more pieces below, which a room that simply
          rotates never manages to */}
      <p className="ap-fs__count" aria-hidden="true">
        <span>{String(cats.indexOf(shown as FloatCat) + 1 || 1).padStart(2, "0")}</span>
        <span className="ap-fs__count-of">/ {String(cats.length).padStart(2, "0")}</span>
      </p>

      <div className="ap-fs__pill" role="group" aria-label="Change the view">
        <span>Change the view</span>
        <button type="button" aria-pressed={mode === "sphere"} onClick={() => setMode("sphere")}>
          ring
        </button>
        <button type="button" aria-pressed={mode === "cylinder"} onClick={() => setMode("cylinder")}>
          spiral
        </button>
      </div>
    </div>
  );
}
