import test from "node:test";
import assert from "node:assert/strict";

import { admitContentPack, createContentRegistry } from "../src/wolves-without-kings/content.mjs";
import { buildVerticalContentPack } from "../src/wolves-without-kings/content-pack.mjs";
import {
  admitScenarioPack,
  buildVerticalScenarioPack,
  createScenarioRegistry,
  projectScenario,
  resolveScenarioChoice,
  restoreScenario,
  snapshotScenario,
  ScenarioValidationError,
} from "../src/wolves-without-kings/scenario-pack.mjs";

function admittedScenario() {
  const contentPack = buildVerticalContentPack();
  let content = createContentRegistry({ packId: contentPack.packId });
  content = admitContentPack(content, { expectedRevision: content.revision, ...contentPack });
  const pack = buildVerticalScenarioPack();
  let state = createScenarioRegistry({ scenarioPackId: pack.scenarioPackId, contentPackId: pack.contentPackId, knownLocationIds: Object.keys(content.locations) });
  state = admitScenarioPack(state, { expectedRevision: state.revision, scenes: pack.scenes });
  return state;
}

test("vertical scenario pack admits, branches, projects, and restores without private authoring state", () => {
  let state = admittedScenario();
  const initial = projectScenario(state);
  assert.equal(initial.scenes.length, 2);
  assert.equal(initial.scenes[0].choices.length, 3);
  assert.deepEqual(initial.resolutions, []);
  state = resolveScenarioChoice(state, { expectedRevision: state.revision, sceneId: "scene:market-lights", choiceId: "choice:delegate-check" });
  const projected = projectScenario(state);
  assert.equal(projected.activeSceneId, "scene:market-followup");
  assert.equal(projected.simulationDate, "1998-01-01");
  assert.equal(projected.resolutions[0].branch, "delegate");
  assert.deepEqual(restoreScenario(snapshotScenario(state)), state);
  assert.deepEqual(projected.omittedFields, ["authoring metadata", "private prerequisites", "event hashes"]);
});

test("scenario admission rejects unknown topology and stale writes before mutation", () => {
  const contentPack = buildVerticalContentPack();
  let state = createScenarioRegistry({ scenarioPackId: "pack:scenario:invalid", contentPackId: contentPack.packId, knownLocationIds: ["loc:market-street"] });
  const invalid = { id: "scene:invalid", title: "Invalid", locationId: "loc:missing", summary: "Invalid", choices: [{ id: "choice:one", label: "Listen", branch: "observe", publicCue: "learn", nextSceneId: null }] };
  assert.throws(() => admitScenarioPack(state, { expectedRevision: state.revision, scenes: [invalid] }), ScenarioValidationError);
  assert.equal(Object.keys(state.scenes).length, 0);
  assert.throws(() => admitScenarioPack(state, { expectedRevision: 1, scenes: [] }), /stale scenario command/);
});
