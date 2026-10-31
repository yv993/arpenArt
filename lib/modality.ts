// ============================================================================
// HOW THE VISITOR LAST REACHED THE PAGE — pointer or keys — for focus that a
// script moves (review, 2026-10-30).
//
// The browser shows a focus ring (:focus-visible) on a script focus unless it
// has SEEN a pointer press move focus in this document. After the puzzle's
// stale-chunk reload (Cloud.tsx) no press ever does — the puzzle's room and
// bar keep focus where it is on purpose — so a mouse visitor saw a piece
// ringed and the keyboard line in the bar for the rest of the page's life.
// Script focus now passes `focusVisible: false` when the last input was a
// pointer, the browser's own rule made explicit. Keyboard visitors keep the
// ring; a browser without the option ignores it and behaves as before.
// ============================================================================

let keys: boolean | null = null;
if (typeof window !== "undefined") {
  addEventListener("pointerdown", () => (keys = false), true);
  addEventListener("keydown", () => (keys = true), true);
}

/** the last input was a key (true), a pointer (false), or none yet (null) */
export const lastKeys = () => keys;

/** a reload made from a pointer press: this document starts as "pointer" */
export const seedPointer = () => {
  if (keys === null) keys = false;
};

/** the options for a focus a script moves */
export const scriptFocus = (): FocusOptions =>
  // `focusVisible` is newer than this TS DOM lib
  ({ preventScroll: true, ...(keys === false ? { focusVisible: false } : {}) }) as FocusOptions;
