import test from "node:test";
import assert from "node:assert/strict";

import { createAuthorityState } from "../src/wolves-without-kings/authority.mjs";
import { createAuthorityService } from "../src/wolves-without-kings/service.mjs";

function service() {
  return createAuthorityService(createAuthorityState(), {
    resolveIntent: ({ intent }) => ({
      eventType: "vehicle.action_resolved",
      affectedEntityIds: intent.entityIds,
      payload: { outcome: "continued", serverChosen: true },
    }),
  });
}

function connect(serviceInstance) {
  return serviceInstance.request({
    method: "POST",
    path: "/sessions/connect",
    body: {
      sessionId: "session:host",
      clientId: "client:host",
      characterId: "character:host",
      role: "host",
      regionId: "region:sofia-south",
    },
  });
}

function inputBody(serviceInstance, clientInputSeq = 1, baseRevision = serviceInstance.state.worldRevision) {
  return {
    clientInputSeq,
    baseRevision,
    intent: {
      type: "vehicle_action",
      actorId: "character:host",
      regionId: "region:sofia-south",
      entityIds: [],
      payload: { direction: "south" },
    },
  };
}

test("service adapter exposes health, connection, and redacted input responses", () => {
  const authority = service();
  const health = authority.request({ method: "GET", path: "/health" });
  assert.equal(health.status, 200);
  assert.equal(health.body.mode, "in-process");

  const connected = connect(authority);
  assert.equal(connected.status, 201);
  const accepted = authority.request({
    method: "POST",
    path: "/sessions/session%3Ahost/input",
    body: inputBody(authority),
  });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.accepted, true);
  assert.equal(Object.hasOwn(accepted.body, "payload"), false);
  assert.equal(Object.hasOwn(accepted.body, "resolution"), false);
});

test("service adapter maps stale and duplicate inputs without mutating state", () => {
  const authority = service();
  connect(authority);
  const accepted = authority.request({
    method: "POST",
    path: "/sessions/session%3Ahost/input",
    body: inputBody(authority),
  });
  assert.equal(accepted.status, 200);
  const afterAccepted = authority.state;

  const duplicate = authority.request({
    method: "POST",
    path: "/sessions/session%3Ahost/input",
    body: inputBody(authority, 1, authority.state.worldRevision),
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error, "duplicate_input");
  assert.deepEqual(authority.state, afterAccepted);

  const stale = authority.request({
    method: "POST",
    path: "/sessions/session%3Ahost/input",
    body: inputBody(authority, 2, afterAccepted.worldRevision - 1),
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error, "stale_input");
  assert.equal(stale.body.reconcileRequired, true);
  assert.deepEqual(authority.state, afterAccepted);
});

test("service adapter supports disconnect, reconnect, and scoped reconciliation", () => {
  const authority = service();
  connect(authority);
  const beforeDisconnect = authority.state.worldRevision;
  const disconnected = authority.request({
    method: "POST",
    path: "/sessions/session%3Ahost/disconnect",
    body: { reason: "network-lost", expectedRevision: beforeDisconnect },
  });
  assert.equal(disconnected.status, 200);
  assert.equal(disconnected.body.status, "disconnected");

  const reconnected = authority.request({
    method: "POST",
    path: "/sessions/session%3Ahost/reconnect",
    body: { clientId: "client:host", lastKnownRevision: beforeDisconnect },
  });
  assert.equal(reconnected.status, 200);
  assert.equal(reconnected.body.reconciliation.status, "required");

  const reconciliation = authority.request({
    method: "GET",
    path: `/sessions/session%3Ahost/reconcile?fromRevision=${beforeDisconnect}`,
  });
  assert.equal(reconciliation.status, 200);
  assert.equal(reconciliation.body.authoritativeRevision, authority.state.worldRevision);
  assert.equal(reconciliation.body.events.every((event) => !Object.hasOwn(event, "payload")), true);
  assert.equal(reconciliation.body.omittedFields.includes("persistentStore"), true);
});

test("service adapter returns bounded errors for malformed and unknown routes", () => {
  const authority = service();
  assert.equal(authority.request({ method: "POST", path: "/sessions/connect", body: null }).status, 400);
  assert.equal(authority.request({ method: "GET", path: "/not-real" }).status, 404);
  assert.equal(authority.request({ method: "GET", path: "/sessions/session%3Aunknown/reconcile" }).status, 404);
});
