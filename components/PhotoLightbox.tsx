"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { loopTab } from "@/lib/tabLoop";

// ============================================================================
// PHOTO LIGHTBOX — one picture, big, with the rest of its set behind the
// arrows.
//
// EXTRACTED from ShopStrip (2026-08-23), which had the only copy of it. The
// sticker sheets needed the same thing — "images must become bigger when user
// click in images" — and a second lightbox in one codebase is how two dialogs
// start disagreeing about which key closes them. Same reason OrderingSteps is
// shared. The `ap-xg__*` class names come with it rather than being renamed,
// so /shop keeps its stylesheet untouched.
//
// It once took an `arriving` flag that held the picture invisible while a
// fridge magnet's pixels flew in to land on it (MagnetFridge). The fridge
// scene left on 2026-10-12 (client, change 4.pdf p8–p9) and no caller was
// left to set the flag, so the prop and shop.css's `[data-arriving]` rule
// went with it.
//
// The behaviour it already had, kept exactly: Escape and a press on the ground
// close it, the arrows and the arrow KEYS move through the set, focus goes to
// Close on open and back to the opener on close, and the body cannot scroll
// underneath. `footer` is whatever the caller wants under the picture — a link
// into the category on /shop, a buy button on the sticker sheets.
// ============================================================================

/** `id` is optional: the shop strip's shots are keyed by their position in a
 *  category and carry no id of their own. */
export type LbShot = { id?: string; src: string; w: number; h: number };

export default function PhotoLightbox({
  shots,
  i,
  onIndex,
  onClose,
  label,
  alt,
  opener,
  footer,
}: {
  shots: LbShot[];
  i: number;
  onIndex: (next: number) => void;
  onClose: () => void;
  /** names the dialog for a screen reader */
  label: string;
  /** each picture's own alt, by index */
  alt: (index: number) => string;
  /** what had focus before this opened — it gets it back */
  opener?: HTMLElement | null;
  footer?: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  /** whether the press in flight BEGAN on the bare ground (see onClick) */
  const groundPress = useRef(false);
  /** where a finger went down on the picture, for the swipe */
  const swipeFrom = useRef<{ x: number; y: number } | null>(null);
  const many = shots.length > 1;

  const close = useCallback(() => {
    onClose();
    opener?.focus?.();
  }, [onClose, opener]);

  // OPEN-ONCE work lives apart from the keydown wiring. Focus and the scroll
  // lock used to sit in the same effect as the key handler, whose deps include
  // `i` — so every arrow press re-ran the effect and yanked focus back to
  // Close. A keyboard user who tabbed to Next and pressed Enter found their
  // NEXT Enter closing the dialog instead of advancing it. Focus belongs to
  // the moment the dialog opens, and to no other moment.
  useEffect(() => {
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      // TAB STAYS IN HERE (2026-10-05): on magnets, stickers and scarves the
      // fourth Tab from Close already left for the footer behind the veil
      // (measured, 390x844) — see lib/tabLoop.ts
      loopTab(e, rootRef.current);
      if (!many) return;
      if (e.key === "ArrowRight") onIndex((i + 1) % shots.length);
      if (e.key === "ArrowLeft") onIndex((i - 1 + shots.length) % shots.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, i, many, onIndex, shots.length]);

  if (!shots.length) return null;
  const shot = shots[Math.min(i, shots.length - 1)];

  // A SWIPE TURNS THE PAGE (2026-10-05, mobile pass): a phone had the two
  // 46px arrows and nothing else — no gesture that every photo viewer it
  // knows answers to (UX laws D3). Right-to-left is the next photograph.
  // Touch and pen only: a mouse drag on the desktop does what it always did.
  const swipeEnd = (e: React.PointerEvent<HTMLElement>) => {
    const from = swipeFrom.current;
    swipeFrom.current = null;
    if (!from || !many) return;
    // a visitor who has pinched in is looking at THIS photograph: a sideways
    // drag must not turn the page under them (2026-10-12, with the pinch
    // given back in shop.css)
    if ((window.visualViewport?.scale ?? 1) > 1.01) return;
    const dx = e.clientX - from.x;
    const dy = e.clientY - from.y;
    if (Math.abs(dx) <= 40 || Math.abs(dx) <= Math.abs(dy)) return;
    onIndex(dx < 0 ? (i + 1) % shots.length : (i - 1 + shots.length) % shots.length);
  };

  return (
    // THE GROUND CLOSES IT — on a press that began AND ended on the ground
    // (2026-10-05, the tote window's rule, ToteGallery.tsx). It used to close
    // on ANY click that bubbled up to it, and at 844x390 the «1 / 35» line
    // overlapped the buy button by 11px: a tap there hit the counter, the
    // click bubbled here, and the window closed with nothing added (measured,
    // cart empty). The counter no longer takes a pointer (shop.css) and only
    // the ground itself closes.
    <div
      ref={rootRef}
      className="ap-xg__lb"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onPointerDown={(e) => {
        groundPress.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (groundPress.current && e.target === e.currentTarget) close();
        groundPress.current = false;
      }}
    >
      <button ref={closeRef} type="button" className="ap-xg__x" onClick={close} aria-label="Close">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 18L18 6M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {many && (
        <button
          type="button"
          className="ap-xg__nav ap-xg__nav--prev"
          aria-label="Previous photograph"
          onClick={(e) => {
            e.stopPropagation();
            onIndex((i - 1 + shots.length) % shots.length);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 19l-7-7 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}

      {/* the ground closes; the picture itself must not */}
      <figure
        className="ap-xg__stage"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          swipeFrom.current = e.pointerType === "mouse" ? null : { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={swipeEnd}
        onPointerCancel={() => {
          swipeFrom.current = null;
        }}
      >
        <img key={shot.id ?? i} src={shot.src} alt={alt(i)} width={shot.w} height={shot.h} />
        {footer && <figcaption>{footer}</figcaption>}
      </figure>

      {many && (
        <button
          type="button"
          className="ap-xg__nav ap-xg__nav--next"
          aria-label="Next photograph"
          onClick={(e) => {
            e.stopPropagation();
            onIndex((i + 1) % shots.length);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}

      {many && (
        <p className="ap-xg__count" role="status">
          {i + 1} / {shots.length}
        </p>
      )}
    </div>
  );
}
