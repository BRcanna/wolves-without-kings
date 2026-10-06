import test from "node:test";
import assert from "node:assert/strict";

import { assertRegionalContentMatchesRuntime, buildRegionalContentPack, admitRegionalContentPack } from "../src/wolves-without-kings/regional-content-pack.mjs";
import { createRegionalRuntime } from "../src/wolves-without-kings/regional-runtime.mjs";

test("regional content pack admits ordinary-life roles and aligns with four-region runtime identities", () => {
  const runtime = createRegionalRuntime();
  const pack = buildRegionalContentPack();
  assert.deepEqual(assertRegionalContentMatchesRuntime(pack, runtime), {
    regions: 4,
    npcs: 12,
    businesses: 4,
    organizations: 2,
    locations: 8,
    routes: 4,
    scheduleTemplates: 12,
  });
  assert.match(pack.safetyBoundary, /fictionalized/);
  assert.doesNotMatch(pack.safetyBoundary, /step-by-step|recipe|evasion/i);
  assert.ok(pack.npcs.some((npc) => npc.occupation === "teacher"));
  assert.ok(pack.npcs.some((npc) => npc.occupation === "nurse"));
  assert.equal(admitRegionalContentPack().projection.counts.locations, 8);
});
