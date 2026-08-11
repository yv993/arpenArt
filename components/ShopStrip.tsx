"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { dram } from "@/lib/cart";

// ============================================================================
// SHOP STRIP — the client's expandable gallery, rebuilt for a shop.
//
// Ported, not pasted: framer-motion is not in this project's three-dependency
// budget, so the flex-grow and overlay tweens are GSAP; Tailwind is not here
// either, so the classes are `ap-xg` rules in app/shop.css.
//
// One deliberate change of behaviour. In the original, clicking a panel opens
// a lightbox — a dead end. This is a shop index, so a panel click OPENS THE
// CATEGORY, which is what a buyer is reaching for; the lightbox lives on its
// own small button, showing every photograph of that line. Nothing that looks
// like a product link leads to a viewer instead of the product.
//
// The plain layer is the real grid of category cards underneath (see
// app/shop/page.tsx): phones, reduced motion and no-JS never see this strip.
// ============================================================================

export type StripShot = { src: string; w: number; h: number; avg: string };
export type StripCat = {
  slug: string;
  name: string;
  from: number;
  status: "open" | "soon";
  blurb: string;
  photo: StripShot;
  shots: StripShot[];
};

const DESKTOP = "(min-width: 861px) and (prefers-reduced-motion: no-preference)";
/** hovered panel : every other panel — the original's 2 and 0.5 */
const GROW_ON = 2;
const GROW_OFF = 0.5;
const DIM_REST = 0.22;

export default function ShopStrip({ cats }: { cats: StripCat[] }) {
  const root = useRef<HTMLDivElement | null>(null);
  const [live, setLive] = useState(false);
  /** which category's photographs are open, or null */
  const [lb, setLb] = useState<number | null>(null);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (window.matchMedia(DESKTOP).matches && window.matchMedia("(scripting: enabled)").matches) {
      setLive(true);
    }
  }, []);

  // the section attribute is what hides the plain grid — set only once the
  // strip is really running, never from CSS, which cannot know about JS
  useEffect(() => {
    const el = root.current;
    if (!el || !live) return;
    const sec = el.closest(".ap-shop");
    sec?.setAttribute("data-strip", "");
    return () => sec?.removeAttribute("data-strip");
  }, [live]);

  const focusPanel = useCallback(
    (idx: number | null) => {
      const el = root.current;
      if (!el || !live) return;
      const panels = Array.from(el.querySelectorAll<HTMLElement>(".ap-xg__panel"));
      const veils = panels.map((p) => p.querySelector<HTMLElement>(".ap-xg__veil"));
      gsap.to(panels, {
        flexGrow: (n: number) => (idx === null ? 1 : n === idx ? GROW_ON : GROW_OFF),
        duration: 0.5,
        ease: "power2.inOut",
        overwrite: true,
      });
      gsap.to(veils.filter(Boolean) as HTMLElement[], {
        opacity: (n: number) => (idx !== null && n === idx ? 0 : DIM_REST),
        duration: 0.3,
        ease: "none",
        overwrite: true,
      });
    },
    [live],
  );

  // ---- the lightbox ------------------------------------------------------
  const shots = lb === null ? [] : cats[lb].shots;
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const open = (idx: number, from: HTMLElement) => {
    openerRef.current = from;
    setI(0);
    setLb(idx);
  };
  const close = useCallback(() => {
    setLb(null);
    // the keyboard goes back where it came from, not to the top of the page
    openerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (lb === null) return;
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setI((n) => (n + 1) % Math.max(1, shots.length));
      if (e.key === "ArrowLeft") setI((n) => (n - 1 + shots.length) % Math.max(1, shots.length));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [lb, shots.length, close]);

  return (
    <div className="ap-xg" ref={root} data-live={live || undefined}>
      <div className="ap-xg__row">
        {cats.map((c, idx) => (
          <div
            className="ap-xg__panel"
            key={c.slug}
            onMouseEnter={() => focusPanel(idx)}
            onMouseLeave={() => focusPanel(null)}
          >
            {/* the whole panel is the category link — a buyer's click goes to
                the product, never to a viewer */}
            <Link
              className="ap-xg__go"
              href={c.status === "open" ? `/shop/${c.slug}` : "/shop"}
              onFocus={() => focusPanel(idx)}
              onBlur={() => focusPanel(null)}
            >
              <img
                src={c.photo.src}
                alt={`${c.name} by Arpine Baroyan`}
                width={c.photo.w}
                height={c.photo.h}
                style={{ background: c.photo.avg }}
                loading={idx < 4 ? undefined : "lazy"}
                decoding="async"
              />
              <span className="ap-xg__veil" aria-hidden="true" style={{ opacity: DIM_REST }} />
              <span className="ap-xg__say">
                <strong>{c.name}</strong>
                <em>{c.status === "open" ? `from ${dram(c.from)}` : "Soon"}</em>
                <span className="ap-xg__blurb">{c.blurb}</span>
              </span>
            </Link>

            {c.shots.length > 1 && (
              <button
                type="button"
                className="ap-xg__zoom"
                aria-label={`See all ${c.shots.length} photographs of ${c.name}`}
                onClick={(e) => open(idx, e.currentTarget)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {lb !== null && (
        <div
          className="ap-xg__lb"
          role="dialog"
          aria-modal="true"
          aria-label={`Photographs of ${cats[lb].name}`}
          onClick={close}
        >
          <button ref={closeRef} type="button" className="ap-xg__x" onClick={close} aria-label="Close">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 18L18 6M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          {shots.length > 1 && (
            <button
              type="button"
              className="ap-xg__nav ap-xg__nav--prev"
              aria-label="Previous photograph"
              onClick={(e) => {
                e.stopPropagation();
                setI((n) => (n - 1 + shots.length) % shots.length);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 19l-7-7 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          )}

          <figure className="ap-xg__stage" onClick={(e) => e.stopPropagation()}>
            <img
              key={i}
              src={shots[i].src}
              alt={`${cats[lb].name}, photograph ${i + 1} of ${shots.length}`}
              width={shots[i].w}
              height={shots[i].h}
            />
            <figcaption>
              <Link className="ap-btn" href={`/shop/${cats[lb].slug}`}>
                Open {cats[lb].name} <span aria-hidden>→</span>
              </Link>
            </figcaption>
          </figure>

          {shots.length > 1 && (
            <button
              type="button"
              className="ap-xg__nav ap-xg__nav--next"
              aria-label="Next photograph"
              onClick={(e) => {
                e.stopPropagation();
                setI((n) => (n + 1) % shots.length);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          )}

          <p className="ap-xg__count" role="status">
            {i + 1} / {shots.length}
          </p>
        </div>
      )}
    </div>
  );
}
