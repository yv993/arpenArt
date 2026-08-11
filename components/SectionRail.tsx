"use client";

import { useEffect, useRef, useState } from "react";

// The left rail, in the spirit of the one on the KAR build: a percentage
// readout and a filling hairline. Here it also NAMES the section you are in,
// so it doubles as a place-marker for the visitor and as a shared coordinate
// when we talk about the page ("the strip at 22").
//
// It is also a CONTROL (client 2026-08-06: "in rail part user must can drag
// and go over page"). Grab the hairline and the page follows the pointer;
// press anywhere on it to jump there. The whole page compressed into ~170px
// means it is a coarse control by construction — that is what makes it useful
// on a document this tall, where the real scrollbar's thumb is a sliver.
//
// ONE SOURCE OF TRUTH, deliberately: a drag only ever calls scrollTo, and the
// number, the fill and the knob are all redrawn by the ordinary scroll
// listener below. Nothing here paints a position the page is not actually at,
// so the readout can never disagree with the document.
//
// Plain scroll listener + rAF, no GSAP — it has to work under reduced motion,
// where the tweens never wire but the page still scrolls.

type Mark = { id: string; label: string; top: number };

export default function SectionRail() {
  const num = useRef<HTMLSpanElement | null>(null);
  const fill = useRef<HTMLSpanElement | null>(null);
  const knob = useRef<HTMLSpanElement | null>(null);
  const track = useRef<HTMLDivElement | null>(null);
  const [label, setLabel] = useState("");

  useEffect(() => {
    const named: Array<[string, string]> = [
      [".ap-hero", "Cover"],
      [".ap-strip", "The series"],
      ["#gallery", "Gallery"],
      ["#shop", "Shop"],
      // About and Contact live on their own pages now; the rail only names
      // what is on this one (measure() drops selectors that match nothing,
      // but a stale entry would still be a lie about the page's shape)
    ];

    let marks: Mark[] = [];
    const measure = () => {
      marks = named
        .map(([sel, lab]) => {
          const el = document.querySelector<HTMLElement>(sel);
          if (!el) return null;
          return { id: sel, label: lab, top: el.getBoundingClientRect().top + window.scrollY };
        })
        .filter(Boolean) as Mark[];
      marks.sort((a, b) => a.top - b.top);
    };

    const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;

    let raf = 0;
    let lastPct = -1;
    let lastLabel = "";
    const read = () => {
      raf = 0;
      const max = maxScroll();
      const y = window.scrollY;
      const pct = max > 0 ? Math.min(100, Math.max(0, Math.round((y / max) * 100))) : 0;
      if (pct !== lastPct) {
        lastPct = pct;
        if (num.current) num.current.textContent = String(pct).padStart(2, "0");
        if (fill.current) fill.current.style.transform = `scaleY(${pct / 100})`;
        if (knob.current) knob.current.style.top = `${pct}%`;
        if (track.current) track.current.setAttribute("aria-valuenow", String(pct));
      }
      // the section whose top has most recently passed the middle of the screen
      const probe = y + window.innerHeight * 0.42;
      let name = marks.length ? marks[0].label : "";
      for (const m of marks) if (m.top <= probe) name = m.label;
      if (name !== lastLabel) {
        lastLabel = name;
        setLabel(name);
      }
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    const onResize = () => {
      measure();
      onScroll();
    };

    // ---- the control ------------------------------------------------------
    const el = track.current;

    /** The track's geometry, frozen for the duration of a drag.
     *
     *  MEASURED BUG, not a precaution: re-reading the rect on every move made
     *  a drag land up to 349px away from where the pointer pointed. The rail
     *  is a centred flex column and `.ap-rail__where` is VERTICAL text, so the
     *  moment the section name changed from "Cover" to "The series" the column
     *  grew, re-centred, and slid the track out from under the pointer
     *  mid-gesture. The label's height is reserved in CSS now so it cannot
     *  twitch during ordinary scrolling either — but a drag should be immune
     *  to layout regardless of what else moves on the page. */
    let grip: DOMRect | null = null;

    /** pointer Y on the track → document scroll position */
    const seek = (clientY: number) => {
      const r = grip ?? fill.current?.parentElement?.getBoundingClientRect();
      if (!r || r.height <= 0) return;
      const ratio = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
      // instant, never smooth: a smooth scroll would chase the pointer a beat
      // behind and the knob would lag the hand holding it
      window.scrollTo(0, ratio * maxScroll());
    };

    const nudge = (deltaPct: number) => {
      const max = maxScroll();
      const now = max > 0 ? window.scrollY / max : 0;
      window.scrollTo(0, Math.min(1, Math.max(0, now + deltaPct / 100)) * max);
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !el) return;
      // capture, or a drag that wanders off this 28px strip stops dead
      try {
        el.setPointerCapture(e.pointerId);
      } catch {}
      el.dataset.drag = "";
      e.preventDefault();
      grip = fill.current?.parentElement?.getBoundingClientRect() ?? null;
      seek(e.clientY);
    };
    const onMove = (e: PointerEvent) => {
      if (!el || !("drag" in el.dataset)) return;
      e.preventDefault();
      seek(e.clientY);
    };
    const onUp = () => {
      grip = null;
      if (el) delete el.dataset.drag;
    };
    const onKey = (e: KeyboardEvent) => {
      const step: Record<string, number> = {
        ArrowDown: 3,
        ArrowRight: 3,
        ArrowUp: -3,
        ArrowLeft: -3,
        PageDown: 15,
        PageUp: -15,
      };
      if (e.key in step) {
        e.preventDefault();
        nudge(step[e.key]);
      } else if (e.key === "Home") {
        e.preventDefault();
        window.scrollTo(0, 0);
      } else if (e.key === "End") {
        e.preventDefault();
        window.scrollTo(0, maxScroll());
      }
    };

    el?.addEventListener("pointerdown", onDown);
    el?.addEventListener("pointermove", onMove);
    el?.addEventListener("pointerup", onUp);
    el?.addEventListener("pointercancel", onUp);
    el?.addEventListener("keydown", onKey);

    measure();
    read();
    // sections move as images finish loading
    const t = window.setTimeout(onResize, 1200);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      el?.removeEventListener("pointerdown", onDown);
      el?.removeEventListener("pointermove", onMove);
      el?.removeEventListener("pointerup", onUp);
      el?.removeEventListener("pointercancel", onUp);
      el?.removeEventListener("keydown", onKey);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="ap-rail">
      <span className="ap-rail__tick" aria-hidden="true" />
      <div className="ap-rail__meter">
        <span className="ap-rail__num" ref={num}>
          00
        </span>
        {/* The slider IS the track. It was a role=progressbar readout; a
            progressbar you can drag is a lie to a screen reader, and two
            elements reporting the same number would just be noise. */}
        <div
          className="ap-rail__track"
          ref={track}
          role="slider"
          tabIndex={0}
          aria-label="Scroll through the page"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
          aria-orientation="vertical"
        >
          <span className="ap-rail__line">
            <span className="ap-rail__fill" ref={fill} />
          </span>
          <span className="ap-rail__knob" ref={knob} aria-hidden="true" />
        </div>
      </div>
      <p className="ap-rail__where" aria-live="polite">
        {label}
      </p>
    </div>
  );
}
