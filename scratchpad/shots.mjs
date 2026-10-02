// Headless-Edge captures with facts — the verification harness.
//
//   node scratchpad/shots.mjs <specs.json> [outDir]
//
// specs.json: [{ name, url, w, h, settle?, pre?, wait?, facts?, crop?, dark?, full? }]
//   pre    — JS run in the page after `settle` ms (async body; `await` works)
//   wait   — ms after pre
//   facts  — JS function body returning a JSON value; printed as `name: {...}`
//   crop   — [x, y, w, h] written as <name>-crop.png next to the full capture
//   dark   — emulate prefers-color-scheme: dark
//   full   — capture the whole document height instead of the viewport
// The dev server recompiles on the first request after an edit: a capture in
// that window loads a page that never hydrates — rerun if facts look empty.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { launch, sleep } from "./cdp.mjs";

const [specFile, outArg] = process.argv.slice(2);
if (!specFile) {
  console.error("usage: node shots.mjs <specs.json> [outDir]");
  process.exit(1);
}
const specs = JSON.parse(readFileSync(specFile, "utf8"));
const out = resolve(outArg || join(dirname(resolve(specFile)), "shots"));
mkdirSync(out, { recursive: true });
const require = createRequire(import.meta.url);
let sharp = null;
try {
  sharp = require("sharp");
} catch {}

const b = await launch({ port: Number(process.env.SHOTS_PORT || 9345) });
let code = 0;
try {
  const p = await b.page();
  for (const s of specs) {
    try {
      await p.send("Emulation.setDeviceMetricsOverride", { width: s.w, height: s.h, deviceScaleFactor: s.dpr || 1, mobile: false });
      await p.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: s.dark ? "dark" : "light" }] });
      await p.send("Page.navigate", { url: "about:blank" });
      await sleep(150);
      await p.send("Page.navigate", { url: s.url });
      await sleep(s.settle ?? 5000);
      if (s.pre) await p.eval(s.pre, { fn: true, timeout: 120000 });
      if (s.wait) await sleep(s.wait);
      if (s.facts) {
        try {
          const f = await p.eval(s.facts, { fn: true });
          console.log(`${s.name}: ${JSON.stringify(f)}`);
        } catch (e) {
          console.log(`${s.name}: facts error ${String(e.message).split("\n")[0]}`);
        }
      }
      let params = { format: "png" };
      if (s.full) {
        const h = await p.eval("Math.ceil(document.documentElement.scrollHeight)");
        params = { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: s.w, height: Math.min(h, 16000), scale: 1 } };
      }
      const shot = await p.send("Page.captureScreenshot", params, 120000);
      const file = join(out, `${s.name}.png`);
      writeFileSync(file, Buffer.from(shot.data, "base64"));
      if (s.crop && sharp) {
        const [x, y, w, h] = s.crop;
        await sharp(file).extract({ left: x, top: y, width: w, height: h }).toFile(join(out, `${s.name}-crop.png`));
      }
      console.log(`${s.name}: saved`);
    } catch (e) {
      code = 1;
      console.log(`${s.name}: FAILED ${String(e.message).split("\n")[0]}`);
    }
  }
} finally {
  await b.close();
}
process.exit(code);
