import test from "node:test";
import assert from "node:assert/strict";

import { createAuthorityService } from "../src/wolves-without-kings/service.mjs";
import {
  createSecureAuthorityHttpServer,
  SecureHttpConfigurationError,
} from "../src/wolves-without-kings/secure-http-service.mjs";

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
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

const TOKEN = "local-test-token";

test("secure local service keeps health public and requires bearer authentication for mutation", async () => {
  const service = createAuthorityService();
  const server = createSecureAuthorityHttpServer({ service, tokens: [{ tokenId: "test-client", secret: TOKEN }] });
  const baseUrl = await listen(server);
  try {
    const health = await jsonRequest(baseUrl, "/health", { headers: {} });
    assert.equal(health.response.status, 200);

    const unauthenticated = await jsonRequest(baseUrl, "/sessions/connect", {
      method: "POST",
      body: JSON.stringify({ sessionId: "session:unauthenticated", clientId: "client:unauthenticated", characterId: "character:player" }),
    });
    assert.equal(unauthenticated.response.status, 401);
    assert.equal(service.state.worldRevision, 0);
    assert.equal(Object.hasOwn(unauthenticated.body, "message"), false);

    const connected = await jsonRequest(baseUrl, "/sessions/connect", {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({
        sessionId: "session:authenticated",
        clientId: "client:authenticated",
        characterId: "character:player",
        role: "host",
        regionId: "region:sofia-south",
      }),
    });
    assert.equal(connected.response.status, 201);
    assert.equal(connected.body.sessionId, "session:authenticated");
  } finally {
    await close(server);
  }
});

test("moderation hold and deny responses are redacted and happen before authority mutation", async () => {
  const service = createAuthorityService();
  const server = createSecureAuthorityHttpServer({
    service,
    tokens: [TOKEN],
    moderate: ({ path, body }) => {
      if (path.endsWith("/input") && body?.intent?.payload?.moderation === "hold") return { decision: "hold" };
      if (path.endsWith("/input") && body?.intent?.payload?.moderation === "deny") return { decision: "deny" };
      return { decision: "allow" };
    },
  });
  const baseUrl = await listen(server);
  try {
    const connected = await jsonRequest(baseUrl, "/sessions/connect", {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ sessionId: "session:moderated", clientId: "client:moderated", characterId: "character:player", role: "host", regionId: "region:sofia-south" }),
    });
    assert.equal(connected.response.status, 201);
    const baseRevision = service.state.worldRevision;
    const input = {
      clientInputSeq: 1,
      baseRevision,
      intent: { type: "vehicle_action", actorId: "character:player", regionId: "region:sofia-south", entityIds: [], payload: { moderation: "hold", privatePayload: "must-not-echo" } },
    };
    const held = await jsonRequest(baseUrl, "/sessions/session%3Amoderated/input", {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(input),
    });
    assert.equal(held.response.status, 202);
    assert.deepEqual(held.body, { accepted: false, decision: "moderation-hold", reviewRequired: true });
    assert.equal(service.state.worldRevision, baseRevision);

    const denied = await jsonRequest(baseUrl, "/sessions/session%3Amoderated/input", {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ ...input, intent: { ...input.intent, payload: { moderation: "deny" } } }),
    });
    assert.equal(denied.response.status, 403);
    assert.deepEqual(denied.body, { error: "moderation_denied" });
    assert.equal(service.state.worldRevision, baseRevision);
  } finally {
    await close(server);
  }
});

test("TLS-required configuration fails closed without key and certificate material", () => {
  assert.throws(
    () => createSecureAuthorityHttpServer({ tokens: [TOKEN], requireTls: true }),
    (error) => error instanceof SecureHttpConfigurationError && /key and cert/.test(error.message),
  );
  assert.throws(
    () => createSecureAuthorityHttpServer({ tokens: [TOKEN], tls: { key: "only-key" } }),
    (error) => error instanceof SecureHttpConfigurationError && /key and cert/.test(error.message),
  );
});

