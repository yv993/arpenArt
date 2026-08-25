// Watches the gallery title reveal frame by frame, to see the "letters mixing"
// the client reported. Records, per frame, each character's rendered box —
// if the glyphs are overlapping or reflowing mid-animation the numbers say so,
// and the strip of screenshots shows it.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9490;
const profile = mkdtempSync(join(tmpdir(), "flip-"));
const edge = spawn(EDGE, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--window-size=1440,1000", "--no-first-run", "--use-gl=swiftshader", "about:blank",
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 60; i++) {
  try { if ((await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).length) break; } catch {}
  await sleep(250);
}
const pages = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter((t) => t.type === "page");
const tab = pages.find((t) => t.url === "about:blank") ?? pages[0];
const sock = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => (sock.onopen = r));
let id = 0; const waiting = new Map();
sock.onmessage = (m) => { const x = JSON.parse(m.data); if (x.id && waiting.has(x.id)) { waiting.get(x.id)(x); waiting.delete(x.id); } };
const send = (method, params = {}) => new Promise((res) => { const n = ++id; waiting.set(n, res); sock.send(JSON.stringify({ id: n, method, params })); })
  .then((r) => { if (r.error) console.error("  !!", method, r.error.message); return r; });
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;

await send("Page.enable"); await send("Runtime.enable");
await send("Page.navigate", { url: process.env.URL_ ?? "http://localhost:4000/" });
await sleep(17000);

// park just ABOVE the gallery title so the ScrollTrigger has not fired yet
const top = await ev(`(() => {
  const h = [...document.querySelectorAll('.ap-h2')].find(e => /EVERYTHING/i.test(e.textContent));
  if (!h) return null;
  const y = h.getBoundingClientRect().top + scrollY;
  scrollTo(0, Math.max(0, y - innerHeight * 1.15));
  return Math.round(y);
})()`);
console.log("title at y =", top);
await sleep(1500);

const probe = `(() => {
  const h = [...document.querySelectorAll('.ap-h2')].find(e => /EVERYTHING/i.test(e.textContent));
  const cs = [...h.querySelectorAll('.tfx-c')];
  if (!cs.length) return JSON.stringify({ split: false, text: h.textContent.trim() });
  const boxes = cs.map(c => { const r = c.getBoundingClientRect(); return { ch: c.textContent, x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1) }; });
  // how many glyphs sit on top of a neighbour — the "mixing"
  let overlaps = 0;
  for (let i = 1; i < boxes.length; i++) {
    const a = boxes[i - 1], b = boxes[i];
    if (Math.abs(a.y - b.y) < 6 && b.x < a.x + a.w - 2) overlaps++;
  }
  const rows = [...new Set(boxes.map(b => Math.round(b.y / 10)))].length;
  return JSON.stringify({ split: true, n: boxes.length, overlaps, rows, first: boxes.slice(0, 6) });
})()`;

// creep down so the trigger fires, sampling every step
const shots = [];
for (let k = 0; k < 14; k++) {
  await ev(`scrollBy(0, 46)`);
  await sleep(90);
  const p = JSON.parse(await ev(probe));
  console.log(` step ${String(k).padStart(2)}  ${p.split ? `chars ${p.n}  overlapping ${p.overlaps}  rows ${p.rows}` : `NOT SPLIT (“${p.text?.slice(0, 28)}”)`}`);
  const s = await send("Page.captureScreenshot", { format: "png" });
  shots.push(await sharp(Buffer.from(s.result.data, "base64")).extract({ left: 0, top: 300, width: 900, height: 260 }).resize(450, 130).png().toBuffer());
}
await sharp({ create: { width: 450 * 2, height: 130 * 7, channels: 3, background: "#1b2b4c" } })
  .composite(shots.map((b, i) => ({ input: b, left: (i % 2) * 450, top: Math.floor(i / 2) * 130 })))
  .png().toFile("scratchpad/flip-strip.png");
console.log("strip -> scratchpad/flip-strip.png");

sock.close(); edge.kill();
