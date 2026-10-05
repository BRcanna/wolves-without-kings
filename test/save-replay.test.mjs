import test from "node:test";
import assert from "node:assert/strict";

import {
  advanceTime,
  changeDistrictCondition,
  createInitialWorld,
  recordEvent,
} from "../src/wolves-without-kings/engine.mjs";
import {
  SaveReplayValidationError,
  branchCounterfactual,
  createSaveBundle,
  migrateSaveBundle,
  replayFromCheckpoint,
  restoreSaveBundle,
} from "../src/wolves-without-kings/save-replay.mjs";

function buildWorld() {
  let world = createInitialWorld({ worldId: "save-replay-fixture" });
  world = recordEvent(world, {
    expectedRevision: world.revision,
    eventType: "fixture.chapter_started",
    actors: ["character:player"],
    location: "sofia-south",
    payload: { chapter: "first-watch" },
  });
  return world;
}

test("versioned save bundles restore with metadata and history intact", () => {
  const world = buildWorld();
  const bundle = createSaveBundle(world, { checkpointId: "checkpoint:year-zero" });

  assert.equal(bundle.saveReplaySchemaVersion, 1);
  assert.deepEqual(restoreSaveBundle(bundle), world);
  assert.equal(bundle.eventCount, 1);
});

test("legacy save migration preserves the canonical event history", () => {
  const world = buildWorld();
  const migrated = migrateSaveBundle({
    saveReplaySchemaVersion: 0,
    checkpointId: "checkpoint:legacy",
    world,
  });

  assert.equal(migrated.saveReplaySchemaVersion, 1);
  assert.deepEqual(restoreSaveBundle(migrated), world);
  assert.equal(migrated.checkpointId, "checkpoint:legacy");
});

test("checkpoint replay matches direct accelerated time settlement", () => {
  const checkpoint = createSaveBundle(buildWorld(), { checkpointId: "checkpoint:five-year-start" });
  const replayed = replayFromCheckpoint(checkpoint, { days: 365 * 5 });

  const direct = advanceTime(restoreSaveBundle(checkpoint), {
    expectedRevision: 1,
    days: 365 * 5,
    actorId: "system:replay",
  });

  assert.deepEqual(restoreSaveBundle(replayed), direct);
  assert.equal(replayed.checkpointId, "checkpoint:five-year-start:replay-1825d");
});

test("counterfactual branches cannot overwrite the canonical checkpoint", () => {
  const checkpoint = createSaveBundle(buildWorld(), { checkpointId: "checkpoint:branch-base" });
  const canonicalDigest = checkpoint.digest;
  const result = branchCounterfactual(
    checkpoint,
    (world) => changeDistrictCondition(world, {
      expectedRevision: world.revision,
      condition: "watchful",
      actorId: "system:counterfactual",
    }),
  );

  assert.equal(result.canonicalDigest, canonicalDigest);
  assert.equal(restoreSaveBundle(checkpoint).district.condition, "stable");
  assert.equal(restoreSaveBundle(result.branch).district.condition, "watchful");
  assert.throws(
    () => restoreSaveBundle({ ...checkpoint, digest: "tampered" }),
    (error) => error instanceof SaveReplayValidationError,
  );
});
