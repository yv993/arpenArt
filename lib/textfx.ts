// ============================================================================
// TEXT FX — the shared vocabulary for how words appear on this site.
//
// Four logics, assigned by meaning, not at random:
//   rise      letters climb out of the line through a mask — the openers
//   flip      letters turn over in 3D — the commerce voice (cart, gallery)
//   decipher  letters settle out of Armenian letterforms — anything that
//             names the Armenia series itself
//   focus     letters sharpen out of a blur — the shop index
//
// The splitting is DOM work done once, after hydration, and only in the
// moved layer (desktop + full motion). The server HTML keeps the real text:
// phones, readers, crawlers and no-JS visitors never meet a single span.
// ============================================================================

/** The same gate every moved layer on this site uses. */
export const FX_MEDIA = "(min-width: 861px) and (prefers-reduced-motion: no-preference)";

/** Armenian capitals — the pool DECIPHER settles out of. The series is
 *  Armenia; the names arrive from its own alphabet. */
export const POOL = "ԱԲԳԴԵԶԷԹԺԻԽԾԿՀՄՆՇՈՊՍՎՏՐՑՔ";

/**
 * Split an element's text into per-character spans, grouped by word:
 *   <span class="tfx" aria-hidden>
 *     <span class="tfx-w"> <span class="tfx-m"><span class="tfx-c">A</span></span> … </span> …
 *   </span>
 * The word wrapper is the load-bearing part: a browser may break a line
 * BETWEEN any two inline-blocks, so bare char spans let "PICTURES" snap in
 * half mid-word (seen on the cloud title). Words are atomic inline-blocks;
 * spaces stay real text nodes between them, so lines still break only at
 * spaces. The full text moves to aria-label on the element, so a reader
 * hears the sentence, never the alphabet soup.
 * Returns the .tfx-c spans, each carrying its final glyph in data-ch.
 */
export function splitChars(el: HTMLElement): HTMLElement[] {
  const text = el.textContent ?? "";
  if (!text.trim()) return [];
  el.setAttribute("aria-label", text);
  const holder = document.createElement("span");
  holder.className = "tfx";
  holder.setAttribute("aria-hidden", "true");
  let word: HTMLElement | null = null;
  for (const ch of text) {
    if (/\s/.test(ch)) {
      word = null;
      holder.appendChild(document.createTextNode(ch));
      continue;
    }
    if (!word) {
      word = document.createElement("span");
      word.className = "tfx-w";
      holder.appendChild(word);
    }
    const m = document.createElement("span");
    m.className = "tfx-m";
    const c = document.createElement("span");
    c.className = "tfx-c";
    c.textContent = ch;
    c.dataset.ch = ch;
    m.appendChild(c);
    word.appendChild(m);
  }
  el.replaceChildren(holder);
  return Array.from(holder.querySelectorAll<HTMLElement>(".tfx-c"));
}

/** Put the element back exactly as React rendered it. */
export function unsplit(el: HTMLElement, original: string) {
  el.textContent = original;
  el.removeAttribute("aria-label");
}

/** Settle scrambled glyphs back to their real characters (safety net for a
 *  decipher killed mid-run). */
export function settle(chars: HTMLElement[]) {
  for (const c of chars) {
    const ch = c.dataset.ch;
    if (ch && c.textContent !== ch) c.textContent = ch;
  }
}
