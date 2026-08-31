// The 6x5 door: counts and positions checked against the client's mapping,
// a reserved slot proven inert, a real slot proven to open ITS OWN magnet.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9566;
const profile = mkdtempSync(join(tmpdir(), "gd-"));
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
  if (x.method === "Runtime.consoleAPICalled" && x.params.type === "error") errs.push(x.params.args.map((a) => a.value ?? "").join(" ").slice(0, 140));
  if (x.method === "Runtime.exceptionThrown") errs.push("THREW " + (x.params.exceptionDetails.exception?.description ?? "").slice(0, 140)); };
const send = (method, params = {}) => new Promise((res) => { const n = ++id; waiting.set(n, res); sock.send(JSON.stringify({ id: n, method, params })); });
const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return "THREW " + r.result.exceptionDetails.exception?.description?.slice(0, 200);
  return r.result?.result?.value; };
await send("Page.enable"); await send("Runtime.enable");
await send("Page.navigate", { url: "http://localhost:4000/shop/magnets" });
await sleep(18000);

console.log("slots        :", await ev(`document.querySelectorAll(".ap-mf__door > li").length`));
console.log("real/reserved:", await ev(`JSON.stringify({
  real: document.querySelectorAll(".ap-mf__door button").length,
  reserved: document.querySelectorAll(".ap-mf__soonslot").length })`));
// the six fixed positions: read the aria-labels by grid index (row-major)
console.log("positions    :", await ev(`(() => {
  const kids = [...document.querySelectorAll(".ap-mf__door > li")];
  const at = (r, c) => {
    const el = kids[(r - 1) * 5 + (c - 1)];
    return el.querySelector("button")?.getAttribute("aria-label")?.match(/no\. (\d+)/)?.[1] ?? "SOON:" + el.textContent.trim().slice(0, 16);
  };
  return JSON.stringify({ R1C1: at(1,1), R1C2: at(1,2), R1C5: at(1,5), R2C1: at(2,1), R3C1: at(3,1), R3C2: at(3,2), R4C5: at(4,5) });
})()`));
// rows really are 6: distinct y of the li boxes
console.log("distinct rows:", await ev(`(() => {
  const ys = [...document.querySelectorAll(".ap-mf__door > li")].map(l => Math.round(l.getBoundingClientRect().top / 8));
  return new Set(ys).size;
})()`));
// a reserved slot is inert
console.log("reserved tag :", await ev(`(() => { const s = document.querySelector(".ap-mf__soonslot"); return s.tagName + " buttons:" + s.querySelectorAll("button").length + " text:" + s.textContent.trim().slice(0, 30); })()`));
// a door magnet opens ITS OWN number (click R3C2 = the stone heads, no. 30)
await ev(`document.querySelector(".ap-mf__scene").scrollIntoView({block:"start"})`); await sleep(1500);
console.log("click R3C2   :", await ev(`(() => { const kids = [...document.querySelectorAll(".ap-mf__door > li")]; kids[(3-1)*5+(2-1)].querySelector("button").click(); return "clicked"; })()`));
await sleep(1500);
console.log("lightbox     :", await ev(`document.querySelector(".ap-xg__lb")?.getAttribute("aria-label")?.slice(0, 30)`));
await ev(`document.querySelector(".ap-xg__x")?.click()`); await sleep(800);
const a = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("scratchpad/mg-grid.png", Buffer.from(a.result.data, "base64"));
console.log("errors       :", errs.length ? errs : "none");
sock.close(); edge.kill();
