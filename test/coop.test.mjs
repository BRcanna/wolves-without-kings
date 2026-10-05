import test from "node:test";
import assert from "node:assert/strict";

import {
  CoopStaleRevisionError,
  CoopValidationError,
  createCoopSession,
  createSharedOperation,
  disconnectGuest,
  joinGuest,
  recordSharedOperationOutcome,
  reconnectGuest,
  rejectHostRewind,
  restoreCoopSession,
  settleGuestLeave,
  snapshotCoopSession,
} from "../src/wolves-without-kings/coop.mjs";

function joinedSession() {
  let state = createCoopSession({ hostWorldRevision: 12 });
  state = joinGuest(state, {
    expectedRevision: state.worldRevision,
    playerId: "guest:one",
    characterId: "character:guest",
    guestWorldId: "guest-world:one",
    role: "specialist",
    joinPoint: "loc:market-street",
  });
  return state;
}

test("guest joins a host world and shared operation settles host and guest consequences separately", () => {
  let state = joinedSession();
  state = createSharedOperation(state, {
    expectedRevision: state.worldRevision,
    operationId: "operation:convoy",
    participantIds: ["host", "guest:one"],
    locationId: "loc:market-street",
    assetIds: ["vehicle:favorite-sedan"],
  });
  state = recordSharedOperationOutcome(state, {
    expectedRevision: state.worldRevision,
    operationId: "operation:convoy",
    worldConsequences: [{ type: "property-damage", summary: "host-world property state changed" }],
    guestConsequences: {
      "guest:one": [{ type: "injury", summary: "guest returned with an injury record" }],
    },
  });
  assert.equal(state.hostWorldRevision, 13);
  assert.equal(state.operations["operation:convoy"].status, "completed");
  assert.equal(state.operations["operation:convoy"].worldConsequences.length, 1);
  assert.equal(state.operations["operation:convoy"].guestConsequences["guest:one"].length, 1);
  assert.deepEqual(state.players["guest:one"].participation, ["operation:convoy"]);
});

test("disconnect preserves the active host operation and reconnect clears the transient disconnect marker", () => {
  let state = joinedSession();
  state = createSharedOperation(state, {
    expectedRevision: state.worldRevision,
    operationId: "operation:disconnect",
    participantIds: ["host", "guest:one"],
    locationId: "loc:night-market",
  });
  state = disconnectGuest(state, {
    expectedRevision: state.worldRevision,
    playerId: "guest:one",
    reason: "connection-lost",
  });
  assert.equal(state.players["guest:one"].status, "disconnected");
  assert.deepEqual(state.operations["operation:disconnect"].disconnectedPlayers, ["guest:one"]);
  assert.equal(state.operations["operation:disconnect"].status, "active");
  state = reconnectGuest(state, {
    expectedRevision: state.worldRevision,
    playerId: "guest:one",
  });
  assert.equal(state.players["guest:one"].status, "connected");
  assert.deepEqual(state.operations["operation:disconnect"].disconnectedPlayers, []);
});

test("guest leave settlement retains host consequences and rejects foreign-world assets", () => {
  let state = joinedSession();
  state = createSharedOperation(state, {
    expectedRevision: state.worldRevision,
    operationId: "operation:settlement",
    participantIds: ["host", "guest:one"],
    locationId: "loc:motel-lobby",
    assetIds: ["vehicle:host-asset"],
  });
  state = recordSharedOperationOutcome(state, {
    expectedRevision: state.worldRevision,
    operationId: "operation:settlement",
    worldConsequences: [{ type: "case-evidence", summary: "host-world evidence remains" }],
  });
  assert.throws(
    () => settleGuestLeave(state, {
      expectedRevision: state.worldRevision,
      playerId: "guest:one",
      assetReturns: ["guest-world:asset"],
    }),
    /outside the host operation/,
  );
  state = settleGuestLeave(state, {
    expectedRevision: state.worldRevision,
    playerId: "guest:one",
    settlementMode: "retained-injury",
    injuryDelta: 18,
    assetReturns: ["vehicle:host-asset"],
  });
  assert.equal(state.players["guest:one"].status, "settled");
  assert.equal(state.players["guest:one"].injury, 18);
  assert.equal(state.players["guest:one"].settlement.hostConsequencesRetained, true);
  assert.equal(state.operations["operation:settlement"].worldConsequences[0].type, "case-evidence");
});

test("co-op rejects duplicate guests, stale transitions, host rewind, and snapshot tampering", () => {
  let state = joinedSession();
  assert.throws(
    () => joinGuest(state, {
      expectedRevision: state.worldRevision,
      playerId: "guest:two",
      characterId: "character:guest",
      guestWorldId: "guest-world:two",
      joinPoint: "loc:night-market",
    }),
    /character already present/,
  );
  assert.throws(
    () => createSharedOperation(state, {
      expectedRevision: state.worldRevision - 1,
      operationId: "operation:stale",
      participantIds: ["host", "guest:one"],
      locationId: "loc:market-street",
    }),
    CoopStaleRevisionError,
  );
  assert.throws(() => rejectHostRewind(), /rewind is not available/);
  const restored = restoreCoopSession(snapshotCoopSession(state));
  assert.deepEqual(restored, state);
  assert.throws(
    () => restoreCoopSession({ snapshotVersion: 1, state: { ...state, lastEventHash: "tampered" } }),
    CoopValidationError,
  );
});
