// The deployed site, not localhost: the two new routes, the crop fix that was
// still live-broken this morning, and the shop grid's tenth+eleventh tiles.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9598;
const BASE = "https://arpen-art.vercel.app";
const profile = mkdtempSync(join(tmpdir(), "pd-"));
const edge = spawn("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--window-size=1440,1000", "--no-first-run", "--use-gl=swiftshader", "about:blank"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 90; i++) { try { if ((await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).length) break; } catch {} await sleep(250); }
const pages = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter((t) => t.type === "page");
const tab = pages.find((t) => t.url === "about:blank") ?? pages[0];
const sock = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => (sock.onopen = r));
let id = 0; const waiting = new Map(); let errs = [];
sock.onmessage = (m) => { const x = JSON.parse(m.data);
  if (x.id && waiting.has(x.id)) { waiting.get(x.id)(x); waiting.delete(x.id); return; }
  if (x.method === "Runtime.consoleAPICalled" && x.params.type === "error") errs.push(x.params.args.map((a) => a.value ?? "").join(" ").slice(0, 130));
  if (x.method === "Runtime.exceptionThrown") errs.push("THREW " + (x.params.exceptionDetails.exception?.description ?? "").slice(0, 130)); };
const send = (method, params = {}) => new Promise((res) => { const n = ++id; waiting.set(n, res); sock.send(JSON.stringify({ id: n, method, params })); });
const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return "THREW " + r.result.exceptionDetails.exception?.description?.slice(0, 200);
  return r.result?.result?.value; };
await send("Page.enable"); await send("Runtime.enable");

const go = async (path, ms = 15000) => { errs = []; await send("Page.navigate", { url: BASE + path }); await sleep(ms); };

console.log("=== /shop/postcards — the crop that was live-broken ===");
await go("/shop/postcards");
console.log(await ev(`(() => {
  const h = document.querySelector(".ap-cv__hero"); const im = h.querySelector("img");
  const hr = h.getBoundingClientRect(), ir = im.getBoundingClientRect();
  return JSON.stringify({ frame: [Math.round(hr.width), Math.round(hr.height)],
    imgBox: [Math.round(ir.width), Math.round(ir.height)],
    clipped: ir.height > hr.height + 1 || ir.width > hr.width + 1 });
})()`));

console.log("\n=== /shop/keychains ===");
await go("/shop/keychains", 18000);
console.log(await ev(`JSON.stringify({
  h1: document.querySelector("h1")?.textContent.trim().slice(0, 30),
  hung: document.querySelectorAll(".ap-kc__cell:not([data-ghost])").length,
  ghosts: document.querySelectorAll('.ap-kc__cell[data-ghost]').length,
  rack: document.querySelectorAll(".ap-kc__rackcell").length,
  pegs: [...document.querySelectorAll(".ap-kc__peg")].filter(i => i.complete && i.naturalWidth > 0).length,
  arrows: document.querySelectorAll(".ap-kc__arrow").length,
  dead: [...document.images].filter(i => i.complete && !i.naturalWidth).length })`));
console.log("errors:", errs.length ? errs : "none");

console.log("\n=== /shop/magnets ===");
await go("/shop/magnets", 18000);
console.log(await ev(`JSON.stringify({
  h1: document.querySelector("h1")?.textContent.trim().slice(0, 30),
  door: document.querySelectorAll(".ap-mf__door button").length,
  grid: document.querySelectorAll(".ap-mf__grid button, .ap-mf__all button").length || undefined,
  fridge: (() => { const f = document.querySelector(".ap-mf__fridge"); return f && f.complete && f.naturalWidth > 0; })(),
  dead: [...document.images].filter(i => i.complete && !i.naturalWidth).length })`));
console.log("errors:", errs.length ? errs : "none");
const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("scratchpad/prod-magnets.png", Buffer.from(shot.result.data, "base64"));

console.log("\n=== /shop — the grid, and the price line ===");
await go("/shop");
console.log(await ev(`(() => {
  const em = [...document.querySelectorAll(".ap-xg__say em")];
  const line = Math.min(...em.map(e => Math.round(e.getBoundingClientRect().height)));
  return JSON.stringify({ tiles: em.length,
    wrapped: em.filter(e => e.getBoundingClientRect().height > line + 3).length,
    hasKeychains: /keychain/i.test(document.body.innerText),
    hasMagnets: /magnet/i.test(document.body.innerText) });
})()`));
console.log("errors:", errs.length ? errs : "none");
sock.close(); edge.kill();
