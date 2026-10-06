import test from "node:test";
import assert from "node:assert/strict";

import { createAuthorityService } from "../src/wolves-without-kings/service.mjs";
import { createAuthorityHttpServer } from "../src/wolves-without-kings/http-service.mjs";

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

test("loopback HTTP adapter exposes health and ordered authority input", async () => {
  const service = createAuthorityService();
  const server = createAuthorityHttpServer({ service });
  const baseUrl = await listen(server);
  try {
    const health = await jsonRequest(baseUrl, "/health", { headers: {} });
    assert.equal(health.response.status, 200);
    assert.equal(health.body.mode, "in-process");

    const connected = await jsonRequest(baseUrl, "/sessions/connect", {
      method: "POST",
      body: JSON.stringify({
        sessionId: "session:host",
        clientId: "client:host",
        characterId: "character:host",
        role: "host",
        regionId: "region:sofia-south",
      }),
    });
    assert.equal(connected.response.status, 201);

    const accepted = await jsonRequest(baseUrl, "/sessions/session%3Ahost/input", {
      method: "POST",
      body: JSON.stringify({
        clientInputSeq: 1,
        baseRevision: service.state.worldRevision,
        intent: {
          type: "vehicle_action",
          actorId: "character:host",
          regionId: "region:sofia-south",
          entityIds: [],
          payload: { direction: "south" },
        },
      }),
    });
    assert.equal(accepted.response.status, 200);
    assert.equal(accepted.body.accepted, true);
    assert.equal(Object.hasOwn(accepted.body, "payload"), false);
  } finally {
    await close(server);
  }
});

test("loopback HTTP adapter preserves stale/duplicate semantics and bounded JSON errors", async () => {
  const service = createAuthorityService();
  const server = createAuthorityHttpServer({ service });
  const baseUrl = await listen(server);
  try {
    const malformed = await fetch(`${baseUrl}/sessions/connect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).error, "invalid_http_request");

    await jsonRequest(baseUrl, "/sessions/connect", {
      method: "POST",
      body: JSON.stringify({
        sessionId: "session:host",
        clientId: "client:host",
        characterId: "character:host",
        role: "host",
        regionId: "region:sofia-south",
      }),
    });
    const input = {
      clientInputSeq: 1,
      baseRevision: service.state.worldRevision,
      intent: { type: "vehicle_action", actorId: "character:host", regionId: "region:sofia-south", entityIds: [], payload: {} },
    };
    const accepted = await jsonRequest(baseUrl, "/sessions/session%3Ahost/input", { method: "POST", body: JSON.stringify(input) });
    assert.equal(accepted.response.status, 200);
    const duplicate = await jsonRequest(baseUrl, "/sessions/session%3Ahost/input", {
      method: "POST",
      body: JSON.stringify({ ...input, baseRevision: service.state.worldRevision }),
    });
    assert.equal(duplicate.response.status, 409);
    assert.equal(duplicate.body.error, "duplicate_input");
    const stale = await jsonRequest(baseUrl, "/sessions/session%3Ahost/input", {
      method: "POST",
      body: JSON.stringify({ ...input, clientInputSeq: 2, baseRevision: 0 }),
    });
    assert.equal(stale.response.status, 409);
    assert.equal(stale.body.error, "stale_input");
  } finally {
    await close(server);
  }
});
