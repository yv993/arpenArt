// A minimal Chrome DevTools Protocol client over headless Edge — no deps
// (Node 22 has WebSocket and fetch). Shared by pdf.mjs and shots.mjs.
//
//   const b = await launch({ port: 9341 });           // starts Edge, headless
//   const p = await b.page();                          // a page target
//   await p.send("Page.navigate", { url });
//   const v = await p.eval("document.title");          // awaits promises, returns by value
//   await b.close();
//
// Every send() is wrapped in a timeout: a dead browser otherwise hangs the
// socket forever (cost a run on 2026-09-22).
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** every msedge.exe started on this run's profile folder — the launcher's
 *  pid is not enough: under Git Bash the browser outlives it under another
 *  pid, and on 2026-10-01 sixty such leftovers (7.9 GB of profiles, 360
 *  processes) filled drive C: and stopped a whole verification run */
function killProfile(dir) {
  const name = dir.split(/[\\/]/).pop();
  try {
    spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*${name}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
      ],
      { stdio: "ignore" },
    );
  } catch {}
}

export async function launch({ port = 9341, args = [] } = {}) {
  // a port that already answers is somebody else's browser: attaching to it
  // drives THEIR page (two agents on one port captured each other's routes)
  let taken = false;
  try {
    taken = (await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(800) })).ok;
  } catch {}
  if (taken) throw new Error(`port ${port} already has a browser on it — pick another (SHOTS_PORT)`);
  const dir = mkdtempSync(join(tmpdir(), "cdp-"));
  const proc = spawn(
    EDGE,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${dir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      "--mute-audio",
      "--autoplay-policy=no-user-gesture-required",
      ...args,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let list = null;
  for (let i = 0; i < 60 && !list; i++) {
    await sleep(250);
    try {
      list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    } catch {}
  }
  if (!list) throw new Error("Edge did not open its debugging port " + port);

  const attach = async (wsUrl) => {
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.addEventListener("open", res, { once: true });
      ws.addEventListener("error", rej, { once: true });
    });
    let id = 0;
    const pending = new Map();
    const listeners = new Set();
    ws.addEventListener("message", (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) {
        const { res, rej, t } = pending.get(m.id);
        clearTimeout(t);
        pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      } else if (m.method) for (const l of listeners) l(m);
    });
    const send = (method, params = {}, timeout = 60000) =>
      new Promise((res, rej) => {
        const n = ++id;
        const t = setTimeout(() => {
          pending.delete(n);
          rej(new Error(`CDP ${method} timed out`));
        }, timeout);
        pending.set(n, { res, rej, t });
        ws.send(JSON.stringify({ id: n, method, params }));
      });
    /** evaluate an expression (or the body of an async function when `fn`
     *  is true) and return its value */
    const evaluate = async (expression, { fn = false, timeout = 120000 } = {}) => {
      const r = await send(
        "Runtime.evaluate",
        { expression: fn ? `(async()=>{${expression}})()` : expression, awaitPromise: true, returnByValue: true },
        timeout,
      );
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    };
    return { send, eval: evaluate, on: (l) => (listeners.add(l), () => listeners.delete(l)), close: () => ws.close() };
  };

  return {
    port,
    page: async () => {
      const t = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((x) => x.type === "page");
      const p = await attach(t.webSocketDebuggerUrl);
      await p.send("Page.enable");
      await p.send("Runtime.enable");
      return p;
    },
    close: async () => {
      // the WHOLE tree: Edge leaves renderer/gpu children behind a plain
      // kill, and they keep node's event loop — and the port — alive
      try {
        spawnSync("taskkill", ["/PID", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
      } catch {}
      try {
        proc.kill();
      } catch {}
      killProfile(dir);
      // the profile stays locked for a moment after the kill; a swallowed
      // first failure is how 72 MB a run was left behind
      for (let i = 0; i < 6; i++) {
        await sleep(400);
        try {
          rmSync(dir, { recursive: true, force: true });
          break;
        } catch {}
      }
    },
  };
}
export { sleep };
