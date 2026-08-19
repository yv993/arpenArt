// ---------------------------------------------------------------------------
// /find-in-store harness — headless Edge over raw CDP.
//
// WHY NOT THE IN-APP BROWSER PANE: when the pane is not displayed the page
// stops compositing, the tab counts as hidden, and React 19 never hydrates the
// page's Suspense boundary (app/loading.tsx makes every route one). Section
// effects therefore never run and every gated feature — the 3D map, the street
// map toggles, the locate button — reads as broken when it is fine. This
// drives a real browser instead, which is the only way to see the live layer.
//
//   node scratchpad/stockcheck.mjs            (expects the dev server on :4000)
// ---------------------------------------------------------------------------
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL_ = process.argv[2] ?? "http://localhost:4000/find-in-store";
const PORT = 9377;

const profile = mkdtempSync(join(tmpdir(), "stockcheck-"));
const edge = spawn(EDGE, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`, // absolute, always
  "--window-size=1440,900",
  "--no-first-run",
  "--disable-gpu-sandbox",
  "--use-gl=swiftshader", // the 3D map needs a GL context
  "about:blank",
]);
edge.on("error", (e) => { console.error("edge failed:", e.message); process.exit(1); });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** wait for the debugger to answer rather than guessing a boot time */
async function targets() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const j = await r.json();
      if (j.length) return j;
    } catch {}
    await sleep(250);
  }
  throw new Error("no CDP targets");
}

const list = await targets();
const page = list.find((t) => t.type === "page");
const ws = new (await import("node:module")).default.createRequire(import.meta.url);
// no ws package here — talk to the socket with the built-in WebSocket (Node 22)
const sock = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (sock.onopen = r));

let id = 0;
const waiting = new Map();
sock.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && waiting.has(msg.id)) {
    waiting.get(msg.id)(msg);
    waiting.delete(msg.id);
  }
};
const send = (method, params = {}) =>
  new Promise((res) => {
    const n = ++id;
    waiting.set(n, res);
    sock.send(JSON.stringify({ id: n, method, params }));
  });

const evalJs = async (expr) => {
  const r = await send("Runtime.evaluate", {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  });
  return r.result?.result?.value;
};

await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url: URL_ });
// the boundary hydrates once the tab is really visible and painting; give the
// dev server its first compile too
await sleep(9000);

const out = await evalJs(`(() => {
  const q = (s) => document.querySelectorAll(s).length;
  return JSON.stringify({
    url: location.pathname,
    towns: [...document.querySelectorAll('.ap-map__town')].map(t => ({
      town: t.querySelector('strong')?.textContent,
      region: t.querySelector('.ap-map__region')?.textContent,
      n: t.querySelector('.ap-map__n')?.textContent,
      shops: [...t.querySelectorAll('.ap-stk__name')].map(x => x.textContent),
    })),
    count: document.querySelector('.ap-map__count')?.textContent,
    // --- the LIVE layer: all of this is gated behind the effect ---
    canvas: q('canvas'),
    pins: [...document.querySelectorAll('.ap-map__tag')].map(x => x.textContent),
    mapToggles: [...document.querySelectorAll('.ap-smap__toggle')].map(x => x.textContent.trim()).filter(t => /street map/i.test(t)).length,
    copyBtns: [...document.querySelectorAll('.ap-smap__toggle')].filter(x => /copy/i.test(x.textContent)).length,
    locate: !!document.querySelector('.ap-map__locate'),
    dirLinks: q('.ap-map__dir'),
    monograms: [...document.querySelectorAll('.ap-stk__mono')].map(x => x.textContent),
    logoImgs: q('.ap-stk__logo img'),
    brokenImgs: [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.src),
    armenianLangTagged: q('.ap-stk__am[lang="hy"]'),
    jsonld: (() => {
      const s = document.querySelector('script[type="application/ld+json"]');
      if (!s) return null;
      try { const d = JSON.parse(s.textContent); return Array.isArray(d) ? d.length + ' Store entries' : 'object'; } catch { return 'unparseable'; }
    })(),
  });
})()`);

console.log(out);

// A LOOK, not just numbers. Full-page so the whole directory is judged at
// once — clip is in PAGE coordinates, which is the trap that has bitten this
// project before, so let the capture take the whole scroll height instead.
const { contentSize } = (await send("Page.getLayoutMetrics")).result;
const shot = await send("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: true,
  clip: { x: 0, y: 0, width: 1440, height: Math.min(contentSize.height, 5200), scale: 1 },
});
const { writeFileSync } = await import("node:fs");
writeFileSync(process.argv[3] ?? "scratchpad/findinstore.png", Buffer.from(shot.result.data, "base64"));
console.log("shot →", process.argv[3] ?? "scratchpad/findinstore.png");

sock.close();
edge.kill();
