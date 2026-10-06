import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { auditCiWorkflow } from "../src/wolves-without-kings/ci-contract.mjs";

const workflowPath = new URL("../.github/workflows/ci.yml", import.meta.url);

test("GitHub Actions workflow runs the repository gates with read-only permissions", async () => {
  const report = auditCiWorkflow(await readFile(workflowPath, "utf8"));
  assert.equal(report.passed, true);
  assert.deepEqual(report.findings, []);
  assert.match(report.boundary, /not production deployment/);
});

test("CI contract rejects unsafe triggers, secret dependencies, and missing gates", () => {
  const report = auditCiWorkflow("on:\n  pull_request_target:\npermissions:\n  contents: write\njobs:\n  test:\n    steps:\n      - run: npm test\n      - run: echo ${{ secrets.TOKEN }}");
  assert.equal(report.passed, false);
  assert.deepEqual(new Set(report.findings.map((finding) => finding.id)), new Set([
    "push-trigger",
    "pull-request-trigger",
    "read-only-permission",
    "checkout-action",
    "node-action",
    "node-version",
    "preview-gate",
    "verify-gate",
    "unsafe-pull-request-trigger",
    "secret-dependency",
  ]));
});

test("CI contract rejects empty workflow input", () => {
  assert.throws(() => auditCiWorkflow(""), /workflow must be a non-empty string/);
});
