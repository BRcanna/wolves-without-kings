import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

test("renderer preview is reproducible and consumes only the public projection", () => {
  const output = execFileSync(process.execPath, ["scripts/build-preview.mjs"], { encoding: "utf8" });
  assert.match(output, /wrote web\/scenario\.json/);
  const payload = JSON.parse(readFileSync("web/scenario.json", "utf8"));
  assert.equal(payload.previewVersion, 1);
  assert.equal(payload.projection.scope, "public");
  assert.equal(Object.hasOwn(payload.projection, "beliefs"), false);
  assert.equal(Object.hasOwn(payload.projection, "surveillance"), false);
  assert.equal(Object.hasOwn(payload.projection, "cases"), false);
  assert.equal(payload.summary.date, "1999-01-01");
});

test("renderer files expose an accessible, projection-only local surface", () => {
  const html = readFileSync("web/index.html", "utf8");
  const app = readFileSync("web/app.mjs", "utf8");
  const css = readFileSync("web/styles.css", "utf8");
  assert.match(html, /<main class="shell">/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /app\.mjs/);
  assert.match(app, /fetch\("\.\/scenario\.json"/);
  assert.match(app, /textContent/);
  assert.match(css, /@media/);
});
