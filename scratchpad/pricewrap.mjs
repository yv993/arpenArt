// Does the shop tile's price still break before the dram sign? Measures every
// tile's price line at two widths: a wrapped line is taller than one line box.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9552;
const profile = mkdtempSync(join(tmpdir(), "pw-"));
const edge = spawn("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--window-size=1440,950", "--no-first-run", "--use-gl=swiftshader", "about:blank"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 90; i++) { try { if ((await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).length) break; } catch {} await sleep(250); }
const pages = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter((t) => t.type === "page");
const tab = pages.find((t) => t.url === "about:blank") ?? pages[0];
const sock = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => (sock.onopen = r));
let id = 0; const waiting = new Map();
sock.onmessage = (m) => { const x = JSON.parse(m.data); if (x.id && waiting.has(x.id)) { waiting.get(x.id)(x); waiting.delete(x.id); } };
const send = (method, params = {}) => new Promise((res) => { const n = ++id; waiting.set(n, res); sock.send(JSON.stringify({ id: n, method, params })); });
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send("Page.enable"); await send("Runtime.enable");

const PROBE = `(() => {
  const els = [...document.querySelectorAll(".ap-xg__say em")];
  const rows = els.map((e) => ({
    text: e.innerText.replace(/\\s+/g, " ").trim(),
    h: Math.round(e.getBoundingClientRect().height),
    clipped: e.scrollWidth > e.clientWidth + 1,
  }));
  const line = Math.min(...rows.map((r) => r.h));
  return JSON.stringify({
    tiles: rows.length,
    wrapped: rows.filter((r) => r.h > line + 3).map((r) => r.text),
    clipped: rows.filter((r) => r.clipped).map((r) => r.text),
    sample: rows[0]?.text,
  });
})()`;

for (const width of [1440, 1240, 1100]) {
  await send("Emulation.setDeviceMetricsOverride", { width, height: 950, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: "http://localhost:4000/shop" });
  await sleep(16000);
  console.log(String(width).padStart(5) + "px  " + (await ev(PROBE)));
}
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: "http://localhost:4000/shop" });
await sleep(16000);
await ev(`window.scrollTo(0, document.body.scrollHeight * 0.45)`);
await sleep(2200);
const a = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("scratchpad/kc-shopgrid.png", Buffer.from(a.result.data, "base64"));
sock.close(); edge.kill();
