import { execFileSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

test("demo runs the authored vertical slice through the integrated runtime bundle", () => {
  const output = execFileSync(process.execPath, ["src/wolves-without-kings/demo.mjs"], { encoding: "utf8" });
  const result = JSON.parse(output);
  assert.equal(result.demoVersion, 2);
  assert.equal(result.world.lastEventType, "organization.work_claimed");
  assert.equal(result.content.counts.npcs, 30);
  assert.equal(result.scenario.resolutions[0].branch, "delegate");
  assert.equal(result.publicProjectionScope, "public");
  assert.equal(result.runtimeBundleRestored, true);
});
