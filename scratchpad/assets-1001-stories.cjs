// STUDIO STORIES — the 2026-10-01 brief (change 3.pdf, p9 + p11).
//
// p9: «Խառնվել են նկարները… խնդրում եմ նորից ըստ պապկաների ստուգես» — the
// pictures were mixed up between stories, check them again BY HER FOLDERS.
// The 09-21 set was built from pictures pasted into a chat and placed by
// what was in them; this one is built from her Drive folders themselves
// (imgss/redesign-2026-10-01/drive/<dir>/, one folder per story), so a
// picture can only land in the story whose folder it came from. The order
// inside a folder is the brief's (SPEC.md, the table under P9/P11): the lead
// first.
//
//   node scratchpad/assets-1001-stories.cjs            (from the repo root)
//   node scratchpad/assets-1001-stories.cjs --films    (re-encode the films too)
//
// Writes public/stories/s-<id>.webp (1600 inside, q82) + s-<id>-sm.webp (720
// inside, q80) — the same sizes, format and quality as assets-0921.cjs —
// regenerates lib/stories.json in the same schema (id, src, thumb, w, h,
// avg; every number read off the written file, never typed), removes the
// s-*.webp files nothing lists any more, and encodes the two new films the
// way the two existing ones were (960×540 H.264, AAC kept, faststart).
const sharp = require("sharp");
const fs = require("fs");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const ROOT = "C:/Users/ysaha/Desktop/arPage";
const DRIVE = `${ROOT}/imgss/redesign-2026-10-01/drive`;
const OUT = `${ROOT}/public/stories`;
const hex = (v) => Math.round(v).toString(16).padStart(2, "0");
const avgOf = async (file) => {
  const s = await sharp(file).stats();
  const [r, g, b] = s.channels;
  return "#" + hex(r.mean) + hex(g.mean) + hex(b.mean);
};
const sha = (file) => crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex");

// story id (lib/content.ts) → her folder → [picture id, file], lead first.
// `shared-*` are the two files her folders repeat: 01.jpg and 1u.jpg sit in
// BOTH the union folder and the first-solo folder, byte for byte (checked
// below, not assumed) — stored once, listed by both stories.
const STORIES = [
  ["tales-2026", "p2-tales", [["tales-3844", "IMG_3844.png"], ["tales-mockup-5", "book-mockup-5.jpg"], ["tales-a5-02", "A5-02.jpg"], ["tales-a5-06", "A5-06.jpg"]]],
  ["vardavar-2026", "p2-vardavar", [["vardavar-mockup-4", "book-mockup-4.jpg"], ["vardavar-mockup-5", "book-mockup-5.jpg"], ["vardavar-7452", "IMG_7452.png"]]],
  ["wishes-2025", "p2-newyear", [["wishes-mockup-13", "mag-mockup-13.jpg"], ["wishes-mockup-01", "mag-mockup-01.jpg"], ["wishes-mockup-07", "mag-mockup-07.jpg"]]],
  // the Dilijan photograph leads — «հիմնական նկարն էլ դիլիջանի ֆոտոն դնենք»
  ["dilijan-2025", "dilijan", [["dilijan-lzav", "lzav.jpg"], ["dilijan-poster", "exibition-2025-03.jpg"], ["dilijan-20230505", "20230505_142715.jpg"], ["dilijan-9201", "IMG_9201.jpg"], ["dilijan-02", "02.jpg"], ["dilijan-vvv", "vvv.jpg"]]],
  ["media-m-2025", "interview", [["interview-7131", "IMG_7131.jpeg"]]],
  // the eye pieces live ONLY here — «Աչքի նկարները ստեղ պետք ա լինեին»
  ["akn-eye", "akn", [["akn-photo-01", "akn-photo-01.jpg"], ["akn-final-03", "akn-final-03.png"], ["akn-final-05", "akn-final-05.png"], ["akn-final-06", "akn-final-06.png"]]],
  ["music-2024", "p2-clips", [["music-5659", "IMG_5659.png"], ["music-monument", "monument.jpg"]]],
  ["tsarapatum-2024", "tsarapatum", [["tsarapatum-6483", "IMG_6483.jpg"], ["tsarapatum-6979", "IMG_6979.jpeg"], ["tsarapatum-7108", "IMG_7108.jpeg"], ["tsarapatum-a", "a.jpg"], ["tsarapatum-b", "b.jpg"], ["tsarapatum-c", "c.jpg"], ["tsarapatum-d", "d.jpg"], ["tsarapatum-demq", "demq.jpg"], ["tsarapatum-7151", "IMG_7151.jpeg"], ["tsarapatum-7154", "IMG_7154.jpeg"], ["tsarapatum-7155", "IMG_7155.jpeg"], ["tsarapatum-7156", "IMG_7156.jpeg"], ["tsarapatum-7157", "IMG_7157.jpeg"]]],
  ["artists-union-2023", "union", [["union-building", "union-building.jfif"], ["union-b148952023", "b148952023.jpg"], ["union-6503", "IMG_6503.jpg"], ["shared-01", "01.jpg"], ["shared-1u", "1u.jpg"], ["union-9745", "IMG_9745.jpg"]]],
  ["first-solo-2022", "first", [["first-poster", "poster-a3.jpg"], ["first-dsc06834", "DSC06834.jpg"], ["first-dsc06735", "DSC06735.jpg"], ["first-mg-0025", "MG_0025.jpg"], ["first-mg-0760", "MG_0760.jpg"], ["first-net-002", "net_002.jpg"], ["shared-01", "01.jpg"], ["shared-1u", "1u.jpg"]]],
];

