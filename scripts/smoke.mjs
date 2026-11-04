// SMOKE TEST — does every page and API route still answer the way it should?
//
//   npm run smoke                                  (against http://localhost:4000)
//   SMOKE_BASE=http://127.0.0.1:4100 npm run smoke
//
// CI runs it against `next start` after `npm run build` (.github/workflows/
// ci.yml); locally it works against the dev server too, where the first hit on
// each route compiles it, hence the long per-request timeout.
//
// IT MUST NEVER BE ABLE TO PLACE AN ORDER. Every push to main is a production
// deploy, and a POST to the live /api/order is a real order in Arpine's inbox.
// So:
//  - a base that is not localhost / 127.0.0.1 / [::1] is REFUSED unless
//    SMOKE_ALLOW_REMOTE=1, and even then only the GETs run;
//  - the two POSTs it sends to /api/order (localhost only) are bodies the
//    route rejects before any delivery code runs: a text/plain body (415) and
//    a JSON `null` (400). Neither can become an order, with or without mail
//    configured. The other two go to /api/early, which never reads a body: it
//    only sends a form posted before the page's script started back to its
//    page (303), marked #not-sent so the form can say so — and never to
//    another site.
//
// Pages come from two places: the shop's own catalogue (lib/content.ts — every
// line, the open ones and the "available soon" ones, since both have a page)
// and, when indexing is open, every <loc> the live sitemap lists. Exit code 1
// on any mismatch, so CI fails loudly; 2 when it refuses to run.
//
// THE SECURITY HEADERS next.config.mjs PROMISES are checked too (2026-11-01),
// because a CSP that lost the Turnstile host would pass every status check
// above and still break all three forms. Most of them are sent by `next dev`
// as well, so they are checked on either server. Two are PRODUCTION-ONLY by
// design — the CSP (dev needs eval) and the day-long picture cache (dev must
// show a swapped picture on the next reload) — and on `next dev` those rows
// say "skipped", rather than failing. Which server it is: SMOKE_PROD=1 says
// production (CI sets it, so there a missing CSP always fails), SMOKE_PROD=0
// says dev; unset, the home page tells — the dev server's webpack runtime is
// /_next/static/chunks/webpack.js with no content hash in its name.
import { readdirSync, readFileSync } from "node:fs";

const BASE = (process.env.SMOKE_BASE || "http://localhost:4000").replace(/\/+$/, "");
const TIMEOUT = Number(process.env.SMOKE_TIMEOUT_MS) || 180_000;

let base;
try {
  base = new URL(BASE);
} catch {
  console.error(`smoke: SMOKE_BASE is not a URL: ${BASE}`);
  process.exit(2);
}
const LOCAL = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
if (!LOCAL && process.env.SMOKE_ALLOW_REMOTE !== "1") {
  console.error(`smoke: refusing ${base.origin} — not localhost. Set SMOKE_ALLOW_REMOTE=1 to run the GETs only.`);
  process.exit(2);
}

// THE CATALOGUE, read from source rather than imported (it is TypeScript, and
// this script needs no build step). Only lines that START with `slug:` /
// `status:` count, so a comment quoting either can never add a page.
function catalogue() {
  const src = readFileSync(new URL("../lib/content.ts", import.meta.url), "utf8");
  const start = src.indexOf("export const categories");
  const end = src.indexOf("\n];", start);
  const block = start >= 0 && end > start ? src.slice(start, end) : "";
  const slugs = [...block.matchAll(/^\s*slug:\s*"([^"]+)"/gm)].map((m) => m[1]);
  const status = [...block.matchAll(/^\s*status:\s*"([^"]+)"/gm)].map((m) => m[1]);
  if (!slugs.length || slugs.length !== status.length) {
    throw new Error(`could not read the categories from lib/content.ts (${slugs.length} slugs, ${status.length} statuses)`);
  }
  return slugs.map((slug, i) => ({ slug, status: status[i] }));
}

const noStore = (res) => ((res.headers.get("cache-control") || "").includes("no-store") ? null : "Cache-Control lacks no-store");
const json = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const checks = [];
const get = (path, expect = 200, verify, note) => checks.push({ method: "GET", path, expect, verify, note });
// a check that only a production build can pass (see the header comment)
const getProd = (path, expect, verify, note) => checks.push({ method: "GET", path, expect, verify, note, prodOnly: true });

// "dev" | "prod" | undefined (not known yet: the home page has not answered)
let mode = process.env.SMOKE_PROD === "1" ? "prod" : process.env.SMOKE_PROD === "0" ? "dev" : undefined;

