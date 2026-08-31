// Walks every route on a PRODUCTION build (next start) and reports what is
// actually broken, at desktop and phone widths. Per page it records:
//   • the document's HTTP status
//   • console errors + uncaught exceptions (React hydration errors included)
//   • failed subresources (404 images / fonts / chunks)
//   • images that did not decode (naturalWidth 0)
//   • images asked to `contain` that overflow a clipping ancestor — the crop
//     bug class fixed in shop.css, checked site-wide so it cannot recur quietly
//   • horizontal page overflow, and the widest offender
//   • the h1 (missing / duplicated)
// Nothing here is a judgement call: every line is a measurement.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9512;
const BASE = process.env.BASE ?? "http://localhost:4010";
const SLUGS = ["postcards", "scarves", "hoodies", "cups", "plates", "puzzles", "stickers", "3d-stickers", "totes"];
const ROUTES = ["/", "/shop", ...SLUGS.map((s) => `/shop/${s}`), "/find-in-store", "/about", "/contact", "/cart", "/account", "/privacy", "/terms", "/this-route-does-not-exist"];
const VIEWS = [{ name: "desktop", w: 1440, h: 950 }, { name: "phone", w: 390, h: 844 }];

const profile = mkdtempSync(join(tmpdir(), "scan-"));
const edge = spawn(EDGE, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--window-size=1440,950", "--no-first-run", "--use-gl=swiftshader",
  "--disable-features=msEdgeSyncPromo,msImplicitSignin", "about:blank",
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 80; i++) {
  try { if ((await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).length) break; } catch {}
  await sleep(250);
}
const pages = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter((t) => t.type === "page");
const tab = pages.find((t) => t.url === "about:blank") ?? pages[0];
const sock = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => (sock.onopen = r));

let id = 0; const waiting = new Map(); const events = [];
sock.onmessage = (m) => {
  const x = JSON.parse(m.data);
  if (x.id && waiting.has(x.id)) { waiting.get(x.id)(x); waiting.delete(x.id); return; }
  if (x.method) events.push(x);
};
const send = (method, params = {}) => new Promise((res) => { const n = ++id; waiting.set(n, res); sock.send(JSON.stringify({ id: n, method, params })); })
  .then((r) => { if (r.error) console.error("  !! CDP", method, r.error.message); return r; });
const ev = async (e) => {
  const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return `EVAL-THREW: ${r.result.exceptionDetails.exception?.description?.slice(0, 160)}`;
  return r.result?.result?.value;
};

await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable"); await send("Log.enable");

const PROBE = `(() => {
  const out = { url: location.pathname };
  const h1 = [...document.querySelectorAll("h1")];
  out.h1 = h1.length === 1 ? h1[0].textContent.trim().replace(/\\s+/g, " ").slice(0, 46)
         : h1.length === 0 ? "MISSING" : "DUPLICATE x" + h1.length;
  const imgs = [...document.images];
  out.imgs = imgs.length;
  out.dead = imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => (i.currentSrc || i.src).split("/").pop()).slice(0, 6);
  out.pending = imgs.filter(i => !i.complete).length;
  // an image told to CONTAIN that still busts out of a clipping ancestor
  const clipped = [];
  for (const im of imgs) {
    if (getComputedStyle(im).objectFit !== "contain") continue;
    const ir = im.getBoundingClientRect();
    if (!ir.width) continue;
    for (let p = im.parentElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (!/hidden|clip/.test(cs.overflowX + cs.overflowY)) continue;
      const pr = p.getBoundingClientRect();
      const over = Math.round(Math.max(ir.bottom - pr.bottom, pr.top - ir.top, ir.right - pr.right, pr.left - ir.left));
      if (over > 2) clipped.push((im.currentSrc || im.src).split("/").pop() + " cut " + over + "px by ." + (p.className.split(" ")[0] || p.tagName));
      break;
    }
  }
  out.clipped = clipped.slice(0, 5);
  // horizontal overflow, and who is widest past the viewport
  const vw = document.documentElement.clientWidth;
  out.scrollW = document.documentElement.scrollWidth;
  if (out.scrollW > vw + 1) {
    let worst = null;
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || getComputedStyle(el).position === "fixed") continue;
      const past = Math.round(r.right - vw);
      if (past > 1 && (!worst || past > worst.past)) worst = { past, sel: (el.tagName + "." + el.className).toString().split(" ")[0].slice(0, 44) };
    }
    out.widest = worst;
  }
  out.bodyText = document.body.innerText.replace(/\\s+/g, " ").trim().length;
  return JSON.stringify(out);
})()`;

