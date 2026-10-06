import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const ledger = readFileSync(resolve(root, "docs/SCENARIO_ACCEPTANCE.md"), "utf8");

test("all supplied scenario traces have source and executable evidence", () => {
  const rows = [...ledger.matchAll(/^\| (Scenario Trace \d+[^|]*) \| `([^`]+)` \| ([^|]+) \| PASS \|$/gm)];
  assert.equal(rows.length, 10);
  for (const [, , source, evidence] of rows) {
    assert.equal(existsSync(resolve(root, source)), true, `missing scenario source: ${source}`);
    const testFiles = [...evidence.matchAll(/`([^`]+\.test\.mjs)`/g)].map((match) => match[1]);
    assert.ok(testFiles.length > 0);
    for (const testFile of testFiles) {
      const path = resolve(root, "test", testFile);
      assert.equal(existsSync(path), true, `missing scenario evidence: ${testFile}`);
      assert.match(readFileSync(path, "utf8"), /test\(/);
    }
  }
});
