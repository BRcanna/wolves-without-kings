import { execFileSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

test("docuseries verification binds repository evidence and records open gates", () => {
  const output = execFileSync(process.execPath, ["scripts/verify-docuseries.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.match(output, /docuseries-verify: PASS/);
  assert.match(output, /preview-scope=public/);
  assert.match(output, /scenario-traces=10/);
  assert.match(output, /external-gates=recorded-open/);
});
