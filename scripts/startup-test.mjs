/**
 * Startup smoke tests — catches init wiring bugs and missing specialty data.
 * Run: node scripts/startup-test.mjs
 * Optional live HTTP checks: node scripts/startup-test.mjs --http
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const withHttp = process.argv.includes("--http");
const baseUrl = process.env.SJC_TEST_URL || "http://localhost:8765";

let failed = 0;

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

function fail(msg) {
  console.error(`  ✗ ${msg}`);
  failed++;
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function assert(cond, msg) {
  if (cond) ok(msg);
  else fail(msg);
}

console.log("Specialty Job Compare — startup tests\n");

// --- Static wiring checks ---
const phase3 = read("phase3.js");
const indexHtml = read("index.html");
const appJs = read("app.js");
const bootstrap = read("bootstrap.js");
const phase4 = read("phase4.js");
const sw = read("sw.js");

assert(
  /const\s+_coreInit\s*=\s*window\.coreInit/.test(phase3),
  "phase3.js captures coreInit at load time (_coreInit)"
);
assert(phase3.includes("phase3PreInit"), "phase3.js exports phase3PreInit");
assert(phase3.includes("phase3PostInit"), "phase3.js exports phase3PostInit");
assert(!/window\.init\s*=\s*init/.test(phase3), "phase3.js does not overwrite window.init");

const settingsMatch = indexHtml.match(/id="settingsBtn"[^>]*>/);
assert(settingsMatch && !/\bhidden\b/.test(settingsMatch[0]), "settingsBtn is visible on home page");

const scriptOrder = ["phase2.js", "app.js", "phase1.js", "phase3.js", "phase4.js", "workflow-guide.js", "bootstrap.js"];
let lastIdx = -1;
let orderOk = true;
for (const src of scriptOrder) {
  const idx = indexHtml.indexOf(src);
  if (idx < 0 || idx <= lastIdx) orderOk = false;
  lastIdx = idx;
}
assert(orderOk, `script load order is ${scriptOrder.join(" → ")}`);
assert(indexHtml.includes("startApp()"), "index.html calls startApp() via bootstrap");

assert(bootstrap.includes("registerBootstrapStep"), "bootstrap.js defines startup pipeline");
assert(bootstrap.includes("coreInit"), "bootstrap.js runs coreInit step");
assert(bootstrap.includes("phase3PreInit"), "bootstrap.js runs phase3PreInit");
assert(bootstrap.includes("phase3PostInit"), "bootstrap.js runs phase3PostInit");

assert(appJs.includes("async function coreInit"), "app.js exports async coreInit");
assert(appJs.includes("function recurringComp"), "app.js separates sign-on from annual recurring comp");
assert(appJs.includes("function bonusUnits"), "app.js includes wRVU bonus unit math");
assert(appJs.includes("function productivityNote"), "app.js includes productivity carryforward/cap notes");
assert(phase4.includes("collectRedFlags"), "phase4.js includes red flag engine");
assert(phase4.includes("tryLoadShareView"), "phase4.js includes team read-only share loader");
assert(phase4.includes("importBenchmarkTemplate"), "phase4.js includes benchmark template import");

assert(sw.includes("sjc-v5.5.2"), "service worker cache bumped to v5.5.2");
assert(fs.existsSync(path.join(root, "data/workflow-guide.json")), "workflow-guide.json exists");
assert(fs.existsSync(path.join(root, "data/community-benchmarks.json")), "community-benchmarks.json exists");
assert(read("workflow-guide.js").includes("initWorkflowGuide"), "workflow-guide.js exports init pipeline hook");
assert(sw.includes("bootstrap.js"), "service worker caches bootstrap.js");

const monetization = JSON.parse(read("config/monetization.json"));
assert(Array.isArray(monetization.freeSpecialties) && monetization.freeSpecialties.length >= 2, "monetization config gates free specialties");
assert(monetization.limits?.freeHistoryDays === 30, "monetization config sets 30-day free history");

assert(fs.existsSync(path.join(root, "data/benchmark-templates/index.json")), "benchmark template index exists");

let specialtyCount = 0;
try {
  const index = JSON.parse(read("data/specialties/index.json"));
  specialtyCount = Object.keys(index).length;
  assert(specialtyCount >= 8, `specialty index has ${specialtyCount} specialties (expected ≥ 8)`);
  for (const key of ["pain", "peds", "anesthesia"]) {
    assert(index[key]?.name, `index entry "${key}" has a name`);
  }
} catch (err) {
  fail(`specialty index.json is valid JSON (${err.message})`);
}

for (const key of Object.keys(JSON.parse(read("data/specialties/index.json")))) {
  const file = path.join(root, "data/specialties", `${key}.json`);
  assert(fs.existsSync(file), `specialty file exists: ${key}.json`);
}

// --- Optional HTTP checks (server must be running) ---
if (withHttp) {
  console.log(`\nHTTP checks (${baseUrl})`);
  try {
    const indexRes = await fetch(`${baseUrl}/data/specialties/index.json`);
    assert(indexRes.ok, "HTTP: specialty index returns 200");
    if (indexRes.ok) {
      const data = await indexRes.json();
      assert(Object.keys(data).length >= 8, "HTTP: specialty index has ≥ 8 entries");
    }

    const bootstrapRes = await fetch(`${baseUrl}/bootstrap.js`);
    assert(bootstrapRes.ok, "HTTP: bootstrap.js is served");

    const homeRes = await fetch(`${baseUrl}/`);
    assert(homeRes.ok, "HTTP: index.html returns 200");
    if (homeRes.ok) {
      const html = await homeRes.text();
      const m = html.match(/id="settingsBtn"[^>]*>/);
      assert(m && !/\bhidden\b/.test(m[0]), "HTTP: settingsBtn not hidden in served HTML");
      assert(html.includes("startApp()"), "HTTP: served HTML uses startApp()");
    }
  } catch (err) {
    fail(`HTTP checks failed — is the server running? (${err.message})`);
    console.error("  Start with: node scripts/serve.mjs");
  }
} else {
  console.log("\nTip: run with --http for live server checks (node scripts/startup-test.mjs --http)");
}

console.log(failed ? `\n${failed} test(s) failed.` : "\nAll startup tests passed.");
process.exit(failed ? 1 : 0);
