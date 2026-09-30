// Runtime smoke test for the production build.
//
// Loads the REAL dist/ bundle (from `npm run build`) into a jsdom
// document and confirms it mounts to #root and renders real content —
// this catches runtime errors (bad hook usage, undefined references,
// broken imports across files) that a syntax-only or bundler-only check
// cannot, because it actually executes the app's JavaScript.
//
// This is NOT a substitute for real browser/E2E testing — no user
// interaction is simulated, no effect timing or network calls are
// exercised (the API layer will fail quietly since there's no backend
// running here, which is fine: we're only checking that the initial
// render — the login screen — mounts without throwing).
//
// Run with: npm run build && npm run smoke-test
import { JSDOM } from "jsdom";
import { readFileSync, readdirSync } from "fs";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: "http://localhost/",
  runScripts: "dangerously",
  // Deliberately NOT loading external resources (fonts, etc.) — this
  // test only checks that the app's JS mounts and renders real content,
  // not that its stylesheet fetches succeed in a sandboxed environment.
});

global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(global, "navigator", { value: dom.window.navigator, configurable: true });
global.localStorage = {
  _store: {},
  getItem(k) {
    return this._store[k] ?? null;
  },
  setItem(k, v) {
    this._store[k] = String(v);
  },
  removeItem(k) {
    delete this._store[k];
  },
};

let caughtError = null;
dom.window.addEventListener("error", (e) => {
  caughtError = e.error || e.message;
});

const assetsDir = new URL("../dist/assets/", import.meta.url);
const assetFile = readdirSync(assetsDir).find((f) => f.endsWith(".js"));
if (!assetFile) {
  console.error("SMOKE TEST FAILED — no built JS bundle found. Run `npm run build` first.");
  process.exit(1);
}
const code = readFileSync(new URL(assetFile, assetsDir), "utf-8");

// Vite's default build output for a single-entry app with no dynamic
// imports is a plain IIFE, not real ESM — a classic (non-module) script
// tag executes it correctly under jsdom.
const script = dom.window.document.createElement("script");
script.textContent = code;
dom.window.document.head.appendChild(script);

// Give React's initial commit a moment to run.
await new Promise((r) => setTimeout(r, 300));

const rootHtml = dom.window.document.getElementById("root")?.innerHTML || "";

if (caughtError) {
  console.error("SMOKE TEST FAILED — runtime error:", caughtError);
  process.exit(1);
}

if (!rootHtml.trim()) {
  console.error("SMOKE TEST FAILED — #root is empty after mount, nothing rendered.");
  process.exit(1);
}

const expectations = [
  ["'Sign in' button text", rootHtml.includes("Sign in")],
  ["'Consult' branding", rootHtml.includes("Consult")],
  ["a real <input> element", rootHtml.includes("<input")],
];
const failed = expectations.filter(([, ok]) => !ok);

if (failed.length > 0) {
  console.error("SMOKE TEST FAILED — rendered, but missing expected content:", failed.map(([name]) => name));
  process.exit(1);
}

console.log("SMOKE TEST PASSED — app mounted and rendered the login screen for real.");
console.log(`  Rendered ${rootHtml.length} chars into #root; all expected content present.`);
