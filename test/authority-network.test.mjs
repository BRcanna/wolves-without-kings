import test from "node:test";
import assert from "node:assert/strict";

import {
  AuthorityValidationError,
  DuplicateInputError,
  LeaseConflictError,
  StaleInputError,
  advanceServerTicks,
  claimEntity,
  connectSession,
  createAuthorityState,
  disconnectSession,
  reconcileSession,
  reconnectSession,
  registerEntityOwner,
  restoreAuthorityState,
  setInterestSet,
  snapshotAuthorityState,
  submitIntent,
} from "../src/wolves-without-kings/authority.mjs";

function connectedState() {
  let state = createAuthorityState();
  state = connectSession(state, {
    sessionId: "session:host",
    clientId: "client:host",
    characterId: "character:host",
    role: "host",
  });
  state = connectSession(state, {
    sessionId: "session:guest",
    clientId: "client:guest",
    characterId: "character:guest",
    role: "guest",
  });
  state = registerEntityOwner(state, {
    expectedRevision: state.worldRevision,
    entityId: "vehicle:sedan",
    ownerId: "character:host",
  });
  return state;
}

test("authority accepts ordered intent and records a server-computed outcome", () => {
  const initial = connectedState();
  const next = submitIntent(initial, {
    sessionId: "session:host",
    clientInputSeq: 1,
    baseRevision: initial.worldRevision,
    intent: {
      type: "vehicle_action",
      actorId: "character:host",
      regionId: "region:sofia-south",
      entityIds: ["vehicle:sedan"],
      payload: { direction: "south", speedBand: "steady" },
    },
  }, {
    resolve: ({ intent }) => ({
      eventType: "vehicle.action_resolved",
      affectedEntityIds: intent.entityIds,
      payload: { outcome: "continued", damageDelta: 0 },
    }),
  });

  assert.equal(next.sessions["session:host"].lastInputSeq, 1);
  assert.equal(next.sessions["session:host"].predictionState, "confirmed");
  assert.equal(next.events.at(-1).eventType, "net.intent.resolved");
  assert.equal(next.events.at(-1).payload.resolution.payload.outcome, "continued");
  assert.equal(next.events.at(-1).payload.intent.payload.direction, "south");
  assert.equal(next.persistentStore.inputReceipts["session:host:1"].acceptedAtRevision, next.worldRevision);
});

test("stale and duplicate inputs fail before mutation", () => {
  const initial = connectedState();
  const request = {
    sessionId: "session:host",
    clientInputSeq: 1,
    baseRevision: initial.worldRevision,
    intent: {
      type: "wait",
      actorId: "character:host",
      regionId: "region:sofia-south",
      entityIds: [],
      payload: {},
    },
  };
  const accepted = submitIntent(initial, request, { resolve: () => ({ eventType: "wait", payload: {} }) });
  assert.throws(
    () => submitIntent(accepted, { ...request, baseRevision: accepted.worldRevision }, { resolve: () => ({ eventType: "wait" }) }),
    DuplicateInputError,
  );
  assert.throws(
    () => submitIntent(accepted, { ...request, clientInputSeq: 2, baseRevision: initial.worldRevision }, { resolve: () => ({ eventType: "wait" }) }),
    StaleInputError,
  );
  assert.equal(accepted.sessions["session:host"].lastInputSeq, 1);
});

test("client cannot submit authoritative results or private state", () => {
  const state = connectedState();
  assert.throws(
    () => submitIntent(state, {
      sessionId: "session:host",
      clientInputSeq: 1,
      baseRevision: state.worldRevision,
      intent: {
        type: "vehicle_action",
        actorId: "character:host",
        regionId: "region:sofia-south",
        entityIds: ["vehicle:sedan"],
        payload: { outcome: "continued" },
      },
    }, { resolve: () => ({ eventType: "vehicle.action_resolved" }) }),
    /server-authoritative/,
  );
  assert.throws(
    () => submitIntent(state, {
      sessionId: "session:host",
      clientInputSeq: 1,
      baseRevision: state.worldRevision,
      intent: {
        type: "vehicle_action",
        actorId: "character:host",
        regionId: "region:sofia-south",
        entityIds: ["vehicle:sedan"],
        payload: { direction: "south" },
        authoritativeResult: { damage: 0 },
      },
    }, { resolve: () => ({ eventType: "vehicle.action_resolved" }) }),
    /unsupported field/,
  );
});

