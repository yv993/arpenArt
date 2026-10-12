// ============================================================================
// TAB STAYS INSIDE AN OPEN WINDOW (2026-10-05, mobile pass, P1).
//
// The tote window has kept Tab inside itself since 2026-10-01
// (ToteGallery.tsx). Measured on the 2026-10-05 audit, the other three
// aria-modal windows did not: in the photo window (PhotoLightbox), the 3D
// sticker window (StickerSurfer) and the Available Soon window (Soon.tsx) the
// first Tab already left for the nav behind the veil — 10 of 10 stops
// outside on the Soon window. A keyboard that walks out of a modal operates a
// page it cannot see, and a buy button may be the next stop.
//
// One loop, shared, so the four windows cannot drift apart again (the same
// reason PhotoLightbox itself was extracted). Call it from the window's own
// keydown handler; it does nothing unless the key is Tab.
//
// The stops are what Tab itself would visit: enabled buttons, links, fields,
// and anything with a tabindex of 0 or more. tabindex="-1" (the 3D window's
// scrim, which closes on a press but is not a second "Close" for a keyboard)
// is left out, and so is anything not rendered.
// ============================================================================

const STOPS = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]';

export function loopTab(e: KeyboardEvent, box: HTMLElement | null) {
  if (e.key !== "Tab" || !box) return;
  const stops = Array.from(box.querySelectorAll<HTMLElement>(STOPS)).filter(
    (el) => el.tabIndex >= 0 && el.getClientRects().length > 0,
  );
  if (!stops.length) {
    // nothing to land on: hold focus where it is rather than leak out
    e.preventDefault();
    return;
  }
  const first = stops[0];
  const last = stops[stops.length - 1];
  const at = document.activeElement;
  const outside = !(at instanceof Node) || !box.contains(at);
  if (e.shiftKey ? at === first || outside : at === last || outside) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  }
}
