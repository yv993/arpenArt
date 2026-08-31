// The same audit, forced into LIGHT theme (localStorage ap-theme=light), since
// every earlier measurement ran dark. Checks the things a theme can break:
// invisible text (ink that matches paper), dead images, errors, overflow.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9528;
const profile = mkdtempSync(join(tmpdir(), "light-"));
const edge = spawn("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--window-size=1440,950", "--no-first-run", "--use-gl=swiftshader", "about:blank",
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 80; i++) { try { if ((await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).length) break; } catch {} await sleep(250); }
const pages = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter((t) => t.type === "page");
const tab = pages.find((t) => t.url === "about:blank") ?? pages[0];
const sock = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => (sock.onopen = r));
let id = 0; const waiting = new Map(); let errs = [];
sock.onmessage = (m) => { const x = JSON.parse(m.data);
  if (x.id && waiting.has(x.id)) { waiting.get(x.id)(x); waiting.delete(x.id); return; }
  if (x.method === "Runtime.consoleAPICalled" && x.params.type === "error") errs.push(x.params.args.map((a) => a.value ?? "").join(" ").slice(0, 120));
  if (x.method === "Runtime.exceptionThrown") errs.push("THREW " + (x.params.exceptionDetails.exception?.description ?? "").slice(0, 120)); };
const send = (method, params = {}) => new Promise((res) => { const n = ++id; waiting.set(n, res); sock.send(JSON.stringify({ id: n, method, params })); });
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send("Page.enable"); await send("Runtime.enable");
await send("Page.navigate", { url: "http://localhost:4010/" }); await sleep(6000);
await ev(`localStorage.setItem("ap-theme","light")`);

const lum = (c) => { const [r, g, b] = c.match(/\d+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ROUTES = ["/", "/shop", "/shop/postcards", "/shop/scarves", "/shop/hoodies", "/shop/cups", "/shop/plates", "/shop/puzzles", "/shop/stickers", "/shop/3d-stickers", "/shop/totes", "/find-in-store", "/about", "/contact", "/cart", "/account", "/privacy", "/terms"];
console.log("=== LIGHT THEME, 1440px ===");
for (const r of ROUTES) {
  errs = [];
  await send("Page.navigate", { url: "http://localhost:4010" + r }); await sleep(7000);
  await ev("scrollTo(0, document.body.scrollHeight * 0.5)"); await sleep(1200); await ev("scrollTo(0,0)"); await sleep(600);
  const out = JSON.parse(await ev(`(() => {
    const theme = document.documentElement.dataset.theme || "(none)";
    const bg = getComputedStyle(document.body).backgroundColor;
    // text whose colour is within 12% luminance of the ground behind it
    const low = [];
    for (const el of document.querySelectorAll("p, h1, h2, h3, a, span, li, strong, button")) {
      if (!el.textContent.trim() || el.children.length) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.opacity === "0" || !el.getBoundingClientRect().width) continue;
      let g = el, bgc = "rgba(0, 0, 0, 0)";
      while (g && (bgc === "rgba(0, 0, 0, 0)" || bgc === "transparent")) { bgc = getComputedStyle(g).backgroundColor; g = g.parentElement; }
      low.push({ c: cs.color, b: bgc, t: el.textContent.trim().slice(0, 26) });
    }
    return JSON.stringify({ theme, bg, dead: [...document.images].filter(i => i.complete && !i.naturalWidth).length,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, samples: low.slice(0, 400) });
  })()`));
  const bad = out.samples.filter((s) => { try { const a = lum(s.c), b = lum(s.b); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) < 1.6; } catch { return false; } });
  const issues = [];
  if (out.theme !== "light") issues.push("theme did not apply: " + out.theme);
  if (out.dead) issues.push(out.dead + " dead images");
  if (out.overflow) issues.push("horizontal overflow");
  if (bad.length) issues.push(bad.length + " near-invisible text: " + bad.slice(0, 2).map((x) => `"${x.t}" ${x.c} on ${x.b}`).join(" ; "));
  for (const e of errs) issues.push("console: " + e);
  console.log(`${issues.length ? "FAIL" : " ok "}  ${r.padEnd(20)} theme=${out.theme} bg=${out.bg}`);
  issues.forEach((i) => console.log("        ↳ " + i));
}
sock.close(); edge.kill();
