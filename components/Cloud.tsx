"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { add, dram, unit } from "@/lib/cart";
import { flyToCart } from "@/lib/fly";
import { isSoldOut, priceTbc, withheldArt } from "@/lib/content";
import dynamic from "next/dynamic";
import { puzzles } from "@/lib/puzzles";
import { layout, type Rect } from "@/lib/puzzleLayout";
import teaser from "@/lib/puzzle-teaser.json";
import type { PuzzleCopy, PuzzleSaved } from "./Puzzle";
import MapBoundary from "./MapBoundary";
import { lastKeys, scriptFocus, seedPointer } from "@/lib/modality";

// THE PUZZLE COMES WHEN IT IS ASKED FOR: its code is not in the home page's
// first load (nothing needs it until «Play the puzzle» is pressed), and it
// sits in a MapBoundary below, so a chunk that is gone after a deploy (a tab
// left open across one) fails alone — back to the picture — instead of
// throwing to app/error.tsx and taking the whole home page with it (the
// same reason GlobeCanvas and the store map sit in one).
const Puzzle = dynamic(() => import("./Puzzle"), { ssr: false });

/** one card's price, from the catalogue — null when Arpine confirms it */
const CARD_PRICE = unit("postcards");

/** a jigsaw piece, the panel's sign for «Play the puzzle» (one tab out on
 *  top and right, a blank on the bottom and left) */
const PieceIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path
      fill="currentColor"
      d="M3 4h3.2a1.8 1.8 0 1 1 3.6 0H13v3.2a1.8 1.8 0 1 1 0 3.6V14H9.8a1.8 1.8 0 1 0-3.6 0H3v-3.2a1.8 1.8 0 1 0 0-3.6V4z"
    />
  </svg>
);

type Art = {
  id: string;
  src: string;
  thumb: string;
  w: number;
  h: number;
  avg: string;
  /** the print-resolution scan, the postcard's back, the printed mockup and
      Arpine's own note (client files 2026-08-11) — three pictures (23/25/34)
      don't have them yet */
  lg?: string;
  lgW?: number;
  lgH?: number;
  back?: string;
  mock?: string;
  mockW?: number;
  mockH?: number;
  text?: string;
};

/** which face of the chosen picture the big card is showing */
type View = "front" | "back" | "mock";
const VIEWS: View[] = ["front", "back", "mock"];

/** one face of a picture: its file and its real box, for the fit decision */
const face = (p: Art, v: View) =>
  v === "back"
    ? { src: p.back, w: p.lgW, h: p.lgH }
    : v === "mock"
      ? { src: p.mock, w: p.mockW, h: p.mockH }
      : { src: p.lg, w: p.lgW, h: p.lgH };

// ============================================================================
// CLOUD — the series lying freely in space, after creativeapproa.ch.
//
// The reference was MEASURED, not eyeballed (scratchpad/refprobe.mjs):
//
//   geometry   ~92×130px cards, axis-aligned (no rotation), 6px radius, no
//              shadow; a white mount around roughly a third of them
//   movement   the cards FLOAT — their wrappers' transforms crept 1–3px
//              between samples with no pointer input. Not mouse parallax.
//   hover      nothing. Cursor only.
//   click      the card enlarges ~1.5× in place, every other card dims hard,
//              the intro text gets out of the way, and a small caption sits
//              directly under the card. Click-away (or another card) closes.
//
// ONE plane carries all 57 cards. A drag pans it, a throw coasts — and that
// is the only travel there is: the section takes no part in page scroll (the
// client asked the pin removed), so the page rolls straight past it. The
// float is a bounded ±few-px wobble per card on top.
//
// The scatter is DETERMINISTIC (hash of the index, quantised) because
// Math.sin differs between Node and browser V8 in the last bit and React
// calls that a hydration mismatch. See git history for the crime scene.
// ============================================================================

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

const hash = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return Math.round((x - Math.floor(x)) * 1e4) / 1e4;
};
const q = (n: number) => Math.round(n * 1e3) / 1e3;

type Placed = Art & { x: number; y: number; size: number; z: number; mount: boolean };

function scatter(items: Art[]): Placed[] {
  const n = items.length;
  return items.map((a, i) => {
    const ang = i * GOLDEN;
    const rad = Math.sqrt((i + 0.55) / n);
    const jx = (hash(i, 1) - 0.5) * 7;
    const jy = (hash(i, 2) - 0.5) * 8;
    const t = hash(i, 3);
    // roughly the reference's 92px cards at 1440 — smaller and denser than the
    // first cut, so far more of the series is in the frame at once
    const size = t < 0.24 ? 2.9 : t < 0.78 ? 3.7 : 4.7;
    return {
      ...a,
      // DRAWN IN TOWARDS THE MIDDLE (client 2026-08-12: "make more dense in
      // center, move from left side postcards to center"). The spread was
      // ±34% of the frame, which pushed cards to both edges and strewed a
      // thin group down the left, underneath the title. Tighter radii pile
      // the series in the centre, and the centre itself sits a little right
      // of middle so the title's column stays its own.
      x: q(54 + Math.cos(ang) * rad * 24 + jx),
      y: q(50 + Math.sin(ang) * rad * 27 + jy),
      size,
      z: Math.round(size * 10),
      mount: hash(i, 5) > 0.62,
    };
  })
    // THE MOUNTED CARDS ARE GONE (client, change.pdf p2, 2026-09-15: «too
    // many pictures, and some have a white frame — remove the white-framed
    // ones from this section»). Filtered AFTER the scatter, so the cards
    // that stay keep the exact positions they always had — the frame simply
    // has fewer, and none with a mount.
    .filter((p) => !p.mount);
}

/** Cards rest at 63–102px, so this opens a picked one to roughly 230–370px —
 *  big enough to actually look at, which the old ×1.8 (~210px) was not
 *  (client 2026-08-06: "it must open more big"). */
const VIEW_SCALE = 3.6;

const DESKTOP = "(min-width: 861px) and (prefers-reduced-motion: no-preference)";
/** sessionStorage: the picture whose puzzle a stale-chunk reload reopens */
const REOPEN = "ap-puzzle-reopen";

// THE SECTION OPENS ON A PUZZLE (client, change 5.pdf p1, 2026-11-04: «could
// we make a game in its place — put the puzzle pieces mixed, and people try
// to put it together»). Her mock is No. 05, the picture he cut into eighteen
// (lib/puzzles.ts); scripts/puzzle-teaser.mjs made its still from those
// pieces and names the picture. On the desktop moved layer the section IS
// the puzzle — played in place, beside the title, clear of the sun's lane —
// and «See the series» brings back the cloud of every picture, unchanged.
// Phones and reduced motion get her mock as a still and «Play the puzzle»,
// which opens the window form; the rail is under a «See the series»
// disclosure.
const IN_PLACE = teaser.art;
/** the in-place game outlives a reload in this tab (Puzzle `persist`); the
 *  set's version is in the key, so a recut never restores into new pieces */
const PERSIST = puzzles[IN_PLACE] ? `ap-puzzle:${IN_PLACE}:${puzzles[IN_PLACE].v}` : undefined;
/** a 1×1 transparent GIF, inlined: the <picture> source where nothing may be fetched */
const NOTHING = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
/** the layer the in-place puzzle lives on (the moved layer, scripted) —
 *  where the still must not be fetched at all */
const MOVED = "(scripting: enabled) and (min-width: 861px) and (prefers-reduced-motion: no-preference)";
/** under Play when the puzzle's file failed for want of a connection */
const OFFLINE_NOTE = "You seem to be offline — the puzzle needs a connection.";

