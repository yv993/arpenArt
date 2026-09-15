// Counts the browser's actual Paint / RasterTask events during a 1.2s
// keychain drag, via CDP tracing (devtools.timeline). This is the metric the
// shadow rework targets: a var-driven filter repaints the silhouette every
// frame; a static filter + var-driven transform should paint almost never
// once the drag is running. rAF timing cannot see this while frames fit the
// budget — the tracer can.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9632;
const profile = mkdtempSync(join(tmpdir(), "pt-"));
const edge = spawn("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--window-size=1280,1350", "--no-first-run", "--use-gl=swiftshader", "about:blank"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 90; i++) { try { if ((await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).length) break; } catch {} await sleep(250); }
const pages = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter((t) => t.type === "page");
const tab = pages.find((t) => t.url === "about:blank") ?? pages[0];
const sock = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => (sock.onopen = r));
let id = 0; const waiting = new Map(); const traceChunks = [];
let traceDone;
sock.onmessage = (m) => {
  const x = JSON.parse(m.data);
  if (x.id && waiting.has(x.id)) { waiting.get(x.id)(x); waiting.delete(x.id); return; }
  if (x.method === "Tracing.dataCollected") traceChunks.push(...x.params.value);
  if (x.method === "Tracing.tracingComplete" && traceDone) traceDone();
};
const send = (method, params = {}) => new Promise((res) => { const n = ++id; waiting.set(n, res); sock.send(JSON.stringify({ id: n, method, params })); });
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send("Page.enable"); await send("Runtime.enable");
await send("Page.navigate", { url: "http://localhost:4000/shop/keychains" });
await sleep(19000);
await ev(`document.querySelector(".ap-kh__wall").scrollIntoView({block:"center"})`);
await sleep(2500); // let load-time painting die down

const box = JSON.parse(await ev(`(() => { const r = document.querySelectorAll(".ap-kh__anchor .ap-kc__hang")[1].getBoundingClientRect();
  return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height * 0.6) }); })()`));
const mouse = (t, x, y) => send("Input.dispatchMouseEvent", { type: t, x, y, button: "left", buttons: t === "mouseReleased" ? 0 : 1, clickCount: 1, pointerType: "mouse" });

await send("Tracing.start", { traceConfig: { includedCategories: ["devtools.timeline", "disabled-by-default-devtools.timeline"] } });
await mouse("mousePressed", box.x, box.y);
for (let k = 0; k < 40; k++) { await mouse("mouseMoved", box.x + Math.round(Math.sin(k / 5) * 90), box.y); await sleep(30); }
await mouse("mouseReleased", box.x, box.y);
await sleep(900); // the settle
const done = new Promise((r) => (traceDone = r));
await send("Tracing.end");
await done;

const count = (name) => traceChunks.filter((e) => e.name === name).length;
console.log(`Paint ${count("Paint")}  RasterTask ${count("RasterTask")}  UpdateLayer ${count("UpdateLayer")}  styleRecalc ${count("UpdateLayoutTree")}  layout ${count("Layout")}`);
sock.close(); edge.kill();