// the two new films (p11): [source, output name, poster second, crf]
//   · agbu — the 252 s feature (1080p) → the size the two existing features
//     have; it is speech, so the sound is kept
//   · music — a 6.4 s animated illustration from the project, 22 Mbit at the
//     source. A drawing with flat colour shows banding sooner than camera
//     footage, and six seconds cost nothing, so it gets a gentler crf.
const FILMS = [
  [`${DRIVE}/p2-agbu/agbu-youtube-1080p.mp4`, "film-agbu", 224, 28],
  [`${DRIVE}/p2-clips/rend-1-trim.mp4`, "film-music", 3, 24],
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  // ---- 1. the pictures ------------------------------------------------------
  const done = new Map(); // id → { hash, entry }
  const manifest = [];
  for (const [story, dir, pics] of STORIES) {
    for (const [id, file] of pics) {
      const src = `${DRIVE}/${dir}/${file}`;
      const hash = sha(src);
      const seen = done.get(id);
      if (seen) {
        // an id listed twice must be the SAME file in both folders
        if (seen !== hash) throw new Error(`${id}: ${dir}/${file} differs from the copy already processed`);
        console.log(`${story}: ${id} — same file as before, stored once`);
        continue;
      }
      done.set(id, hash);
      // limitInputPixels off: akn-photo-01.jpg is 11330×14173 (44 MB).
      // .rotate() with no angle applies the EXIF orientation (DSC06735 is
      // stored on its side); flatten puts the eye renders' soft alpha on the
      // same near-black the 09-21 set used.
      const base = sharp(src, { limitInputPixels: false }).rotate().flatten({ background: "#0d0d0f" });
      const big = await base.clone().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toFile(`${OUT}/s-${id}.webp`);
      const sm = await base.clone().resize({ width: 720, height: 720, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toFile(`${OUT}/s-${id}-sm.webp`);
      const avg = await avgOf(`${OUT}/s-${id}-sm.webp`);
      manifest.push({ id, src: `/stories/s-${id}.webp`, thumb: `/stories/s-${id}-sm.webp`, w: big.width, h: big.height, avg });
      console.log(`${story}: ${id} ← ${dir}/${file}  ${big.width}x${big.height} ${(big.size / 1024).toFixed(0)} KB / sm ${sm.width}x${sm.height} ${(sm.size / 1024).toFixed(0)} KB ${avg}`);
    }
  }
  fs.writeFileSync(`${ROOT}/lib/stories.json`, JSON.stringify(manifest, null, 1) + "\n");

  // ---- 2. what nothing lists any more goes ----------------------------------
  const keep = new Set(manifest.flatMap((m) => [`s-${m.id}.webp`, `s-${m.id}-sm.webp`]));
  for (const f of fs.readdirSync(OUT)) {
    if (/^s-.*\.webp$/.test(f) && !keep.has(f)) {
      fs.unlinkSync(`${OUT}/${f}`);
      console.log(`removed ${f}`);
    }
  }

  // ---- 3. the films ---------------------------------------------------------
  for (const [src, out, poster, crf] of FILMS) {
    const mp4 = `${OUT}/${out}.mp4`;
    if (!fs.existsSync(mp4) || process.argv.includes("--films")) {
      execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src, "-vf", "scale=960:540:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", String(crf), "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-ac", "2", "-movflags", "+faststart", mp4]);
      execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(poster), "-i", src, "-frames:v", "1", "-vf", "scale=960:540:flags=lanczos", "-c:v", "libwebp", "-quality", "78", `${OUT}/${out}.webp`]);
    }
    console.log(`${out}.mp4 ${(fs.statSync(mp4).size / 1048576).toFixed(1)} MB`);
  }

  // ---- 4. what lib/content.ts should list, to check it against --------------
  console.log("\nphotos per story (lead first):");
  for (const [story, , pics] of STORIES) console.log(`  ${story}: ${JSON.stringify(pics.map((p) => p[0]))}`);
  const content = fs.readFileSync(`${ROOT}/lib/content.ts`, "utf8");
  const missing = manifest.filter((m) => !content.includes(`"${m.id}"`)).map((m) => m.id);
  console.log(missing.length ? `\nNOT listed in lib/content.ts yet: ${missing.join(", ")}` : "\nevery picture is listed in lib/content.ts");
})();
