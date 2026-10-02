// Read a client PDF without poppler: pdf.js inside headless Edge.
//
//   node scratchpad/pdf.mjs <file.pdf> <outDir> [scale=1.6]
//
// Writes <outDir>/pages/p-NN.png (each page rendered), <outDir>/text.json
// (every text run with its position — pdf.js recovers Armenian that raw
// stream extraction cannot) and <outDir>/embedded/pNN-K.png (every raster
// the PDF embeds, at NATIVE resolution, with its box on the page in
// embedded.json — the client's attached artwork is usually in there at far
// better quality than a screenshot of the page).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";

const [file, out, scaleArg] = process.argv.slice(2);
if (!file || !out) {
  console.error("usage: node pdf.mjs <file.pdf> <outDir> [scale]");
  process.exit(1);
}
const scale = Number(scaleArg || 1.6);
const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(out, "pages"), { recursive: true });
mkdirSync(join(out, "embedded"), { recursive: true });

const b = await launch({ port: 9343 });
try {
  const p = await b.page();
  await p.send("Page.navigate", { url: pathToFileURL(join(here, "pdfview.html")).href });
  for (let i = 0; i < 80; i++) {
    await sleep(250);
    if (await p.eval("typeof pdfjsLib !== 'undefined' && typeof window.openPdf === 'function'")) break;
  }
  const b64 = readFileSync(file).toString("base64");
  const n = await p.eval(`window.openPdf(${JSON.stringify(b64)})`, { timeout: 180000 });
  console.log(`${n} pages`);
  const text = {};
  const embedded = {};
  for (let i = 1; i <= n; i++) {
    const nn = String(i).padStart(2, "0");
    const r = await p.eval(`window.renderPage(${i}, ${scale})`, { timeout: 180000 });
    writeFileSync(join(out, "pages", `p-${nn}.png`), Buffer.from(r.png, "base64"));
    text[i] = await p.eval(`window.pageText(${i})`);
    const imgs = await p.eval(`window.pageImages(${i})`, { timeout: 180000 });
    embedded[i] = imgs.map((im, k) => {
      const name = `p${nn}-${k + 1}.png`;
      writeFileSync(join(out, "embedded", name), Buffer.from(im.png, "base64"));
      return { file: name, w: im.w, h: im.h, box: im.box };
    });
    console.log(`p${nn}: ${r.w}x${r.h}, ${text[i].length} text runs, ${imgs.length} images ${imgs.map((x) => x.w + "x" + x.h).join(" ")}`);
  }
  writeFileSync(join(out, "text.json"), JSON.stringify(text, null, 1));
  writeFileSync(join(out, "embedded.json"), JSON.stringify(embedded, null, 1));
} finally {
  await b.close();
}
process.exit(0);
