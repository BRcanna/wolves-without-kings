import test from "node:test";
import assert from "node:assert/strict";

import { createAuthorityService } from "../src/wolves-without-kings/service.mjs";
import { createOperationalAuthorityHttpServer } from "../src/wolves-without-kings/operational-http-service.mjs";

async function listen(runtime) {
  await new Promise((resolve, reject) => {
    runtime.server.once("error", reject);
    runtime.server.listen(0, "127.0.0.1", resolve);
  });
  const address = runtime.server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function close(runtime) {
  if (!runtime.server.listening) return;
  runtime.markDraining();
  await runtime.drain({ timeoutMs: 1000 });
  await new Promise((resolve, reject) => runtime.server.close((error) => error ? reject(error) : resolve()));
  runtime.markStopped();
}

async function jsonRequest(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
  });
  return { response, body: await response.json() };
}

const TOKEN = "operational-test-token";
const session = {
  sessionId: "session:operational",
  clientId: "client:operational",
  characterId: "character:player",
  role: "host",
  regionId: "region:sofia-south",
};

test("operational wrapper exposes readiness and authenticates normal traffic", async () => {
  const runtime = createOperationalAuthorityHttpServer({
    service: createAuthorityService(),
    tokens: [TOKEN],
  });
  const baseUrl = await listen(runtime);
  try {
    assert.equal(runtime.lifecycle, "ready");
    const health = await jsonRequest(baseUrl, "/health", { headers: {} });
    assert.equal(health.response.status, 200);
    assert.equal(health.body.lifecycle, "ready");
    const ready = await jsonRequest(baseUrl, "/ready", { headers: {} });
    assert.equal(ready.response.status, 200);
    const connected = await jsonRequest(baseUrl, "/sessions/connect", {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(session),
    });
    assert.equal(connected.response.status, 201);
  } finally {
    await close(runtime);
  }
});

test("in-flight limits and graceful drain reject new mutation traffic without interrupting active work", async () => {
  let releaseModeration;
  let moderationStarted;
  const moderationReady = new Promise((resolve) => { moderationStarted = resolve; });
  const service = createAuthorityService();
  const runtime = createOperationalAuthorityHttpServer({
    service,
    tokens: [TOKEN],
    maxInFlight: 1,
    moderate: async ({ path }) => {
      if (path.endsWith("/input")) {
        moderationStarted();
        await new Promise((resolve) => { releaseModeration = resolve; });
      }
      return { decision: "allow" };
    },
  });
  const baseUrl = await listen(runtime);
  try {
    await jsonRequest(baseUrl, "/sessions/connect", {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(session),
    });
    const baseRevision = service.state.worldRevision;
    const activeRequest = jsonRequest(baseUrl, "/sessions/session%3Aoperational/input", {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({
        clientInputSeq: 1,
        baseRevision,
        intent: { type: "vehicle_action", actorId: "character:player", regionId: "region:sofia-south", entityIds: [], payload: {} },
      }),
    });
    await moderationReady;
    assert.equal(runtime.activeRequests, 1);

    const overloaded = await jsonRequest(baseUrl, "/sessions/session%3Aoperational/input", {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({
        clientInputSeq: 2,
        baseRevision,
        intent: { type: "vehicle_action", actorId: "character:player", regionId: "region:sofia-south", entityIds: [], payload: {} },
      }),
    });
    assert.equal(overloaded.response.status, 503);
    assert.deepEqual(overloaded.body, { error: "service_overloaded" });

    const draining = runtime.drain({ timeoutMs: 1000 });
    const rejectedDuringDrain = await jsonRequest(baseUrl, "/sessions/connect", {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ ...session, sessionId: "session:draining" }),
    });
    assert.equal(rejectedDuringDrain.response.status, 503);
    assert.deepEqual(rejectedDuringDrain.body, { error: "service_draining" });
    releaseModeration();
    const accepted = await activeRequest;
    assert.equal(accepted.response.status, 200);
    assert.deepEqual(await draining, { drained: true, activeRequests: 0 });
    assert.equal(service.state.worldRevision > baseRevision, true);
  } finally {
    await close(runtime);
  }
});

