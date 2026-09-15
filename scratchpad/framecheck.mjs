// Frame timing during a keychain drag + settle, before/after the shadow fix.
// A rAF sampler runs while a synthetic pointer drags keychain 2 for ~1.2s and
// then lets the elastic settle play out. SwiftShader inflates the absolute
// numbers — only the BEFORE/AFTER delta on the same machine means anything.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9630;
const profile = mkdtempSync(join(tmpdir(), "fr-"));
const edge = spawn("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--window-size=1280,1350", "--no-first-run", "--use-gl=swiftshader", "about:blank"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 90; i++) { try { if ((await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).length) break; } catch {} await sleep(250); }
const pages = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter((t) => t.type === "page");
const tab = pages.find((t) => t.url === "about:blank") ?? pages[0];
const sock = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => (sock.onopen = r));
let id = 0; const waiting = new Map();
sock.onmessage = (m) => { const x = JSON.parse(m.data); if (x.id && waiting.has(x.id)) { waiting.get(x.id)(x); waiting.delete(x.id); } };
const send = (method, params = {}) => new Promise((res) => { const n = ++id; waiting.set(n, res); sock.send(JSON.stringify({ id: n, method, params })); });
const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return "THREW " + r.result.exceptionDetails.exception?.description?.slice(0, 200);
  return r.result?.result?.value; };
await send("Page.enable"); await send("Runtime.enable");
await send("Page.navigate", { url: "http://localhost:4000/shop/keychains" });
await sleep(19000);
await ev(`document.querySelector(".ap-kh__wall").scrollIntoView({block:"center"})`);
await sleep(1600);

const box = JSON.parse(await ev(`(() => { const r = document.querySelectorAll(".ap-kh__anchor .ap-kc__hang")[1].getBoundingClientRect();
  return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height * 0.6) }); })()`));

// the sampler: raw rAF deltas from drag start until told to stop
await ev(`window.__f = []; window.__go = true; let last = performance.now();
  (function tick(t) { if (!window.__go) return; window.__f.push(t - last); last = t; requestAnimationFrame(tick); })(last);`);

const mouse = (t, x, y) => send("Input.dispatchMouseEvent", { type: t, x, y, button: "left", buttons: t === "mouseReleased" ? 0 : 1, clickCount: 1, pointerType: "mouse" });
await mouse("mousePressed", box.x, box.y);
// ~1.2s of continuous back-and-forth drag
for (let k = 0; k < 40; k++) { await mouse("mouseMoved", box.x + Math.round(Math.sin(k / 5) * 90), box.y); await sleep(30); }
await mouse("mouseReleased", box.x, box.y);
await sleep(1300); // the elastic settle keeps painting
await ev(`window.__go = false`);

const f = JSON.parse(await ev(`JSON.stringify(window.__f.slice(1))`));
f.sort((a, b) => a - b);
const mean = f.reduce((s, v) => s + v, 0) / f.length;
const p95 = f[Math.floor(f.length * 0.95)];
const slow = f.filter((v) => v > 25).length;
console.log(`frames ${f.length}  mean ${mean.toFixed(1)}ms  p95 ${p95.toFixed(1)}ms  frames>25ms ${slow}`);
sock.close(); edge.kill();
