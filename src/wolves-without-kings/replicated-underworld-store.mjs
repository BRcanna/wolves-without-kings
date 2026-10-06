import { existsSync, readFileSync, truncateSync } from "node:fs";

import {
  appendUnderworldCheckpoint,
  readUnderworldJournal,
  restoreLatestUnderworldCheckpoint,
  UnderworldJournalValidationError,
} from "./underworld-journal.mjs";
import { createUnderworldState, restoreUnderworld, snapshotUnderworld } from "./underworld.mjs";

export class ReplicatedUnderworldValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ReplicatedUnderworldValidationError";
  }
}

function clone(value) { return structuredClone(value); }

function assertPath(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new ReplicatedUnderworldValidationError(`${field} must be a non-empty path`);
}

function truncateIncompleteTail(filePath, journal) {
  if (!journal.recoveredTail || !existsSync(filePath)) return journal;
  const raw = readFileSync(filePath, "utf8");
  const newline = raw.lastIndexOf("\n");
  truncateSync(filePath, newline < 0 ? 0 : newline + 1);
  return readUnderworldJournal(filePath);
}

function assertSharedPrefix(primary, replica) {
  const sharedLength = Math.min(primary.entries.length, replica.entries.length);
  for (let index = 0; index < sharedLength; index += 1) {
    if (primary.entries[index].hash !== replica.entries[index].hash || primary.entries[index].checkpointId !== replica.entries[index].checkpointId) {
      throw new ReplicatedUnderworldValidationError(`replica diverges at checkpoint ${index + 1}`);
    }
  }
}

function repairShorterJournal(targetPath, target, source) {
  let repaired = target;
  for (let index = repaired.entries.length; index < source.entries.length; index += 1) {
    const entry = source.entries[index];
    appendUnderworldCheckpoint(targetPath, restoreUnderworld(entry.snapshot), { checkpointId: entry.checkpointId });
    repaired = readUnderworldJournal(targetPath);
  }
  return repaired;
}

function selectAndRepair({ primaryPath, replicaPath, initialState }) {
  let primary = truncateIncompleteTail(primaryPath, readUnderworldJournal(primaryPath));
  let replica = truncateIncompleteTail(replicaPath, readUnderworldJournal(replicaPath));
  assertSharedPrefix(primary, replica);

  if (primary.entries.length === 0 && replica.entries.length === 0) {
    const state = restoreUnderworld(snapshotUnderworld(initialState ?? createUnderworldState()));
    appendUnderworldCheckpoint(primaryPath, state, { checkpointId: "checkpoint:underworld:initial" });
    appendUnderworldCheckpoint(replicaPath, state, { checkpointId: "checkpoint:underworld:initial" });
    primary = readUnderworldJournal(primaryPath);
    replica = readUnderworldJournal(replicaPath);
    return { state, primary, replica };
  }

  const source = primary.entries.length >= replica.entries.length ? primary : replica;
  const sourcePath = source === primary ? primaryPath : replicaPath;
  const targetPath = source === primary ? replicaPath : primaryPath;
  let target = source === primary ? replica : primary;
  target = repairShorterJournal(targetPath, target, source);
  if (sourcePath === primaryPath) replica = target;
  else primary = target;
  const state = restoreLatestUnderworldCheckpoint(sourcePath).state;
  return { state, primary, replica };
}

export function createReplicatedUnderworldStore({ primaryPath, replicaPath, initialState } = {}) {
  assertPath(primaryPath, "primaryPath");
  assertPath(replicaPath, "replicaPath");
  if (primaryPath === replicaPath) throw new ReplicatedUnderworldValidationError("primaryPath and replicaPath must be different");

  let selected;
  try {
    selected = selectAndRepair({ primaryPath, replicaPath, initialState });
  } catch (error) {
    if (error instanceof ReplicatedUnderworldValidationError) throw error;
    if (error instanceof UnderworldJournalValidationError) throw new ReplicatedUnderworldValidationError(`replicated startup rejected: ${error.message}`);
    throw new ReplicatedUnderworldValidationError(`replicated startup failed: ${error.message}`);
  }
  let state = selected.state;
  let journal = { primary: selected.primary, replica: selected.replica };

  return {
    get state() { return clone(state); },
    get journal() { return clone(journal); },
    checkpoint(nextState, { checkpointId = `checkpoint:underworld:${nextState.revision}` } = {}) {
      let validated;
      try {
        validated = restoreUnderworld(snapshotUnderworld(nextState));
      } catch (error) {
        throw new ReplicatedUnderworldValidationError(`cannot checkpoint invalid Underworld state: ${error.message}`);
      }
      appendUnderworldCheckpoint(primaryPath, validated, { checkpointId });
      appendUnderworldCheckpoint(replicaPath, validated, { checkpointId });
      state = validated;
      journal = { primary: readUnderworldJournal(primaryPath), replica: readUnderworldJournal(replicaPath) };
      return { state: clone(state), journal: clone(journal) };
    },
  };
}