test("unique entity transfer is authoritative and contested leases fail closed", () => {
  let state = connectedState();
  state = claimEntity(state, {
    expectedRevision: state.worldRevision,
    entityId: "vehicle:sedan",
    ownerId: "character:host",
    leaseId: "lease:host-drive",
    expiresAtTick: state.serverTick + 10,
  });
  assert.throws(
    () => submitIntent(state, {
      sessionId: "session:guest",
      clientInputSeq: 1,
      baseRevision: state.worldRevision,
      intent: {
        type: "take_vehicle",
        actorId: "character:guest",
        regionId: "region:sofia-south",
        entityIds: ["vehicle:sedan"],
        payload: { request: "transfer" },
      },
    }, {
      resolve: () => ({
        eventType: "vehicle.transferred",
        entityTransfers: [{
          entityId: "vehicle:sedan",
          fromOwnerId: "character:host",
          toOwnerId: "character:guest",
        }],
      }),
    }),
    LeaseConflictError,
  );
  assert.equal(state.entityOwners["vehicle:sedan"].ownerId, "character:host");

  state = disconnectSession(state, {
    expectedRevision: state.worldRevision,
    sessionId: "session:host",
    reason: "network-lost",
  });
  state = submitIntent(state, {
    sessionId: "session:guest",
    clientInputSeq: 1,
    baseRevision: state.worldRevision,
    intent: {
      type: "take_vehicle",
      actorId: "character:guest",
      regionId: "region:sofia-south",
      entityIds: ["vehicle:sedan"],
      payload: { request: "transfer" },
    },
  }, {
    resolve: () => ({
      eventType: "vehicle.transferred",
      entityTransfers: [{
        entityId: "vehicle:sedan",
        fromOwnerId: "character:host",
        toOwnerId: "character:guest",
      }],
    }),
  });
  assert.equal(state.entityOwners["vehicle:sedan"].ownerId, "character:guest");
});

test("disconnect releases claims, reconnect requests reconciliation, and redaction omits private payloads", () => {
  let state = connectedState();
  state = setInterestSet(state, {
    expectedRevision: state.worldRevision,
    sessionId: "session:guest",
    entityIds: ["vehicle:sedan"],
  });
  state = claimEntity(state, {
    expectedRevision: state.worldRevision,
    entityId: "vehicle:sedan",
    ownerId: "character:host",
    leaseId: "lease:host-drive",
    expiresAtTick: state.serverTick + 10,
  });
  const disconnectedRevision = state.worldRevision;
  state = disconnectSession(state, {
    expectedRevision: state.worldRevision,
    sessionId: "session:host",
  });
  assert.equal(state.claims["vehicle:sedan"], undefined);
  state = reconnectSession(state, {
    sessionId: "session:host",
    clientId: "client:host",
    lastKnownRevision: disconnectedRevision,
  });
  const reconciliation = reconcileSession(state, {
    sessionId: "session:host",
    fromRevision: disconnectedRevision,
  });
  assert.equal(reconciliation.authoritativeRevision, state.worldRevision);
  assert.equal(reconciliation.events.some((event) => Object.hasOwn(event, "payload")), false);
  assert.equal(reconciliation.omittedFields.includes("persistentStore"), true);
  assert.equal(state.sessions["session:host"].predictionState, "reconciliation-required");
});

test("authority events survive snapshot restore and lease expiry is evented", () => {
  let state = connectedState();
  state = claimEntity(state, {
    expectedRevision: state.worldRevision,
    entityId: "vehicle:sedan",
    ownerId: "character:host",
    leaseId: "lease:short",
    expiresAtTick: state.serverTick + 1,
  });
  state = advanceServerTicks(state, { expectedRevision: state.worldRevision, ticks: 1 });
  assert.equal(state.claims["vehicle:sedan"], undefined);
  const restored = restoreAuthorityState(snapshotAuthorityState(state));
  assert.deepEqual(restored, state);
  assert.throws(
    () => restoreAuthorityState({ snapshotVersion: 1, state: { ...state, lastEventHash: "tampered" } }),
    AuthorityValidationError,
  );
});
