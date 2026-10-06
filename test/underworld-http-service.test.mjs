import test from "node:test";
import assert from "node:assert/strict";

import {
  createUnderworldHttpServer,
  createUnderworldHttpService,
  registerMarket,
  registerOrganization,
  registerProperty,
} from "../src/wolves-without-kings/underworld-http-service.mjs";
import { createUnderworldState } from "../src/wolves-without-kings/underworld.mjs";

const TOKEN = "underworld-local-token";

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return `http://127.0.0.1:${server.address().port}`;
}

async function close(server) {
  if (!server.listening) return;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function jsonRequest(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
  });
  return { response, body: await response.json() };
}

function seededService() {
  let state = createUnderworldState({ shardId: "shard:http" });
  state = registerOrganization(state, { expectedRevision: state.revision, orgId: "organization:lanterns", headquartersRegionId: "region:coast" });
  state = registerMarket(state, { expectedRevision: state.revision, marketId: "market:coast", regionId: "region:coast", commodityClass: "vehicle-demand" });
  state = registerProperty(state, { expectedRevision: state.revision, propertyId: "property:club", regionId: "region:coast", ownerOrgId: "organization:lanterns" });
  return createUnderworldHttpService({ state });
}

test("underworld HTTP adapter keeps health/projection public and bearer-protects mutations", async () => {
  const service = seededService();
  const server = createUnderworldHttpServer({ service, tokens: [TOKEN] });
  const baseUrl = await listen(server);
  try {
    const health = await jsonRequest(baseUrl, "/health", { headers: {} });
    assert.equal(health.response.status, 200);
    assert.equal(health.body.shardId, "shard:http");
    const projection = await jsonRequest(baseUrl, "/projection", { headers: {} });
    assert.equal(projection.response.status, 200);
    assert.equal(Object.hasOwn(projection.body, "playerSessions"), false);
    const beforeRevision = service.state.revision;
    const unauthenticated = await jsonRequest(baseUrl, "/sessions/join", { method: "POST", body: JSON.stringify({ expectedRevision: service.state.revision, sessionId: "session:one", characterId: "character:one", regionId: "region:coast" }) });
    assert.equal(unauthenticated.response.status, 401);
    assert.equal(service.state.revision, beforeRevision);
  } finally {
    await close(server);
  }
});

test("underworld HTTP adapter commits revision-bound sessions and market influence without private response fields", async () => {
  const service = seededService();
  const server = createUnderworldHttpServer({ service, tokens: [TOKEN] });
  const baseUrl = await listen(server);
  try {
    const headers = { authorization: `Bearer ${TOKEN}` };
    const joined = await jsonRequest(baseUrl, "/sessions/join", { method: "POST", headers, body: JSON.stringify({ expectedRevision: service.state.revision, sessionId: "session:one", characterId: "character:one", regionId: "region:coast" }) });
    assert.equal(joined.response.status, 201);
    const influenced = await jsonRequest(baseUrl, "/markets/influence", { method: "POST", headers, body: JSON.stringify({ expectedRevision: joined.body.revision, sessionId: "session:one", marketId: "market:coast", pressureDelta: 8 }) });
    assert.equal(influenced.response.status, 200);
    assert.equal(influenced.body.projection.activePlayerCount, 1);
    assert.equal(Object.hasOwn(influenced.body, "state"), false);
    const stale = await jsonRequest(baseUrl, "/sessions/leave", { method: "POST", headers, body: JSON.stringify({ expectedRevision: joined.body.revision, sessionId: "session:one" }) });
    assert.equal(stale.response.status, 409);
    assert.equal(stale.body.error, "stale_underworld_revision");
  } finally {
    await close(server);
  }
});

test("underworld HTTP adapter returns bounded malformed and unknown-route errors without leaking messages", async () => {
  const service = seededService();
  const server = createUnderworldHttpServer({ service, tokens: [TOKEN] });
  const baseUrl = await listen(server);
  try {
    const malformed = await fetch(`${baseUrl}/weeks/settle`, { method: "POST", headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" }, body: "{" });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).error, "invalid_http_request");
    const unknown = await jsonRequest(baseUrl, "/secret-state", { headers: { authorization: `Bearer ${TOKEN}` } });
    assert.equal(unknown.response.status, 404);
    assert.deepEqual(unknown.body, { error: "route_not_found" });
    const invalid = await jsonRequest(baseUrl, "/sessions/join", { method: "POST", headers: { authorization: `Bearer ${TOKEN}` }, body: JSON.stringify({ expectedRevision: service.state.revision }) });
    assert.equal(invalid.response.status, 400);
    assert.deepEqual(invalid.body, { error: "invalid_underworld_request" });
  } finally {
    await close(server);
  }
});
