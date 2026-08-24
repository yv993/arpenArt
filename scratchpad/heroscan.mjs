// Walks the hero's scroll and looks for the black the client reported
// ("hero section with some scroll appear black and gone"). Reports, per step,
// the mean luminance of the frame and the share of it that is near-black, and
// saves the darkest frames so the cause can be seen rather than guessed.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9430;
const THEME = process.argv[2] ?? "light";
const profile = mkdtempSync(join(tmpdir(), "hero-"));
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
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: THEME }] });
await send("Page.navigate", { url: "http://localhost:4000/" });
await sleep(18000);

console.log(`theme=${THEME}  docHeight=${await ev("document.documentElement.scrollHeight")}`);

const frames = [];
for (let y = 0; y <= 2600; y += 130) {
  await ev(`scrollTo(0, ${y})`);
  await sleep(650);
  const s = await send("Page.captureScreenshot", { format: "png" });
  const buf = Buffer.from(s.result.data, "base64");
  const { data, info } = await sharp(buf).resize(180, null).raw().toBuffer({ resolveWithObject: true });
  let sum = 0, dark = 0, n = 0;
  for (let p = 0; p < data.length; p += info.channels) {
    const l = 0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2];
    sum += l; if (l < 26) dark++; n++;
  }
  const mean = sum / n, pct = (dark / n) * 100;
  frames.push({ y, mean, pct, buf });
  const bar = "#".repeat(Math.round(pct / 2));
  console.log(`  y=${String(y).padStart(4)}  mean L ${mean.toFixed(1).padStart(5)}  near-black ${pct.toFixed(1).padStart(5)}%  ${bar}`);
}

frames.sort((a, b) => b.pct - a.pct);
for (let k = 0; k < 3; k++) {
  writeFileSync(`scratchpad/hero-black-${k}-y${frames[k].y}.png`, frames[k].buf);
  console.log(`worst #${k + 1}: y=${frames[k].y} (${frames[k].pct.toFixed(1)}% near-black) -> scratchpad/hero-black-${k}-y${frames[k].y}.png`);
}

sock.close(); edge.kill();