const report = [];
for (const view of VIEWS) {
  await send("Emulation.setDeviceMetricsOverride", { width: view.w, height: view.h, deviceScaleFactor: 1, mobile: view.w < 700 });
  console.log(`\n=============== ${view.name.toUpperCase()} ${view.w}px ===============`);
  for (const route of ROUTES) {
    events.length = 0;
    await send("Page.navigate", { url: BASE + route });
    await sleep(route === "/" ? 9000 : 7000);
    await ev("scrollTo(0, document.body.scrollHeight * 0.55)"); await sleep(1400);
    await ev("scrollTo(0, 0)"); await sleep(700);

    const status = events.find((e) => e.method === "Network.responseReceived" && e.params.type === "Document")?.params.response.status;
    const netFail = events.filter((e) => e.method === "Network.loadingFailed" && !/net::ERR_ABORTED/.test(e.params.errorText || ""))
      .map((e) => e.params.errorText).slice(0, 4);
    const http404 = events.filter((e) => e.method === "Network.responseReceived" && e.params.response.status >= 400 && e.params.type !== "Document")
      .map((e) => e.params.response.status + " " + e.params.response.url.split("/").pop().slice(0, 40));
    const consoleErr = events.filter((e) => e.method === "Runtime.consoleAPICalled" && e.params.type === "error")
      .map((e) => e.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 150));
    const thrown = events.filter((e) => e.method === "Runtime.exceptionThrown")
      .map((e) => (e.params.exceptionDetails.exception?.description ?? e.params.exceptionDetails.text ?? "").slice(0, 150));

    const raw = await ev(PROBE);
    let p; try { p = JSON.parse(raw); } catch { p = { parseFail: String(raw).slice(0, 180) }; }

    const bad = [];
    const wantStatus = route.includes("does-not-exist") ? 404 : 200;
    if (status !== wantStatus) bad.push(`HTTP ${status} (expected ${wantStatus})`);
    if (p.parseFail) bad.push("probe failed: " + p.parseFail);
    if (p.h1 === "MISSING" || String(p.h1).startsWith("DUPLICATE")) bad.push("h1 " + p.h1);
    if (p.dead?.length) bad.push("dead images: " + p.dead.join(", "));
    if (p.pending) bad.push(p.pending + " images never loaded");
    if (p.clipped?.length) bad.push("CLIPPED: " + p.clipped.join(" | "));
    if (p.widest) bad.push(`h-overflow ${p.scrollW}px, worst ${p.widest.sel} +${p.widest.past}px`);
    if (p.bodyText < 120) bad.push("page nearly empty (" + p.bodyText + " chars)");
    for (const c of consoleErr) bad.push("console: " + c);
    for (const t of thrown) bad.push("threw: " + t);
    for (const f of netFail) bad.push("net: " + f);
    for (const f of http404) bad.push("subresource " + f);

    const ok = bad.length === 0;
    console.log(`${ok ? " ok " : "FAIL"}  ${route.padEnd(22)} ${String(status).padEnd(4)} imgs ${String(p.imgs ?? "?").padEnd(3)} h1 “${p.h1 ?? "?"}”`);
    for (const b of bad) console.log(`        ↳ ${b}`);
    if (!ok) report.push({ view: view.name, route, bad });
  }
}

console.log("\n================ SUMMARY ================");
if (!report.length) console.log("every route clean on both widths");
else for (const r of report) console.log(`${r.view.padEnd(8)} ${r.route.padEnd(22)} ${r.bad.length} issue(s)`);

sock.close(); edge.kill();
