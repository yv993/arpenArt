// Does a CLICK on a sheet picture open it big — and does a DRAG not?
// The cards are gsap/Draggable while the folder is open, and the whole risk of
// making them buttons is that a drag ends in a click nobody asked for.
// Uses REAL Input events: a synthetic el.click() cannot tell the two apart,
// which is exactly the distinction under test.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9410;
const profile = mkdtempSync(join(tmpdir(), "zoom-"));
const edge = spawn(EDGE, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--window-size=1440,900", "--no-first-run", "--use-gl=swiftshader", "about:blank",
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 60; i++) {
  try { if ((await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).length) break; } catch {}
  await sleep(250);
}
const pages = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter((t) => t.type === "page");
const tab = pages.find((t) => t.url === "about:blank") ?? pages[0];
const sock = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => (sock.onopen = r));
let id = 0; const waiting = new Map();
sock.onmessage = (m) => { const x = JSON.parse(m.data); if (x.id && waiting.has(x.id)) { waiting.get(x.id)(x); waiting.delete(x.id); } };
const send = (method, params = {}) => new Promise((res) => { const n = ++id; waiting.set(n, res); sock.send(JSON.stringify({ id: n, method, params })); })
  .then((r) => { if (r.error) console.error("  !!", method, r.error.message); return r; });
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;

/** a real press/release. clickCount on BOTH or no click is synthesised. */
async function mouse(type, x, y) {
  await send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseMoved" ? 1 : 0, clickCount: 1 });
}

await send("Page.enable"); await send("Runtime.enable");
await send("Page.navigate", { url: "http://localhost:4000/shop/stickers" });
await sleep(15000);

const state = () => ev(`JSON.stringify({lb:!!document.querySelector('.ap-xg__lb'),count:document.querySelector('.ap-xg__count')?.textContent.trim(),src:(document.querySelector('.ap-xg__stage img')||{}).src?.split('/').pop(),locked:getComputedStyle(document.body).overflow})`);

// open folder 1
await ev(`document.querySelectorAll('.ap-sf__flap')[0].click()`);
await sleep(1200);
console.log("folder open:", await ev(`!!document.querySelector('.ap-sf__cell[data-open]')`));

/** centre of the nth visible card of the open folder */
const cardAt = (n) => ev(`(() => {
  const cell = document.querySelector('.ap-sf__cell[data-open]');
  const c = cell.querySelectorAll('.ap-sf__card')[${n}];
  const r = c.getBoundingClientRect();
  return JSON.stringify([Math.round(r.left + r.width/2), Math.round(r.top + r.height/2)]);
})()`);

// --- 1. a DRAG must NOT open anything -------------------------------------
let [x, y] = JSON.parse(await cardAt(1));
await mouse("mousePressed", x, y);
for (let k = 1; k <= 6; k++) await mouse("mouseMoved", x, y + k * 18);
await mouse("mouseReleased", x, y + 108);
await sleep(900);
console.log("after a 108px DRAG ->", await state());

// the drag may have closed the folder (that is its job); reopen
await ev(`(() => { const f = document.querySelectorAll('.ap-sf__flap')[0]; if (!document.querySelector('.ap-sf__cell[data-open]')) f.click(); })()`);
await sleep(1200);

// --- 2. a CLICK must open it big ------------------------------------------
[x, y] = JSON.parse(await cardAt(1));
await mouse("mousePressed", x, y);
await mouse("mouseReleased", x, y);
await sleep(1100);
console.log("after a CLICK        ->", await state());

const s1 = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("scratchpad/zoom-open.png", Buffer.from(s1.result.data, "base64"));

// --- 3. arrows walk the sheet's three pictures ----------------------------
await ev(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight'}))`);
await sleep(700);
console.log("after ArrowRight     ->", await state());

// --- 4. buy from inside, then Escape --------------------------------------
await ev(`document.querySelector('.ap-xg__stage figcaption .ap-btn').click()`);
await sleep(800);
console.log("cart:", await ev(`localStorage.getItem('arpenart.cart.v1')`));
await ev(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`);
await sleep(700);
console.log("after Escape         ->", await state());

sock.close(); edge.kill();
