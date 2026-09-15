"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";

// ============================================================================
// PHOTO LIGHTBOX — one picture, big, with the rest of its set behind the
// arrows.
//
// EXTRACTED from ShopStrip (2026-08-23), which had the only copy of it. The
// sticker sheets needed the same thing — "images must become bigger when user
// click in images" — and a second lightbox in one codebase is how two dialogs
// start disagreeing about which key closes them. Same reason OrderingSteps and
// CategorySpec are shared. The `ap-xg__*` class names come with it rather than
// being renamed, so /shop keeps its stylesheet untouched.
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
  arriving = false,
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
  /** Something is still FLYING here and will land on this dialog's picture
   *  (the fridge magnets do this). While it is true the picture is held
   *  invisible and its pop animation suppressed, so the traveller can arrive
   *  onto the exact pixels it will become — the chrome around it still fades
   *  in, which is what makes the ground darken while the magnet is on its
   *  way. Callers that open the ordinary way never pass it. */
  arriving?: boolean;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
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
      if (!many) return;
      if (e.key === "ArrowRight") onIndex((i + 1) % shots.length);
      if (e.key === "ArrowLeft") onIndex((i - 1 + shots.length) % shots.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, i, many, onIndex, shots.length]);

  if (!shots.length) return null;
  const shot = shots[Math.min(i, shots.length - 1)];

  return (
    <div className="ap-xg__lb" data-arriving={arriving || undefined} role="dialog" aria-modal="true" aria-label={label} onClick={close}>
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
      <figure className="ap-xg__stage" onClick={(e) => e.stopPropagation()}>
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
