import test from "node:test";
import assert from "node:assert/strict";

import {
  ConflictStaleRevisionError,
  ConflictValidationError,
  declareConflict,
  createConflictState,
  projectConflicts,
  recordConflictAction,
  registerProtectedProperty,
  restoreConflicts,
  settleConflict,
  settleConflictTime,
  snapshotConflicts,
} from "../src/wolves-without-kings/conflict.mjs";

function conflictState() {
  let state = createConflictState({ worldId: "shard:fictional", offlineProtectionDays: 14 });
  state = registerProtectedProperty(state, {
    expectedRevision: state.revision,
    propertyId: "property:nightclub",
    ownerId: "organization:lanterns",
  });
  return state;
}

test("offline property protection holds until an explicit bounded conflict window settles", () => {
  let state = conflictState();
  state = declareConflict(state, {
    expectedRevision: state.revision,
    conflictId: "conflict:nightclub",
    initiatorId: "organization:rivals",
    participantIds: ["organization:rivals", "organization:lanterns"],
    casusBelli: "fictional-supply-contract",
    location: "district:nightclub",
    mode: "business-rivalry",
    windowDays: 2,
    propertyId: "property:nightclub",
  });
  assert.equal(state.properties["property:nightclub"].vulnerability, "protected");
  state = recordConflictAction(state, {
    expectedRevision: state.revision,
    conflictId: "conflict:nightclub",
    actorId: "organization:rivals",
    actionType: "property-pressure",
  });
  state = settleConflict(state, {
    expectedRevision: state.revision,
    conflictId: "conflict:nightclub",
    outcome: "property-contested",
  });
  assert.equal(state.properties["property:nightclub"].vulnerability, "contested");
  assert.equal(state.conflicts["conflict:nightclub"].status, "settled");
});

test("nonlethal competition and bounded violent windows are separate outcomes", () => {
  let state = conflictState();
  state = declareConflict(state, {
    expectedRevision: state.revision,
    conflictId: "conflict:race",
    initiatorId: "player:a",
    participantIds: ["player:a", "player:b"],
    casusBelli: "fictional-race-season",
    location: "district:roofline",
    mode: "race",
  });
  state = settleConflict(state, { expectedRevision: state.revision, conflictId: "conflict:race", outcome: "nonlethal-resolution" });
  state = declareConflict(state, {
    expectedRevision: state.revision,
    conflictId: "conflict:window",
    initiatorId: "player:a",
    participantIds: ["player:a", "player:b"],
    casusBelli: "fictional-declared-conflict",
    location: "district:yard",
    mode: "violent-window",
    windowDays: 2,
  });
  assert.throws(
    () => declareConflict(state, {
      expectedRevision: state.revision,
      conflictId: "conflict:too-long",
      initiatorId: "player:a",
      participantIds: ["player:a", "player:b"],
      casusBelli: "x",
      location: "y",
      mode: "violent-window",
      windowDays: 3,
    }),
    /limited to two days/,
  );
  assert.equal(state.conflicts["conflict:window"].mode, "violent-window");
});

test("repeated harassment is rate-limited and cooldowns expire through time", () => {
  let state = conflictState();
  state = declareConflict(state, {
    expectedRevision: state.revision,
    conflictId: "conflict:harassment",
    initiatorId: "player:a",
    participantIds: ["player:a", "player:b"],
    casusBelli: "fictional-grievance",
    location: "district:street",
  });
  state = recordConflictAction(state, { expectedRevision: state.revision, conflictId: "conflict:harassment", actorId: "player:a", actionType: "harassment" });
  assert.throws(
    () => recordConflictAction(state, { expectedRevision: state.revision, conflictId: "conflict:harassment", actorId: "player:a", actionType: "harassment" }),
    /anti-harassment cooldown/,
  );
  state = settleConflictTime(state, { expectedRevision: state.revision, days: 3 });
  assert.equal(Object.keys(state.actorCooldowns).length, 0);
});

test("stale writes, invalid actions, public redaction, and snapshots fail closed", () => {
  const state = conflictState();
  assert.throws(
    () => settleConflictTime(state, { expectedRevision: state.revision - 1, days: 1 }),
    ConflictStaleRevisionError,
  );
  assert.throws(
    () => declareConflict(state, { expectedRevision: state.revision, conflictId: "bad", initiatorId: "a", participantIds: ["a", "a"], casusBelli: "x", location: "y" }),
    ConflictValidationError,
  );
  const projected = projectConflicts(state);
  assert.equal(projected.omittedFields.includes("participantIds"), true);
  assert.deepEqual(restoreConflicts(snapshotConflicts(state)), state);
  assert.throws(
    () => restoreConflicts({ snapshotVersion: 1, state: { ...state, lastEventHash: "tampered" } }),
    ConflictValidationError,
  );
});
