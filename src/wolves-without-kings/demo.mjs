import { projectWorld } from "./projection.mjs";
import { projectContent } from "./content.mjs";
import { projectScenario } from "./scenario-pack.mjs";
import { restoreRuntimeBundle, snapshotRuntimeBundle } from "./runtime-bundle.mjs";
import { createVerticalRuntime, dispatchVerticalScenarioChoice } from "./vertical-runtime.mjs";

const initialRuntime = createVerticalRuntime();
const { runtime: finalRuntime } = dispatchVerticalScenarioChoice(initialRuntime, {
  expectedWorldRevision: initialRuntime.world.revision,
  expectedScenarioRevision: initialRuntime.scenarioState.revision,
  sceneId: "scene:market-lights",
  choiceId: "choice:delegate-check",
});
const { world, contentState, scenarioState } = finalRuntime;
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
