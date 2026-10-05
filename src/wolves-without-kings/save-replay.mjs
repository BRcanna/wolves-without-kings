import {
  advanceTime,
  canonicalJson,
  restore,
  snapshot,
} from "./engine.mjs";

export const SAVE_REPLAY_SCHEMA_VERSION = 1;

export class SaveReplayValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "SaveReplayValidationError";
  }
}

function clone(value) {
  return structuredClone(value);
}

function assertNonEmptyString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new SaveReplayValidationError(`${field} must be a non-empty string`);
  }
}

function assertPositiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) {
    throw new SaveReplayValidationError(`${field} must be a positive integer`);
  }
}

function restoreEngineSnapshot(engineSnapshot) {
  try {
    return restore(engineSnapshot);
  } catch (error) {
    throw new SaveReplayValidationError(`invalid engine snapshot: ${error.message}`);
  }
}

export function createSaveBundle(world, { checkpointId = "checkpoint:manual" } = {}) {
  assertNonEmptyString(checkpointId, "checkpointId");
  const engineSnapshot = snapshot(world);
  return {
    saveReplaySchemaVersion: SAVE_REPLAY_SCHEMA_VERSION,
    checkpointId,
    simulationDate: world.date,
    worldRevision: world.revision,
    eventCount: world.events.length,
    digest: canonicalJson(engineSnapshot),
    snapshot: engineSnapshot,
  };
}

export function migrateSaveBundle(bundle) {
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) {
    throw new SaveReplayValidationError("save bundle must be an object");
  }

  if (bundle.saveReplaySchemaVersion === SAVE_REPLAY_SCHEMA_VERSION) {
    return clone(bundle);
  }

  if (bundle.saveReplaySchemaVersion === 0 && bundle.world) {
    const world = restoreEngineSnapshot({
      snapshotVersion: 1,
      engineSchemaVersion: bundle.world.schemaVersion,
      world: bundle.world,
    });
    return createSaveBundle(world, {
      checkpointId: bundle.checkpointId ?? "checkpoint:migrated-v0",
    });
  }

  throw new SaveReplayValidationError("unsupported save-replay schema version");
}

export function restoreSaveBundle(bundle) {
  const current = migrateSaveBundle(bundle);
  assertNonEmptyString(current.checkpointId, "checkpointId");
  if (current.digest !== canonicalJson(current.snapshot)) {
    throw new SaveReplayValidationError("save digest does not match its snapshot");
  }

  const world = restoreEngineSnapshot(current.snapshot);
  if (world.date !== current.simulationDate || world.revision !== current.worldRevision) {
    throw new SaveReplayValidationError("save metadata does not match restored world");
  }
  if (world.events.length !== current.eventCount) {
    throw new SaveReplayValidationError("save event count does not match restored world");
  }
  return world;
}

export function replayFromCheckpoint(bundle, { days, actorId = "system:replay" }) {
  assertPositiveInteger(days, "days");
  assertNonEmptyString(actorId, "actorId");
  const world = restoreSaveBundle(bundle);
  const replayed = advanceTime(world, {
    expectedRevision: world.revision,
    days,
    actorId,
  });
  return createSaveBundle(replayed, {
    checkpointId: `${bundle.checkpointId}:replay-${days}d`,
  });
}

export function branchCounterfactual(bundle, transform, { checkpointId = "checkpoint:counterfactual" } = {}) {
  if (typeof transform !== "function") {
    throw new SaveReplayValidationError("counterfactual transform must be a function");
  }
  const canonicalWorld = restoreSaveBundle(bundle);
  const branchInput = clone(canonicalWorld);
  const branchWorld = transform(branchInput);
  if (!branchWorld || typeof branchWorld !== "object" || Array.isArray(branchWorld)) {
    throw new SaveReplayValidationError("counterfactual transform must return a world");
  }
  return {
    canonicalDigest: canonicalJson(snapshot(canonicalWorld)),
    branch: createSaveBundle(branchWorld, { checkpointId }),
  };
}
