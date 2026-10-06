import test from "node:test";
import assert from "node:assert/strict";

import { createAuthorityHttpServer } from "../src/wolves-without-kings/http-service.mjs";
import { createVerticalScenarioService } from "../src/wolves-without-kings/scenario-service.mjs";

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return `http://127.0.0.1:${server.address().port}`;
}

async function close(server) {
  if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
  });
  return { response, body: await response.json() };
}

test("authoritative scenario service dispatches an authored choice atomically over HTTP", async () => {
  const service = createVerticalScenarioService();
  const server = createAuthorityHttpServer({ service });
  const baseUrl = await listen(server);
  try {
    const initial = await request(baseUrl, "/scenario");
    assert.equal(initial.response.status, 200);
    assert.equal(initial.body.projection.scope, "public");
    assert.equal(initial.body.content.counts.locations, 8);
    assert.equal(initial.body.scenario.activeSceneId, "scene:market-lights");
    const command = {
      expectedWorldRevision: initial.body.worldRevision,
      expectedScenarioRevision: initial.body.scenarioRevision,
      sceneId: "scene:market-lights",
      choiceId: "choice:listen",
      actorId: "character:player",
    };
    const result = await request(baseUrl, "/scenario/choice", { method: "POST", body: JSON.stringify(command) });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.accepted, true);
    assert.equal(result.body.resolution.branch, "observe");
    assert.equal(result.body.scenario.activeSceneId, "scene:market-followup");
    assert.equal(result.body.worldRevision, initial.body.worldRevision + 1);
    assert.equal(result.body.scenarioRevision, initial.body.scenarioRevision + 1);
    const serialized = JSON.stringify(result.body);
    assert.doesNotMatch(serialized, /"beliefs"|"hiddenCompetence"|"caseConfidence"/i);
    assert.match(serialized, /event hashes/);
  } finally {
    await close(server);
  }
});

test("authoritative scenario service rejects stale dispatch without partial world or scenario mutation", async () => {
  const service = createVerticalScenarioService();
  const before = service.state;
  const result = service.request({
    method: "POST",
    path: "/scenario/choice",
    body: {
      expectedWorldRevision: before.world.revision - 1,
      expectedScenarioRevision: before.scenarioState.revision,
      sceneId: "scene:market-lights",
      choiceId: "choice:listen",
    },
  });
  assert.equal(result.status, 409);
  assert.equal(result.body.error, "stale_world_revision");
  assert.deepEqual(service.state, before);
});
