// The cart, tested the way a buyer actually uses it: choose an illustration
// FIRST on a picker category (postcards refuses to add without one, by design),
// then add; and on a category with no picker a bare click must add at once.
// Then follow the basket across a hard reload and check the total is the
// price in content.ts × qty — not something the cart invented.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 9522;
const profile = mkdtempSync(join(tmpdir(), "cart2-"));
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
const addBtn = `[...document.querySelectorAll("button")].find(x => /add to cart/i.test(x.textContent))`;

console.log("=== 1. postcards WITHOUT choosing — must refuse and say so ===");
await send("Page.navigate", { url: "http://localhost:4010/shop/postcards" });
await sleep(11000);
await ev(`${addBtn}.click()`); await sleep(1500);
console.log("  badge   :", await ev(badge));
console.log("  storage :", await ev(store));
console.log("  hint    :", await ev(`document.querySelector(".ap-cv__hint")?.textContent ?? "(no hint shown)"`));

console.log("\n=== 2. postcards WITH an illustration chosen — must add ===");
console.log("  picked  :", await ev(`(() => {
  const b = document.querySelectorAll(".ap-pick__grid button")[2];
  if (!b) return "NO PICKER"; b.click(); return b.getAttribute("aria-label") || b.title || "button 3";
})()`));
await sleep(1200);
await ev(`${addBtn}.click()`); await sleep(2200);
console.log("  badge   :", await ev(badge));
console.log("  storage :", await ev(store));
console.log("  said    :", await ev(`document.querySelector(".ap-cv__added")?.textContent ?? ""`));

console.log("\n=== 3. a category with NO picker (3d-stickers) — bare click must add ===");
await send("Page.navigate", { url: "http://localhost:4010/shop/3d-stickers" });
await sleep(11000);
console.log("  badge before:", await ev(badge));
console.log("  buttons     :", await ev(`[...document.querySelectorAll("button")].filter(x => /add to cart|add/i.test(x.textContent)).length`));
await ev(`(() => { const b = ${addBtn}; if (b) b.click(); })()`); await sleep(2200);
console.log("  badge after :", await ev(badge));
console.log("  storage     :", await ev(store));

console.log("\n=== 4. hard reload → /cart : does the basket survive, and does it add up? ===");
await send("Page.navigate", { url: "http://localhost:4010/cart" });
await sleep(8000);
console.log("  badge   :", await ev(badge));
console.log("  rows    :", await ev(`JSON.stringify([...document.querySelectorAll("li, tr")].map(r => r.innerText.replace(/\\s+/g, " ").trim()).filter(t => t && t.includes("\\u058F")).slice(0, 8))`));
console.log("  total   :", await ev(`(() => {
  const t = document.body.innerText.replace(/\\s+/g, " ");
  const m = t.match(/total[^\\d]{0,20}([\\d,]+)/i);
  return m ? m[1] : "(no total found) :: " + t.slice(0, 160);
})()`));
console.log("  checkout:", await ev(`[...document.querySelectorAll("button, a")].map(b => b.innerText.trim()).filter(Boolean).filter(t => /order|send|checkout|request/i.test(t)).slice(0, 4).join(" | ") || "(none)"`));
console.log("\nconsole errors:", errs.length ? errs : "none");
const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("scratchpad/chk-cart.png", Buffer.from(shot.result.data, "base64"));
sock.close(); edge.kill();
