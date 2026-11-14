// THE ROLLS AND HER FILE NAMES, WRITTEN APART (review O7, L8-hostile-code#6,
// 2026-11-13).
//
// lib/products.json is imported by client components — the home page, the
// cart, the shop pages — and webpack ships the whole file to every page that
// imports one, so it holds only what pages draw. Her source file names
// (`her`: the names in her Drive folders, which bookmarks.mjs, eternal.mjs
// and posters.mjs read the pictures from) went with it to every visitor,
// though at run time only /api/order reads them, for her own file number in
// her order mail. They are written to lib/sources.json instead, which only
// that route imports:
//
//   { "<roll>": { "<id>": "<her name>", "<id>/<picture>": "<her name>" } }
//
// — "<id>/back" for an Armenia Eternal card's back, "<id>/wall" for a
// poster's wall photograph. A script builds its rows with `her` as before
// (its report prints them), then saves through saveRolls.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** a roll's rows without `her` — on the row, and on any picture object the
 *  row holds — and the names taken out, keyed as above */
export function splitHer(rows) {
  const names = {};
  const bare = rows.map((row) => {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      if (k === "her") {
        names[row.id] = v;
      } else if (v && typeof v === "object" && !Array.isArray(v) && "her" in v) {
        const { her, ...rest } = v;
        names[`${row.id}/${k}`] = her;
        out[k] = rest;
      } else {
        out[k] = v;
      }
    }
    return out;
  });
  return { bare, names };
}

/** write these rolls into lib/products.json and their file names into
 *  lib/sources.json; every other roll in either file is left as it is */
export async function saveRolls(root, rolls) {
  const manifestFile = join(root, "lib", "products.json");
  const sourcesFile = join(root, "lib", "sources.json");
  const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  let sources = {};
  try {
    sources = JSON.parse(await readFile(sourcesFile, "utf8"));
  } catch {
    // the first save writes it
  }
  for (const [key, rows] of Object.entries(rolls)) {
    const { bare, names } = splitHer(rows);
    manifest[key] = bare;
    if (Object.keys(names).length) sources[key] = names;
    else delete sources[key];
  }
  await writeFile(manifestFile, JSON.stringify(manifest, null, 1) + "\n");
  await writeFile(sourcesFile, JSON.stringify(sources, null, 1) + "\n");
}
