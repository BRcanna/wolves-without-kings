import test from "node:test";
import assert from "node:assert/strict";

import { createPreviewServer } from "../src/wolves-without-kings/preview-server.mjs";

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

test("preview server serves committed assets and authoritative scenario API together", async () => {
  const server = createPreviewServer();
  const baseUrl = await listen(server);
  try {
    const page = await fetch(`${baseUrl}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /WOLVES WITHOUT KINGS/);
    const scenarioResponse = await fetch(`${baseUrl}/scenario`);
    const scenario = await scenarioResponse.json();
    assert.equal(scenarioResponse.status, 200);
    assert.equal(scenario.projection.scope, "public");
    const sessionResponse = await fetch(`${baseUrl}/scenario/sessions/connect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "preview:server", clientId: "client:server", characterId: "character:player" }),
    });
    assert.equal(sessionResponse.status, 201);
    const choiceResponse = await fetch(`${baseUrl}/scenario/choice`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedWorldRevision: scenario.worldRevision,
        expectedScenarioRevision: scenario.scenarioRevision,
        sessionId: "preview:server",
        sceneId: "scene:market-lights",
        choiceId: "choice:meet-owner",
      }),
    });
    const choice = await choiceResponse.json();
    assert.equal(choiceResponse.status, 200);
    assert.equal(choice.resolution.branch, "meet");
    assert.equal(choice.scenario.activeSceneId, "scene:market-followup");
    const missing = await fetch(`${baseUrl}/not-a-preview-file`);
    assert.equal(missing.status, 404);
  } finally {
    await close(server);
  }
});
