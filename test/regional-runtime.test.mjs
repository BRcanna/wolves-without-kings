import test from "node:test";
import assert from "node:assert/strict";

import {
  applyRegionalPropertyConflict,
  createRegionalRuntime,
  joinRegionalSession,
  leaveRegionalSession,
  projectRegionalRuntime,
  RegionalRuntimeStaleRevisionError,
  restoreRegionalRuntime,
  settleRegionalSeason,
  snapshotRegionalRuntime,
} from "../src/wolves-without-kings/regional-runtime.mjs";

test("regional runtime composes a seasonal multi-region trace with conflict and disconnect continuity", () => {
  let state = createRegionalRuntime();
  state = joinRegionalSession(state, {
    expectedRevision: state.revision,
    sessionId: "session:regional-player",
    characterId: "character:regional-player",
    regionId: "region:capital",
  });
  state = applyRegionalPropertyConflict(state, {
    expectedRevision: state.revision,
    propertyId: "property:coastal-warehouse",
    orgId: "organization:rivals",
  });
  state = settleRegionalSeason(state, { expectedRevision: state.revision, days: 180 });
  state = leaveRegionalSession(state, {
    expectedRevision: state.revision,
    sessionId: "session:regional-player",
  });

  assert.equal(state.simulationDate, "1999-06-30");
  assert.equal(state.geography.regions["region:coast"].seasonBand, "seasonal-high");
  assert.ok(state.markets.markets["market:coast"].shockHistory.length >= 1);
  assert.equal(state.logistics.transitHistory.at(-1).outcome, "completed");
  assert.equal(state.underworld.serverWeek, 25);
  assert.equal(state.underworld.properties["property:coastal-warehouse"].status, "contested");
  assert.equal(state.underworld.playerSessions["session:regional-player"].status, "offline");
  const publicView = projectRegionalRuntime(state);
  assert.equal(publicView.geography.regions.length, 4);
  assert.equal(publicView.markets.markets.length, 2);
  assert.deepEqual(publicView.content.counts, {
    regions: 4,
    npcs: 12,
    businesses: 4,
    organizations: 2,
    locations: 8,
    routes: 4,
    scheduleTemplates: 12,
  });
  assert.equal(publicView.underworld.properties[0].status, "contested");
  assert.equal(publicView.omittedFields.includes("player session identity"), true);
});

test("regional runtime snapshot restart preserves nested histories and stale commands fail before mutation", () => {
  let state = createRegionalRuntime();
  state = settleRegionalSeason(state, { expectedRevision: state.revision, days: 180 });
  const restored = restoreRegionalRuntime(snapshotRegionalRuntime(state));
  assert.deepEqual(restored, state);
  const before = structuredClone(state);
  assert.throws(() => settleRegionalSeason(state, { expectedRevision: state.revision - 1, days: 30 }), RegionalRuntimeStaleRevisionError);
  assert.deepEqual(state, before);
  const tampered = snapshotRegionalRuntime(state);
  tampered.state.events[0].hash = "tampered";
  assert.throws(() => restoreRegionalRuntime(tampered), /event hash is invalid/);
});
