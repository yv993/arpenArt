// The two buy paths that live behind a click, not on the page:
//   • /shop/3d-stickers — click a flying card → it opens big in the centre →
//     buy from there (the 500 ֏ each path)
//   • /shop/stickers    — open a folder → the sheet opens → buy (1,600 ֏)
// A page scan cannot see either, because neither button exists until something
// is opened. This drives both the way a buyer would.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 9524;
const profile = mkdtempSync(join(tmpdir(), "mod-"));
const edge = spawn("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--window-size=1440,950", "--no-first-run", "--use-gl=swiftshader", "about:blank",
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 80; i++) {
  try { if ((await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).length) break; } catch {}
  await sleep(250);
}
const pages = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter((t) => t.type === "page");
const tab = pages.find((t) => t.url === "about:blank") ?? pages[0];
const sock = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => (sock.onopen = r));
let id = 0; const waiting = new Map(); const errs = [];
sock.onmessage = (m) => {
  const x = JSON.parse(m.data);
  if (x.id && waiting.has(x.id)) { waiting.get(x.id)(x); waiting.delete(x.id); return; }
  if (x.method === "Runtime.consoleAPICalled" && x.params.type === "error") errs.push(x.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 140));
  if (x.method === "Runtime.exceptionThrown") errs.push("THREW " + (x.params.exceptionDetails.exception?.description ?? "").slice(0, 140));
};
const send = (method, params = {}) => new Promise((res) => { const n = ++id; waiting.set(n, res); sock.send(JSON.stringify({ id: n, method, params })); });
const ev = async (e) => {
  const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return "EVAL-THREW " + r.result.exceptionDetails.exception?.description?.slice(0, 200);
  return r.result?.result?.value;
};
await send("Page.enable"); await send("Runtime.enable");
const badge = `(() => { const a = document.querySelector('a[href="/cart"]'); return a ? a.innerText.replace(/\\s+/g, " ").trim() : "NO LINK"; })()`;
const store = `localStorage.getItem("arpenart.cart.v1") ?? "(empty)"`;

console.log("=== 3D STICKERS: click a flying card ===");
await send("Page.navigate", { url: "http://localhost:4010/shop/3d-stickers" });
await sleep(12000);
await ev(`document.querySelector(".ap-s3").scrollIntoView({block:"start"})`); await sleep(3000);
console.log("  cards on the lane :", await ev(`document.querySelectorAll(".ap-s3__card").length`));
console.log("  click one         :", await ev(`(() => {
  const c = document.querySelector(".ap-s3__card");
  if (!c) return "NO CARD"; c.click(); return "clicked";
})()`));
await sleep(2500);
console.log("  what opened       :", await ev(`(() => {
  const d = document.querySelector('[role="dialog"], dialog[open], .ap-s3__open, [class*="open"]');
  if (!d) return "NOTHING OPENED";
  const btns = [...d.querySelectorAll("button")].map(b => b.innerText.trim()).filter(Boolean);
  return JSON.stringify({ cls: d.className.slice(0, 40), buttons: btns.slice(0, 6), text: d.innerText.replace(/\\s+/g, " ").slice(0, 130) });
})()`));
console.log("  buy from it       :", await ev(`(() => {
  const b = [...document.querySelectorAll("button")].find(x => /add to cart|add/i.test(x.textContent) && x.offsetParent !== null);
  if (!b) return "NO BUY BUTTON"; b.click(); return "clicked “" + b.innerText.trim() + "”";
})()`));
await sleep(2200);
console.log("  badge             :", await ev(badge));
console.log("  storage           :", await ev(store));
const s1 = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("scratchpad/chk-3dmodal.png", Buffer.from(s1.result.data, "base64"));

console.log("\n=== STICKERS: open a folder ===");
await send("Page.navigate", { url: "http://localhost:4010/shop/stickers" });
await sleep(11000);
console.log("  folders           :", await ev(`document.querySelectorAll(".ap-sf__cell").length`));
console.log("  open one          :", await ev(`(() => {
  const f = document.querySelector(".ap-sf__flap");
  if (!f) return "NO FOLDER BUTTON";
  f.click();
  return "clicked, aria-expanded=" + f.getAttribute("aria-expanded");
})()`));
await sleep(2500);
console.log("  buy button        :", await ev(`(() => {
  const b = [...document.querySelectorAll("button")].filter(x => /add to cart/i.test(x.textContent) && x.offsetParent !== null);
  return b.length ? b.map(x => x.innerText.trim()).slice(0, 3).join(" | ") : "NONE VISIBLE";
})()`));
console.log("  price on page     :", await ev(`(() => {
  const m = document.body.innerText.match(/[\\d,]+\\s*\\u058F/g);
  return m ? [...new Set(m)].slice(0, 5).join(", ") : "no price shown";
})()`));
console.log("  add it            :", await ev(`(() => {
  const b = [...document.querySelectorAll("button")].find(x => /add to cart/i.test(x.textContent) && x.offsetParent !== null);
  if (!b) return "NO BUY BUTTON"; b.click(); return "clicked";
})()`));
await sleep(2200);
console.log("  badge             :", await ev(badge));
console.log("  storage           :", await ev(store));
console.log("\nconsole errors:", errs.length ? errs : "none");
const s2 = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("scratchpad/chk-stickers.png", Buffer.from(s2.result.data, "base64"));
sock.close(); edge.kill();
