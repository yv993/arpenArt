import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9544;
const profile = mkdtempSync(join(tmpdir(), "kf-"));
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
  if (x.method === "Runtime.consoleAPICalled" && x.params.type === "error") errs.push(x.params.args.map((a) => a.value ?? "").join(" ").slice(0, 150));
  if (x.method === "Runtime.exceptionThrown") errs.push("THREW " + (x.params.exceptionDetails.exception?.description ?? "").slice(0, 150)); };
const send = (method, params = {}) => new Promise((res) => { const n = ++id; waiting.set(n, res); sock.send(JSON.stringify({ id: n, method, params })); });
const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return "THREW " + r.result.exceptionDetails.exception?.description?.slice(0, 220);
  return r.result?.result?.value; };
await send("Page.enable"); await send("Runtime.enable");

await send("Page.navigate", { url: "http://localhost:4000/shop/keychains" });
await sleep(22000);
await ev(`document.querySelectorAll(".ap-kc__hang")[1].scrollIntoView({block:"center"})`);
await sleep(2500);
const mouse = (t, x, y) => send("Input.dispatchMouseEvent", { type: t, x, y, button: "left", buttons: t === "mouseReleased" ? 0 : 1, clickCount: 1, pointerType: "mouse" });
const box = JSON.parse(await ev(`(() => { const r = document.querySelectorAll(".ap-kc__hang")[1].getBoundingClientRect(); return JSON.stringify({x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2)}); })()`));
await mouse("mousePressed", box.x, box.y);
for (let k = 1; k <= 9; k++) { await mouse("mouseMoved", box.x + k * 13, box.y); await sleep(50); }
await sleep(600);
console.log("turned      :", await ev(`document.querySelectorAll(".ap-kc__spin")[1].style.transform`));
const a = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("scratchpad/kc-wall.png", Buffer.from(a.result.data, "base64"));
await mouse("mouseReleased", box.x + 117, box.y);
await sleep(1700);

console.log("badge before:", await ev(`document.querySelector('a[href="/cart"]').innerText.replace(/\s+/g," ").trim()`));
console.log("buy         :", await ev(`(() => { const b = document.querySelectorAll(".ap-kc__add")[1]; b.click(); return "clicked " + b.textContent; })()`));
await sleep(2200);
console.log("badge after :", await ev(`document.querySelector('a[href="/cart"]').innerText.replace(/\s+/g," ").trim()`));
console.log("stored      :", await ev(`localStorage.getItem("arpenart.cart.v1")`));
console.log("said        :", await ev(`[...document.querySelectorAll(".ap-kc__added")].map(e=>e.textContent).filter(Boolean).join("")`));

await send("Page.navigate", { url: "http://localhost:4000/cart" });
await sleep(9000);
console.log("cart row    :", await ev(`(() => { const t = document.body.innerText.replace(/\s+/g," "); const m = t.match(/Keychain[^R]*/); return m ? m[0].slice(0,90) : "NOT IN CART :: " + t.slice(0,120); })()`));

// the plain layer: a phone must still see and buy every keychain
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send("Page.navigate", { url: "http://localhost:4000/shop/keychains" });
await sleep(15000);
console.log("phone live? :", await ev(`document.querySelector(".ap-kc")?.hasAttribute("data-live")`));
console.log("phone items :", await ev(`document.querySelectorAll(".ap-kc__cell").length + " cells, " + document.querySelectorAll(".ap-kc__add").length + " buy buttons"`));
console.log("h-overflow  :", await ev(`document.documentElement.scrollWidth > document.documentElement.clientWidth + 1`));
await ev(`document.querySelectorAll(".ap-kc__hang")[1].scrollIntoView({block:"center"})`); await sleep(2000);
const c = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("scratchpad/kc-phone.png", Buffer.from(c.result.data, "base64"));
console.log("errors      :", errs.length ? errs : "none");
sock.close(); edge.kill();
