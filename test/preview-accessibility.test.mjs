import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { auditPreviewAccessibility } from "../src/wolves-without-kings/preview-accessibility.mjs";

const htmlPath = new URL("../web/index.html", import.meta.url);
const cssPath = new URL("../web/styles.css", import.meta.url);

test("public preview assets pass the structural accessibility contract", async () => {
  const report = auditPreviewAccessibility({ html: await readFile(htmlPath, "utf8"), css: await readFile(cssPath, "utf8") });
  assert.equal(report.passed, true);
  assert.deepEqual(report.findings, []);
  assert.match(report.boundary, /not screen-reader/);
});

test("accessibility audit catches missing language, skip navigation, live feedback, and motion safeguards", () => {
  const report = auditPreviewAccessibility({
    html: "<html><head><title>Preview</title></head><body><main><h1>Preview</h1><section aria-labelledby=\"missing\"></section></main></body></html>",
    css: ".button { color: white; }",
  });
  assert.equal(report.passed, false);
  assert.deepEqual(new Set(report.findings.map((finding) => finding.id)), new Set([
    "document-language",
    "skip-navigation",
    "main-landmark",
    "noscript-fallback",
    "live-status",
    "section-heading:missing",
    "focus-visible",
    "reduced-motion",
  ]));
});

test("accessibility audit rejects images without alternative text", () => {
  const report = auditPreviewAccessibility({
    html: "<html lang=\"en\"><head><title>Preview</title></head><body><a href=\"#main-content\">Skip</a><main id=\"main-content\"><h1>Preview</h1><noscript>Enable scripts.</noscript><div aria-live=\"polite\"></div><div aria-live=\"assertive\"></div><img src=\"map.png\"></main></body></html>",
    css: ":focus-visible { outline: 2px solid red; } @media (prefers-reduced-motion: reduce) { * { animation: none; } }",
  });
  assert.equal(report.passed, false);
  assert.deepEqual(report.findings.map((finding) => finding.id), ["image-alternative"]);
});
