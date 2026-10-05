import test from "node:test";
import assert from "node:assert/strict";

import { restore, snapshot } from "../src/wolves-without-kings/engine.mjs";
import { runVerticalHistory } from "../src/wolves-without-kings/vertical-slice.mjs";

test("three different player histories reach the year-one vertical-slice endpoint", () => {
  const histories = ["relationship", "organization", "quiet"].map(runVerticalHistory);
  for (const { summary } of histories) {
    assert.equal(summary.date, "1999-01-01");
    assert.equal(summary.npcCount, 30);
    assert.equal(summary.businessCount, 3);
    assert.equal(summary.organizationCount, 2);
    assert.equal(summary.caseCount, 1);
    assert.equal(summary.marketCount, 1);
    assert.equal(summary.playerRelationships, 8);
    assert.equal(summary.caseStage, "cold");
    assert.ok(summary.eventCount > 50);
  }
  assert.equal(histories[0].summary.vehicleOwner, "character:player");
  assert.equal(histories[1].summary.vehicleOwner, "npc:resident-04");
  assert.equal(histories[2].summary.vehicleOwner, "character:player");
  assert.notEqual(histories[0].summary.eventCount, histories[1].summary.eventCount);
});

test("vertical-slice history remains replayable after a full year", () => {
  const { world } = runVerticalHistory("organization");
  assert.deepEqual(restore(snapshot(world)), world);
  assert.equal(world.businesses["business:night-market"].ageDays, 365);
  assert.equal(world.businesses["business:night-market"].operatingMonths, 12);
  assert.equal(world.relationships["character:player|npc:resident-01"].relationshipAgeDays, 365);
  assert.equal(world.npcLife["npc:resident-01"].lifeDays, 365);
});
