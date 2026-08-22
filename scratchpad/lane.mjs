// Drives the 3D lane in a real browser: proves it loops rather than ending,
// that a click opens the design big with a price, and that buying writes a
// cart line. Shoots the lane at three points along the pin.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9401;
const profile = mkdtempSync(join(tmpdir(), "lane-"));
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

await send("Page.enable"); await send("Runtime.enable");
await send("Page.navigate", { url: "http://localhost:4000/shop/3d-stickers" });
await sleep(16000);

console.log("live:", await ev(`!!document.querySelector('.ap-s3[data-live]')`),
  " cards:", await ev(`document.querySelectorAll('.ap-s3__card').length`),
  " plain:", await ev(`document.querySelectorAll('.ap-s3__grid button').length`));

/** which card ids are currently on screen, left-to-right */
const onScreen = `(() => {
  const out = [];
  for (const el of document.querySelectorAll('.ap-s3__card')) {
    if (el.style.display === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.right < 0 || r.left > innerWidth || r.width < 40) continue;
    out.push({ id: el.querySelector('.ap-s3__no').textContent, x: Math.round(r.left), w: Math.round(r.width) });
  }
  return JSON.stringify(out.sort((a,b)=>a.x-b.x).map(c=>c.id));
})()`;

const shots = [];
for (const frac of [0, 0.35, 0.72, 0.98]) {
  await ev(`(() => { const s = document.querySelector('.ap-s3'); const top = s.offsetTop; scrollTo(0, top + ${frac} * innerHeight * 0.34 * 48); })()`);
  await sleep(1400);
  console.log(`  at ${String(Math.round(frac * 100)).padStart(3)}% of the pin ->`, await ev(onScreen));
  const s = await send("Page.captureScreenshot", { format: "png" });
  shots.push(Buffer.from(s.result.data, "base64"));
}
writeFileSync("scratchpad/lane-start.png", shots[0]);
writeFileSync("scratchpad/lane-mid.png", shots[2]);

// click the nearest card, buy it
await ev(`(() => {
  const vis = [...document.querySelectorAll('.ap-s3__card')].filter(e => e.style.display !== 'none');
  vis.sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width);
  vis[0].click();
})()`);
await sleep(900);
console.log("opened:", await ev(`JSON.stringify({dialog:!!document.querySelector('.ap-s3__open'),no:document.querySelector('.ap-s3__bigno')?.textContent,price:document.querySelector('.ap-s3__bigprice')?.textContent,locked:getComputedStyle(document.body).overflow})`));
const s2 = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("scratchpad/lane-open.png", Buffer.from(s2.result.data, "base64"));

await ev(`document.querySelector('.ap-s3__panel .ap-btn').click()`);
await sleep(800);
console.log("cart:", await ev(`localStorage.getItem('arpenart.cart.v1')`),
  " said:", await ev(`document.querySelector('.ap-s3__added')?.textContent`));

await ev(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`);
await sleep(600);
console.log("after Esc:", await ev(`JSON.stringify({dialog:!!document.querySelector('.ap-s3__open'),overflow:getComputedStyle(document.body).overflow})`));

sock.close(); edge.kill();