// "/" also carries the site-wide header checks: they apply on dev and prod
get("/", 200, (res, text) => {
  if (!mode) mode = /\/_next\/static\/chunks\/webpack\.js\?/.test(text) ? "dev" : "prod";
  const h = (k) => res.headers.get(k) || "";
  const bad = [];
  if (h("cross-origin-opener-policy") !== "same-origin") bad.push("no COOP same-origin");
  if (res.headers.has("x-powered-by")) bad.push("X-Powered-By sent");
  if (h("x-frame-options") !== "DENY") bad.push("no X-Frame-Options DENY");
  if (h("x-content-type-options") !== "nosniff") bad.push("no X-Content-Type-Options nosniff");
  if (h("referrer-policy") !== "strict-origin-when-cross-origin") bad.push("Referrer-Policy is not strict-origin-when-cross-origin");
  const pp = h("permissions-policy").replace(/\s+/g, "");
  for (const want of ["camera=()", "microphone=()", "geolocation=(self)"]) if (!pp.includes(want)) bad.push(`Permissions-Policy lacks ${want}`);
  return bad.join("; ") || null;
});
// THE CSP, production only. Each line is something next.config.mjs promises
// and something real depends on: Cloudflare's widget needs its host in
// script-src (api.js) and frame-src (the iframe); the map's worker starts from
// a blob: URL and its tiles come from one host; nothing may frame the site.
const TURNSTILE = "https://challenges.cloudflare.com";
const TILES = "https://tiles.openfreemap.org";
getProd(
  "/",
  200,
  (res) => {
    const raw = res.headers.get("content-security-policy");
    if (!raw) return "no Content-Security-Policy header";
    const csp = new Map(
      raw
        .split(";")
        .map((d) => d.trim().split(/\s+/))
        .filter((t) => t[0])
        .map(([name, ...v]) => [name.toLowerCase(), v]),
    );
    const has = (dir, v) => (csp.get(dir) || []).includes(v);
    const bad = [];
    if (!has("default-src", "'self'")) bad.push("default-src lacks 'self'");
    if (!has("script-src", TURNSTILE)) bad.push(`script-src lacks ${TURNSTILE}`);
    if (has("script-src", "'unsafe-eval'")) bad.push("script-src allows 'unsafe-eval'");
    if (!has("frame-src", TURNSTILE)) bad.push(`frame-src lacks ${TURNSTILE}`);
    if ((csp.get("frame-ancestors") || []).join(" ") !== "'none'") bad.push("frame-ancestors is not 'none'");
    if (!has("worker-src", "blob:")) bad.push("worker-src lacks blob:");
    if (!has("connect-src", TILES)) bad.push(`connect-src lacks ${TILES}`);
    return bad.join("; ") || null;
  },
  "CSP",
);
// THE PICTURE CACHE, production only: a file in a /public folder is kept for a
// day; the PAGES that share a folder's name (/cart, /stories) must not be —
// the `:path+` trap in next.config.mjs — and that holds on either server.
const DAY = "max-age=86400";
const brand = (() => {
  try {
    return readdirSync(new URL("../public/brand", import.meta.url)).find((f) => !f.startsWith("."));
  } catch {
    return undefined;
  }
})();
if (brand) {
  getProd(
    `/brand/${brand}`,
    200,
    (res) => ((res.headers.get("cache-control") || "").includes(DAY) ? null : `Cache-Control lacks ${DAY}`),
    "picture cache",
  );
}
const notPictureCached = (res) =>
  (res.headers.get("cache-control") || "").includes(DAY) ? `a page with the pictures' ${DAY}` : null;
get("/shop");
let cats;
try {
  cats = catalogue();
} catch (e) {
  console.error(`smoke: ${e.message}`);
  process.exit(1);
}
for (const c of cats) get(`/shop/${c.slug}`, 200, null, c.status);
for (const p of ["/cart", "/about", "/stories", "/find-in-store", "/contact", "/account", "/privacy", "/terms"]) {
  get(p, 200, p === "/cart" || p === "/stories" ? notPictureCached : undefined);
}
for (const p of ["/robots.txt", "/sitemap.xml", "/manifest.webmanifest", "/opengraph-image.jpg"]) get(p);
get("/api/health", 200, (res, text) => {
  const body = json(text);
  if (!body || typeof body !== "object" || Array.isArray(body)) return "not a JSON object";
  const want = ["ok", "orders", "buyerCopy", "contact", "signIn", "turnstile"];
  const missing = want.filter((k) => !(k in body));
  // booleans ONLY — this endpoint must never echo an address or a key
  const notBool = Object.keys(body).filter((k) => typeof body[k] !== "boolean");
  return [missing.length && `missing ${missing}`, notBool.length && `non-boolean ${notBool}`, body.ok !== true && "ok!==true", noStore(res)]
    .filter(Boolean)
    .join("; ") || null;
});
get("/api/auth/me", 200, (res, text) => {
  const body = json(text);
  if (!body || typeof body !== "object" || Array.isArray(body)) return "not a JSON object";
  return noStore(res);
});
// what must NOT exist
get(`/smoke-no-such-page-${Date.now().toString(36)}`, 404);
get("/shop/no-such-line", 404);
get("/api/order", 405);
get("/api/early", 405);

