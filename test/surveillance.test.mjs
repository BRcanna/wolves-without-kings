import test from "node:test";
import assert from "node:assert/strict";

import {
  advanceTime,
  createInitialWorld,
  createNpc,
  interruptSurveillance,
  recordSurveillanceObservation,
  setNpcThreat,
  startSurveillance,
} from "../src/wolves-without-kings/engine.mjs";

function createObservedWorld() {
  let world = createInitialWorld({ startDate: "1998-03-01" });
  world = createNpc(world, {
    expectedRevision: world.revision,
    npcId: "npc:guard",
    displayName: "Night Guard",
    home: "loc:motel-lobby",
    occupation: "guard",
    routineBlocks: [
      { id: "lobby", label: "Lobby", locationId: "loc:motel-lobby", need: "money" },
      { id: "yard", label: "Service yard", locationId: "loc:motel-service-yard", need: "safety", threatSafe: false },
      { id: "home", label: "Home", locationId: "loc:market-street", need: "sleep" },
    ],
  });
  return world;
}

test("surveillance records information, confidence, and noncombat witness outcomes", () => {
  let world = createObservedWorld();
  world = startSurveillance(world, {
    expectedRevision: world.revision,
    surveillanceId: "surveillance:guard-01",
    observerId: "character:player",
    targetId: "npc:guard",
    locationId: "loc:motel-service-yard",
    visibility: 20,
    sound: 10,
    accessState: "public",
    entryMethod: "observation",
    timeWindowDays: 3,
  });
  world = recordSurveillanceObservation(world, {
    expectedRevision: world.revision,
    surveillanceId: "surveillance:guard-01",
    observerId: "character:player",
    knownRoutineId: "yard",
    routineConfidence: 80,
    informationGained: ["routine:yard", "location:service-yard"],
    witnessState: "uncertain",
    counterSurveillance: 15,
  });
  assert.equal(world.surveillance["surveillance:guard-01"].routineConfidence, 80);
  assert.deepEqual(world.surveillance["surveillance:guard-01"].informationGained, [
    "routine:yard",
    "location:service-yard",
  ]);
  world = setNpcThreat(world, {
    expectedRevision: world.revision,
    npcId: "npc:guard",
    threatLevel: 80,
  });
  world = advanceTime(world, { expectedRevision: world.revision, days: 4 });
  const stale = world.surveillance["surveillance:guard-01"];
  assert.equal(stale.scheduleStatus, "stale");
  assert.equal(stale.stalenessDays, 4);
  assert.equal(stale.routineConfidence, 76);
  world = interruptSurveillance(world, {
    expectedRevision: world.revision,
    surveillanceId: "surveillance:guard-01",
    observerId: "character:player",
    outcome: "withdrawn",
  });
  assert.equal(world.surveillance["surveillance:guard-01"].status, "interrupted");
  assert.equal(world.surveillance["surveillance:guard-01"].witnessState, "withdrawn");
});

test("surveillance ownership and invalid outcomes fail closed", () => {
  let world = createObservedWorld();
  world = startSurveillance(world, {
    expectedRevision: world.revision,
    surveillanceId: "surveillance:guard-02",
    observerId: "character:player",
    targetId: "npc:guard",
    locationId: "loc:motel-lobby",
  });
  const revision = world.revision;
  assert.throws(
    () => recordSurveillanceObservation(world, {
      expectedRevision: revision,
      surveillanceId: "surveillance:guard-02",
      observerId: "npc:other",
      witnessState: "noticed",
    }),
    /observer does not own/,
  );
  assert.throws(
    () => interruptSurveillance(world, {
      expectedRevision: revision,
      surveillanceId: "surveillance:guard-02",
      observerId: "character:player",
      outcome: "combat",
    }),
    /unsupported surveillance interruption/,
  );
  assert.equal(world.revision, revision);
});
