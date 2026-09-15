// The 3D keychain, verified the only way an r3f scene can be from outside
// (the project note: roots live in a module-scope Map, __r3f hangs off THREE
// objects not the DOM) — by PIXELS.
//
//   1. the Canvas exists, has a real WebGL context and a non-zero box;
//   2. it is DRAWING: the canvas crop is not a flat field;
//   3. it MOVES when pushed: mean abs pixel delta across ~80ms is large just
//      after a drag and small once the pendulum has damped — a still image
//      would read the same at both samples;
//   4. the fallback photograph is hidden while the model is up (but present,
//      because flyToCart launches from it);
//   5. the arrows change which keychain is modelled, and Add to cart works.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const PORT = 9600;
const profile = mkdtempSync(join(tmpdir(), "r3f-"));
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
  if (x.method === "Runtime.consoleAPICalled" && x.params.type === "error") errs.push(x.params.args.map((a) => a.value ?? "").join(" ").slice(0, 160));
  if (x.method === "Runtime.exceptionThrown") errs.push("THREW " + (x.params.exceptionDetails.exception?.description ?? "").slice(0, 160)); };
const send = (method, params = {}) => new Promise((res) => { const n = ++id; waiting.set(n, res); sock.send(JSON.stringify({ id: n, method, params })); });
const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return "THREW " + r.result.exceptionDetails.exception?.description?.slice(0, 240);
  return r.result?.result?.value; };
await send("Page.enable"); await send("Runtime.enable");
await send("Page.navigate", { url: "http://localhost:4000/shop/keychains" });
await sleep(26000); // R3F + textures + the transmission FBOs

await ev(`document.querySelector(".ap-kc__stage").scrollIntoView({block:"center"})`);
await sleep(6000);

console.log("=== 1. the Canvas ===");
console.log(await ev(`(() => {
  const c = document.querySelector(".ap-kc__glass canvas");
  if (!c) return "NO CANVAS";
  const r = c.getBoundingClientRect();
  return JSON.stringify({ box: [Math.round(r.width), Math.round(r.height)],
    ctx: !!(c.getContext("webgl2") || c.getContext("webgl")) });
})()`));
console.log("fallback hidden:", await ev(`document.querySelector(".ap-kc__stageshot").hasAttribute("data-hidden")`));
console.log("fallback present:", await ev(`!!document.querySelector(".ap-kc__stageshot")`));

// Crop of the canvas. `Page.captureScreenshot`'s clip is in PAGE space while
// getBoundingClientRect is in VIEWPORT space — without the scroll offset the
// first run of this harness measured the nav bar and reported the pendulum
// dead when it was fine.
// TWO COORDINATE SPACES, and they are not the same one: captureScreenshot's
// clip is PAGE space, Input.dispatchMouseEvent is VIEWPORT space. Getting
// either wrong reads as "the pendulum is dead" when it is the harness that
// missed — once by measuring the nav bar, once by dragging below the canvas.
const geom = JSON.parse(await ev(`(() => { const r = document.querySelector(".ap-kc__glass canvas").getBoundingClientRect();
  return JSON.stringify({
    page: { x: Math.round(r.x + scrollX), y: Math.round(r.y + scrollY), width: Math.round(r.width), height: Math.round(r.height) },
    view: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) } }); })()`));
const clip = geom.page;
const grab = async () => {
  const s = await send("Page.captureScreenshot", { format: "png", clip: { ...clip, scale: 1 } });
  return Buffer.from(s.result.data, "base64");
};
const delta = async (a, b) => {
  const A = await sharp(a).resize(220, 260, { fit: "fill" }).greyscale().raw().toBuffer();
  const B = await sharp(b).resize(220, 260, { fit: "fill" }).greyscale().raw().toBuffer();
  let s = 0;
  for (let i = 0; i < A.length; i++) s += Math.abs(A[i] - B[i]);
  return +(s / A.length).toFixed(2);
};

console.log("\n=== 2. is it drawing? ===");
const first = await grab();
writeFileSync("scratchpad/r3f-still.png", first);
const st = await sharp(first).greyscale().stats();
console.log(`canvas stdev ${st.channels[0].stdev.toFixed(1)} (a flat/blank canvas is ~0)`);

console.log("\n=== 3. does it swing when pushed? ===");
const mouse = (t, x, y) => send("Input.dispatchMouseEvent", { type: t, x, y, button: "left", buttons: t === "mouseReleased" ? 0 : 1, clickCount: 1, pointerType: "mouse" });
const cx = geom.view.x + geom.view.width / 2, cy = geom.view.y + geom.view.height * 0.62;
await mouse("mousePressed", cx, cy);
for (let k = 1; k <= 9; k++) { await mouse("mouseMoved", cx + k * 20, cy); await sleep(28); }
await mouse("mouseReleased", cx + 180, cy);
await sleep(120);
const m1 = await grab(); await sleep(80); const m2 = await grab();
const moving = await delta(m1, m2);
writeFileSync("scratchpad/r3f-swing.png", m1);
await sleep(6500); // let the pendulum damp out
const r1 = await grab(); await sleep(80); const r2 = await grab();
const resting = await delta(r1, r2);
console.log(`pixel delta over 80ms — swinging ${moving}, rested ${resting}  (moved: ${moving > resting * 3})`);

console.log("\n=== 4. the arrows change the model ===");
console.log("before:", await ev(`document.querySelector(".ap-kc__stagebuy .ap-kc__name").textContent`));
await ev(`document.querySelector(".ap-kc__stage .ap-kc__arrow--next").click()`);
await sleep(4000);
console.log("after :", await ev(`document.querySelector(".ap-kc__stagebuy .ap-kc__name").textContent`));

console.log("\n=== 5. buy from the stage ===");
await ev(`localStorage.setItem("arpenart.cart.v1", "[]")`);
await ev(`document.querySelector(".ap-kc__stagebuy .ap-kc__add").click()`);
await sleep(2000);
console.log("stored:", await ev(`localStorage.getItem("arpenart.cart.v1")`));

const full = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("scratchpad/r3f-page.png", Buffer.from(full.result.data, "base64"));
console.log("\nerrors:", errs.length ? errs.slice(0, 5) : "none");
sock.close(); edge.kill();
