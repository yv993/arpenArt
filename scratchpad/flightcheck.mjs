// The magnet flight, sampled: click a door magnet, watch the clone travel
// (left/width growing toward centre), the lightbox open at landing with
// price + Add to cart, the clone gone after crossfade, the door restored.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9594;
const profile = mkdtempSync(join(tmpdir(), "fl-"));
const edge = spawn("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--window-size=1280,1100", "--no-first-run", "--use-gl=swiftshader", "about:blank"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 90; i++) { try { if ((await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).length) break; } catch {} await sleep(250); }
const pages = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter((t) => t.type === "page");
const tab = pages.find((t) => t.url === "about:blank") ?? pages[0];
const sock = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => (sock.onopen = r));
let id = 0; const waiting = new Map(); const errs = [];
sock.onmessage = (m) => { const x = JSON.parse(m.data);
  if (x.id && waiting.has(x.id)) { waiting.get(x.id)(x); waiting.delete(x.id); return; }
  if (x.method === "Runtime.consoleAPICalled" && x.params.type === "error") errs.push(x.params.args.map((a) => a.value ?? "").join(" ").slice(0, 140));
  if (x.method === "Runtime.exceptionThrown") errs.push("THREW " + (x.params.exceptionDetails.exception?.description ?? "").slice(0, 140)); };
const send = (method, params = {}) => new Promise((res) => { const n = ++id; waiting.set(n, res); sock.send(JSON.stringify({ id: n, method, params })); });
const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return "THREW " + r.result.exceptionDetails.exception?.description?.slice(0, 220);
  return r.result?.result?.value; };
await send("Page.enable"); await send("Runtime.enable");
await send("Page.navigate", { url: "http://localhost:4000/shop/magnets" });
await sleep(18000);
await ev(`document.querySelector(".ap-mf__scene").scrollIntoView({block:"center"})`);
await sleep(1500);

await ev(`window.__s = []; window.__iv = setInterval(() => {
  const c = document.querySelector(".ap-mf__fly");
  window.__s.push({
    t: window.__s.length * 70,
    fly: c ? Math.round(c.getBoundingClientRect().width) : null,
    left: c ? Math.round(c.getBoundingClientRect().left) : null,
    dlg: !!document.querySelector(".ap-xg__lb"),
  });
  if (window.__s.length > 18) clearInterval(window.__iv);
}, 70)`);
await ev(`document.querySelectorAll(".ap-mf__door button")[7].click()`);
await sleep(650);
const mid = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("scratchpad/mg-flight-mid.png", Buffer.from(mid.result.data, "base64"));
await sleep(1100);
console.log("samples:", await ev(`JSON.stringify(window.__s.filter(x => x.fly !== null || x.dlg).slice(0, 14))`));
console.log("lightbox:", await ev(`document.querySelector(".ap-xg__lb")?.getAttribute("aria-label")?.slice(0, 16)`));
console.log("price+buy:", await ev(`(() => { const d = document.querySelector(".ap-xg__lb"); const t = d.innerText.replace(/\s+/g, " ");
  return JSON.stringify({ price: /1,600/.test(t), add: /add to cart/i.test(t) }); })()`));
console.log("clone gone:", await ev(`!document.querySelector(".ap-mf__fly")`));
console.log("door back :", await ev(`document.querySelectorAll(".ap-mf__door button")[7].style.visibility === ""`));
const end = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("scratchpad/mg-flight-end.png", Buffer.from(end.result.data, "base64"));
console.log("errors:", errs.length ? errs : "none");
sock.close(); edge.kill();
