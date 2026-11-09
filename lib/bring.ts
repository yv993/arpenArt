// ============================================================================
// PUT THE KEYBOARD ON A FIELD AND BRING IT INTO VIEW, CLEAR OF THE FIXED BAR.
//
// Born in the cart (CartView.tsx, 2026-10-31): focus() alone left Name 470px
// ABOVE the screen at 1440x900 — the form rides in the sticky side column,
// taller than the window, and the browser's own scroll misjudges a sticky
// box. Shared with /contact (live check 2026-11-04, FL-1), where focus()'s
// own scroll stopped with the field at the window's top edge, so its label
// (NAME) sat under the fixed bar.
//
// The field is focused without the browser's scroll, then brought in by hand
// and re-checked over a few frames while the layout settles (the error lines
// a failed Send adds render in the same update). 110px keeps the field AND
// the label above it clear of the bar; a field already in view stays put.
// ============================================================================

export function bring(el: HTMLElement) {
  el.focus({ preventScroll: true });
  let n = 0;
  const show = () => {
    const r = el.getBoundingClientRect();
    if (r.top < 110 || r.bottom > window.innerHeight - 24) window.scrollBy({ top: r.top - window.innerHeight / 3, behavior: "instant" });
    if (++n < 3) requestAnimationFrame(show);
  };
  show();
}
