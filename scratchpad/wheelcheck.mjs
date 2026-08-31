// The endless wall, measured:
//   1. the next arrow slides the track LEFT (translateX more negative) — the
//      circle turns left, new keychains enter from the right;
//   2. a background drag slides it and a throw carries it after release;
//   3. the wrap: pushed past one full copy, the offset comes back around
//      (translate stays within [0, W)) with no visual seam to measure;
//   4. a drag that starts ON a keychain still turns THAT keychain and the
//      track does not move — the two gestures stay separate;
//   5. ghosts: the wrap copy is aria-hidden and its buttons untabbable.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9586;
const profile = mkdtempSync(join(tmpdir(), "wh-"));
const edge = spawn("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--window-size=1280,1200", "--no-first-run", "--use-gl=swiftshader", "about:blank"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 90; i++) { try { if ((await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).length) break; } catch {} await sleep(250); }
const pages = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter((t) => t.type === "page");
const tab = pages.find((t) => t.url === "about:blank") ?? pages[0];
const sock = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => (sock.onopen = r));
let id = 0; const waiting = new Map(); const errs = [];
sock.onmessage = (m) => { const x = JSON.parse(m.data);
  if (x.id && waiting.has(x.id)) { waiting.get(x.id)(x); waiting.delete(x.id); return; }
  if (x.method === "Runtime.consoleAPICalled" && x.params.type === "error") errs.push(x.params.args.map((a) => a.value ?? "").join(" ").slice(0, 140));
  if (x.method === "Runtime.exceptionThrown") errs.push("THREW " + (x.params.exceptionDetails.exception?.description ?? "").slice(0, 140)); };
const send = (method, params = {}) => new Promise((res) => { const n = ++id; waiting.set(n, res); sock.send(JSON.stringify({ id: n, method, params })); });
const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return "THREW " + r.result.exceptionDetails.exception?.description?.slice(0, 220);
  return r.result?.result?.value; };
await send("Page.enable"); await send("Runtime.enable");
await send("Page.navigate", { url: "http://localhost:4000/shop/keychains" });
await sleep(19000);
await ev(`document.querySelector(".ap-kc__rail").scrollIntoView({block:"center"})`);
await sleep(1500);

const tx = `(() => { const m = getComputedStyle(document.querySelector(".ap-kc__track")).transform; if (m === "none") return 0; return Math.round(-parseFloat(m.split(",")[4])); })()`;

console.log("cards (real+ghost):", await ev(`document.querySelectorAll(".ap-kc__cell:not([data-ghost])").length + " + " + document.querySelectorAll('.ap-kc__cell[data-ghost]').length`));
console.log("ghost hidden from AT:", await ev(`(() => { const g = document.querySelector('.ap-kc__cell[data-ghost]'); return g.getAttribute("aria-hidden") === "true" && g.querySelector("button").tabIndex === -1; })()`));

console.log("\n=== 1. next arrow — the circle turns left ===");
const t0 = await ev(tx);
await ev(`document.querySelector(".ap-kc__arrow--next").click()`);
await sleep(900);
const t1 = await ev(tx);
console.log(`offset ${t0} -> ${t1}  (moved left: ${t1 > t0})`);

console.log("\n=== 2. background drag + throw ===");
const rail = JSON.parse(await ev(`(() => { const r = document.querySelector(".ap-kc__rail").getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), yTop: Math.round(r.y + 8) }); })()`));
const mouse = (t, x, y) => send("Input.dispatchMouseEvent", { type: t, x, y, button: "left", buttons: t === "mouseReleased" ? 0 : 1, clickCount: 1, pointerType: "mouse" });
// drag on the strip ABOVE the keychains (between pegs = background)
await mouse("mousePressed", rail.x, rail.yTop);
for (let k = 1; k <= 8; k++) { await mouse("mouseMoved", rail.x - k * 22, rail.yTop); await sleep(30); }
await mouse("mouseReleased", rail.x - 176, rail.yTop);
await sleep(300);
const t2 = await ev(tx);
await sleep(900);
const t3 = await ev(tx);
console.log(`after drag ${t2}, after throw ${t3}  (dragged: ${t2 > t1}, threw on: ${t3 > t2})`);

console.log("\n=== 3. the wrap — 14 fast advances must stay within one copy ===");
for (let k = 0; k < 14; k++) { await ev(`document.querySelector(".ap-kc__arrow--next").click()`); await sleep(140); }
await sleep(1200);
const W = await ev(`(() => { const t = document.querySelector(".ap-kc__track"); return Math.round(t.scrollWidth / 2); })()`);
const t4 = await ev(tx);
console.log(`half-width ${W}, offset ${t4}  (wrapped: ${t4 >= 0 && t4 < W})`);

console.log("\n=== 4. a drag ON a keychain turns it, not the wall ===");
const hang = JSON.parse(await ev(`(() => { const els = [...document.querySelectorAll(".ap-kc__hang")].filter(h => { const r = h.getBoundingClientRect(); return r.left > 100 && r.right < innerWidth - 100 && r.width > 0; }); const r = els[0].getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height * 0.6), i: [...document.querySelectorAll(".ap-kc__hang")].indexOf(els[0]) }); })()`));
const t5 = await ev(tx);
await mouse("mousePressed", hang.x, hang.y);
for (let k = 1; k <= 7; k++) { await mouse("mouseMoved", hang.x + k * 14, hang.y); await sleep(40); }
await sleep(250);
console.log("keychain turned :", await ev(`document.querySelectorAll(".ap-kc__spin")[${hang.i}].style.transform`));
console.log("track unmoved   :", (await ev(tx)) === t5);
await mouse("mouseReleased", hang.x + 98, hang.y);
await sleep(1500);

const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("scratchpad/kc-wheel.png", Buffer.from(shot.result.data, "base64"));
console.log("\nerrors:", errs.length ? errs : "none");
sock.close(); edge.kill();
