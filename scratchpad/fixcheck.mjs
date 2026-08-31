// Verifies every review fix against the running site:
//  1. cart identity — a magnet, a keychain and a 3D sticker in one basket must
//     each show THEIR OWN photo and word, and the illustration path (postcard)
//     must be untouched
//  2. lightbox focus — after pressing Next, focus must NOT be on Close
//  3. grid buy — flyToCart now gets the cell's img (cart badge bumps)
//  4. /shop lede + meta description count all lines
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9564;
const profile = mkdtempSync(join(tmpdir(), "fx-"));
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
  if (x.method === "Runtime.exceptionThrown") errs.push("THREW " + (x.params.exceptionDetails.exception?.description ?? "").slice(0, 150)); };
const send = (method, params = {}) => new Promise((res) => { const n = ++id; waiting.set(n, res); sock.send(JSON.stringify({ id: n, method, params })); });
const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return "THREW " + r.result.exceptionDetails.exception?.description?.slice(0, 200);
  return r.result?.result?.value; };
await send("Page.enable"); await send("Runtime.enable");

console.log("=== 1. one basket, four id-spaces ===");
await send("Page.navigate", { url: "http://localhost:4000/cart" });
await sleep(9000);
await ev(`localStorage.setItem("arpenart.cart.v1", JSON.stringify([
  { cat: "magnets", art: "05", qty: 1 },
  { cat: "keychains", art: "05", qty: 1 },
  { cat: "3d-stickers", art: "05", qty: 1 },
  { cat: "postcards", art: "05", variant: "Single card", qty: 1 },
]))`);
await send("Page.navigate", { url: "http://localhost:4000/cart" });
await sleep(9000);
console.log(await ev(`JSON.stringify([...document.querySelectorAll(".ap-cart__row")].map(r => ({
  name: r.querySelector("h2")?.textContent,
  label: r.querySelector(".ap-cart__what p")?.textContent,
  img: (r.querySelector("img")?.getAttribute("src") || "(none)").split("/").pop(),
})), null, 1)`));

console.log("=== 2. lightbox focus after Next ===");
await send("Page.navigate", { url: "http://localhost:4000/shop/magnets" });
await sleep(16000);
await ev(`(() => { const b = document.querySelectorAll(".ap-mf__cell")[0]; b.scrollIntoView({block:"center"}); b.click(); })()`);
await sleep(1500);
await ev(`document.querySelector(".ap-xg__nav--next").focus()`);
await ev(`document.querySelector(".ap-xg__nav--next").click()`);
await sleep(900);
console.log("focused after Next:", await ev(`document.activeElement?.className || document.activeElement?.tagName`));
console.log("dialog shows      :", await ev(`document.querySelector(".ap-xg__lb")?.getAttribute("aria-label")?.slice(0, 20)`));
await ev(`document.querySelector(".ap-xg__x").click()`); await sleep(700);

console.log("=== 3. grid buy bumps the badge ===");
await ev(`localStorage.setItem("arpenart.cart.v1", "[]")`);
await send("Page.navigate", { url: "http://localhost:4000/shop/magnets" });
await sleep(14000);
await ev(`(() => { const b = document.querySelectorAll(".ap-mf__add")[1]; b.scrollIntoView({block:"center"}); b.click(); })()`);
await sleep(2000);
console.log("badge:", await ev(`document.querySelector('a[href="/cart"]')?.innerText.replace(/\s+/g, " ").trim()`),
  "| stored:", await ev(`localStorage.getItem("arpenart.cart.v1")`));

console.log("=== 4. /shop copy ===");
await send("Page.navigate", { url: "http://localhost:4000/shop" });
await sleep(10000);
console.log("lede :", await ev(`document.querySelector(".ap-lede")?.textContent.trim().slice(0, 60)`));
console.log("meta :", await ev(`document.querySelector('meta[name="description"]')?.content.slice(0, 160)`));
console.log("errors:", errs.length ? errs : "none");
sock.close(); edge.kill();
