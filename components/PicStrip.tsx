"use client";

import { useEffect, useRef, useState } from "react";
import { artXs } from "@/lib/thumbs";

// ============================================================================
// THE PICTURE STRIP — every one of her pictures, one press from its puzzle
// (Vardan's pick, 2026-11-20, «picture strip under the game», from four live
// demos). Before it, only No. 05 was offered as a puzzle: any other picture
// was four steps away (See the series → find its card → its panel → Play).
//
// Two forms:
//   · "bar"  — the desktop moved layer: a pill just over the game's own bar,
//     under the room; ‹ › page through it, a wheel turns it sideways
//   · "row"  — the plain layer (phones, reduced motion): a swipe row under
//     the still's «Play the puzzle»
//
// ONE TAB STOP FOR FIFTY-SEVEN PICTURES: the picture being played (or the
// last one focused) is the stop; ← → walk the strip, Home / End jump to its
// ends, Enter or Space plays. The one being played says so (aria-current).
// The pictures are the -xs files, lazy: the strip asks for what is in view.
// Positions are read off the list itself (cloud.css makes it the offset
// parent): measured against the pill instead, ← and Home put focus on
// pictures scrolled out of sight (review, 2026-11-20).
// ============================================================================

export type StripPic = { id: string; thumb: string; avg: string };

const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

export default function PicStrip({
  pics,
  current,
  onPick,
  variant,
  labelId,
  pickLabel,
  prevLabel,
  nextLabel,
  load,
}: {
  /** the pictures may be asked for: never in the hero's LCP window. Until
   *  then each tile is its picture's average colour, in its own place, so
   *  nothing moves when the pictures come (Cloud's `near`) */
  load: boolean;
  pics: StripPic[];
  /** the picture being played (or offered) — the strip's tab stop */
  current: string;
  /** the button pressed comes too: where focus goes back to */
  onPick: (id: string, from: HTMLButtonElement) => void;
  variant: "bar" | "row";
  /** the visible words that name the strip */
  labelId: string;
  /** each picture's name, «Play No. {n}» */
  pickLabel: string;
  prevLabel: string;
  nextLabel: string;
}) {
  const list = useRef<HTMLUListElement | null>(null);
  const [stop, setStop] = useState(current);
  useEffect(() => setStop(current), [current]);

  // THE PICTURE BEING PLAYED IS IN VIEW — set on the strip itself, never by
  // scrollIntoView, which would also scroll the PAGE to a strip below the fold
  useEffect(() => {
    const ul = list.current;
    const el = ul?.querySelector<HTMLElement>(`[data-id="${current}"]`);
    if (!ul || !el) return;
    const li = el.parentElement as HTMLElement;
    const left = li.offsetLeft - (ul.clientWidth - li.offsetWidth) / 2;
    const max = ul.scrollWidth - ul.clientWidth;
    const to = Math.max(0, Math.min(max, left));
    if (Math.abs(ul.scrollLeft - to) > 1) ul.scrollTo({ left: to, behavior: calm() ? "auto" : "smooth" });
  }, [current]);

  // NO WHEEL TAKEOVER (review, 2026-11-20): turning a vertical wheel into
  // sideways movement stopped the PAGE for ~14 notches whenever the strip
  // slid under a resting pointer, and blocked Ctrl+wheel zoom. A trackpad's
  // sideways swipe and Shift+wheel scroll the list natively; ‹ › and the
  // arrow keys serve everyone else.

  const page = (dir: 1 | -1) => {
    const ul = list.current;
    if (ul) ul.scrollBy({ left: dir * ul.clientWidth * 0.8, behavior: calm() ? "auto" : "smooth" });
  };

  const onKey = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const ids = pics.map((p) => p.id);
    const at = ids.indexOf(stop);
    let to = -1;
    if (e.key === "ArrowRight") to = Math.min(ids.length - 1, at + 1);
    else if (e.key === "ArrowLeft") to = Math.max(0, at - 1);
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = ids.length - 1;
    if (to < 0) return;
    e.preventDefault();
    setStop(ids[to]);
    const btn = list.current?.querySelector<HTMLButtonElement>(`[data-id="${ids[to]}"]`);
    btn?.focus({ preventScroll: true });
    // …and brought into view on the strip alone (the page stays put)
    const ul = list.current;
    const li = btn?.parentElement;
    if (ul && li) {
      if (li.offsetLeft < ul.scrollLeft) ul.scrollLeft = li.offsetLeft;
      else if (li.offsetLeft + li.offsetWidth > ul.scrollLeft + ul.clientWidth) ul.scrollLeft = li.offsetLeft + li.offsetWidth - ul.clientWidth;
    }
  };

  return (
    <div className={`ap-picks ap-picks--${variant}`} role="group" aria-labelledby={labelId}>
      <button type="button" className="ap-picks__nav" aria-label={prevLabel} onClick={() => page(-1)}>
        <span aria-hidden="true">‹</span>
      </button>
      <ul className="ap-picks__list" ref={list} onKeyDown={onKey}>
        {pics.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="ap-picks__pic"
              data-id={p.id}
              aria-current={p.id === current || undefined}
              aria-label={fill(pickLabel, { n: p.id })}
              tabIndex={p.id === stop ? 0 : -1}
              onFocus={() => setStop(p.id)}
              onClick={(e) => onPick(p.id, e.currentTarget)}
              style={{ background: p.avg }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- a 240px file for a ~50px tile */}
              <img src={load ? artXs(p.thumb) : undefined} alt="" width={240} height={339} loading="lazy" decoding="async" draggable={false} />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="ap-picks__nav" aria-label={nextLabel} onClick={() => page(1)}>
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}

const calm = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
