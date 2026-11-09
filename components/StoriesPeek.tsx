"use client";

import { useEffect, useRef, type RefObject } from "react";
import { stories, type Story } from "@/lib/content";
import shots from "@/lib/stories.json";

// ============================================================================
// THE COVER'S PEEK — /stories (client, change 5.pdf p7, 2026-11-04)
//
// On the desktop cover she filled the bare paper between her subtitle and
// «SCROLL» with a solid box in her own ink, with no note. Until she says what
// she meant (she has been asked), the box holds a picture of the story a
// visitor points at, or reaches by keyboard, in the index; at rest, the
// newest story that has photographs. It came in as one commit of its own —
// this file, its lines in StoriesView.tsx and its block in stories.css — so
// it can be taken out whole if she wants the paper back.
//
//   · A story's picture is its first photograph (her own pictures over a
//     television frame); only a story with none — the AGBU feature — shows
//     its film's poster, the picture its sheet opens on.
//   · DECORATIVE. The figure is aria-hidden: the index row it follows already
//     names the story. It adds no tab stop and takes no pointer.
//   · NOTHING AT LOAD. The resting picture is fetched once the window has
//     loaded, at idle; every other story's only on intent (a mouse or pen
//     over its row, or keyboard focus on it). The -sm rung (720px) covers the
//     box at 1x on every desktop measured; md and the master are in the
//     srcset for denser screens. A box too small to show a picture (the
//     @container query in stories.css, mirrored here) fetches nothing.
//   · DRAWN ON A CANVAS, NOT AN <img>. Measured on the first build with
//     <img>: the resting picture, idle after load, became the page's Largest
//     Contentful Paint — 173,800 px² at 2.1 s over the 56,404 px² text
//     painted at 0.7 s — and a hover before any click or scroll would do the
//     same in the field, timing the page by a visitor's mouse. A canvas is
//     not a candidate, so LCP stays the text it was. Two canvases
//     cross-fade: the next picture is drawn on the face that is down, which
//     then comes up.
//   · The stack layer only: StoriesView renders it when `stack` is on, so
//     the server markup, phones and reduced motion are exactly what they
//     were. GSAP scales the cover sheet it sits on, so the faces move on
//     opacity alone and carry no transform (gsap-individual-transform-trap);
//     their size is layout (offsetWidth), which GSAP's scale does not touch.
// ============================================================================

type Shot = { id: string; src: string; thumb: string; md?: string; w: number; h: number };
type Pic = { src: string; srcSet?: string; w: number; h: number };

/** the -sm rung fits inside 720×720 (scratchpad/assets-1001-stories.cjs) */
const SM_EDGE = 720;
/** every film poster is a 960×540 frame (public/stories/film-*.webp) */
const POSTER_W = 960;
const POSTER_H = 540;
/** the tallest a picture is drawn — the story sheets' own lead cap */
const CAP = 620;
/** the box below which no picture shows: the @container query in
 *  stories.css says the same, and this copy keeps it from being fetched */
const MIN_H = 160;
const MIN_W = 220;
/** how long the pointer rests on a row before its picture is fetched: a
 *  sweep across the list on the way somewhere else fetches nothing
 *  (measured before this: 60ms a row fetched all ten). A picture already
 *  fetched comes up at once. */
const DWELL = 90;

function picOf(s: Story): Pic | null {
  const lead = s.photos.length ? (shots as Shot[]).find((x) => x.id === s.photos[0]) : undefined;
  if (lead) {
    const smW = Math.round(lead.w * Math.min(1, SM_EDGE / Math.max(lead.w, lead.h)));
    const set = [`${lead.thumb} ${smW}w`];
    if (lead.md) set.push(`${lead.md} 1080w`);
    if (lead.w > smW) set.push(`${lead.src} ${lead.w}w`);
    return { src: lead.thumb, srcSet: set.join(", "), w: lead.w, h: lead.h };
  }
  if (s.film) return { src: s.film.poster, w: POSTER_W, h: POSTER_H };
  return null;
}
const PICS = stories.entries.map(picOf);
/** at rest: the newest story with photographs (the list is newest first) */
const REST = stories.entries.findIndex((s) => s.photos.length > 0);

/** what the index calls: point the peek at story i, or back at rest (null) */
export type PeekControl = { point: (i: number | null) => void };

