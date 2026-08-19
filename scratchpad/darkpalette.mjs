// ---------------------------------------------------------------------------
// THE NIGHT PALETTE, derived the same way --paper was.
//
// Her five pigments are MEASURED and do not change — paint does not become a
// different colour after sunset. What changes is which of them can carry text.
// On paper the rule is "no accent carries body text"; on a dark ground the
// arithmetic inverts, and the accents that failed are the ones that pass.
//
// So each dark token is her own colour held at its Lab HUE ANGLE and re-lit to
// a new L*, exactly as --paper was derived, then checked against WCAG. Nothing
// here is picked by eye.
//
//   node scratchpad/darkpalette.mjs
// ---------------------------------------------------------------------------

const srgb2lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lin2srgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

const hex2rgb = (h) => {
  const s = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
};
const rgb2hex = (r) =>
  "#" + r.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, "0")).join("");

// sRGB D65 -> XYZ -> Lab
const M = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.072175],
  [0.0193339, 0.119192, 0.9503041],
];
const Mi = [
  [3.2404542, -1.5371385, -0.4985314],
  [-0.969266, 1.8760108, 0.041556],
  [0.0556434, -0.2040259, 1.0572252],
];
const WP = [0.95047, 1, 1.08883];
const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
const fi = (t) => (t ** 3 > 216 / 24389 ? t ** 3 : (t - 4 / 29) / (841 / 108));

function hex2lab(hex) {
  const lin = hex2rgb(hex).map(srgb2lin);
  const xyz = M.map((row) => row.reduce((s, m, i) => s + m * lin[i], 0)).map((v, i) => v / WP[i]);
  const [fx, fy, fz] = xyz.map(f);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function lab2hex([L, a, b]) {
  const fy = (L + 16) / 116;
  const xyz = [fi(fy + a / 500) * WP[0], fi(fy) * WP[1], fi(fy - b / 200) * WP[2]];
  return rgb2hex(Mi.map((row) => row.reduce((s, m, i) => s + m * xyz[i], 0)).map(lin2srgb));
}

/** her colour, same hue and chroma, a new lightness */
const relight = (hex, L) => {
  const [, a, b] = hex2lab(hex);
  return lab2hex([L, a, b]);
};
/** re-lit AND pulled toward/away from grey, for grounds that must stay quiet */
const relightChroma = (hex, L, k) => {
  const [, a, b] = hex2lab(hex);
  return lab2hex([L, a * k, b * k]);
};

const lum = (hex) => {
  const [r, g, b] = hex2rgb(hex).map(srgb2lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (x, y) => {
  const a = lum(x), b = lum(y);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

// --- her measured pigments, verbatim from globals.css ----------------------
const P = {
  cream: "#fcf2e6",
  ink: "#232834",
  inkIndigo: "#1b2b4c",
  marigold: "#efab23",
  terracotta: "#d1622d",
  indigo: "#374897",
  sky: "#568fc3",
  olive: "#91a33a",
};

// --- the night grounds: her ink-indigo, re-lit down --------------------------
// Chroma pulled back a little: at full chroma a large field of it reads as a
// blue wash rather than as a ground.
const ground = relightChroma(P.inkIndigo, 12, 0.82);
const surface = relightChroma(P.inkIndigo, 17.5, 0.86);
const surface3 = relightChroma(P.inkIndigo, 24, 0.9);

// --- the type ---------------------------------------------------------------
// Her cream, held a touch below paper's L*96: full-brightness cream on a dark
// ground is glare, and the body face is set at 15.5–17.5px.
const text = relight(P.cream, 92);
const textStrong = relight(P.cream, 97);

console.log("GROUNDS");
for (const [k, v] of Object.entries({ ground, surface, surface3 })) console.log(`  ${k.padEnd(10)} ${v}  L*${hex2lab(v)[0].toFixed(1)}`);

console.log("\nTYPE on each ground (target: body 4.5, large/display 3.0)");
const rows = [];
const push = (name, hex) => rows.push([name, hex, ratio(hex, ground), ratio(hex, surface), ratio(hex, surface3)]);

push("text", text);
push("textStrong", textStrong);

// muted: the smallest L* that still clears 4.5:1 on the SURFACE (the worst of
// the three grounds, because cards are lighter than the page)
for (let L = 55; L <= 85; L += 0.5) {
  const c = relightChroma(P.sky, L, 0.5);
  if (ratio(c, surface3) >= 4.5) { push(`muted(L${L})`, c); break; }
}
// each accent, re-lit until it carries text on the lightest ground
for (const [name, hex] of [["indigo", P.indigo], ["terracotta", P.terracotta], ["marigold", P.marigold], ["sky", P.sky], ["olive", P.olive]]) {
  for (let L = 45; L <= 95; L += 0.5) {
    const c = relight(hex, L);
    if (ratio(c, surface3) >= 4.5) { push(`${name}-lit(L${L})`, c); break; }
  }
}
// marigold and terracotta RAW, to see whether they already pass
push("marigold RAW", P.marigold);
push("terracotta RAW", P.terracotta);
push("sky RAW", P.sky);

console.log("  name                hex        vs ground  vs surface  vs surface3");
for (const [n, h, a, b, c] of rows) {
  const flag = c >= 4.5 ? "ok " : c >= 3 ? "lg " : "XX ";
  console.log(`  ${flag}${n.padEnd(18)} ${h}   ${a.toFixed(2).padStart(6)}   ${b.toFixed(2).padStart(6)}   ${c.toFixed(2).padStart(6)}`);
}

console.log("\nDISPLAY RUN stops (2rem+, need 3:1 on the ground they sit on)");
for (const [n, h] of [["cream", relight(P.cream, 96)], ["soft gold", relight(P.marigold, 88)], ["marigold", relight(P.marigold, 78)]]) {
  console.log(`  ${n.padEnd(10)} ${h}  vs ground ${ratio(h, ground).toFixed(2)}  vs surface3 ${ratio(h, surface3).toFixed(2)}`);
}
