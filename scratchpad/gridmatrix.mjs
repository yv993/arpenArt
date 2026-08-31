// Prints the door plan as the browser actually renders it: a 6x5 matrix of
// magnet numbers and reserved-slot names, plus how many horizontal bands and
// columns the boxes truly fall into.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9568;
const profile = mkdtempSync(join(tmpdir(), "g2-"));
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
const ev = async (e) => {
  const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return "THREW " + r.result.exceptionDetails.exception?.description?.slice(0, 220);
  return r.result?.result?.value;
};
await send("Page.enable"); await send("Runtime.enable");
await send("Page.navigate", { url: "http://localhost:4000/shop/magnets" });
await sleep(18000);

const PROBE = String.raw`(() => {
  const kids = [...document.querySelectorAll(".ap-mf__door > li")];
  const cell = (el) => {
    const b = el.querySelector("button");
    if (b) {
      const m = (b.getAttribute("aria-label") || "").match(/no\. (\d+)/);
      return m ? m[1].padStart(2, "0") : "B?";
    }
    const sp = el.querySelector("span");
    return "*" + (sp ? sp.textContent.slice(0, 8) : "??");
  };
  const rows = [];
  for (let r = 0; r < 7; r++) rows.push(kids.slice(r * 5, r * 5 + 5).map((c) => cell(c).padEnd(10)).join(" "));
  const bands = new Set(kids.map((l) => Math.round(l.getBoundingClientRect().top / 40))).size;
  const cols = new Set(kids.map((l) => Math.round(l.getBoundingClientRect().left / 40))).size;
  return rows.join("\n") + "\nbands~" + bands + "  cols~" + cols;
})()`;
console.log(await ev(PROBE));
await ev(`document.querySelector(".ap-mf__scene").scrollIntoView({block:"start"})`);
await sleep(2000);
const a = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("scratchpad/mg-grid.png", Buffer.from(a.result.data, "base64"));
sock.close(); edge.kill();
