// Does the shop actually take an order? Clicks Add to cart on a product page,
// then follows the cart across a full page load — and looks at the three odd
// things the first pass turned up on /cart: an empty basket after a successful
// click, seven bare ֏ signs with no number, and "chosen" rendering as "cho en".
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 9520;
const profile = mkdtempSync(join(tmpdir(), "cart-"));
const edge = spawn("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--window-size=1440,950", "--no-first-run", "--use-gl=swiftshader", "about:blank",
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
let id = 0; const waiting = new Map(); const errs = [];
sock.onmessage = (m) => {
  const x = JSON.parse(m.data);
  if (x.id && waiting.has(x.id)) { waiting.get(x.id)(x); waiting.delete(x.id); return; }
  if (x.method === "Runtime.consoleAPICalled" && x.params.type === "error") errs.push(x.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 140));
  if (x.method === "Runtime.exceptionThrown") errs.push("THREW " + (x.params.exceptionDetails.exception?.description ?? "").slice(0, 140));
};
const send = (method, params = {}) => new Promise((res) => { const n = ++id; waiting.set(n, res); sock.send(JSON.stringify({ id: n, method, params })); });
const ev = async (e) => {
  const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return "EVAL-THREW " + r.result.exceptionDetails.exception?.description?.slice(0, 200);
  return r.result?.result?.value;
};
await send("Page.enable"); await send("Runtime.enable");

const badge = `(() => {
  const a = document.querySelector('a[href="/cart"]');
  return a ? a.innerText.replace(/\\s+/g, " ").trim() : "NO CART LINK";
})()`;

console.log("=== add to cart, from /shop/postcards ===");
await send("Page.navigate", { url: "http://localhost:4010/shop/postcards" });
await sleep(11000);
console.log("badge before      :", await ev(badge));
console.log("click             :", await ev(`(() => {
  const b = [...document.querySelectorAll("button")].find(x => /add to cart/i.test(x.textContent));
  if (!b) return "NO BUTTON";
  b.click();
  return "clicked";
})()`));
await sleep(2500);
console.log("badge after       :", await ev(badge));
console.log("storage after     :", await ev(`JSON.stringify({
  local: Object.fromEntries(Object.entries(localStorage).map(([k, v]) => [k, String(v).slice(0, 120)])),
  session: Object.keys(sessionStorage),
  cookie: document.cookie.slice(0, 120)
})`));

console.log("\n=== same tab, SOFT nav to /cart (client-side link) ===");
console.log("soft nav          :", await ev(`(() => {
  const a = document.querySelector('a[href="/cart"]');
  if (!a) return "NO LINK"; a.click(); return "clicked cart link";
})()`));
await sleep(6000);
console.log("url               :", await ev("location.pathname"));
console.log("badge on cart     :", await ev(badge));
console.log("cart contents     :", await ev(`(() => {
  const t = document.body.innerText.replace(/\\s+/g, " ");
  return JSON.stringify({ empty: /nothing cho/i.test(t), text: t.slice(0, 200) });
})()`));

console.log("\n=== HARD reload of /cart ===");
await send("Page.navigate", { url: "http://localhost:4010/cart" });
await sleep(8000);
console.log("badge             :", await ev(badge));
console.log("cart contents     :", await ev(`(() => {
  const t = document.body.innerText.replace(/\\s+/g, " ");
  return JSON.stringify({ empty: /nothing cho/i.test(t), text: t.slice(0, 200) });
})()`));

console.log("\n=== the seven bare ֏ signs ===");
console.log(await ev(`(() => {
  const hits = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walk.nextNode());) {
    if (!n.textContent.includes("\\u058F")) continue;
    const el = n.parentElement;
    const r = el.getBoundingClientRect();
    hits.push({
      text: JSON.stringify(n.textContent.slice(0, 24)),
      el: el.tagName + "." + (el.className || "").toString().split(" ")[0],
      parent: el.parentElement?.tagName + "." + (el.parentElement?.className || "").toString().split(" ")[0],
      box: [Math.round(r.width), Math.round(r.height)],
      vis: getComputedStyle(el).visibility + "/" + getComputedStyle(el).display
    });
  }
  return JSON.stringify(hits, null, 1);
})()`));

console.log("\n=== 'cho en' — is a character missing? ===");
console.log(await ev(`(() => {
  const el = [...document.querySelectorAll("*")].find(e => e.children.length === 0 && /nothing cho/i.test(e.textContent));
  if (!el) return "not found";
  return JSON.stringify({
    tag: el.tagName + "." + (el.className || "").toString().split(" ")[0],
    textContent: el.textContent,
    innerText: el.innerText,
    html: el.innerHTML.slice(0, 300)
  }, null, 1);
})()`));

console.log("\nconsole errors    :", errs.length ? errs : "none");
const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("scratchpad/chk-cart.png", Buffer.from(shot.result.data, "base64"));
sock.close(); edge.kill();
