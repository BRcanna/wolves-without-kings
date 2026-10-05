import test from "node:test";
import assert from "node:assert/strict";

import {
  PrisonStaleRevisionError,
  PrisonValidationError,
  createPrisonState,
  projectPrison,
  recordPrisonRelationship,
  recordPrisonStatusMark,
  recordVisitation,
  restorePrison,
  settlePrisonTime,
  snapshotPrison,
} from "../src/wolves-without-kings/prison.mjs";

function sentence() {
  return createPrisonState({
    characterId: "character:player",
    sentenceDays: 1095,
    facilityId: "facility:fictional-central",
    cellBlock: "general",
    startDate: "1999-01-01",
    outsideWorldRevision: 17,
  });
}

test("a multi-year sentence advances prison life and produces meaningful re-entry drift", () => {
  let state = sentence();
  state = recordPrisonRelationship(state, {
    expectedRevision: state.revision,
    relationshipId: "prison:mentor",
    relationshipType: "mentor",
    delta: 20,
  });
  state = recordVisitation(state, {
    expectedRevision: state.revision,
    visitorId: "npc:family-member",
    quality: "supportive",
  });
  state = recordPrisonStatusMark(state, {
    expectedRevision: state.revision,
    markId: "mark:old-era",
    category: "status",
    publicLabel: "Old Era",
  });
  state = settlePrisonTime(state, {
    expectedRevision: state.revision,
    days: 365,
    mode: "compressed",
    timeProfile: "education",
  });
  state = settlePrisonTime(state, {
    expectedRevision: state.revision,
    days: 365,
    mode: "compressed",
    timeProfile: "connection",
  });
  state = settlePrisonTime(state, {
    expectedRevision: state.revision,
    days: 365,
    mode: "playable",
    timeProfile: "routine",
  });
  assert.equal(state.status, "released");
  assert.equal(state.timeServedDays, 1095);
  assert.equal(state.simulationDate, "2001-12-31");
  assert.equal(state.outsideDrift.relationshipBand, "stale");
  assert.equal(state.outsideDrift.businessBand, "drifted");
  assert.equal(state.outsideDrift.organizationControlBand, "reconsolidated");
  assert.equal(state.reentry.reentryCondition, "changed-world");
  assert.equal(state.prisonRelationships["prison:mentor"].ageDays, 1095);
});

test("prison reputation and relationships remain separate from outside drift", () => {
  let state = sentence();
  state = settlePrisonTime(state, {
    expectedRevision: state.revision,
    days: 180,
    mode: "playable",
    timeProfile: "conflict",
  });
  const publicView = projectPrison(state);
  assert.equal(publicView.prisonReputationBand, "low");
  assert.equal(publicView.outsideDrift.relationshipBand, "stale");
  assert.equal(Object.hasOwn(publicView, "prisonRelationships"), false);
  assert.equal(Object.hasOwn(publicView, "outsideRelationships"), false);
  assert.equal(Object.hasOwn(publicView, "injury"), false);
  assert.equal(publicView.omittedFields.includes("prisonWork"), true);
});

test("sentence boundaries and stale writes fail before mutation", () => {
  let state = createPrisonState({
    characterId: "character:short",
    sentenceDays: 30,
    facilityId: "facility:fictional-central",
  });
  assert.throws(
    () => settlePrisonTime(state, { expectedRevision: state.revision, days: 31 }),
    /exceeds remaining sentence/,
  );
  assert.throws(
    () => settlePrisonTime(state, { expectedRevision: 99, days: 1 }),
    PrisonStaleRevisionError,
  );
  state = settlePrisonTime(state, { expectedRevision: state.revision, days: 30 });
  assert.equal(state.status, "released");
  assert.throws(
    () => settlePrisonTime(state, { expectedRevision: state.revision, days: 1 }),
    /only settle while incarcerated/,
  );
});

test("prison state restores from the event chain and rejects tampering", () => {
  const state = settlePrisonTime(sentence(), {
    expectedRevision: 0,
    days: 30,
    timeProfile: "routine",
  });
  assert.deepEqual(restorePrison(snapshotPrison(state)), state);
  assert.throws(
    () => restorePrison({ snapshotVersion: 1, state: { ...state, lastEventHash: "tampered" } }),
    PrisonValidationError,
  );
});
