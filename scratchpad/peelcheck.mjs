// Measures the magnet's new physics rather than trusting the code:
//   1. HOVER TILT — synthetic pointermove at the magnet's top-right corner
//      must produce a rotationY>0/rotationX>0 3D matrix; pointerleave must
//      settle it back toward identity (elastic, so sampled after 1.2s).
//      (Synthetic events because headless-CDP mousemoves never reach page
//      hover listeners — the trap in the project notes.)
//   2. THE PEEL — click, sample the transform every 60ms: it must pass
//      through a non-identity 3D state (the pull), the dialog must open at
//      the right magnet AFTER the motion (~0.4s), and the button's inline
//      transform must be cleared once the dialog is up.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9576;
const profile = mkdtempSync(join(tmpdir(), "peel-"));
const edge = spawn("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--window-size=1100,1500", "--no-first-run", "--use-gl=swiftshader", "about:blank"]);
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

console.log("=== 1. hover tilt (synthetic pointermove, top-right corner) ===");
console.log("before  :", await ev(`getComputedStyle(document.querySelectorAll(".ap-mf__door button")[7]).transform.slice(0, 40)`));
await ev(`(() => {
  const el = document.querySelectorAll(".ap-mf__door button")[7];
  const r = el.getBoundingClientRect();
  el.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: r.right - 4, clientY: r.top + 4 }));
})()`);
await sleep(500);
const tilted = await ev(`getComputedStyle(document.querySelectorAll(".ap-mf__door button")[7]).transform`);
console.log("tilted  :", String(tilted).slice(0, 60));
console.log("is 3d   :", String(tilted).startsWith("matrix3d"));
await ev(`document.querySelectorAll(".ap-mf__door button")[7].dispatchEvent(new PointerEvent("pointerleave", { bubbles: false }))`);
await sleep(1300);
const settled = await ev(`getComputedStyle(document.querySelectorAll(".ap-mf__door button")[7]).transform`);
console.log("settled :", String(settled).slice(0, 44), "(identity-ish:", /matrix\(1, 0, 0, 1, 0, 0\)|none/.test(String(settled)) + ")");

console.log("\n=== 2. the peel on click ===");
await ev(`window.__samples = []; window.__t0 = performance.now();
  window.__iv = setInterval(() => {
    const el = document.querySelectorAll(".ap-mf__door button")[7];
    window.__samples.push({
      t: Math.round(performance.now() - window.__t0),
      m: getComputedStyle(el).transform.slice(0, 8),
      dlg: !!document.querySelector(".ap-xg__lb"),
    });
    if (window.__samples.length > 16) clearInterval(window.__iv);
  }, 60)`);
await ev(`document.querySelectorAll(".ap-mf__door button")[7].click()`);
await sleep(1200);
console.log(await ev(`JSON.stringify(window.__samples.slice(0, 12))`));
console.log("dialog  :", await ev(`document.querySelector(".ap-xg__lb")?.getAttribute("aria-label")?.slice(0, 14) ?? "NOT OPEN"`));
console.log("inline transform cleared:", await ev(`document.querySelectorAll(".ap-mf__door button")[7].style.transform === ""`));
console.log("li z restored:", await ev(`document.querySelectorAll(".ap-mf__door button")[7].parentElement.style.zIndex === ""`));
await ev(`document.querySelector(".ap-xg__x")?.click()`);
await sleep(600);
console.log("errors  :", errs.length ? errs : "none");
sock.close(); edge.kill();
