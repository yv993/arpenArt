// Opens a shop's street map and proves the live layer works end to end:
// maplibre draws real tiles, the approximate-pin caveat appears only where it
// should, and only ONE map may exist at a time.
//   node scratchpad/mapcheck.mjs
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9378;
const profile = mkdtempSync(join(tmpdir(), "mapcheck-"));
const edge = spawn(EDGE, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--window-size=1440,900", "--no-first-run", "--use-gl=swiftshader", "about:blank",
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let list;
for (let i = 0; i < 60; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); list = await r.json(); if (list.length) break; } catch {}
  await sleep(250);
}
const sock = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (sock.onopen = r));
let id = 0; const waiting = new Map();
sock.onmessage = (m) => { const x = JSON.parse(m.data); if (x.id && waiting.has(x.id)) { waiting.get(x.id)(x); waiting.delete(x.id); } };
const send = (method, params = {}) => new Promise((res) => { const n = ++id; waiting.set(n, res); sock.send(JSON.stringify({ id: n, method, params })); });
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;

await send("Page.enable"); await send("Runtime.enable");
await send("Page.navigate", { url: "http://localhost:4000/find-in-store" });
await sleep(9000);

/** press the "Show the street map" button inside the Nth .ap-stk card */
const openNth = (n) => ev(`(() => {
  const card = document.querySelectorAll('.ap-stk')[${n}];
  const btn = [...card.querySelectorAll('button')].find(b => /street map/i.test(b.textContent));
  if (!btn) return 'no button';
  btn.click();
  return 'clicked ' + card.querySelector('.ap-stk__name').textContent;
})()`);

const report = () => ev(`(() => {
  const cv = document.querySelector('.ap-loc__canvas canvas');
  return JSON.stringify({
    openCards: document.querySelectorAll('.ap-loc').length,
    canvases: document.querySelectorAll('canvas').length,
    approxNotes: [...document.querySelectorAll('.ap-stk__approx')].map(p => p.textContent.slice(0, 34)),
    expanded: [...document.querySelectorAll('[aria-expanded="true"]')].length,
    mapCanvasSize: cv ? cv.width + 'x' + cv.height : null,
    credit: !!document.querySelector('.ap-loc figcaption, .ap-loc__cap'),
  });
})()`);

console.log("shop 0 (Note Mote 6/2 — flagged approximate):", await openNth(0));
await sleep(6000);
console.log("  →", await report());

console.log("\nshop 2 (Made by Armenia — exact):", await openNth(2));
await sleep(6000);
console.log("  →", await report());

sock.close(); edge.kill();
