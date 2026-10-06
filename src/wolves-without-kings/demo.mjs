import { admitContentPack, createContentRegistry, projectContent } from "./content.mjs";
import { buildVerticalContentPack } from "./content-pack.mjs";
import { projectWorld } from "./projection.mjs";
import { admitScenarioPack, buildVerticalScenarioPack, createScenarioRegistry, projectScenario, resolveScenarioChoice } from "./scenario-pack.mjs";
import { applyVerticalScenarioChoice } from "./scenario-runtime.mjs";
import { restoreRuntimeBundle, snapshotRuntimeBundle } from "./runtime-bundle.mjs";
import { runVerticalHistory } from "./vertical-slice.mjs";

const { world: settledWorld } = runVerticalHistory("relationship");
const contentPack = buildVerticalContentPack();
let contentState = createContentRegistry({ packId: contentPack.packId, simulationDate: settledWorld.date });
contentState = admitContentPack(contentState, { expectedRevision: contentState.revision, ...contentPack });
const scenarioPack = buildVerticalScenarioPack();
let scenarioState = createScenarioRegistry({
  scenarioPackId: scenarioPack.scenarioPackId,
  contentPackId: scenarioPack.contentPackId,
  simulationDate: settledWorld.date,
  knownLocationIds: Object.keys(contentState.locations),
});
scenarioState = admitScenarioPack(scenarioState, { expectedRevision: scenarioState.revision, scenes: scenarioPack.scenes });
const world = applyVerticalScenarioChoice(settledWorld, { expectedRevision: settledWorld.revision, choiceId: "choice:delegate-check" });
scenarioState = resolveScenarioChoice(scenarioState, {
  expectedRevision: scenarioState.revision,
  sceneId: "scene:market-lights",
  choiceId: "choice:delegate-check",
});
const bundle = snapshotRuntimeBundle({ world, contentState, scenarioState });
const restored = restoreRuntimeBundle(bundle);

console.log(JSON.stringify({
  demoVersion: 2,
  world: {
    date: world.date,
    revision: world.revision,
    lastEventType: world.events.at(-1).eventType,
  },
  content: projectContent(contentState),
  scenario: projectScenario(scenarioState),
  publicProjectionScope: projectWorld(world, { scope: "public" }).scope,
  runtimeBundleRestored: JSON.stringify(restored) === JSON.stringify({ world, contentState, scenarioState }),
}, null, 2));