// the POSTs: localhost only; the order ones rejected before any delivery code
const backTo = (want) => (res) => (res.headers.get("location") === want ? null : `Location is ${res.headers.get("location")}, not ${want}`);
const posts = [
  { path: "/api/order", expect: 415, type: "text/plain", body: "smoke test — not an order" },
  { path: "/api/order", expect: 400, type: "application/json", body: "null" },
  { path: "/api/early?to=/contact", expect: 303, type: "application/x-www-form-urlencoded", body: "hp=", verify: backTo("/contact#not-sent") },
  { path: "/api/early?to=//example.com", expect: 303, type: "application/x-www-form-urlencoded", body: "hp=", verify: backTo("/") },
];
// Its own X-Forwarded-For (a TEST-NET-3 address, RFC 5737, fresh per run) so
// the route's 6-per-10-minutes limiter counts the smoke test apart from
// whoever else is testing this server — Next keeps a client-sent value
// (`??=` in base-server) — and a rerun cannot trip into 429.
const fakeIp = `203.0.113.${1 + Math.floor(Math.random() * 254)}`;
for (const p of posts) {
  checks.push({
    method: "POST",
    path: p.path,
    expect: p.expect,
    verify: p.verify,
    note: p.type,
    skip: LOCAL ? null : "remote: POSTs never run",
    init: {
      method: "POST",
      // same-origin, as a browser on this site would send it
      headers: { "Content-Type": p.type, Origin: base.origin, "X-Forwarded-For": fakeIp },
      body: p.body,
    },
  });
}

async function run(c) {
  if (c.skip) return { ...c, got: "-", ms: 0, ok: true, detail: c.skip };
  if (c.prodOnly && mode === "dev") return { ...c, got: "-", ms: 0, ok: true, detail: "skipped: next dev (production-only)" };
  const t0 = Date.now();
  try {
    const res = await fetch(BASE + c.path, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT), ...(c.init || {}) });
    const text = await res.text();
    const ms = Date.now() - t0;
    let detail = res.status >= 300 && res.status < 400 ? `-> ${res.headers.get("location")}` : "";
    let ok = res.status === c.expect;
    if (ok && c.verify) {
      const problem = c.verify(res, text);
      if (problem) {
        ok = false;
        detail = problem;
      }
    }
    return { ...c, got: res.status, ms, ok, detail };
  } catch (e) {
    return { ...c, got: "ERR", ms: Date.now() - t0, ok: false, detail: e?.name === "TimeoutError" ? `timeout ${TIMEOUT} ms` : String(e?.cause?.code || e?.message || e) };
  }
}

const rows = [];
try {
  console.log(`smoke: ${base.origin}${LOCAL ? "" : " (remote: GETs only)"}`);
  // one at a time: the dev server compiles a route on its first hit, and other
  // people may be using it
  for (const c of checks) rows.push(await run(c));
  const how = process.env.SMOKE_PROD === "1" || process.env.SMOKE_PROD === "0" ? `SMOKE_PROD=${process.env.SMOKE_PROD}` : "detected";
  console.log(`server: ${mode === "dev" ? "next dev — production-only rows skipped" : mode === "prod" ? "production build" : "unknown (the home page did not answer)"} (${how})`);

  // anything the sitemap lists that the list above missed (empty until the
  // site is indexable — lib/site.ts)
  const sm = rows.find((r) => r.path === "/sitemap.xml");
  if (sm?.ok) {
    const xml = await (await fetch(BASE + "/sitemap.xml", { signal: AbortSignal.timeout(TIMEOUT) })).text();
    const seen = new Set(rows.map((r) => r.path));
    for (const [, loc] of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const path = new URL(loc.trim()).pathname;
      if (!seen.has(path)) {
        seen.add(path);
        rows.push(await run({ method: "GET", path, expect: 200, note: "sitemap" }));
      }
    }
  }
} catch (e) {
  console.error(`smoke: ${e?.message || e}`);
  process.exitCode = 1;
}

const w = (s, n) => String(s).padEnd(n);
const pw = Math.max(...rows.map((r) => r.path.length), 4) + 2;
console.log(`\n${w("", 6)}${w("METHOD", 8)}${w("PATH", pw)}${w("WANT", 6)}${w("GOT", 6)}${w("MS", 8)}NOTE`);
for (const r of rows) {
  const note = [r.note, r.detail].filter(Boolean).join(" · ");
  console.log(`${w(r.ok ? "ok" : "FAIL", 6)}${w(r.method, 8)}${w(r.path, pw)}${w(r.expect, 6)}${w(r.got, 6)}${w(r.ms, 8)}${note}`);
}
const failed = rows.filter((r) => !r.ok);
console.log(`\n${rows.length - failed.length}/${rows.length} passed${failed.length ? ` — ${failed.length} FAILED` : ""}`);
process.exit(failed.length || process.exitCode ? 1 : 0);
