// Splits the two overloaded tokens into PIGMENT vs ROLE.
//
//   background: var(--ink)   -> var(--ink-solid)   her neutral dark, a SURFACE
//   color:      var(--paper) -> var(--cream)       her cream, TYPE on a dark band
//
// Both new tokens hold the identical value in light mode, so this refactor is
// a no-op on the light site by construction — and it is what makes a dark mode
// possible at all, because --ink and --paper can then flip as ROLES (body text,
// page ground) without dragging every intentionally-dark band with them.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "app";
let total = 0;
for (const file of readdirSync(DIR).filter((f) => f.endsWith(".css"))) {
  const p = join(DIR, file);
  const before = readFileSync(p, "utf8");
  let s = before;

  // any background shorthand/longhand mentioning var(--ink) as a whole token
  s = s.replace(/(background(?:-color)?:[^;]*?)var\(--ink\)/g, "$1var(--ink-solid)");
  // colour-ish properties taking var(--paper): color, border-color, outline-color,
  // -webkit-text-fill-color, caret-color, text-decoration-color
  s = s.replace(/((?:^|[\s;{])(?:-webkit-text-fill-|text-decoration-|border-|outline-|caret-)?color:[^;]*?)var\(--paper\)/g, "$1var(--cream)");

  if (s !== before) {
    const n = (before.match(/var\(--ink\)|var\(--paper\)/g) || []).length - (s.match(/var\(--ink\)|var\(--paper\)/g) || []).length;
    writeFileSync(p, s);
    console.log(`${file.padEnd(16)} ${n} replaced`);
    total += n;
  }
}
console.log(`\n${total} total`);
