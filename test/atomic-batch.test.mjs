import test from "node:test";
import assert from "node:assert/strict";

import {
  AtomicBatchStaleRevisionError,
  AtomicBatchValidationError,
  executeAtomicEventBatch,
} from "../src/wolves-without-kings/atomic-batch.mjs";
import {
  createInitialWorld,
  restore,
  snapshot,
} from "../src/wolves-without-kings/engine.mjs";

function proposals() {
  return [
    { eventType: "chapter.contact_opened", subjects: ["npc:broker"], payload: { result: "welcomed" } },
    { eventType: "chapter.business_noted", subjects: ["business:night-market"], payload: { condition: "watchful" } },
  ];
}

test("atomic event batches commit contiguous proposals with one batch identity", () => {
  const world = createInitialWorld({ worldId: "batch-fixture" });
  const next = executeAtomicEventBatch(world, { expectedRevision: world.revision, actorId: "character:player", proposals: proposals() });

  assert.equal(world.revision, 0);
  assert.equal(next.revision, 2);
  assert.equal(next.events[0].payload.batchId, next.events[1].payload.batchId);
  assert.deepEqual(next.events.map((event) => event.payload.batchIndex), [0, 1]);
});

test("an invalid proposal rejects the entire batch without partial mutation", () => {
  const world = createInitialWorld({ worldId: "batch-atomicity" });
  const before = structuredClone(world);
  assert.throws(
    () => executeAtomicEventBatch(world, {
      expectedRevision: world.revision,
      proposals: [...proposals(), { eventType: "invalid.payload", payload: "not-an-object" }],
    }),
    (error) => error instanceof AtomicBatchValidationError,
  );
  assert.deepEqual(world, before);
});

test("stale batches fail before any proposal is evaluated", () => {
  const world = createInitialWorld();
  assert.throws(
    () => executeAtomicEventBatch(world, { expectedRevision: 1, proposals: proposals() }),
    (error) => error instanceof AtomicBatchStaleRevisionError,
  );
  assert.equal(world.revision, 0);
});

test("atomic batch history remains save/restore compatible", () => {
  const world = createInitialWorld({ worldId: "batch-replay" });
  const next = executeAtomicEventBatch(world, { expectedRevision: world.revision, proposals: proposals() });
  assert.deepEqual(restore(snapshot(next)), next);
});
