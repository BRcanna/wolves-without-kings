import { restore, snapshot } from "./engine.mjs";
import { restoreContent, snapshotContent } from "./content.mjs";
import { restoreScenario, snapshotScenario } from "./scenario-pack.mjs";

export const RUNTIME_BUNDLE_VERSION = 1;

export class RuntimeBundleValidationError extends Error {
  constructor(message) { super(message); this.name = "RuntimeBundleValidationError"; }
}

function clone(value) { return structuredClone(value); }

function assertRegistryBinding(contentState, scenarioState) {
  if (scenarioState.contentPackId !== contentState.packId) throw new RuntimeBundleValidationError("scenario registry is bound to a different content pack");
  const contentLocationIds = Object.keys(contentState.locations).sort();
  const scenarioLocationIds = [...scenarioState.knownLocationIds].sort();
  if (JSON.stringify(contentLocationIds) !== JSON.stringify(scenarioLocationIds)) throw new RuntimeBundleValidationError("scenario registry locations do not match the content registry");
}

export function snapshotRuntimeBundle({ world, contentState, scenarioState } = {}) {
  if (!world || !contentState || !scenarioState) throw new RuntimeBundleValidationError("world, contentState, and scenarioState are required");
  assertRegistryBinding(contentState, scenarioState);
  return {
    bundleVersion: RUNTIME_BUNDLE_VERSION,
    engine: snapshot(world),
    content: snapshotContent(contentState),
    scenario: snapshotScenario(scenarioState),
  };
}

export function restoreRuntimeBundle(bundle) {
  if (!bundle || bundle.bundleVersion !== RUNTIME_BUNDLE_VERSION) throw new RuntimeBundleValidationError("unsupported runtime bundle version");
  let world;
  let contentState;
  let scenarioState;
  try {
    world = restore(bundle.engine);
    contentState = restoreContent(bundle.content);
    scenarioState = restoreScenario(bundle.scenario);
  } catch (error) {
    throw new RuntimeBundleValidationError(`runtime bundle restore failed: ${error.message}`);
  }
  assertRegistryBinding(contentState, scenarioState);
  return { world: clone(world), contentState: clone(contentState), scenarioState: clone(scenarioState) };
}