export default function StoriesPeek({ control }: { control: RefObject<PeekControl | null> }) {
  const fig = useRef<HTMLElement | null>(null);
  const faceA = useRef<HTMLCanvasElement | null>(null);
  const faceB = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const box = fig.current;
    const faces = [faceA.current, faceB.current];
    if (!box || !faces[0] || !faces[1]) return;
    const face = faces as HTMLCanvasElement[];

    let gone = false;
    let want = REST; // the story the peek should show
    let picked: number | null = null; // the row pointed at, if any
    let front = -1; // the face that is up (0 or 1), −1 before the first
    let loaded = false; // the load event has passed: the resting picture may come
    const drawn: (number | null)[] = [null, null]; // the story on each face
    const pics = new Map<number, HTMLImageElement>(); // fetched and decoded
    const pending = new Set<number>();

    // the inverse of `@container (max-height: 160px) or (max-width: 220px)`
    const roomy = () => box.clientHeight > MIN_H && box.clientWidth > MIN_W;

    /** paint story i on a face at the face's own size × the screen's density */
    const paint = (f: HTMLCanvasElement, i: number) => {
      const img = pics.get(i);
      const p = PICS[i];
      if (!img || !p) return;
      f.style.setProperty("--r", String(p.w / p.h));
      const w = f.offsetWidth; // CSS px; 0 while the @container query hides it
      if (!w) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const pw = Math.round(w * dpr);
      const ph = Math.round((pw * p.h) / p.w);
      if (f.width !== pw || f.height !== ph) {
        f.width = pw;
        f.height = ph;
      }
      const ctx = f.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.clearRect(0, 0, pw, ph);
      ctx.drawImage(img, 0, 0, pw, ph);
    };

    /** bring story i up: drawn on the face that is down, which then rises */
    const show = (i: number) => {
      if (front >= 0 && drawn[front] === i) return;
      const next = front === 0 ? 1 : 0;
      paint(face[next], i);
      drawn[next] = i;
      face[next].dataset.story = stories.entries[i].id;
      face[next].setAttribute("data-on", "");
      if (front >= 0) face[front].removeAttribute("data-on");
      front = next;
    };

    /** fetch story i's picture; it goes up when decoded, if still wanted */
    const fetchPic = (i: number) => {
      const p = PICS[i];
      if (!p || pics.has(i) || pending.has(i) || !roomy()) return;
      pending.add(i);
      const img = new Image();
      img.decoding = "async";
      img.setAttribute("fetchpriority", "low");
      if (p.srcSet) {
        // the width it will be drawn at, the way stories.css fits it
        const w = Math.min(box.clientWidth, (Math.min(box.clientHeight, CAP) * p.w) / p.h);
        img.sizes = `${Math.ceil(w)}px`;
        img.srcset = p.srcSet;
      }
      img.src = p.src;
      img.decode().then(
        () => {
          pending.delete(i);
          if (gone) return;
          pics.set(i, img);
          if (want === i) show(i);
        },
        () => pending.delete(i),
      );
    };

    /** may story i's picture be fetched now? a row pointed at, always; the
     *  resting picture (back at rest, i = null) only after the load event */
    const mayFetch = (i: number | null) => i !== null || loaded;

    let dwell = 0;
    const point = (i: number | null) => {
      picked = i;
      want = i ?? REST;
      window.clearTimeout(dwell);
      if (want < 0) return;
      if (pics.has(want)) show(want);
      else if (mayFetch(i)) {
        const at = want;
        dwell = window.setTimeout(() => {
          if (want === at) fetchPic(at);
        }, DWELL);
      }
    };
    control.current = { point };

    // the resting picture: after the window's load event, at idle
    let idle = 0;
    let timer = 0;
    const rest = () => {
      loaded = true;
      fetchPic(REST); // up when decoded, unless the index is pointing elsewhere
    };
    const later = () => {
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(rest, { timeout: 1500 });
      else timer = window.setTimeout(rest, 300);
    };
    if (document.readyState === "complete") later();
    else window.addEventListener("load", later, { once: true });

    // a new box (a resize, the fonts arriving): repaint both faces at their
    // new size, and fetch what is wanted if the box has just become roomy
    const ro = new ResizeObserver(() => {
      face.forEach((f, k) => {
        const i = drawn[k];
        if (i !== null) paint(f, i);
      });
      if (want >= 0 && !pics.has(want) && mayFetch(picked)) fetchPic(want);
    });
    ro.observe(box);

    return () => {
      gone = true;
      control.current = null;
      ro.disconnect();
      window.removeEventListener("load", later);
      if (idle) window.cancelIdleCallback(idle);
      window.clearTimeout(timer);
      window.clearTimeout(dwell);
    };
  }, [control]);

  return (
    <figure className="ap-st__peek" aria-hidden="true" ref={fig} style={{ "--peek-cap": `${CAP}px` } as React.CSSProperties}>
      <canvas ref={faceA} width={0} height={0} />
      <canvas ref={faceB} width={0} height={0} />
    </figure>
  );
}
