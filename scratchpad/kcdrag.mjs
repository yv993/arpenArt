import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9542;
const profile = mkdtempSync(join(tmpdir(), "kd-"));
const edge = spawn("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--window-size=1440,950", "--no-first-run", "--use-gl=swiftshader", "about:blank"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 90; i++) { try { if ((await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).length) break; } catch {} await sleep(250); }
const pages = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter((t) => t.type === "page");
const tab = pages.find((t) => t.url === "about:blank") ?? pages[0];
const sock = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => (sock.onopen = r));
let id = 0; const waiting = new Map(); const errs = [];
sock.onmessage = (m) => { const x = JSON.parse(m.data);
  if (x.id && waiting.has(x.id)) { waiting.get(x.id)(x); waiting.delete(x.id); return; }
  if (x.method === "Runtime.exceptionThrown") errs.push("THREW " + (x.params.exceptionDetails.exception?.description ?? "").slice(0, 200)); };
const send = (method, params = {}) => new Promise((res) => { const n = ++id; waiting.set(n, res); sock.send(JSON.stringify({ id: n, method, params })); });
const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return "THREW " + r.result.exceptionDetails.exception?.description?.slice(0, 240);
  return r.result?.result?.value; };
await send("Page.enable"); await send("Runtime.enable");
await send("Page.navigate", { url: "http://localhost:4000/shop/keychains" });
await sleep(22000);
await ev(`document.querySelectorAll(".ap-kc__hang")[2].scrollIntoView({block:"center"})`);
await sleep(2000);

// instrument: count the raw DOM events the element sees
await ev(`(() => {
  window.__log = [];
  const h = document.querySelectorAll(".ap-kc__hang")[2];
  for (const t of ["pointerdown","pointermove","pointerup","mousedown","mousemove"])
    h.addEventListener(t, (e) => window.__log.push(t + "@" + Math.round(e.clientX) + " id" + e.pointerId + " type:" + (e.pointerType||"-")), true);
  return "instrumented";
})()`);
const box = JSON.parse(await ev(`(() => { const h = document.querySelectorAll(".ap-kc__hang")[2]; const r = h.getBoundingClientRect();
  return JSON.stringify({x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2), w: Math.round(r.width), h: Math.round(r.height), inView: r.top > 0 && r.bottom < innerHeight}); })()`));
console.log("target box   :", JSON.stringify(box));
console.log("elem at point:", await ev(`(() => { const e = document.elementFromPoint(${box.x}, ${box.y}); return e ? e.tagName + "." + (e.className||"").toString().split(" ")[0] : "NOTHING"; })()`));

const mouse = (type, px, py) => send("Input.dispatchMouseEvent", { type, x: px, y: py, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1, pointerType: "mouse" });
await mouse("mousePressed", box.x, box.y); await sleep(150);
for (let k = 1; k <= 8; k++) { await mouse("mouseMoved", box.x + k * 12, box.y); await sleep(60); }
await sleep(400);
console.log("events seen  :", await ev(`JSON.stringify(window.__log.slice(0, 6))`));
console.log("spin style   :", await ev(`JSON.stringify({t: document.querySelectorAll(".ap-kc__spin")[2].style.transform, glare: document.querySelectorAll(".ap-kc__spin")[2].style.getPropertyValue("--kc-turn")})`));
console.log("holding attr :", await ev(`document.querySelectorAll(".ap-kc__hang")[2].hasAttribute("data-holding")`));
const b = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("scratchpad/kc-turned.png", Buffer.from(b.result.data, "base64"));
await mouse("mouseReleased", box.x + 96, box.y);
await sleep(1600);
console.log("after release:", await ev(`document.querySelectorAll(".ap-kc__spin")[2].style.transform`));
console.log("errors       :", errs.length ? errs : "none");
sock.close(); edge.kill();
