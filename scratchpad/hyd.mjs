// ---------------------------------------------------------------------------
// HYDRATION CHECK — does React complain on any route?
//
// It must listen to Runtime.consoleAPICalled: React reports hydration
// mismatches through console.error, and Log.entryAdded CANNOT see them. Also
// walks each page with a stored theme, because the pre-paint script writes
// data-theme onto <html> and that is precisely the kind of write that made the
// old `js` class a mismatch.
//
//   node scratchpad/hyd.mjs
// ---------------------------------------------------------------------------
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9381;
const ROUTES = ["/", "/find-in-store", "/shop", "/shop/postcards", "/about", "/contact", "/cart"];

const profile = mkdtempSync(join(tmpdir(), "hyd-"));
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

let id = 0;
const waiting = new Map();
let bucket = [];
sock.onmessage = (m) => {
  const x = JSON.parse(m.data);
  if (x.id && waiting.has(x.id)) { waiting.get(x.id)(x); waiting.delete(x.id); return; }
  if (x.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(x.params.type)) {
    const text = (x.params.args || []).map((a) => a.value ?? a.description ?? "").join(" ");
    if (/hydrat|did not match|server rendered|server HTML/i.test(text)) bucket.push(text.slice(0, 220));
  }
  if (x.method === "Runtime.exceptionThrown") {
    bucket.push("EXCEPTION: " + (x.params.exceptionDetails?.exception?.description ?? "").slice(0, 200));
  }
};
const send = (method, params = {}) =>
  new Promise((res) => { const n = ++id; waiting.set(n, res); sock.send(JSON.stringify({ id: n, method, params })); });

await send("Page.enable");
await send("Runtime.enable");

// arrive with a stored choice, so the pre-paint script actually fires
await send("Page.navigate", { url: "http://localhost:4000/" });
await sleep(12000);
await send("Runtime.evaluate", { expression: "localStorage.setItem('ap-theme','dark')" });

let bad = 0;
for (const route of ROUTES) {
  bucket = [];
  await send("Page.navigate", { url: "http://localhost:4000" + route });
  await sleep(11000);
  const info = (await send("Runtime.evaluate", {
    expression: `JSON.stringify({theme:document.documentElement.dataset.theme,bg:getComputedStyle(document.body).backgroundColor,toggle:!!document.querySelector('.ap-nav__theme'),pressed:document.querySelector('.ap-nav__theme')?.getAttribute('aria-pressed')})`,
    returnByValue: true,
  })).result?.result?.value;
  const ok = bucket.length === 0;
  if (!ok) bad++;
  console.log(`${ok ? "✓" : "✗"} ${route.padEnd(18)} ${info}`);
  for (const b of bucket) console.log(`     ${b}`);
}

console.log(bad === 0 ? "\nNo hydration errors on any route." : `\n${bad} route(s) with problems.`);
sock.close(); edge.kill();
