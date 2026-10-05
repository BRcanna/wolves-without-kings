import test from "node:test";
import assert from "node:assert/strict";

import {
  InvalidCommandError,
  StaleRevisionError,
  advanceTime,
  changeDistrictCondition,
  createInitialWorld,
  recordEvent,
  restore,
  snapshot,
} from "../src/wolves-without-kings/engine.mjs";

function buildTrace() {
  let world = createInitialWorld({ startDate: "1998-01-01" });
  world = changeDistrictCondition(world, {
    expectedRevision: world.revision,
    condition: "watchful",
    actorId: "npc:district-steward",
  });
  world = recordEvent(world, {
    expectedRevision: world.revision,
    eventType: "social.first_contact",
    actors: ["character:player", "npc:broker-01"],
    subjects: ["business:night-market"],
    location: "sofia-south",
    payload: { outcome: "invitation", trust: "uncertain" },
  });
  return advanceTime(world, { expectedRevision: world.revision, days: 30 });
}

test("commits canonical events with contiguous revisions and a hash chain", () => {
  const world = buildTrace();

  assert.equal(world.revision, 3);
  assert.equal(world.events.length, 3);
  assert.deepEqual(world.events.map((event) => event.eventId), ["evt-000001", "evt-000002", "evt-000003"]);
  assert.equal(world.events[1].previousHash, world.events[0].hash);
  assert.equal(world.events[2].previousHash, world.events[1].hash);
  assert.equal(world.date, "1998-01-31");
  assert.equal(world.tick, 30);
});

test("rejects stale proposals without mutating the authoritative world", () => {
  const world = createInitialWorld();
  const before = structuredClone(world);

  assert.throws(
    () => recordEvent(world, {
      expectedRevision: 1,
      eventType: "social.stale_attempt",
    }),
    (error) => error instanceof StaleRevisionError,
  );
  assert.deepEqual(world, before);
});

test("save and restore rebuild the same world from the event history", () => {
  const world = buildTrace();
  const restored = restore(snapshot(world));

  assert.deepEqual(restored, world);
});

test("tampered event history is rejected during restore", () => {
  const saved = snapshot(buildTrace());
  saved.world.events[1].payload.outcome = "fabricated";

  assert.throws(
    () => restore(saved),
    (error) => error instanceof InvalidCommandError && /invalid hash/.test(error.message),
  );
});

test("time advance is transactional and validates positive whole days", () => {
  const world = createInitialWorld();
  assert.throws(
    () => advanceTime(world, { expectedRevision: world.revision, days: 0 }),
    (error) => error instanceof InvalidCommandError,
  );
  assert.deepEqual(world, createInitialWorld());
});
