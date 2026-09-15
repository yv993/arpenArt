// The magnet's journey, sampled frame by frame. Three things must hold:
//   1. IT NEVER STOPS — the clone's position changes on every sample from
//      the press until it lands (no plateau in the middle);
//   2. IT LANDS ON THE DESTINATION — the clone's final rect equals the
//      dialog picture's rect, so the swap is invisible rather than a jump;
//   3. THE DIALOG'S PICTURE IS HELD until then (opacity 0 while `arriving`),
//      and is visible once the traveller is gone.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9602;
const profile = mkdtempSync(join(tmpdir(), "fl2-"));
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

// sample on every animation frame: the traveller and its destination
await ev(`window.__s = [];
  (function tick() {
    const c = document.querySelector(".ap-mf__fly");
    const d = document.querySelector(".ap-xg__lb .ap-xg__stage img");
    if (c || d) {
      const cr = c && c.getBoundingClientRect();
      const dr = d && d.getBoundingClientRect();
      window.__s.push({
        c: cr ? [Math.round(cr.left), Math.round(cr.top), Math.round(cr.width)] : null,
        d: dr ? [Math.round(dr.left), Math.round(dr.top), Math.round(dr.width)] : null,
        op: d ? getComputedStyle(d).opacity : null,
      });
    }
    if (window.__s.length < 200) requestAnimationFrame(tick);
  })();`);
await ev(`document.querySelectorAll(".ap-mf__door button")[7].click()`);
await sleep(500);
const mid = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("scratchpad/mg-flight-mid.png", Buffer.from(mid.result.data, "base64"));
await sleep(1600);

const s = JSON.parse(await ev(`JSON.stringify(window.__s)`));
const flying = s.filter((x) => x.c);
console.log(`frames with a traveller: ${flying.length}`);

// 1. never stops: how many consecutive samples share a position, mid-flight?
let worstStall = 0, run = 0;
for (let i = 1; i < flying.length; i++) {
  const a = flying[i - 1].c, b = flying[i].c;
  if (a[0] === b[0] && a[1] === b[1] && a[2] === b[2]) { run++; worstStall = Math.max(worstStall, run); }
  else run = 0;
}
console.log(`longest run of identical positions mid-flight: ${worstStall} frames`);

// 2. lands on the destination
const last = flying[flying.length - 1];
console.log("last traveller rect :", JSON.stringify(last.c));
console.log("destination rect    :", JSON.stringify(last.d));
if (last.c && last.d) {
  const off = [Math.abs(last.c[0] - last.d[0]), Math.abs(last.c[1] - last.d[1]), Math.abs(last.c[2] - last.d[2])];
  console.log(`landing error       : ${off.join(" / ")} px  (left / top / width)`);
}

// 3. the destination picture is held, then released
const heldWhileFlying = flying.every((x) => x.op === null || x.op === "0");
const afterOp = await ev(`getComputedStyle(document.querySelector(".ap-xg__lb .ap-xg__stage img")).opacity`);
console.log(`dialog picture hidden during flight: ${heldWhileFlying}, opacity after: ${afterOp}`);
console.log("clone gone :", await ev(`!document.querySelector(".ap-mf__fly")`));
console.log("door back  :", await ev(`document.querySelectorAll(".ap-mf__door button")[7].style.visibility === ""`));
console.log("price+buy  :", await ev(`(() => { const t = document.querySelector(".ap-xg__lb").innerText.replace(/\\s+/g, " ");
  return JSON.stringify({ price: /1,600/.test(t), add: /add to cart/i.test(t) }); })()`));
const end = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("scratchpad/mg-flight-end.png", Buffer.from(end.result.data, "base64"));
console.log("errors:", errs.length ? errs : "none");
sock.close(); edge.kill();