export default function Cloud({
  items,
  kicker,
  title,
  copy,
  pick,
  puzzle,
}: {
  /** what a chosen picture says — see home.strip in lib/content.ts */
  pick: { line: string; body: string; cta: string };
  /** the puzzle's interface words (home.strip.puzzle) — a picture with
   *  pieces in lib/puzzles.ts offers «Play the puzzle» in its panel */
  puzzle: PuzzleCopy;
  items: Art[];
  kicker: string;
  /** the title's LINES — the break is the client's (change.pdf p2,
   *  2026-09-21), so it is data, not a wrap the viewport happens to make */
  title: string[];
  copy: string;
}) {
  const root = useRef<HTMLDivElement | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  /** the PLAIN layer (phones, reduced motion): a card there opens the panel
   *  under the rail — a disclosure, not a picture growing in place — so it
   *  is named and stated as one (2026-10-05 package). False on the server
   *  and on the desktop moved layer, whose card stays exactly as it was. */
  const [plain, setPlain] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(DESKTOP);
    const read = () => setPlain(!m.matches);
    read();
    m.addEventListener("change", read);
    return () => m.removeEventListener("change", read);
  }, []);
  const infoId = useId();
  /** "No. n" — where focus goes when a card on the plain layer opens it */
  const noRef = useRef<HTMLParagraphElement | null>(null);
  /** set by a card press (not by ‹ ›, whose own button keeps focus) */
  const focusNo = useRef(false);
  // every picture opens on its front; the switcher below the note changes it
  const [view, setView] = useState<View>("front");
  /** the page mid-turn. Forward: the OLD face rides on top, turning away,
   *  the new one already beneath. Backward: the NEW face turns back in on
   *  top, while the old one holds beneath until it is covered. */
  type Face = { src?: string; w?: number; h?: number };
  const [page, setPage] = useState<{ over: Face; under?: Face; dir: 1 | -1 } | null>(null);

  // THE PUZZLE (Vardan, 2026-10-29). Every picture offers «Play the puzzle»
  // in its panel — No. 05 with his pieces (lib/puzzles.ts), the rest cut in
  // the browser with his knob (lib/puzzleCut.ts, 2026-10-30). On the desktop
  // moved layer the cloud's own frame becomes the room: the cards fade out,
  // the panel steps aside, the plane's drag and the panel's keys stand down
  // (`playingRef`), and the puzzle's bar brings the picture back. On the
  // plain layer it opens as a window over the page. Leaving keeps the game
  // (`puzzleMemory`), so coming back finds the pieces where they were left.
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  playingRef.current = playing;
  /** what `playing` opens: the chosen card's puzzle (its panel's Play), or
   *  No. 05 from the still (phones, reduced motion) */
  const [playFrom, setPlayFrom] = useState<"panel" | "teaser">("panel");
  const playFromRef = useRef(playFrom);
  playFromRef.current = playFrom;
  const puzzleMemory = useRef<Record<string, PuzzleSaved | undefined>>({});
  const playBtn = useRef<HTMLButtonElement | null>(null);
  /** the still's «Play the puzzle» — where focus comes back to from its window */
  const teaserBtn = useRef<HTMLButtonElement | null>(null);

  // ---- THE TWO SCENES (change 5.pdf p1, 2026-11-04) ------------------------
  /** the series is out: on the moved layer the cloud replaces the in-place
   *  puzzle; on the plain layer the rail's disclosure is open */
  const [series, setSeries] = useState(false);
  const seriesRef = useRef(series);
  seriesRef.current = series;
  /** the series has been shown once: from then on its cards' pictures are
   *  asked for (a hidden lazy <img> still loads — so until then they have
   *  no address at all) */
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (series) setSeen(true);
  }, [series]);
  /** the in-place puzzle may come: the section is within a screen of the
   *  viewport AND the page has loaded — never in the hero's LCP window */
  const [near, setNear] = useState(false);
  /** the in-place puzzle's file failed (a deploy since the page opened, or
   *  no connection): the still and «Play the puzzle» stand in */
  const [inFailed, setInFailed] = useState(false);
  /** a new mount of the in-place puzzle (its retry) */
  const [inKey, setInKey] = useState(0);
  /** when the still's Play was pressed to retry it (0: never) */
  const inPressAt = useRef(0);
  // THE SECTION IS NEVER AN EMPTY ROOM (review, change 5): on a slow link the
  // visitor got here long before window load and the game's file — 5–7 s of
  // the title over an empty dark room, nothing to see and nothing to press.
  // Until the game's pieces are shown, No. 05's still lies whole exactly
  // where its board will be (the same layout, lib/puzzleLayout.ts) with «See
  // the series» where the game's bar will be; then it fades as the pieces
  // come in. The still is asked for only once the section is on screen — a
  // page that opens on the hero asks for nothing of the puzzle before load.
  /** the in-place game has shown its pieces on this page: "fading" while
   *  its still makes way (false again once it fails) */
  const [inReady, setInReady] = useState<boolean | "fading">(false);
  /** the still's Play was pressed, and the game has not come yet */
  const [inPressed, setInPressed] = useState(false);
  /** the section is on screen: the still may be asked for (and stays) */
  const [stillOn, setStillOn] = useState(false);
  /** the board's box in the room, CSS px: where the still lies */
  const [standGeo, setStandGeo] = useState<{ l: number; t: number; w: number; h: number } | null>(null);
  /** the still has loaded (it fades in over the board's ground) */
  const [stillIn, setStillIn] = useState(false);
  const standRoom = useRef<HTMLDivElement | null>(null);
  const standBar = useRef<HTMLDivElement | null>(null);
  /** where focus goes when the in-place puzzle next mounts: onto its way to
   *  the series, when the visitor came back from there by the keyboard */
  const [inFocus, setInFocus] = useState<boolean | "exit">(false);
  /** the moved layer's «Play the puzzle», shown over the series */
  const backBtn = useRef<HTMLButtonElement | null>(null);
  /** the still's «Play the puzzle», standing in for a failed in-place game */
  const standBtn = useRef<HTMLButtonElement | null>(null);
  const wasPlaying = useRef(false);
  /** when Play was last pressed (performance.now) — see puzzleFailed */
  const playAt = useRef(0);
  /** the puzzle's file could not be fetched for want of a connection — said
   *  under Play (readiness P3, 2026-10-31: the press used to just put the
   *  picture back, silently). Cleared by the next press, another picture, or
   *  the connection coming back. */
  const [offline, setOffline] = useState(false);
  /** A PRESS THAT CANNOT DO ANYTHING SAYS WHY (review, change 5): inside the
   *  reload guard (the puzzle's file still gone a minute after the reload
   *  that should have brought it) a press on «Play the puzzle» only put the
   *  same still back — no line, no reload. Now the existing failure line is
   *  said under the Play that was pressed: which one, by where it was. */
  const [failNote, setFailNote] = useState<null | "panel" | "teaser" | "inplace">(null);
  useEffect(() => {
    setOffline(false);
    setFailNote(null);
  }, [chosen]);
  useEffect(() => {
    const back = () => setOffline(false);
    window.addEventListener("online", back);
    return () => window.removeEventListener("online", back);
  }, []);
  const startPuzzle = useCallback(() => {
    playAt.current = performance.now();
    setOffline(false);
    setFailNote(null);
    setPlayFrom("panel");
    // the desktop room is the frame: bring the whole of it on screen first,
    // or the board can open half under the fold
    const frame = root.current?.querySelector<HTMLElement>(".ap-cloud__frame");
    if (frame && window.matchMedia(DESKTOP).matches) {
      const top = frame.getBoundingClientRect().top;
      if (Math.abs(top) > 2) window.scrollTo({ top: window.scrollY + top, behavior: "smooth" });
    }
    setPlaying(true);
  }, []);
  /** the still's «Play the puzzle»: No. 05 in the window form — no card is
   *  chosen, so the rail and its panel stay as they are */
  const startTeaser = useCallback(() => {
    playAt.current = performance.now();
    setOffline(false);
    setFailNote(null);
    setPlayFrom("teaser");
    setPlaying(true);
  }, []);
  /** the visitor closed the puzzle themselves (Back, ✕, Escape) — see the way back */
  const exitByHand = useRef(false);
  const stopPuzzle = useCallback(() => {
    exitByHand.current = true;
    setPlaying(false);
  }, []);
  // A PAGE OPENED BEFORE A DEPLOY (Vardan, 2026-10-30: «when i click puzzle
  // didnt showed»): its «Play» asks for the puzzle's file by the OLD build's
  // name, the new deployment has no such file (no skew protection: the live
  // HTML carries no dpl= tag), and the boundary below put the picture back —
  // a click that did nothing. A chunk that will not load now reloads the
  // page ONCE into the new version and opens the same picture's puzzle
  // there (`reopen`). Any other error, or a second failure within a
  // minute, puts the picture back as before — never a reload loop.
  // NOT EVERY CHUNK FAILURE IS A DEPLOY (review, 2026-10-30): with the
  // connection gone the error is the same, and a reload would replace the
  // site with the browser's offline page — so the server is asked first
  // (any answer, 404 included, means a reload lands on a page; no answer
  // keeps this one). And only while the visitor still waits on their press:
  // a hung request fails by webpack's own timeout 120 s later, under a
  // visitor who has moved on — that one only puts the picture back (the
  // lazy import keeps its rejection, so their NEXT Play fails at once and
  // takes the reload then).
  const reopen = useRef<string | null>(null);
  /** the puzzle now out came from a stale-chunk reopen (see the way back) */
  const reopened = useRef(false);
  /** a picture was chosen by hand since this page loaded (see the reopen) */
  const handChose = useRef(false);
  /** the cloud is still on the page: a check that answers after the visitor
   *  has gone elsewhere must not reload the page they went to (re-check) */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  /** the guarded reload; false when the guard (or no storage) refuses it */
  const reloadOnce = useCallback(() => {
    try {
      const last = Number(sessionStorage.getItem(`${REOPEN}:at`) || 0);
      if (Date.now() - last <= 60_000) return false;
      sessionStorage.setItem(`${REOPEN}:at`, String(Date.now()));
      // what the reload reopens: the chosen card's puzzle, No. 05 from the
      // still, or nothing (the in-place puzzle comes back by itself)
      const from = playingRef.current ? playFromRef.current : "inplace";
      sessionStorage.setItem(REOPEN, from === "panel" ? (chosenRef.current ?? "") : from === "teaser" ? IN_PLACE : "");
      sessionStorage.setItem(`${REOPEN}:from`, from);
      // the page the note is for: only a reload of THIS address may use it
      sessionStorage.setItem(`${REOPEN}:href`, location.href.split("#")[0]);
      // how Play was pressed, so the reopened page treats focus the same
      sessionStorage.setItem(`${REOPEN}:by`, lastKeys() ? "keys" : "pointer");
    } catch {
      return false; // no storage: no guard, so no reload
    }
    window.location.reload();
    return true;
  }, []);
  /** ONE WAY TO FAIL, TWO PUZZLES (change 5.pdf p1): the one a press opened
   *  (`playing`) and the in-place one. `at` is when the visitor pressed
   *  (0: nobody did — the in-place puzzle mounts by itself, and a page
   *  never reloads itself under a visitor who asked for nothing);
   *  `waiting` says whether they still wait on it; `giveUp` puts the
   *  picture (or the still) back; `from` is the Play that was pressed,
   *  under which a press that came to nothing says so (`failNote`). */
  const chunkFailed = useCallback(
    (err: unknown, at: number, waiting: () => boolean, giveUp: () => void, from: "panel" | "teaser" | "inplace") => {
      const stale =
        err instanceof Error &&
        (err.name === "ChunkLoadError" ||
          /Loading (CSS )?chunk|dynamically imported module|Importing a module script failed/i.test(err.message));
      // only for a visitor still waiting on their press (a page that fails
      // by itself, or a hung request answering two minutes later under a
      // visitor who has moved on, says nothing)
      const tell = () => {
        if (at > 0 && performance.now() - at < 15_000) setFailNote(from);
      };
      if (stale && navigator.onLine !== false && at > 0 && performance.now() - at < 15_000) {
        // webpack's ChunkLoadError carries the address that failed
        const url = (err as { request?: unknown }).request;
        // A PRESS OR A KEY WHILE THE SERVER IS ASKED is the visitor moving
        // on — a link whose page has not arrived yet leaves the cloud
        // mounted, and the reload swallowed that click (re-check). Then the
        // picture only comes back; their next Play takes the reload.
        let acted = false;
        const act = (e: Event) => {
          if (!(e instanceof KeyboardEvent && e.repeat)) acted = true;
        };
        const kinds = ["pointerdown", "keydown"] as const;
        kinds.forEach((k) => window.addEventListener(k, act, true));
        const unhook = () => kinds.forEach((k) => window.removeEventListener(k, act, true));
        fetch(typeof url === "string" ? url : location.href, {
          method: "HEAD",
          cache: "no-store",
          signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(4000) : undefined,
        }).then(
          () => {
            unhook();
            // the visitor left (or put the picture away) while it was asked
            if (!alive.current || !waiting()) return;
            // the guard refused the reload (it was taken within the minute
            // and the file is still gone), or they moved on: back to the
            // picture, and the line under Play says the press came to nothing
            if (acted || !reloadOnce()) {
              tell();
              giveUp();
            }
          },
          () => {
            unhook();
            // no answer at all: the connection, not a deploy — say so
            if (alive.current) setOffline(true);
            giveUp();
          },
        );
        return;
      }
      // the browser itself says it is offline: no reload (above), and no
      // silent press either — the line under Play says why; any other
      // failure of a press says it came to nothing
      if (stale && navigator.onLine === false) setOffline(true);
      else tell();
      giveUp();
    },
    [reloadOnce],
  );
  const puzzleFailed = useCallback(
    (err?: unknown) =>
      chunkFailed(
        err,
        playAt.current,
        () => playingRef.current,
        () => setPlaying(false),
        playFromRef.current,
      ),
    [chunkFailed],
  );
  /** the in-place game failed: the still and «Play the puzzle» stand in */
  const inplaceDown = useCallback(() => {
    setInFailed(true);
    setInReady(false);
  }, []);
  const inplaceFailed = useCallback(
    (err?: unknown) => chunkFailed(err, inPressAt.current, () => !seriesRef.current, inplaceDown, "inplace"),
    [chunkFailed, inplaceDown],
  );
  /** THE IN-PLACE PUZZLE'S PICTURES would not come, even on a second try
   *  (review, change 5: offline, or his files gone since the page opened —
   *  the section was left an empty room with «go back and try again»): the
   *  still and «Play the puzzle» stand in, exactly as for its file of code,
   *  and the press asks for them again. Offline, the line under Play says
   *  why, as it does for the code. */
  const inplacePicturesFailed = useCallback(() => {
    if (navigator.onLine === false) setOffline(true);
    // …and when the still's Play asked for them again, the press says it
    // came to nothing (review, change 5 — the same line as for the code)
    else if (inPressAt.current > 0) setFailNote("inplace");
    // a keyboard already in the room (on its «See the series») would fall
    // to <body> as the room goes: it is taken on to the still's Play
    const a = document.activeElement;
    if (a instanceof HTMLElement && root.current?.contains(a) && a.closest(".ap-pz, .ap-pz__bar")) setInFocus(true);
    inplaceDown();
  }, [inplaceDown]);
  /** the in-place game shows its pieces: its still fades away, and its bar
   *  hands over to the game's. A keyboard on the still's «See the series»
   *  goes on to the game's — the same words in the same place; one on its
   *  Play has already been taken into the pieces by the game (`autoFocus`,
   *  which that press set). */
  const handOver = useRef(false);
  const inplaceReady = useCallback(() => {
    const a = document.activeElement;
    handOver.current = a instanceof HTMLElement && !!standBar.current?.contains(a);
    setInPressed(false);
    setFailNote(null);
    setInReady((r) => (r === true ? r : "fading"));
  }, []);
  // …once the still has begun to fade: the game's bar is shown from then on
  // (cloud.css), and a hidden button cannot take focus
  useLayoutEffect(() => {
    if (inReady !== "fading" || !handOver.current) return;
    handOver.current = false;
    root.current?.querySelector<HTMLButtonElement>(".ap-pz + .ap-pz__bar .ap-pz__exit")?.focus(scriptFocus());
  }, [inReady]);
  useEffect(() => {
    if (inReady !== "fading") return;
    // the pieces' own fade-in is 0.35 s (puzzle.css), and the still's the same
    const id = window.setTimeout(() => setInReady(true), 450);
    return () => window.clearTimeout(id);
  }, [inReady]);
  // …and after that reload: the picture is chosen again and its puzzle
  // started, once the page has loaded (the browser has put the scroll back;
  // the cloud's frame is then brought to the top at once).
  // ONLY ON THE RELOAD THAT WROTE THE NOTE (review): the same address,
  // reloaded within 10 s of the note — a note left behind by a reload that
  // never got this far (the visitor went to another page, or reloaded that
  // one) would otherwise open a puzzle by itself on a later visit home.
  // AND THE VISITOR'S OWN HAND COMES FIRST: a picture chosen by hand, or a
  // scroll, before the page has loaded cancels the reopen.
  useEffect(() => {
    let id: string | null = null;
    let ok = false;
    let by: string | null = null;
    let from: string | null = null;
    try {
      id = sessionStorage.getItem(REOPEN);
      if (id === null) return; // an ordinary visit: nothing was set
      by = sessionStorage.getItem(`${REOPEN}:by`);
      from = sessionStorage.getItem(`${REOPEN}:from`);
      const href = sessionStorage.getItem(`${REOPEN}:href`);
      // `:at` stays: it is the loop guard
      for (const k of [REOPEN, `${REOPEN}:by`, `${REOPEN}:href`, `${REOPEN}:from`]) sessionStorage.removeItem(k);
      const at = Number(sessionStorage.getItem(`${REOPEN}:at`) || 0);
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      ok =
        nav?.type === "reload" &&
        nav.name.split("#")[0] === href &&
        performance.timeOrigin - at < 10_000 &&
        Date.now() - at < 60_000;
    } catch {
      return;
    }
    const want = ok && items.some((a) => a.id === id) ? id : null;
    // THE IN-PLACE PUZZLE'S RELOAD IS A REOPEN TOO (review, change 5): the
    // still's Play wrote no picture (the in-place game comes back by
    // itself), so this bailed — the page stayed where the browser's own
    // restoration put it (the hero, at 1440×900) and focus on <body>. Now
    // the frame is brought to the top and the game, once it is ready, takes
    // focus, as the panel's reopen does. `:from` says which it was; the
    // teaser's IN_PLACE would open the window form instead.
    const inplace = ok && id === "" && from === "inplace";
    if (!want && !inplace) return;
    if (by === "pointer") seedPointer();
    let touched = false;
    const touch = () => {
      touched = true;
    };
    const kinds = ["wheel", "touchmove", "keydown"] as const;
    kinds.forEach((k) => window.addEventListener(k, touch, { capture: true, passive: true }));
    const unhook = () => kinds.forEach((k) => window.removeEventListener(k, touch, { capture: true }));
    let live = true;
    const go = () =>
      requestAnimationFrame(() => {
        unhook();
        if (!live || touched || handChose.current || chosenRef.current || playingRef.current || (inplace && seriesRef.current)) return;
        const frame = root.current?.querySelector<HTMLElement>(".ap-cloud__frame");
        if (frame) {
          window.scrollTo({ top: window.scrollY + frame.getBoundingClientRect().top, behavior: "instant" });
          // …AND SCROLLTRIGGER IS TOLD AT ONCE (review, change 5): its
          // refresh (FootReveal calls one as the page grows while loading)
          // scrolls to the top, measures, and puts back the position it read
          // — from a cache that only a scroll event renews, and that event
          // has not fired yet. Measured after the in-place reload: brought to
          // 1440, put back to 0 by a refresh 11 ms later. update() renews it.
          gsap.registerPlugin(ScrollTrigger);
          ScrollTrigger.update();
        }
        // the layer is read here too: Cloud hydrates at idle priority, so
        // the mount effect's own read lands after this choice, and a phone
        // built the desktop room first, then the window (review)
        const isPlain = !window.matchMedia(DESKTOP).matches;
        setPlain(isPlain);
        if (inplace) {
          if (!isPlain) setInFocus(true);
          // the game coming back is the visitor's press carried through the
          // reload: if its file is still gone, the line under Play says so
          // (as it does for the window form), and the guard keeps the page
          inPressAt.current = performance.now();
          return;
        }
        if (from === "teaser") {
          // No. 05 from the still: its window again (on the moved layer the
          // section is that puzzle already, in place)
          if (isPlain) startTeaser();
          return;
        }
        reopen.current = want;
        // a card lives in the series: it is brought out first
        setSeries(true);
        setChosen(want);
      });
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
    return () => {
      live = false;
      unhook();
      window.removeEventListener("load", go);
    };
    // once, on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // the way back lands on the button that opened it
  useEffect(() => {
    // …but only when focus was in the puzzle (it is on <body> once the
    // puzzle's pieces are gone) or still in the cloud — never pulled out of
    // somewhere else the reader has gone (review, 2026-10-29)
    // THE TITLE GOES WHILE A PUZZLE IS OUT (review, 2026-10-30): a picture
    // filtered out of the cloud has no card, so choosing it leaves the title
    // up — and the deal laid pieces across «A JOURNEY THROUGH ARMENIA». On
    // the way back the title is what the choice says (hidden while a card
    // is open). The desktop room only: the plain layer's window covers it.
    const el = root.current;
    const say = el?.querySelector<HTMLElement>(".ap-cloud__say");
    if (el && say && (playing || wasPlaying.current) && window.matchMedia(DESKTOP).matches) {
      const id = chosenRef.current;
      const card = id ? el.querySelector(`.ap-cloud__card[data-id="${id}"]`) : null;
      gsap.to(say, { autoAlpha: playing || card ? 0 : 1, duration: playing ? 0.25 : 0.35 });
    }
    if (wasPlaying.current && !playing) {
      // after a stale-chunk REOPEN the page is where the reload put it (on
      // a phone, the rail at the top), not where Play was pressed: closing
      // that puzzle by hand brings Play on screen, centred clear of the
      // header (review: 360×640). Any other way back leaves the page where
      // the visitor has it — a 120 s chunk timeout pulled a visitor who had
      // scrolled on back up (re-check) — and focus is not put on a Play off
      // screen, where the next Space would press it.
      const bring = reopened.current && exitByHand.current;
      reopened.current = false;
      exitByHand.current = false;
      requestAnimationFrame(() => {
        const a = document.activeElement;
        // back to the button that opened it: the panel's Play, or the still's
        const b = playFromRef.current === "teaser" ? teaserBtn.current : playBtn.current;
        if (!b || !(!a || a === document.body || root.current?.contains(a))) return;
        const r = b.getBoundingClientRect();
        const off = r.top < 0 || r.bottom > window.innerHeight;
        if (off && !bring) return;
        b.focus(scriptFocus());
        if (off) b.scrollIntoView({ block: "center", behavior: "instant" });
      });
    }
    wasPlaying.current = playing;
  }, [playing]);

  useEffect(() => {
    setView("front");
    setPage(null);
    setPlaying(false);
    // chosen again after a stale-chunk reload: straight into its puzzle
    if (chosen && reopen.current === chosen) {
      reopen.current = null;
      reopened.current = true;
      startPuzzle();
    } else {
      reopen.current = null; // any other choice: nothing stays armed
      if (chosen) handChose.current = true;
    }
    // warm the picture's other faces the moment it opens, so the first
    // switch doesn't have to wait on the network — and its front, the file
    // its puzzle is cut from: a picture with no card in the cloud (filtered
    // out) has not loaded it, and «Play» waited on it (review, 2026-10-30)
    const art = chosen ? items.find((a) => a.id === chosen) : undefined;
    [art?.lg ?? art?.src, art?.back, art?.mock].forEach((s) => {
      if (s) new Image().src = s;
    });
  }, [chosen, items]);

  /** A later click supersedes a turn still waiting on its image. */
  const turnToken = useRef(0);

  /** Bought straight from the cloud (client 2026-08-12). The line is the
   *  SAME shape the shop writes — postcards / this illustration / Single
   *  card — so the cart, the totals and the order endpoint's server-side
   *  re-pricing all treat it identically; nothing here names a price. */
  const [added, setAdded] = useState(false);
  /** the open picture is not sold as a postcard — see the buy row below */
  const notACard = !!chosen && !!withheldArt.postcards?.includes(chosen);
  /** SOLD OUT (readiness #25, 2026-11-01): the open picture's single card is
   *  listed in content.ts `soldOut` — by its number, or "Single card" for
   *  every card. Unlike `notACard` the price and the button STAY, the button
   *  reading «Sold out»: the card was on sale, and saying so is the answer.
   *  aria-disabled, not disabled: ← → walk the series while this button may
   *  hold focus, and a disabled button would drop it. */
  const soldCard = !!chosen && isSoldOut("postcards", chosen, "Single card");
  const buy = useCallback((id: string) => {
    // add() refuses a sold-out card (lib/cart.ts) — no flight, no "Added"
    if (!add("postcards", id, 1, "Single card")) return;
    flyToCart(document.querySelector<HTMLElement>(`.ap-cloud__card[data-id="${id}"]`));
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2400);
  }, []);
  useEffect(() => {
    setAdded(false);
  }, [chosen]);

  const switchView = useCallback(
    (v: View, art: Art | undefined) => {
      if (v === view || !art) return;
      const dir: 1 | -1 = VIEWS.indexOf(v) > VIEWS.indexOf(view) ? 1 : -1;
      const oldFace = face(art, view);
      const newFace = face(art, v);
      if (!oldFace.src || !newFace.src) {
        setPage(null);
        setView(v);
        return;
      }
      // NEVER start the turn before the incoming face has decoded — faces
      // load lazily, and turning onto an empty <img> showed whatever sat
      // beneath (the front thumb) until the real face popped in
      // (client 2026-08-12: "brings the first image then changes").
      const token = ++turnToken.current;
      const img = new Image();
      img.src = newFace.src;
      const go = () => {
        if (token !== turnToken.current) return;
        setPage(dir === 1 ? { over: oldFace, dir } : { over: newFace, under: oldFace, dir });
        setView(v);
      };
      img.decode().then(go, go);
    },
    [view],
  );

  // THE DRAG IS BACK (client, change 4.pdf p1, 2026-10-12: «Էն ժամանակ լինում
  // էր քլիք անել վրա ու շարժել, հիմա չի լինում» — "back then you could click
  // on it and move it, now you can't"). She had asked it removed on
  // 2026-08-06, and with it went the pointer-capture dance, the click slop,
  // the timestamp guard and the throw's friction; the new note wins, so all
  // of that is rebuilt below (inside the DESKTOP match, so the phone rail —
  // a native horizontal scroller since the 2026-10-05 pass — never sees it):
  //   · a press that travels under SLOP px is a CLICK and reaches the card's
  //     own onClick untouched (nothing is captured until the slop is passed,
  //     so the browser still delivers the click to the card);
  //   · past the slop the FRAME captures the pointer and the plane follows
  //     the hand; the click the browser then fires lands on the frame, and
  //     `dragEndAt` makes both the frame's click-away and a card's onClick
  //     ignore it;
  //   · on release the plane coasts with the hand's last velocity under
  //     friction, inside a SOFT LIMIT: a free range big enough to bring the
  //     far side of the plane on screen (plus a quarter-screen of play, since
  //     at 1440 the whole scatter already fits), a rubber band beyond it,
  //     and a spring back to the range at rest — the plane cannot be thrown
  //     away to nowhere.
  // `pan` is the plane's translation; `rest` is where the hand last left it,
  // which is where the plane returns when a picked card is put back.
  const pan = useRef({ x: 0, y: 0 });
  const rest = useRef({ x: 0, y: 0 });
  /** the throw: on while coasting / springing back; px per second */
  const fling = useRef({ on: false, vx: 0, vy: 0 });
  /** performance.now() of the last drag's release — the click that the
   *  browser fires right after it must not open or close anything */
  const dragEndAt = useRef(0);
  const planeRef = useRef<HTMLElement | null>(null);
  /** Mirror of `chosen` for the flight loop — a 60fps tick cannot read state. */
  const chosenRef = useRef<string | null>(null);
  chosenRef.current = chosen;

  const placed = useMemo(() => scatter(items), [items]);

  // THE IN-PLACE PUZZLE IS ASKED FOR NEAR THE SECTION, AFTER THE PAGE HAS
  // LOADED (change 5.pdf p1): its code and its nineteen pictures would
  // otherwise compete with the hero. A screen of margin above and below:
  // by the time the curtain starts to rise, the pieces are on their way.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let loaded = document.readyState === "complete";
    let close = false;
    const check = () => {
      if (loaded && close) {
        // THE LAYER IS READ IN THE SAME BREATH (measured on a phone): Cloud
        // hydrates at idle priority, so the mount effect's `plain` lands
        // after this observer's update — and for ~300 ms the moved layer's
        // puzzle mounted on a 390px phone and fetched all nineteen files.
        // Both now arrive in one render.
        setPlain(!window.matchMedia(DESKTOP).matches);
        setNear(true);
        io.disconnect();
        window.removeEventListener("load", onLoad);
      }
    };
    const io = new IntersectionObserver(
      ([e]) => {
        close = e.isIntersecting;
        check();
      },
      { rootMargin: "100% 0px" },
    );
    const onLoad = () => {
      loaded = true;
      check();
    };
    io.observe(el);
    window.addEventListener("load", onLoad);
    return () => {
      io.disconnect();
      window.removeEventListener("load", onLoad);
    };
  }, []);

  const write = useCallback(() => {
    const plane = planeRef.current;
    if (plane) gsap.set(plane, { x: pan.current.x, y: pan.current.y });
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const plane = el.querySelector<HTMLElement>(".ap-cloud__plane");
    if (!plane) return;
    planeRef.current = plane;
    const mm = gsap.matchMedia();

    mm.add(DESKTOP, () => {
      // ---- the FLIGHT: every card rides its own slow orbit ----------------
      // The first cut was a ±3px sine breath, and the client asked for real
      // flight. Each card now traces a Lissajous drift — sin on one clock for
      // x, cos on another for y, amplitudes in the tens of pixels, a couple of
      // degrees of bank — with every number seeded from the hash, so the
      // paths never visibly repeat and the server has nothing to disagree
      // with (all of it is applied after mount). Cards sail over and under
      // each other; that is what makes it read as flying rather than bobbing.
      const cards = gsap.utils.toArray<HTMLElement>(".ap-cloud__card", plane);
      const flight = cards.map((c, i) => {
        gsap.set(c, { xPercent: -50, yPercent: -50 });
        return {
          id: c.dataset.id,
          setX: gsap.quickSetter(c, "x", "px"),
          setY: gsap.quickSetter(c, "y", "px"),
          setR: gsap.quickSetter(c, "rotation", "deg"),
          ax: 16 + hash(i, 6) * 22, // 16–38px of sideways travel
          ay: 13 + hash(i, 7) * 18,
          fx: 0.22 + hash(i, 8) * 0.22, // rad/s — one lap in ~15–30s
          fy: 0.18 + hash(i, 9) * 0.2,
          ph: hash(i, 10) * Math.PI * 2,
          ar: 1.6 + hash(i, 11) * 2.2, // degrees of bank
          fr: 0.12 + hash(i, 12) * 0.14,
          w: 1, // drift weight — eases to 0 while chosen, back to 1 after
          frozen: false,
        };
      });

      // ---- the DRAG and the THROW (restored 2026-10-12, change 4.pdf p1) --
      const frame = el.querySelector<HTMLElement>(".ap-cloud__frame");
      /** a press travelling less than this is a click (UX laws: ~6px slop) */
      const SLOP = 6;
      /** the free range of the pan, in plane px, and the play beyond it */
      let lo = { x: 0, y: 0 };
      let hi = { x: 0, y: 0 };
      let play = { x: 0, y: 0 };
      /** the cards' box in the frame at pan 0 — from their --x/--y/--w
       *  against the plane, so the float plays no part — sets the range: far
       *  enough that the farthest card can be brought 6% inside the frame's
       *  edge, never so far that the whole scatter leaves the screen, plus a
       *  quarter-screen of play each way so the cloud can always be moved
       *  (at 1440×900 the scatter already fits the frame, and without the
       *  play there would be nothing to drag). */
      const measureBounds = () => {
        if (!frame) return;
        const fr = frame.getBoundingClientRect();
        const pr = plane.getBoundingClientRect();
        let L = Infinity;
        let R = -Infinity;
        let T = Infinity;
        let B = -Infinity;
        for (const c of cards) {
          const x = (parseFloat(c.style.getPropertyValue("--x")) / 100) * pr.width;
          const y = (parseFloat(c.style.getPropertyValue("--y")) / 100) * pr.height;
          const r = c.getBoundingClientRect();
          const cx = pr.left - pan.current.x - fr.left + x;
          const cy = pr.top - pan.current.y - fr.top + y;
          L = Math.min(L, cx - r.width / 2);
          R = Math.max(R, cx + r.width / 2);
          T = Math.min(T, cy - r.height / 2);
          B = Math.max(B, cy + r.height / 2);
        }
        if (!Number.isFinite(L)) return;
        const mx = fr.width * 0.06;
        const my = fr.height * 0.06;
        play = { x: fr.width * 0.25, y: fr.height * 0.22 };
        lo = { x: Math.min(0, fr.width - mx - R) - play.x, y: Math.min(0, fr.height - my - B) - play.y };
        hi = { x: Math.max(0, mx - L) + play.x, y: Math.max(0, my - T) + play.y };
      };
      /** the rubber band: past the free range the plane follows the hand at
       *  a third of its travel, and never more than 60% of the play beyond */
      const rubber = (v: number, a: number, b: number, p: number) =>
        v < a ? a - Math.min(p * 0.6, (a - v) * 0.3) : v > b ? b + Math.min(p * 0.6, (v - b) * 0.3) : v;
      type Sample = { x: number; y: number; t: number };
      let down: { id: number; x: number; y: number; t: number; px: number; py: number; dragging: boolean; samples: Sample[] } | null = null;
      let dirty = false;

      const onDown = (e: PointerEvent) => {
        if (!frame) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        // the info panel's own controls (and its scrolling sheet) keep the
        // pointer; so does anything outside the plane's room
        if ((e.target as HTMLElement).closest(".ap-cloud__info")) return;
        // while the puzzle is out the frame is its room: a press there moves
        // a piece, never the hidden plane (2026-10-29)
        // and while the puzzle is played IN PLACE the plane is not out at all
        if (playingRef.current || !seriesRef.current || (e.target as HTMLElement).closest(".ap-pz, .ap-pz__bar, .ap-cloud__back")) return;
        // a press takes over from whatever was moving the plane — a throw
        // still coasting, or the centring tween of a picked card
        gsap.killTweensOf(pan.current);
        fling.current.on = false;
        fling.current.vx = 0;
        fling.current.vy = 0;
        // A NEW PRESS CLEARS THE LAST DRAG'S GUARD (review fix, 2026-10-12).
        // The click the guard exists for is the one the browser fires at the
        // END of a drag, and it always arrives before the next pointerdown;
        // left as a bare time window it also swallowed a clean press on a
        // card made within 400ms of the release — drag, then click the card
        // now under the hand: nothing opened (measured: a press 300ms after
        // a drag chose nothing, 420ms chose the card).
        dragEndAt.current = 0;
        measureBounds();
        down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, px: pan.current.x, py: pan.current.y, dragging: false, samples: [] };
      };
      const onMove = (e: PointerEvent) => {
        if (!frame || !down || e.pointerId !== down.id) return;
        // NO BUTTON, NO PRESS (review fix, 2026-10-12). Until the slop is
        // passed nothing is captured, so a press that leaves the frame
        // before 6px of travel — a few px under the nav bar, released on
        // the bar — never showed the frame its release: `down` stayed set,
        // and from then on every bare mouse move over the frame panned the
        // plane with the cursor stuck at `grabbing` (measured at 1440×900:
        // 14 hover moves carried the plane 290×286px). A hover-capable
        // pointer that reports no primary button is not pressing; a touch
        // always is while it is in contact.
        if (e.pointerType !== "touch" && !(e.buttons & 1)) {
          if (down.dragging) onUp(e);
          else down = null;
          return;
        }
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        if (!down.dragging) {
          // the click/drag decision: travel past the slop, or a press held
          // a third of a second that has started to move — never a tap
          const dist = Math.hypot(dx, dy);
          if (dist < SLOP && !(e.timeStamp - down.t > 300 && dist >= 2)) return;
          down.dragging = true;
          // CAPTURE ON THE FRAME, AND ONLY NOW: captured at pointerdown, the
          // browser would fire the following click at the frame instead of
          // the card, and a clean press could never open a picture
          try {
            frame.setPointerCapture(e.pointerId);
          } catch {
            /* a pointer already gone (pen lifted between events) — the move still counts */
          }
          frame.dataset.drag = "";
        }
        pan.current.x = rubber(down.px + dx, lo.x, hi.x, play.x);
        pan.current.y = rubber(down.py + dy, lo.y, hi.y, play.y);
        dirty = true;
        down.samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
        if (down.samples.length > 8) down.samples.shift();
      };
      const onUp = (e: PointerEvent) => {
        if (!frame || !down || e.pointerId !== down.id) return;
        const was = down;
        down = null;
        // the hand is off whatever happened: never leave the grabbing
        // cursor behind (review fix, 2026-10-12)
        delete frame.dataset.drag;
        // a clean press: the click the browser fires next opens (or puts
        // back) the card, exactly as a keyboard press would
        if (!was.dragging) return;
        if (frame.hasPointerCapture(e.pointerId)) frame.releasePointerCapture(e.pointerId);
        dragEndAt.current = performance.now();
        // the hand's velocity over its last ~100ms, in px/s, capped — a
        // cancelled pointer (the page took the touch for a scroll) throws
        // nothing
        const f = fling.current;
        f.vx = 0;
        f.vy = 0;
        if (e.type !== "pointercancel") {
          const recent = was.samples.filter((s) => e.timeStamp - s.t <= 100);
          const first = recent[0];
          if (first && e.timeStamp - first.t > 8) {
            const dt = (e.timeStamp - first.t) / 1000;
            const cap = 2600;
            f.vx = Math.max(-cap, Math.min(cap, (e.clientX - first.x) / dt));
            f.vy = Math.max(-cap, Math.min(cap, (e.clientY - first.y) / dt));
          }
        }
        // on, even at rest: the integration below also springs the plane
        // back into its range and records where it came to rest
        f.on = true;
      };
      /** the throw's integration, one step per ticker frame: coast under
       *  friction, spring back into the free range, and stop at a threshold
       *  — the plane never drifts forever and never stays outside. */
      const coast = () => {
        const f = fling.current;
        const dt = Math.min(0.05, gsap.ticker.deltaRatio(60) / 60);
        // friction: the velocity keeps ~7% less per 60fps frame, whatever
        // the real frame rate
        const keep = Math.pow(0.013, dt);
        f.vx *= keep;
        f.vy *= keep;
        pan.current.x += f.vx * dt;
        pan.current.y += f.vy * dt;
        let settled = Math.abs(f.vx) < 6 && Math.abs(f.vy) < 6;
        const axis = (k: "x" | "y") => {
          const v = pan.current[k];
          const edge = v < lo[k] ? lo[k] : v > hi[k] ? hi[k] : null;
          if (edge === null) return;
          // the spring: close most of the gap each frame and bleed the
          // velocity that carried it out, so it eases home without a bounce
          const gap = edge - v;
          pan.current[k] = Math.abs(gap) < 0.5 ? edge : v + gap * Math.min(1, 9 * dt);
          f[k === "x" ? "vx" : "vy"] *= 0.7;
          if (Math.abs(gap) >= 0.5) settled = false;
        };
        axis("x");
        axis("y");
        dirty = true;
        if (settled) {
          f.on = false;
          f.vx = 0;
          f.vy = 0;
          rest.current = { x: pan.current.x, y: pan.current.y };
        }
      };
      if (frame) {
        frame.addEventListener("pointerdown", onDown);
        frame.addEventListener("pointermove", onMove);
      }
      // THE RELEASE IS HEARD ANYWHERE (review fix, 2026-10-12): a press
      // under the slop is not captured, so one released over the nav bar
      // or past the window's bottom edge ended nowhere and the next hover
      // dragged the plane. Both events bubble from the frame to here, so
      // the captured case is the same path as before — onUp ignores a
      // pointer it is not holding.
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);

      const tick = () => {
        const t = gsap.ticker.time;
        if (fling.current.on) coast();
        if (dirty) {
          dirty = false;
          write();
        }
        // THE HIDDEN CLOUD RESTS (review, 2026-10-29): under the puzzle the
        // plane is invisible, and writing ~35 cards' transforms every frame
        // was most of the frame's style work. The clock runs on, so when
        // «Back to the picture» fades the plane in, the cards are simply
        // further along their paths — the step happens at opacity 0.
        for (const f of flight) {
          const open = !!f.id && f.id === chosenRef.current;
          // …except the OPEN card, until it is at rest (then frozen: no
          // writes), so «Back» finds it still even when Play came before
          // its ease had finished — the stale-chunk reopen (review, 2026-10-30)
          // The same rest while the series is not out (change 5.pdf p1:
          // the section opens on the in-place puzzle, the plane hidden).
          if ((playingRef.current || !seriesRef.current) && !open) continue;
          // A chosen card STOPS — eased to a standstill, then NOT WRITTEN
          // AT ALL. The old 0.25 damping kept writing a new transform every
          // frame, and a perpetually-animating transform keeps the card on
          // a conservatively-rasterized compositor layer — the print looked
          // soft at open size no matter how large the file was (measured:
          // 188 Laplacian variance mid-animation vs 478 once static).
          const target = open ? 0 : 1;
          f.w += (target - f.w) * 0.1;
          if (target === 0 && f.w < 0.01) {
            if (!f.frozen) {
              f.frozen = true;
              f.setX(0);
              f.setY(0);
              f.setR(0);
            }
            continue;
          }
          f.frozen = false;
          if (f.w > 0.999) f.w = 1;
          f.setX(Math.sin(t * f.fx + f.ph) * f.ax * f.w);
          f.setY(Math.cos(t * f.fy + f.ph * 1.7) * f.ay * f.w);
          f.setR(Math.sin(t * f.fr + f.ph) * f.ar * f.w);
        }
        // the plane itself moved above, before the cards: the throw's
        // integration (coast) and the drag's pending write; the centring
        // tween of a picked card writes itself through onUpdate
      };
      gsap.ticker.add(tick);

      return () => {
        gsap.ticker.remove(tick);
        gsap.killTweensOf([cards, pan.current]);
        if (frame) {
          frame.removeEventListener("pointerdown", onDown);
          frame.removeEventListener("pointermove", onMove);
          delete frame.dataset.drag;
        }
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        down = null;
        fling.current.on = false;
        // THE PAN DOES NOT OUTLIVE THE LAYER (review fix, 2026-10-12). The
        // drag writes the plane's transform from event handlers, outside
        // this context, so matchMedia's own revert never saw it: a 300px
        // drag at 1440, then a window under 861px, left the plain rail's
        // plane at -300px with its first cards off the left edge (measured
        // at 800×900). The rail starts from zero, as it always did.
        pan.current.x = 0;
        pan.current.y = 0;
        rest.current.x = 0;
        rest.current.y = 0;
        gsap.set(plane, { clearProps: "transform" });
      };
    });

    return () => mm.revert();
  }, [write]);

  /** Step to the next or previous picture without closing the viewer — the
   *  pan choreography below flies the plane to wherever it lies. Declared
   *  before the choosing effect, which wires it to the arrow keys. */
  const step = useCallback(
    (dir: 1 | -1) => {
      setChosen((cur) => {
        if (!cur) return cur;
        const i = items.findIndex((a) => a.id === cur);
        return items[(i + dir + items.length) % items.length].id;
      });
    },
    [items],
  );

  // ---- choosing a picture --------------------------------------------------
  // Measured contract: the chosen card grows in place, the rest dim hard, the
  // intro clears out, a caption sits under the card. Here the plane also pans
  // the choice comfortably into view — our cloud extends past the screen, the
  // reference's does not.
  useEffect(() => {
    const el = root.current;
    // On the plain rail the caption CSS does the whole job; the dim / grow /
    // pan choreography is desktop-and-full-motion only.
    if (!el) return;
    // CROSSING TO THE PLAIN LAYER WITH A PICTURE OPEN (review, 2026-10-29 —
    // older than the puzzle): the desktop branch below had written opacity
    // and width onto every card and hidden the title, and the rail kept all
    // of it — every card at 0.16 and the open one at 3.6× its width. On the
    // plain layer those inline styles go; back on the desktop the branch
    // runs again (this effect follows `plain`) and re-grows the open card.
    if (!window.matchMedia(DESKTOP).matches) {
      const cards = el.querySelectorAll<HTMLElement>(".ap-cloud__card");
      gsap.killTweensOf(cards);
      gsap.set(cards, { clearProps: "opacity,width" });
      const say = el.querySelector<HTMLElement>(".ap-cloud__say");
      if (say) {
        gsap.killTweensOf(say);
        gsap.set(say, { clearProps: "opacity,visibility" });
      }
      return;
    }
    const cards = gsap.utils.toArray<HTMLElement>(".ap-cloud__card", el);
    const say = el.querySelector<HTMLElement>(".ap-cloud__say");
    const card = chosen ? cards.find((c) => c.dataset.id === chosen) : undefined;

    cards.forEach((c) => {
      const isIt = c === card;
      // GROWN BY LAYOUT, NOT BY transform SCALE (2026-08-12). A scaled card
      // lives on a compositor layer whose raster the engine refuses to redo
      // at full resolution while anything nearby still animates — measured
      // 179 Laplacian variance against the browser's own 388 for this file
      // at this size, i.e. half the sharpness, whatever the source quality.
      // A layout-sized image always paints at device resolution. The card is
      // centre-anchored (xPercent/yPercent -50), so growing width moves
      // nothing; aspect-ratio carries the height.
      const pSize = parseFloat(c.style.getPropertyValue("--w")) || 3.7;
      gsap.to(c, {
        opacity: card && !isIt ? 0.16 : 1,
        width: `${isIt ? pSize * VIEW_SCALE : pSize}%`,
        duration: 0.45,
        ease: "power2.out",
      });
      // the chosen card over everything; the others back to the sheet's own
      // order (var(--z)), NOT a copy of it written inline — inline would
      // out-rank cloud.css's :focus-visible rule that brings a focused card
      // forward (live check 2026-11-04, FL-2)
      c.style.zIndex = isIt ? "600" : "";
    });
    // (and while a puzzle is out — back on the desktop mid-game, see above)
    if (say) gsap.to(say, { autoAlpha: card || playingRef.current ? 0 : 1, duration: 0.35 });

    // the centring tween owns the plane now: a throw still coasting would
    // fight it frame by frame (drag restored 2026-10-12)
    fling.current.on = false;
    fling.current.vx = 0;
    fling.current.vy = 0;
    if (card) {
      // bring it to the middle of the frame by panning the shared plane
      const r = card.getBoundingClientRect();
      const f = el.getBoundingClientRect();
      // centred in the FRAME, not the viewport: the panel sits to the right of
      // the picture, so the picture is offset left to leave it room
      const dx = f.left + f.width * 0.36 - (r.left + r.width / 2);
      const dy = f.top + f.height / 2 - (r.top + r.height / 2);
      gsap.to(pan.current, { x: pan.current.x + dx, y: pan.current.y + dy, duration: 0.6, ease: "power3.out", onUpdate: write });
    } else {
      // nothing chosen: the plane goes back to where the hand last left it
      // (`rest` — the origin until the first drag), or the cloud drifts a
      // little further off-centre with every pick. Not to 0,0 any more: with
      // the drag back (2026-10-12) that would undo the reader's own pan.
      gsap.to(pan.current, { x: rest.current.x, y: rest.current.y, duration: 0.6, ease: "power3.out", onUpdate: write });
    }

    const onKey = (e: KeyboardEvent) => {
      // the puzzle has the keys while it is out: its Escape leaves the
      // puzzle (not the picture), its arrows move a piece (not the series)
      if (playingRef.current) return;
      if (e.key === "Escape") setChosen(null);
      if (!chosenRef.current) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chosen, write, step, plain]);

  // THE RAIL FOLLOWS THE PANEL — plain layer only (phone repair pass,
  // 2026-10-05). ‹ › in the panel choose the next picture, and on the rail
  // that card can be screens away sideways; its caption and the face the
  // panel's Front · Back · Printed switch to are drawn ON the card, so
  // pressing Back changed a picture nobody could see (measured at 390x844:
  // card 12 off the right edge while its panel said "Back").
  // AND THE PAGE FOLLOWS THE CARD (2026-10-05 package). Sideways only was not
  // enough: pressing card 05 at 390x844 left its card at y 316 and the
  // panel's Add to cart at y 1052 — below the fold — and after → the new card
  // was wherever the rail had scrolled to, under the bar. Now the chosen card
  // comes to rest under the bar (its scroll-margin-top in cloud.css is the
  // bar's 84px) and at the start of the rail (its snap point), which puts
  // the card, its note and Add on one screen. "start", not "nearest": a card
  // already fully on screen at y 316 would not move, and Add would stay
  // below the fold. Instant under reduced motion.
  // THE PAGE MOVES ON A PHONE ONLY (2026-10-05 repair). The plain layer is
  // also the desktop under reduced motion, and there the page scroll pulled
  // the page 255px when card 06 was pressed at 1440x900 — the approved
  // desktop rail slides sideways and the page stays put, so at 861px and up
  // it is the old sideways centring again, unchanged.
  useEffect(() => {
    // read and clear in one go: a press that CLOSED the panel, or one on the
    // desktop, must not leave the flag set for the next ‹ ›
    const wantFocus = focusNo.current;
    focusNo.current = false;
    const el = root.current;
    if (!chosen || !el || window.matchMedia(DESKTOP).matches) return;
    const card = el.querySelector<HTMLElement>(`.ap-cloud__card[data-id="${chosen}"]`);
    if (!card) return;
    const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    if (window.matchMedia("(max-width: 860px)").matches) {
      card.scrollIntoView({ block: "start", inline: "start", behavior });
    } else {
      const plane = el.querySelector<HTMLElement>(".ap-cloud__plane");
      if (plane) {
        const pr = plane.getBoundingClientRect();
        const cr = card.getBoundingClientRect();
        plane.scrollBy({ left: cr.left + cr.width / 2 - (pr.left + pr.width / 2), behavior });
      }
    }
    // a card press hands focus to the panel's "No. n", so a screen reader
    // lands on what opened; preventScroll — the page is already moving
    if (wantFocus) noRef.current?.focus({ preventScroll: true });
  }, [chosen]);

  /** Press a card to open it, press it again to put it back — pointer and
   *  keyboard alike, through onClick. The one click that is NOT a press is
   *  the one the browser fires at the end of a drag (2026-10-12): a drag is
   *  never a choice, so a click inside a beat of a drag's release is let go. */
  const choose = useCallback((id: string) => {
    if (performance.now() - dragEndAt.current < 400) return;
    focusNo.current = true;
    setChosen((cur) => (cur === id ? null : id));
  }, []);

  // FOCUS NEVER FALLS TO THE PAGE AS THE PILL GOES OR COMES BACK (review,
  // change 5): opening a card unmounts the series' «Play the puzzle» pill
  // (below), and putting the card back unmounts its panel. When focus was on
  // the one that went — the pill, in a browser that does not focus a pressed
  // button; the panel's ✕ or any of its buttons — it lands on the card that
  // was opened: the one just chosen, or the one just put back. Focus that is
  // anywhere else is left where it is. Not after a stale-chunk reopen, whose
  // puzzle takes focus itself.
  const lastChosen = useRef<string | null>(null);
  useEffect(() => {
    const prev = lastChosen.current;
    lastChosen.current = chosen;
    if (!window.matchMedia(DESKTOP).matches || !seriesRef.current || playingRef.current || reopened.current) return;
    const a = document.activeElement;
    if (a && a !== document.body) return;
    const id = chosen ?? prev;
    const card = id ? root.current?.querySelector<HTMLElement>(`.ap-cloud__card[data-id="${id}"]`) : null;
    card?.focus(scriptFocus());
  }, [chosen]);

  // ---- the scenes (change 5.pdf p1) ----------------------------------------
  /** the in-place bar's «See the series»: the cloud comes back as it was,
   *  and focus waits on the way back to the puzzle (the same spot) */
  const showSeries = useCallback(() => {
    setSeries(true);
    requestAnimationFrame(() => backBtn.current?.focus(scriptFocus()));
  }, []);
  /** the series' «Play the puzzle» on the moved layer: back to the game in
   *  place, just as it was left (Puzzle keeps it) */
  const backToPuzzle = useCallback(() => {
    setChosen(null);
    setPlaying(false);
    setInFocus("exit");
    setSeries(false);
  }, []);
  /** the plain layer's disclosure: the rail in, the rail out */
  const toggleSeries = useCallback(() => {
    if (seriesRef.current) setChosen(null);
    setSeries((s) => !s);
  }, []);
  /** the still standing in for a failed in-place puzzle: its Play asks for
   *  it again — and a press makes a second failure a stale-chunk reload */
  const retryInPlace = useCallback(() => {
    inPressAt.current = performance.now();
    setOffline(false);
    setFailNote(null);
    // the still and this Play stay where they are while the game is asked
    // for again (review, change 5: they went for ~140 ms and came back as
    // new elements — focus fell to <body>, and nothing said anything)
    setInPressed(true);
    setInFocus(true);
    setInFailed(false);
    setInKey((k) => k + 1);
  }, []);
  // A PRESS THAT FAILS AGAIN KEEPS ITS FOCUS (review, change 5): the still
  // is a new element each time it comes back, so a second failure — inside
  // the reload guard, or after the reload itself (the file still gone) —
  // left focus on <body>. When the press (or the reopen) asked for focus, it
  // goes back to the still's Play; focus the visitor has taken elsewhere
  // stays there.
  useEffect(() => {
    if (!inFailed || !inFocus) return;
    const id = requestAnimationFrame(() => {
      const a = document.activeElement;
      if (a && a !== document.body && !root.current?.contains(a)) return;
      standBtn.current?.focus(scriptFocus());
    });
    return () => cancelAnimationFrame(id);
  }, [inFailed, inFocus]);
  // the still's window is the plain layer's: a window widened past it (or
  // motion allowed again) closes it — the section is that puzzle in place
  // …and on the way to the plain layer, the focus a press asked for is
  // spent: a resize back to the moved layer later mounts the in-place game
  // again, and nobody pressed anything then (review, change 5)
  useEffect(() => {
    if (!plain && playFromRef.current === "teaser") setPlaying(false);
    if (plain) setInFocus(false);
  }, [plain]);
  /** the title's box: no piece rests on it (Puzzle `avoid`) */
  const titleBox = useCallback(() => [root.current?.querySelector(".ap-cloud__say .ap-h2") ?? null], []);
  /** the in-place bar names the series as its way on */
  const inCopy = useMemo(() => ({ ...puzzle, back: puzzle.series }), [puzzle]);
  const inArt = items.find((a) => a.id === IN_PLACE);
  const railId = useId();

  // ---- the still where the game will be (review, change 5) ---------------
  /** the moved layer's puzzle scene, with no game shown yet (or a failed
   *  one): the still holds the board's place */
  const standShown = !plain && !series && !playing && !!inArt && !!puzzles[IN_PLACE] && (inFailed || inReady !== true);
  // THE BOARD'S PLACE IS THE GAME'S OWN LAYOUT: the stand's room box is the
  // game's room box (cloud.css, the same insets as puzzle.css), the no-go
  // box is the title's + 16 px (Puzzle `avoid`), and lib/puzzleLayout.ts is
  // the code the game itself runs — so the still lies exactly where the
  // board will, and the pieces come in over it without a shift.
  useLayoutEffect(() => {
    const el = standRoom.current;
    const set = puzzles[IN_PLACE];
    if (!standShown || !el || !set) return;
    const title = root.current?.querySelector(".ap-cloud__say .ap-h2") ?? null;
    const run = () => {
      const W = el.clientWidth;
      const H = el.clientHeight;
      // the plain layer hides the stand (cloud.css): nothing to lay out
      if (W < 40 || H < 40 || !window.matchMedia(DESKTOP).matches) {
        setStandGeo(null);
        return;
      }
      const h = el.getBoundingClientRect();
      const no: Rect[] = [];
      const r = title?.getBoundingClientRect();
      if (r && r.right > r.left && r.bottom > r.top) no.push({ l: r.left - h.left - 16, t: r.top - h.top - 16, r: r.right - h.left + 16, b: r.bottom - h.top + 16 });
      const L = layout(W, H, set, no);
      const g = { l: L.bx, t: L.by, w: L.cw * set.cols, h: L.ch * set.rows };
      setStandGeo((o) => (o && Math.abs(o.l - g.l) < 0.5 && Math.abs(o.t - g.t) < 0.5 && Math.abs(o.w - g.w) < 0.5 && Math.abs(o.h - g.h) < 0.5 ? o : g));
    };
    run();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    if (title) ro.observe(title);
    return () => ro.disconnect();
  }, [standShown]);
  // THE STILL IS ASKED FOR ONLY WHEN THE SECTION IS ON SCREEN — never with
  // the hero (SPEC: nothing of the puzzle loads before window load unless
  // it is what the section shows). The page opens with the section 0.6 of
  // a screen below the fold; with the game there first, it is never asked.
  useEffect(() => {
    const el = root.current;
    if (!el || stillOn || !standShown || !standGeo) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setStillOn(true);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [stillOn, standShown, standGeo]);
  // …AND IT IS FETCHED, NOT GIVEN TO THE <img> AS AN ADDRESS, BEFORE LOAD:
  // an image asked for before window load holds the load event back until
  // it is in, and the game's own file and pictures wait for that event — on
  // a 1.6 Mbit/s link the still put the game a second later (measured). A
  // fetch does not hold it back; the picture is then shown from its bytes,
  // and the file sits in the HTTP cache for any later <img> of it. After
  // load (or if the fetch fails) the address itself is used.
  const [stillUrl, setStillUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!stillOn) return;
    if (document.readyState === "complete") {
      setStillUrl(teaser.src);
      return;
    }
    let gone = false;
    let blob: string | null = null;
    const ctl = new AbortController();
    fetch(teaser.src, { signal: ctl.signal })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then(
        (b) => {
          if (gone) return;
          blob = URL.createObjectURL(b);
          setStillUrl(blob);
        },
        () => {
          if (!gone) setStillUrl(teaser.src);
        },
      );
    return () => {
      gone = true;
      ctl.abort();
      if (blob) URL.revokeObjectURL(blob);
    };
  }, [stillOn]);
  /** the line over the still's bar */
  const standNote = offline ? OFFLINE_NOTE : failNote === "inplace" ? puzzle.failed : "";
  /** the still's Play: once the game has failed, and while a press asks
   *  for it again */
  const standPlay = inFailed || inPressed;
  /** the still's bar is the section's bar: until the game's pieces show */
  const standBarOn = standShown && !!standGeo && (inFailed || inReady === false);
  // BACK FROM THE SERIES BY THE KEYBOARD BEFORE THE GAME HAS COME: its way
  // to the series is not shown yet, so focus waits on the still's own «See
  // the series» — the same words in the same place — and goes on to the
  // game's when its pieces show (inplaceReady), not on <body> meanwhile
  useEffect(() => {
    if (inFocus !== "exit" || !standBarOn) return;
    const id = requestAnimationFrame(() => {
      const a = document.activeElement;
      if (a && a !== document.body && !root.current?.contains(a)) return;
      if (a && standBar.current?.contains(a)) return;
      standBar.current?.querySelector<HTMLButtonElement>(".ap-pz__btn")?.focus(scriptFocus());
    });
    return () => cancelAnimationFrame(id);
  }, [inFocus, standBarOn]);

  return (
    // No `data-nosun` here: this section is an opaque stacking context at
    // z 2 (globals.css) and the flying sun (components/Sun.tsx) is under it
    // from the moment the curtain rises. THE SUN SHOWS IN HERE ALL THE SAME
    // (client, change 4.pdf p1, 2026-10-12: «արևը էս հատվածի տակով ա
    // անցնում, հնարավոր ա երևա արևը էս բաժնում էլ» — the sun passes under this
    // part; could it show in this section too): .ap-cloud__sun below is a
    // TWIN of the disc, laid inside the section over its dark ground and
    // under the frame — so under the title and under every card — and
    // Sun.tsx writes it the same place, size and opacity it writes the real
    // one, every frame. Where the section covers the screen the twin is
    // seen; where it does not, the real sun is; the two meet at the
    // curtain's edge without a jump, and nothing of the hero shows through.
    // Her 2026-08-10 note (no sun between the cards) still holds: the
    // journey's cloud keys keep the disc in the right margin, clear of
    // every card's box at rest (measured — see Sun.tsx PATH), and the
    // z-order means it can never cover one in any case.
    <section className="ap-cloud ap-dark" ref={root} aria-label={title.join(" ")}>
      <div className="ap-cloud__sun" aria-hidden="true">
        {/* the same <picture> gate as Sun.tsx: where the sun never flies —
            narrow, reduced motion, no scripting — the source is a 1×1 data
            GIF and nothing is fetched (2026-10-05 package rule) */}
        <picture style={{ display: "contents" }}>
          <source
            media="(max-width: 860px), (prefers-reduced-motion: reduce), (scripting: none)"
            srcSet="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- driven by
              transform from Sun.tsx's measured journey, like the real disc */}
          <img className="ap-cloud__sun-disc" src="/hero/sun.webp" alt="" width={879} height={830} />
        </picture>
      </div>
      <div
        className="ap-cloud__frame"
        data-chosen={chosen || undefined}
        data-puzzle={playing && !plain ? "" : undefined}
        // the in-place puzzle, or the series (cloud.css shows the one out)
        data-scene={series ? "series" : "puzzle"}
        // Click-away to close: "a clean press on the ground puts one back".
        // A press on a card or on the panel is that element's business, and
        // the click the browser fires at the end of a DRAG (it lands here,
        // on the capturing frame) is not a press at all — see dragEndAt.
        // Nor is any press while the puzzle is out: the room is the frame.
        onClick={(e) => {
          if (playingRef.current || !seriesRef.current) return;
          if (performance.now() - dragEndAt.current < 400) return;
          const t = e.target as HTMLElement;
          // the still, its Play and the disclosure are presses of their own
          // (a click-away there would close the panel under a puzzle being
          // opened — and a new choice closes any puzzle)
          if (!t.closest(".ap-cloud__card, .ap-cloud__info, .ap-cloud__teaser, .ap-cloud__more, .ap-cloud__back")) setChosen(null);
        }}
        // a drag that starts on a picture must pan the plane, not lift the
        // picture's bitmap out of the page (the native image drag fires
        // dragstart and cancels the pointer stream mid-gesture)
        onDragStart={(e) => e.preventDefault()}
      >
        {/* THE PLAIN LAYER'S PUZZLE (phones, reduced motion): her mock as a
            still — the board with its cut lines, two pieces beside it — and
            «Play the puzzle», which opens the window form. Shown by CSS on
            that layer only; on the moved layer the <picture> source is the
            inlined 1×1, so the still is never fetched there. */}
        <div className="ap-cloud__teaser">
          <picture aria-hidden="true">
            <source media={MOVED} srcSet={NOTHING} />
            {/* eslint-disable-next-line @next/next/no-img-element -- one small still, no resizing needed */}
            <img src={teaser.src} alt="" width={teaser.w} height={teaser.h} loading="lazy" decoding="async" draggable={false} />
          </picture>
          <button type="button" className="ap-cloud__play" ref={teaserBtn} onClick={startTeaser}>
            <PieceIcon />
            {puzzle.cta}
          </button>
          <p className="ap-cloud__note" role="status">
            {playFrom === "teaser" ? (offline ? OFFLINE_NOTE : failNote === "teaser" ? puzzle.failed : "") : ""}
          </p>
        </div>
        {/* …and the series one press away: the rail, as a disclosure */}
        <button type="button" className="ap-cloud__more" aria-expanded={series} aria-controls={railId} onClick={toggleSeries}>
          {puzzle.series}
        </button>
        {/* THE MOVED LAYER'S WAY BACK from the series to the game in place
            (the same words as every Play) — first in the frame's Tab order,
            where «See the series» left focus.
            ONE «PLAY THE PUZZLE» IN SIGHT AT A TIME (review, change 5; WCAG
            2.4.6): with a card open, its panel's Play plays THAT picture, and
            this pill — same words, same icon — would leave it for No. 05.
            So the pill steps aside while a card is open (the panel's ✕ and
            Escape put the card back, and it returns), and its name says
            where it goes, its visible words first (2.5.3). */}
        {!plain && series && !playing && !chosen && (
          <button
            type="button"
            className="ap-cloud__play ap-cloud__back"
            ref={backBtn}
            onClick={backToPuzzle}
            aria-label={`${puzzle.cta} — No. ${IN_PLACE}`}
          >
            <PieceIcon />
            {puzzle.cta}
          </button>
        )}
        <div className="ap-cloud__plane" id={railId}>
          {placed.map((p) => (
            <button
              type="button"
              className={`ap-cloud__card${p.mount ? " is-mounted" : ""}`}
              key={p.id}
              data-id={p.id}
              // the caption under a chosen card. Only facts we actually have:
              // the number and the series. No invented titles or mediums.
              data-caption={`No. ${p.id} — the Armenia series`}
              // THE PLAIN LAYER'S CARD IS A DISCLOSURE (2026-10-05 package):
              // it opens the panel under the rail rather than viewing the
              // picture larger, so it says expanded/collapsed and points at
              // that panel. MICROCOPY: "view it larger" → "see its details"
              // there. The desktop card is untouched: pressed, same name.
              aria-pressed={plain ? undefined : chosen === p.id}
              aria-expanded={plain ? chosen === p.id : undefined}
              aria-controls={plain && chosen === p.id ? infoId : undefined}
              aria-label={
                plain
                  ? `Illustration number ${p.id}. Press to see its details.`
                  : `Illustration number ${p.id}. Press to view it larger.`
              }
              onClick={() => choose(p.id)}
              style={
                {
                  "--x": `${p.x}%`,
                  "--y": `${p.y}%`,
                  "--w": `${p.size}%`,
                  "--z": String(p.z),
                  background: p.avg,
                } as React.CSSProperties
              }
            >
              {/* NO ADDRESS UNTIL THE SERIES IS FIRST SHOWN (change 5.pdf p1):
                  the section opens on the puzzle, and a hidden lazy picture
                  is still fetched — thirty-five of them under the game. Without
                  scripts the rail is simply open, and the <noscript> copy is
                  the picture. */}
              <img src={seen ? p.thumb : undefined} alt="" width={p.w} height={p.h} loading="lazy" decoding="async" draggable={false} />
              <noscript>
                {/* eslint-disable-next-line @next/next/no-img-element -- the no-script rail's picture */}
                <img src={p.thumb} alt="" width={p.w} height={p.h} loading="lazy" decoding="async" />
              </noscript>
              {/* the chosen card shows the selected face — front print, the
                  postcard's back, or the printed mockup — and CHANGES FACE
                  LIKE A BOOK PAGE (client 2026-08-12): forward turns the
                  current face away around its left edge, backward turns the
                  previous face back in, over the face beneath. A face whose
                  aspect differs from the card (art-13's portrait print of a
                  landscape original; every landscape mockup) letterboxes on
                  the artwork's own average colour instead of cropping. */}
              {chosen === p.id &&
                (() => {
                  const cur = face(p, view);
                  if (!cur.src) return null;
                  const fit = (w?: number, h?: number) => !(w && h && Math.abs(p.w / p.h - w / h) < 0.08);
                  const under = page?.under ?? cur;
                  return (
                    <>
                      {/* ONE persistent element, NEVER keyed by its file: a
                          remount paints empty for a few frames and the front
                          thumb beneath showed through on every switch (client
                          2026-08-12, twice). Swapping src in place keeps the
                          old bitmap until the new one paints, and the new one
                          is already decoded (the gate in switchView), so
                          decoding=sync makes the swap a single clean frame. */}
                      <img
                        className={`ap-cloud__lg${fit(under.w, under.h) ? " is-fit" : ""}`}
                        src={under.src}
                        alt=""
                        width={under.w}
                        height={under.h}
                        decoding="sync"
                        style={fit(under.w, under.h) ? { background: p.avg } : undefined}
                      />
                      {page && (
                        <img
                          className={`ap-cloud__page ${page.dir === 1 ? "is-out" : "is-in"}${fit(page.over.w, page.over.h) ? " is-fit" : ""}`}
                          key={(page.over.src ?? "") + view}
                          src={page.over.src}
                          alt=""
                          width={page.over.w}
                          height={page.over.h}
                          decoding="sync"
                          style={fit(page.over.w, page.over.h) ? { background: p.avg } : undefined}
                          onAnimationEnd={() => setPage(null)}
                        />
                      )}
                    </>
                  );
                })()}
            </button>
          ))}
        </div>

        {/* The kicker, the sentence and the drag cue are all still here for
            the PLAIN layer — the phone rail has no room to explain itself and
            this is its only introduction. In the live cloud, CSS shows the
            title alone and moves it to the left (client 2026-08-06). */}
        <div className="ap-cloud__say">
          <p className="ap-kicker">{kicker}</p>
          {/* every letter arrives cut in two — the halves slide vertically
              and seam shut, left to right. ONE LINE PER SPAN (change.pdf p2,
              2026-09-21: «write it in 2 lines, ARMENIA up to the line»): the
              runner splits each line on its own, the second a beat behind,
              and CSS keeps a line from wrapping where the box is narrow. */}
          <h2 className="ap-h2">
            {title.map((line, i) => (
              <span className="ap-cloud__tl" key={line} data-tfx="cut" data-tfx-delay={i ? "0.18" : undefined}>
                {line}
              </span>
            ))}
          </h2>
          <p className="ap-lede">{copy}</p>
        </div>

        {/* what a picked picture IS: its number, its series, and Arpine's own
            note for it (client files 2026-08-11). The three pictures without
            a note yet (23/25/34) keep the series body. ‹ › browse the whole
            series without closing — the plane flies to each one. */}
        {/* the desktop panel steps aside while the puzzle has the frame */}
        {chosen && !(playing && !plain) && (
          // NO role=status ON THE PLAIN LAYER (2026-10-05 package): the
          // whole panel — note, faces, price, buttons — was read out on every
          // change. Focus moves to "No. n" when a card opens it, and only
          // that line is live, so ‹ › announce the new number. The desktop
          // panel keeps its status role, as it was.
          <div className="ap-cloud__info" id={infoId} role={plain ? undefined : "status"}>
            {/* THE SHEET SCROLLS, THE PANEL DOES NOT (2026-10-05). On the
                desktop cloud the long-note cap (max-height + overflow) sat on
                the panel itself, so it clipped its own ✕ — which hung 46px
                above the panel's top edge: invisible, and a press at its
                centre landed on the plane at 1440x900, 1280x720 and 1886x835
                (measured with elementFromPoint). The cap lives on this inner
                sheet now and the ✕ is its sibling, so it stays in its corner
                while a long note scrolls. On the plain layer the sheet is
                `display: contents` and the panel's grid is what it was. */}
            <div className="ap-cloud__sheet">
              <p className="ap-cloud__no" ref={noRef} tabIndex={-1} aria-live={plain ? "polite" : undefined}>
                No. {chosen}
              </p>
              <p className="ap-cloud__series">{pick.line}</p>
              {(items.find((a) => a.id === chosen)?.text ?? pick.body).split("\n").map((t) => (
                <p className="ap-cloud__body" key={t.slice(0, 24)}>
                  {t}
                </p>
              ))}
              {(() => {
                const art = items.find((a) => a.id === chosen);
                if (!art?.back && !art?.mock) return null;
                return (
                  <div className="ap-cloud__views" role="group" aria-label="Faces of this picture">
                    <button type="button" aria-pressed={view === "front"} onClick={() => switchView("front", art)}>
                      Front
                    </button>
                    {art.back && (
                      <button type="button" aria-pressed={view === "back"} onClick={() => switchView("back", art)}>
                        Back
                      </button>
                    )}
                    {art.mock && (
                      <button type="button" aria-pressed={view === "mock"} onClick={() => switchView("mock", art)}>
                        Printed
                      </button>
                    )}
                  </div>
                );
              })()}
              {/* EVERY PICTURE PLAYS (2026-10-29, «use same logic for other
                  images»): No. 05 with the pieces he cut, every other one cut
                  in the browser with his knob (lib/puzzleCut.ts) */}
              <button type="button" className="ap-cloud__play" ref={playBtn} onClick={startPuzzle}>
                <PieceIcon />
                {puzzle.cta}
              </button>
              {/* why the press did nothing, when it was the connection. The
                  desktop panel is already a status region (it announces the
                  line); the plain layer's has no role, so a hidden live line,
                  present before the words arrive, says it there. */}
              {(offline || failNote === "panel") && playFrom === "panel" && (
                <p className="ap-cloud__body" aria-hidden={plain || undefined}>
                  {offline ? OFFLINE_NOTE : puzzle.failed}
                </p>
              )}
              {plain && (
                <span className="ap-sr" aria-live="polite">
                  {playFrom === "panel" ? (offline ? OFFLINE_NOTE : failNote === "panel" ? puzzle.failed : "") : ""}
                </span>
              )}
              <div className="ap-cloud__nav">
                <button type="button" onClick={() => step(-1)} aria-label="Previous picture">
                  ←
                </button>
                <span aria-hidden="true">
                  {items.findIndex((a) => a.id === chosen) + 1} / {items.length}
                </span>
                <button type="button" onClick={() => step(1)} aria-label="Next picture">
                  →
                </button>
              </div>
              {/* buy this card without leaving the cloud — UNLESS it is one the
                  client took out of the postcard catalogue (change 3.pdf p2,
                  2026-10-01: nos. 23 and 25, `withheldArt` in content.ts). The
                  picture stays in the cloud to be looked at — her note removes
                  a postcard, not a picture — but this button writes a
                  "postcards" line to the cart, i.e. it is a second door into
                  the very catalogue she closed, so for those two neither the
                  card's price nor the button is offered. The way to the shop
                  stays. */}
              {!notACard && (
                <p className="ap-cloud__price">
                  {CARD_PRICE === null ? (
                    priceTbc
                  ) : (
                    <>
                      <strong>{dram(CARD_PRICE)}</strong> <span>a card</span>
                    </>
                  )}
                </p>
              )}
              <div className="ap-cloud__buy">
                {!notACard && (
                  <button
                    type="button"
                    className="ap-btn"
                    onClick={() => {
                      if (!soldCard) buy(chosen);
                    }}
                    data-added={added || undefined}
                    data-sold={soldCard || undefined}
                    aria-disabled={soldCard || undefined}
                  >
                    {soldCard ? "Sold out" : added ? "Added ✓" : "Add to cart"}
                  </button>
                )}
                <Link className="ap-cloud__go" href="/shop/postcards">
                  {pick.cta} <span aria-hidden>→</span>
                </Link>
              </div>
            </div>
            <button
              type="button"
              className="ap-cloud__close"
              onClick={() => setChosen(null)}
              aria-label="Put the picture back"
            >
              ✕
            </button>
          </div>
        )}

        {/* the puzzle: in the frame on the desktop moved layer, as a window
            everywhere else (a portal — it lies over the page, not the rail) */}
        {/* THE SECTION'S OWN PUZZLE, played in place (moved layer, change
            5.pdf p1): No. 05 lies whole until the room is half on screen,
            then breaks up round its board, between the title (no piece
            rests on it) and the sun's lane (puzzle.css: the room ends at
            0.84 of the width). The game is kept for the tab (`persist`).
            Asked for only once `near` (a screen away, after load). A file
            that will not come (a deploy since this page opened) leaves the
            still and «Play the puzzle», whose press is the visitor asking —
            a second failure then takes the guarded reload. His piece
            pictures failing twice (offline, or gone) leave the same still
            (`onFail`), and its press asks for them again. */}
        {!plain && !series && !playing && near && inArt && puzzles[IN_PLACE] && !inFailed && (
          <MapBoundary key={`in-${inKey}`} onError={inplaceFailed}>
            <Puzzle
              set={puzzles[IN_PLACE]}
              art={{ id: inArt.id, src: inArt.lg ?? inArt.src, w: inArt.lgW ?? inArt.w, h: inArt.lgH ?? inArt.h }}
              mode="inline"
              placement="section"
              dealWhen="visible"
              autoFocus={inFocus}
              escapeExits={false}
              avoid={titleBox}
              roving
              persist={PERSIST}
              label={`No. ${IN_PLACE}`}
              copy={inCopy}
              memory={puzzleMemory}
              onExit={showSeries}
              onFail={inplacePicturesFailed}
              onReady={inplaceReady}
            />
          </MapBoundary>
        )}
        {/* THE STILL WHERE THE GAME WILL BE (review, change 5): until the
            game's pieces are shown — before window load, while its file and
            its pictures come, or when they would not come — No. 05 lies
            whole on the board's own place (her still's board, cut lines and
            all; its two loose pieces are the game's to deal), and «See the
            series» stands where the game's bar will (which waits unseen
            under it — cloud.css). When the pieces show, the still and its
            bar fade as the pieces and the game's bar come in. Failed, the
            bar offers «Play the puzzle» too (it asks again; a second
            failure takes the guarded reload) and the line over it says why
            a press came to nothing. One element all along, so a press never
            loses its focus. Fading, it takes no press and no focus. */}
        {standShown && (
          <div
            className="ap-cloud__stand"
            data-out={(inReady === "fading" && !inFailed) || undefined}
            inert={(inReady === "fading" && !inFailed) || undefined}
          >
            <div className="ap-cloud__stand-room" ref={standRoom}>
              {standGeo && (
                <div
                  className="ap-cloud__still"
                  aria-hidden="true"
                  style={{ left: standGeo.l, top: standGeo.t, width: standGeo.w, height: standGeo.h }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- the still, cut to its board by its own box */}
                  <img
                    src={stillUrl ?? undefined}
                    alt=""
                    width={teaser.w}
                    height={teaser.h}
                    decoding="async"
                    draggable={false}
                    data-in={stillIn || undefined}
                    style={{
                      width: standGeo.w / teaser.board.w,
                      height: standGeo.h / teaser.board.h,
                      left: (-teaser.board.x * standGeo.w) / teaser.board.w,
                      top: (-teaser.board.y * standGeo.h) / teaser.board.h,
                    }}
                    onLoad={() => setStillIn(true)}
                    // OFFLINE THE STILL CANNOT COME EITHER (review, change 5):
                    // then the board's ground, the buttons and the line remain
                    onError={() => setStillIn(false)}
                  />
                </div>
              )}
            </div>
            {standGeo && (
              <div className="ap-pz__bar ap-cloud__stand-bar" data-mode="inline" ref={standBar}>
                <p className="ap-cloud__note" role="status">
                  {standNote}
                </p>
                {standPlay && (
                  <button type="button" className="ap-cloud__play" ref={standBtn} onClick={retryInPlace}>
                    <PieceIcon />
                    {puzzle.cta}
                  </button>
                )}
                <button type="button" className="ap-pz__btn" onClick={showSeries}>
                  {puzzle.series}
                </button>
              </div>
            )}
          </div>
        )}

        {/* the puzzle a press opened: the chosen card's, in the frame on the
            desktop moved layer, as a window everywhere else (a portal — it
            lies over the page, not the rail); or No. 05 from the still */}
        {playing &&
          (() => {
            const id = playFrom === "teaser" ? IN_PLACE : chosen;
            const a = id ? items.find((x) => x.id === id) : undefined;
            if (!id || !a) return null;
            return (
              <MapBoundary onError={puzzleFailed}>
                <Puzzle
                  key={plain ? "sheet" : "inline"}
                  set={puzzles[id]}
                  // the picture the open card already shows — so its file is
                  // already in the cache when a cut puzzle draws from it
                  art={{ id: a.id, src: a.lg ?? a.src, w: a.lgW ?? a.w, h: a.lgH ?? a.h }}
                  mode={plain ? "sheet" : "inline"}
                  label={`No. ${id}`}
                  copy={puzzle}
                  memory={puzzleMemory}
                  // No. 05 is ONE game wherever it is played
                  persist={id === IN_PLACE ? PERSIST : undefined}
                  onExit={stopPuzzle}
                />
              </MapBoundary>
            );
          })()}
      </div>
    </section>
  );
}
