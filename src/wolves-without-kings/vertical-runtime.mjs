import { admitContentPack, createContentRegistry, projectContent } from "./content.mjs";
import { assertVerticalContentMatchesWorld, buildVerticalContentPack } from "./content-pack.mjs";
import { projectWorld } from "./projection.mjs";
import { admitScenarioPack, buildVerticalScenarioPack, createScenarioRegistry, projectScenario, resolveScenarioChoice } from "./scenario-pack.mjs";
import { applyVerticalScenarioChoice } from "./scenario-runtime.mjs";
import { runVerticalHistory } from "./vertical-slice.mjs";

function clone(value) { return structuredClone(value); }

export function createVerticalRuntime({ historyVariant = "relationship" } = {}) {
  const { world } = runVerticalHistory(historyVariant);
  const contentPack = buildVerticalContentPack();
  assertVerticalContentMatchesWorld(contentPack, world);
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

export function projectVerticalRuntime({ world, contentState, scenarioState } = {}) {
  if (!world || !contentState || !scenarioState) throw new TypeError("world, contentState, and scenarioState are required");
  return {
    worldRevision: world.revision,
    scenarioRevision: scenarioState.revision,
    projection: projectWorld(world, { scope: "public" }),
    content: projectContent(contentState),
    scenario: projectScenario(scenarioState, { scope: "public" }),
  };
}

export function dispatchVerticalScenarioChoice(
  runtime,
  { expectedWorldRevision, expectedScenarioRevision, sceneId, choiceId, actorId = "character:player" } = {},
) {
  if (!runtime?.world || !runtime?.scenarioState) throw new TypeError("runtime with world and scenarioState is required");
  // Both transitions run against clones. Nothing is committed unless the scene and the
  // authoritative world mutation validate together.
  const nextScenarioState = resolveScenarioChoice(clone(runtime.scenarioState), {
    expectedRevision: expectedScenarioRevision,
    sceneId,
    choiceId,
    actorId,
  });
  const nextWorld = applyVerticalScenarioChoice(clone(runtime.world), {
    expectedRevision: expectedWorldRevision,
    choiceId,
    actorId,
  });
  return {
    runtime: {
      world: nextWorld,
      contentState: clone(runtime.contentState),
      scenarioState: nextScenarioState,
    },
    resolution: clone(nextScenarioState.resolutions.at(-1)),
  };
}
