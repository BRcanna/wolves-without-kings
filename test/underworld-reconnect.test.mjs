import test from "node:test";
import assert from "node:assert/strict";

import {
  createUnderworldState,
  joinPlayerSession,
  leavePlayerSession,
  reconnectPlayerSession,
  registerProperty,
  registerOrganization,
  UnderworldValidationError,
} from "../src/wolves-without-kings/underworld.mjs";

function disconnectedState() {
  let state = createUnderworldState();
  state = registerOrganization(state, { expectedRevision: state.revision, orgId: "organization:lanterns", headquartersRegionId: "region:coast" });
  state = registerProperty(state, { expectedRevision: state.revision, propertyId: "property:club", regionId: "region:coast", ownerOrgId: "organization:lanterns" });
  state = joinPlayerSession(state, { expectedRevision: state.revision, sessionId: "session:one", characterId: "character:one", regionId: "region:coast" });
  return leavePlayerSession(state, { expectedRevision: state.revision, sessionId: "session:one", reason: "network-loss" });
}

test("online shard reconnect restores the bound session without importing a new character or changing property ownership", () => {
  let state = disconnectedState();
  state = reconnectPlayerSession(state, { expectedRevision: state.revision, sessionId: "session:one", characterId: "character:one", regionId: "region:coast" });
  assert.equal(state.playerSessions["session:one"].status, "active");
  assert.equal(state.playerSessions["session:one"].reconnectCount, 1);
  assert.equal(state.playerCharacters["character:one"].status, "active");
  assert.equal(state.properties["property:club"].ownerOrgId, "organization:lanterns");
  assert.equal(state.events.at(-1).eventType, "underworld.player_reconnected");
});

test("reconnect rejects active, mismatched, and cross-region bindings without mutation", () => {
  let state = disconnectedState();
  const before = structuredClone(state);
  assert.throws(() => reconnectPlayerSession(state, { expectedRevision: state.revision, sessionId: "session:one", characterId: "character:other", regionId: "region:coast" }), UnderworldValidationError);
  assert.deepEqual(state, before);
  state = reconnectPlayerSession(state, { expectedRevision: state.revision, sessionId: "session:one", characterId: "character:one", regionId: "region:coast" });
  const active = state;
  assert.throws(() => reconnectPlayerSession(active, { expectedRevision: active.revision, sessionId: "session:one", characterId: "character:one", regionId: "region:coast" }), /not reconnectable/);
  assert.throws(() => reconnectPlayerSession(active, { expectedRevision: active.revision, sessionId: "session:one", characterId: "character:one", regionId: "region:sofia" }), /not reconnectable/);
});
