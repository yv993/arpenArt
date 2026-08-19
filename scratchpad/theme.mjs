// ---------------------------------------------------------------------------
// THEME HARNESS — shoots a page in both themes and measures the contrast of
// what is actually painted, not what the tokens claim.
//
//   node scratchpad/theme.mjs /find-in-store
//   node scratchpad/theme.mjs / home
//
// Writes scratchpad/<name>-light.png and -dark.png and prints, for every text
// node it can see, the ratio of its COMPUTED colour against the nearest
// painted backdrop. Composites translucent colours; skips nodes whose fill is
// transparent (a clipped gradient makes `color` dead paint — those are
// reported separately as gradient titles, since a ratio there would be a lie).
// ---------------------------------------------------------------------------
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
// GIT BASH REWRITES A LEADING SLASH. `node theme.mjs /find-in-store` arrives
// here as "C:/Program Files/Git/find-in-store" (MSYS path conversion), the URL
// comes out malformed, Page.navigate refuses it, and the harness then measures
// about:blank — which scores a flawless pass, because nothing is there. Strip
// any Windows prefix and re-add the slash.
const PATHNAME =
  "/" + String(process.argv[2] ?? "find-in-store")
    .replace(/^[A-Za-z]:[\\/].*?[\\/]Git[\\/]/, "")
    .replace(/^[A-Za-z]:[\\/]/, "")
    .replace(/^\/+/, "");
const NAME = process.argv[3] ?? (PATHNAME.replace(/\W+/g, "") || "home");
const PORT = 9379;
/** how tall a shot may get — a pinned page reports a document several screens
 *  long and the interesting part is always near the top */
const TALL = Number(process.argv[4] ?? 2400);

const profile = mkdtempSync(join(tmpdir(), "theme-"));
const edge = spawn(EDGE, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--window-size=1440,900", "--no-first-run", "--use-gl=swiftshader", "about:blank",
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// WAIT FOR THE DEBUGGER, THEN MAKE OUR OWN TAB. Do not just grab the first
// page target: Edge opens a "we are now syncing your browsing data" splash on
// a fresh profile and it IS a page target, so the harness cheerfully measured
// Microsoft's interstitial and reported that the site passed. Anything that
// can silently score the wrong document has to name the document it scored —
// which is why the run prints its own location.pathname now.
for (let i = 0; i < 60; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); if ((await r.json()).length) break; } catch {}
  await sleep(250);
}
const pages = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter((t) => t.type === "page");
const tab = pages.find((t) => t.url === "about:blank") ?? pages[0];
if (!tab) throw new Error("no page target");
const sock = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => (sock.onopen = r));
let id = 0; const waiting = new Map();
sock.onmessage = (m) => { const x = JSON.parse(m.data); if (x.id && waiting.has(x.id)) { waiting.get(x.id)(x); waiting.delete(x.id); } };
const send = (method, params = {}) =>
  new Promise((res) => { const n = ++id; waiting.set(n, res); sock.send(JSON.stringify({ id: n, method, params })); })
    // NEVER swallow these. A silently-failing Page.navigate is what let this
    // harness spend four runs scoring about:blank as a perfect pass.
    .then((r) => { if (r.error) console.error(`  !! ${method}: ${r.error.message}`); return r; });
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;

await send("Page.enable");
await send("Runtime.enable");

const PROBE = `(() => {
  const px = (s) => {
    const m = String(s).match(/[\\d.]+/g) || [];
    const v = m.map(Number);
    if (String(s).startsWith('color(')) return [v[1]*255, v[2]*255, v[3]*255, v[4] ?? 1];
    return [v[0]||0, v[1]||0, v[2]||0, v[3] ?? 1];
  };
  const over = (fg, bg) => fg.slice(0,3).map((c,i) => c*fg[3] + bg[i]*(1-fg[3]));
  const lum = (c) => { const [r,g,b] = c.map(v => { v/=255; return v<=0.04045 ? v/12.92 : ((v+0.055)/1.055)**2.4; }); return 0.2126*r+0.7152*g+0.0722*b; };
  const ratio = (a,b) => { const x=lum(a), y=lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };

  // walk up for the first painted backdrop
  const backdrop = (el) => {
    let n = el, acc = null;
    while (n && n !== document.documentElement) {
      const c = px(getComputedStyle(n).backgroundColor);
      if (c[3] > 0) { acc = acc ? over(acc.concat(1), c.slice(0,3)) : (c[3] >= 1 ? c.slice(0,3) : over(c, [252,242,230])); if (c[3] >= 1) return acc; }
      n = n.parentElement;
    }
    return acc ?? px(getComputedStyle(document.body).backgroundColor).slice(0,3);
  };

  const out = { text: [], gradientTitles: 0, worst: null };
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (!el.firstChild) continue;
    const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!hasText) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    // a clipped gradient makes \`color\` dead paint — never score it
    const fill = cs.webkitTextFillColor || cs.color;
    if (px(fill)[3] === 0) { out.gradientTitles++; continue; }
    const fg = px(fill), bg = backdrop(el);
    const c = ratio(over(fg, bg), bg);
    const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    const key = el.className + '|' + cs.fontSize + '|' + Math.round(c*100);
    if (seen.has(key)) continue; seen.add(key);
    if (c < need) out.text.push({ sel: (el.tagName+'.'+String(el.className||'').split(' ')[0]).slice(0,44), size: Math.round(size), ratio: +c.toFixed(2), need, sample: el.textContent.trim().slice(0,26) });
    if (!out.worst || c < out.worst.ratio) out.worst = { sel: el.tagName+'.'+String(el.className||'').split(' ')[0], ratio: +c.toFixed(2) };
  }
  return JSON.stringify(out);
})()`;

for (const theme of ["light", "dark"]) {
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: theme }],
  });
  await send("Page.navigate", { url: `http://localhost:4000${PATHNAME}` });
  // Generous, and it has to be: a CSS edit makes the dev server rebuild the
  // whole route, the first paint took 11s in the logs, and a screenshot taken
  // early is a blank page that scores a perfect contrast pass on nothing.
  await sleep(20000);

  console.log(`\n=== ${theme.toUpperCase()} ===`);
  const where = await ev(`location.pathname + " | " + document.title + " | nodes:" + document.querySelectorAll('body *').length`);
  console.log(`  at ${where}`);

  const probe = JSON.parse(await ev(PROBE));
  console.log(`  gradient-filled titles (unscoreable by design): ${probe.gradientTitles}`);
  if (!probe.text.length) console.log("  ✓ every scoreable text node passes WCAG AA");
  else {
    console.log(`  ✗ ${probe.text.length} FAILING:`);
    for (const f of probe.text) console.log(`     ${String(f.ratio).padStart(5)} (needs ${f.need})  ${f.size}px  ${f.sel}  "${f.sample}"`);
  }

  // NO captureBeyondViewport on this site. The home page pins three sections;
  // asking for a full-height shot re-lays the document out at some other width
  // and comes back as a 240px column that looks like a broken build. Force the
  // metrics instead and shoot exactly what a 1440 viewport shows.
  const { contentSize } = (await send("Page.getLayoutMetrics")).result;
  const H = Math.min(contentSize.height, TALL);
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: H, deviceScaleFactor: 1, mobile: false });
  await sleep(1200);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  await send("Emulation.clearDeviceMetricsOverride");
  writeFileSync(`scratchpad/${NAME}-${theme}.png`, Buffer.from(shot.result.data, "base64"));
  console.log(`  shot -> scratchpad/${NAME}-${theme}.png`);
}

sock.close(); edge.kill();
