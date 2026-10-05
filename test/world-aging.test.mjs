import test from "node:test";
import assert from "node:assert/strict";

import {
  WorldAgingStaleRevisionError,
  WorldAgingValidationError,
  createAgingPlace,
  createWorldAgingState,
  projectWorldAging,
  recordPlaceMemory,
  restoreWorldAging,
  settleWorldTime,
  snapshotWorldAging,
} from "../src/wolves-without-kings/world-aging.mjs";

function worldState() {
  let state = createWorldAgingState({ worldId: "world:bulgaria-fictional" });
  state = createAgingPlace(state, {
    expectedRevision: state.revision,
    placeId: "place:market-hall",
    regionId: "region:sofia",
    placeType: "market",
    publicLabel: "South Market Hall",
    condition: 75,
  });
  state = createAgingPlace(state, {
    expectedRevision: state.revision,
    placeId: "place:rail-yard",
    regionId: "region:sofia",
    placeType: "rail-yard",
    publicLabel: "Old Rail Yard",
    condition: 45,
  });
  return state;
}

test("public place memory persists as a scar while two places age differently", () => {
  let state = worldState();
  state = recordPlaceMemory(state, {
    expectedRevision: state.revision,
    placeId: "place:market-hall",
    memoryType: "community-repair",
    severity: 20,
    meaning: "gathering-place",
  });
  state = recordPlaceMemory(state, {
    expectedRevision: state.revision,
    placeId: "place:rail-yard",
    memoryType: "institutional-closure",
    severity: 70,
    publicVisibility: "local",
    meaning: "contested-memory",
    status: "closed",
  });
  state = settleWorldTime(state, { expectedRevision: state.revision, days: 365 * 7 });
  assert.equal(state.era, "early-2000s");
  assert.equal(state.places["place:market-hall"].memory.length, 1);
  assert.equal(state.places["place:rail-yard"].status, "closed");
  assert.equal(state.places["place:rail-yard"].currentMeaning, "era-layered");
  const projected = projectWorldAging(state);
  assert.equal(projected.places[1].scarBand, "high");
  assert.equal(projected.omittedFields.includes("causal actors"), true);
});

test("private place memory changes canonical state but is omitted from public memory counts", () => {
  let state = worldState();
  state = recordPlaceMemory(state, {
    expectedRevision: state.revision,
    placeId: "place:market-hall",
    memoryType: "private-meeting",
    severity: 30,
    publicVisibility: "private",
    meaning: "unknown-to-public",
  });
  const projected = projectWorldAging(state);
  assert.equal(projected.places.find((place) => place.id === "place:market-hall").publicMemoryCount, 0);
  assert.equal(state.places["place:market-hall"].memory.length, 1);
});

test("era transition, stale writes, and invalid place memories fail closed", () => {
  const state = worldState();
  assert.throws(
    () => settleWorldTime(state, { expectedRevision: state.revision - 1, days: 1 }),
    WorldAgingStaleRevisionError,
  );
  assert.throws(
    () => recordPlaceMemory(state, { expectedRevision: state.revision, placeId: "place:missing", memoryType: "x" }),
    /unknown place/,
  );
  assert.throws(
    () => recordPlaceMemory(state, { expectedRevision: state.revision, placeId: "place:market-hall", memoryType: "x", publicVisibility: "secret" }),
    WorldAgingValidationError,
  );
});

test("world aging snapshots preserve scars and reject tampering", () => {
  const state = worldState();
  assert.deepEqual(restoreWorldAging(snapshotWorldAging(state)), state);
  assert.throws(
    () => restoreWorldAging({ snapshotVersion: 1, state: { ...state, lastEventHash: "tampered" } }),
    WorldAgingValidationError,
  );
});
