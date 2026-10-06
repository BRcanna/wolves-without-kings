import test from "node:test";
import assert from "node:assert/strict";

import { admitContentPack, createContentRegistry } from "../src/wolves-without-kings/content.mjs";
import { buildVerticalContentPack } from "../src/wolves-without-kings/content-pack.mjs";
import { admitScenarioPack, buildVerticalScenarioPack, createScenarioRegistry } from "../src/wolves-without-kings/scenario-pack.mjs";
import { restoreRuntimeBundle, RuntimeBundleValidationError, snapshotRuntimeBundle } from "../src/wolves-without-kings/runtime-bundle.mjs";
import { runVerticalHistory } from "../src/wolves-without-kings/vertical-slice.mjs";

function buildRuntime() {
  const { world } = runVerticalHistory("relationship");
  const contentPack = buildVerticalContentPack();
  let contentState = createContentRegistry({ packId: contentPack.packId, simulationDate: world.date });
  contentState = admitContentPack(contentState, { expectedRevision: contentState.revision, ...contentPack });
  const scenarioPack = buildVerticalScenarioPack();
  let scenarioState = createScenarioRegistry({
    scenarioPackId: scenarioPack.scenarioPackId,
    contentPackId: scenarioPack.contentPackId,
    simulationDate: world.date,
    knownLocationIds: Object.keys(contentState.locations),
  });
  scenarioState = admitScenarioPack(scenarioState, { expectedRevision: scenarioState.revision, scenes: scenarioPack.scenes });
  return { world, contentState, scenarioState };
}

test("vertical slice bundle restores world, content, and scenario history together", () => {
  const runtime = buildRuntime();
  const bundle = snapshotRuntimeBundle(runtime);
  const restored = restoreRuntimeBundle(bundle);
  assert.deepEqual(restored, runtime);
  assert.equal(restored.scenarioState.contentPackId, restored.contentState.packId);
  assert.equal(restored.world.districtTopology.locations.length, 8);
});

test("bundle restore rejects tampered subsystem history", () => {
  const bundle = snapshotRuntimeBundle(buildRuntime());
  bundle.scenario.state.events[0].hash = "tampered";
  assert.throws(() => restoreRuntimeBundle(bundle), RuntimeBundleValidationError);
});
