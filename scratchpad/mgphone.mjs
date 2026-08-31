// The plain layer: a phone gets no fridge, but every magnet, the lightbox and
// the buy path must all still work. Also walks the HOME page once — FloatShop
// and the sphere build their card sets from `categories`, so an 11th category
// must not have broken either.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9562;
const profile = mkdtempSync(join(tmpdir(), "mp-"));
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
  if (r.result?.exceptionDetails) return "THREW " + r.result.exceptionDetails.exception?.description?.slice(0, 200);
  return r.result?.result?.value; };
await send("Page.enable"); await send("Runtime.enable");

console.log("=== PHONE 390px /shop/magnets ===");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send("Page.navigate", { url: "http://localhost:4000/shop/magnets" });
await sleep(16000);
console.log("live (want false):", await ev(`document.querySelector(".ap-mf")?.hasAttribute("data-live")`));
console.log("fridge hidden    :", await ev(`getComputedStyle(document.querySelector(".ap-mf__scene")).display`));
console.log("grid cells       :", await ev(`document.querySelectorAll(".ap-mf__all > li").length`));
console.log("h-overflow       :", await ev(`document.documentElement.scrollWidth > document.documentElement.clientWidth + 1`));
console.log("open from grid   :", await ev(`(() => { const b = document.querySelectorAll(".ap-mf__cell")[2]; b.scrollIntoView({block:"center"}); b.click(); return "clicked #3"; })()`));
await sleep(1600);
console.log("dialog           :", await ev(`document.querySelector(".ap-xg__lb")?.getAttribute("aria-label")?.slice(0, 40) ?? "NOT OPEN"`));
console.log("buy              :", await ev(`(() => { const f = document.querySelector(".ap-xg__stage figcaption button"); if (!f) return "no buy"; f.click(); return "clicked"; })()`));
await sleep(1800);
console.log("stored           :", await ev(`localStorage.getItem("arpenart.cart.v1")`));
const a = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("scratchpad/mg-phone.png", Buffer.from(a.result.data, "base64"));

console.log("\n=== HOME 1440px (11 categories feed the WebGL rooms) ===");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: "http://localhost:4000/" });
await sleep(22000);
await ev(`(async () => { const h = document.body.scrollHeight; for (let y = 0; y < h; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 100)); } scrollTo(0, 0); })()`);
await sleep(8000);
console.log("canvases         :", await ev(`document.querySelectorAll("canvas").length`));
console.log("dead images      :", await ev(`[...document.images].filter(i => i.complete && !i.naturalWidth).length`));
console.log("errors           :", errs.length ? errs : "none");
sock.close(); edge.kill();
