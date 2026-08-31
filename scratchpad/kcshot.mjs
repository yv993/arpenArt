// Looks at the wall the way a buyer would: loads it, waits for hydration,
// screenshots the room, then drags one keychain and screenshots it mid-turn.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9540;
const profile = mkdtempSync(join(tmpdir(), "kc-"));
const edge = spawn("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--window-size=1440,950", "--no-first-run", "--use-gl=swiftshader", "about:blank",
]);
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
  if (r.result?.exceptionDetails) return "THREW " + r.result.exceptionDetails.exception?.description?.slice(0, 200);
  return r.result?.result?.value; };
await send("Page.enable"); await send("Runtime.enable");
await send("Page.navigate", { url: "http://localhost:4000/shop/keychains" });
await sleep(22000);

console.log("live layer   :", await ev(`document.querySelector(".ap-kc")?.hasAttribute("data-live")`));
console.log("keychains    :", await ev(`document.querySelectorAll(".ap-kc__cell").length`));
console.log("images ok    :", await ev(`(() => { const i = [...document.querySelectorAll(".ap-kc__spin img")]; return JSON.stringify({ n: i.length, dead: i.filter(x => x.complete && !x.naturalWidth).length, first: i[0］?.naturalWidth + "x" + i[0]?.naturalHeight }); })()`.replace("［","[").replace("］","]")));
console.log("buy buttons  :", await ev(`document.querySelectorAll(".ap-kc__add").length`));
await ev(`document.querySelector(".ap-kc__rail").scrollIntoView({block:"center"})`);
await sleep(2500);
const a = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("scratchpad/kc-wall.png", Buffer.from(a.result.data, "base64"));

// drag the third keychain and hold it turned
const box = await ev(`(() => { const h = document.querySelectorAll(".ap-kc__hang")[2]; const r = h.getBoundingClientRect(); return JSON.stringify({x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2)}); })()`);
const { x, y } = JSON.parse(box);
const mouse = (type, px, py, btn = "left") => send("Input.dispatchMouseEvent", { type, x: px, y: py, button: btn, buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1 });
await mouse("mousePressed", x, y);
for (let k = 1; k <= 10; k++) { await mouse("mouseMoved", x + k * 11, y); await sleep(45); }
await sleep(500);
console.log("turned to    :", await ev(`(() => { const s = document.querySelectorAll(".ap-kc__spin")[2]; return s.style.transform + "  glare " + s.style.getPropertyValue("--kc-turn"); })()`));
const b = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("scratchpad/kc-turned.png", Buffer.from(b.result.data, "base64"));
await mouse("mouseReleased", x + 110, y);
await sleep(1800);
console.log("settled back :", await ev(`document.querySelectorAll(".ap-kc__spin")[2].style.transform`));
console.log("errors       :", errs.length ? errs : "none");
sock.close(); edge.kill();
