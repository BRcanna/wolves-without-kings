import test from "node:test";
import assert from "node:assert/strict";

import {
  OffscreenStaleRevisionError,
  OffscreenValidationError,
  materializeOffscreenRegion,
  promoteImportantEntity,
  projectOffscreen,
  registerOffscreenRegion,
  restoreOffscreen,
  scheduleOffscreenEvent,
  settleOffscreenTime,
  snapshotOffscreen,
  createOffscreenState,
} from "../src/wolves-without-kings/offscreen.mjs";

function fixture() {
  let state = createOffscreenState({ simulationDate: "1998-01-01" });
  state = registerOffscreenRegion(state, {
    expectedRevision: state.revision,
    regionId: "region:capital",
    mode: "full",
    populationBand: "high",
    marketPressure: 55,
    organizationPressure: 35,
  });
  state = registerOffscreenRegion(state, {
    expectedRevision: state.revision,
    regionId: "region:coast",
    mode: "aggregate",
    populationBand: "moderate",
    marketPressure: 45,
    organizationPressure: 25,
  });
  state = promoteImportantEntity(state, {
    expectedRevision: state.revision,
    regionId: "region:coast",
    entityId: "npc:club-manager",
    entityType: "named-manager",
  });
  state = scheduleOffscreenEvent(state, {
    expectedRevision: state.revision,
    regionId: "region:coast",
    eventId: "event:seasonal-fire",
    eventType: "business-disruption",
    dueInDays: 30,
    entityIds: ["npc:club-manager"],
    outcomeBands: ["contained", "disrupted"],
  });
  return state;
}

test("aggregate regions settle while full regions keep individual-tick continuity and named entities stay promoted", () => {
  const state = settleOffscreenTime(fixture(), { expectedRevision: 4, days: 30 });
  assert.equal(state.regions["region:capital"].lastFullTick, 30);
  assert.equal(state.regions["region:coast"].aggregateElapsed, 30);
  assert.equal(state.regions["region:coast"].importantEntities["npc:club-manager"].promoted, true);
  assert.equal(state.regions["region:coast"].scheduledEvents["event:seasonal-fire"].status, "materialized");
});

test("materialization reconciles aggregate elapsed time without fabricating exact witness detail", () => {
  let state = settleOffscreenTime(fixture(), { expectedRevision: 4, days: 30 });
  state = materializeOffscreenRegion(state, { expectedRevision: state.revision, regionId: "region:coast" });
  assert.equal(state.regions["region:coast"].mode, "full");
  assert.equal(state.regions["region:coast"].reconciliationState, "materialized");
  assert.equal(state.regions["region:coast"].lastFullTick, 30);
  assert.equal(state.events.at(-1).payload.uncertainty, "exact witness detail unavailable");
});

test("public offscreen projection exposes continuity bands but omits seeds and exact scheduled payloads", () => {
  const state = settleOffscreenTime(fixture(), { expectedRevision: 4, days: 30 });
  const publicView = projectOffscreen(state);
  const debugView = projectOffscreen(state, { scope: "debug" });
  assert.equal(["contained", "disrupted"].includes(publicView.regions[1].scheduledOutcomeBands[0]), true);
  assert.equal(Object.hasOwn(publicView.regions[1], "materializationSeed"), false);
  assert.equal(Object.hasOwn(debugView.regions[1], "materializationSeed"), true);
});

test("offscreen rejects stale or invalid region writes before mutation", () => {
  const state = fixture();
  assert.throws(
    () => materializeOffscreenRegion(state, { expectedRevision: state.revision - 1, regionId: "region:coast" }),
    OffscreenStaleRevisionError,
  );
  assert.throws(
    () => registerOffscreenRegion(state, { expectedRevision: state.revision, regionId: "region:bad", mode: "invalid" }),
    OffscreenValidationError,
  );
  assert.equal(Object.hasOwn(state.regions, "region:bad"), false);
});

test("offscreen snapshots preserve deterministic history and reject tampering", () => {
  const state = fixture();
  assert.deepEqual(restoreOffscreen(snapshotOffscreen(state)), state);
  assert.throws(
    () => restoreOffscreen({ snapshotVersion: 1, state: { ...state, lastEventHash: "tampered" } }),
    OffscreenValidationError,
  );
});
