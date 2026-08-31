// Screenshots the fridge scene so the door-plane numbers can be tuned against
// the real render, then opens the lightbox and buys from it.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9560;
const profile = mkdtempSync(join(tmpdir(), "mg-"));
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
  if (x.method === "Runtime.consoleAPICalled" && x.params.type === "error") errs.push(x.params.args.map((a) => a.value ?? "").join(" ").slice(0, 150));
  if (x.method === "Runtime.exceptionThrown") errs.push("THREW " + (x.params.exceptionDetails.exception?.description ?? "").slice(0, 150)); };
const send = (method, params = {}) => new Promise((res) => { const n = ++id; waiting.set(n, res); sock.send(JSON.stringify({ id: n, method, params })); });
const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return "THREW " + r.result.exceptionDetails.exception?.description?.slice(0, 200);
  return r.result?.result?.value; };
await send("Page.enable"); await send("Runtime.enable");
await send("Page.navigate", { url: "http://localhost:4000/shop/magnets" });
await sleep(20000);
console.log("live      :", await ev(`document.querySelector(".ap-mf")?.hasAttribute("data-live")`));
console.log("door mags :", await ev(`document.querySelectorAll(".ap-mf__door li").length`));
console.log("grid mags :", await ev(`document.querySelectorAll(".ap-mf__all > li").length`));
await ev(`document.querySelector(".ap-mf__scene").scrollIntoView({block:"start"})`);
await sleep(2500);
const a = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("scratchpad/mg-scene.png", Buffer.from(a.result.data, "base64"));

// open the lightbox from a door magnet, walk it, buy
console.log("open      :", await ev(`(() => { const b = document.querySelectorAll(".ap-mf__door button")[4]; if (!b) return "none"; b.click(); return "clicked door #5"; })()`));
await sleep(1800);
console.log("dialog    :", await ev(`(() => { const d = document.querySelector(".ap-xg__lb"); return d ? "open: " + (d.getAttribute("aria-label") || "").slice(0, 44) : "NOT OPEN"; })()`));
await ev(`document.querySelector(".ap-xg__nav--next")?.click()`); await sleep(900);
console.log("after →   :", await ev(`document.querySelector(".ap-xg__lb")?.getAttribute("aria-label")?.slice(0, 44)`));
const b = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("scratchpad/mg-big.png", Buffer.from(b.result.data, "base64"));
console.log("buy       :", await ev(`(() => { const f = document.querySelector(".ap-xg__stage figcaption button"); if (!f) return "no buy"; f.click(); return "clicked: " + f.textContent.trim(); })()`));
await sleep(2200);
console.log("stored    :", await ev(`localStorage.getItem("arpenart.cart.v1")`));
console.log("badge     :", await ev(`document.querySelector('a[href="/cart"]')?.innerText.replace(/\s+/g, " ").trim()`));
console.log("errors    :", errs.length ? errs : "none");
sock.close(); edge.kill();
