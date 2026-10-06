import { existsSync, readFileSync, truncateSync } from "node:fs";

import {
  appendAuthorityCheckpoint,
  readAuthorityJournal,
  restoreLatestAuthorityCheckpoint,
  AuthorityJournalValidationError,
} from "./authority-journal.mjs";
import { createAuthorityState, restoreAuthorityState } from "./authority.mjs";
import { createAuthorityService } from "./service.mjs";

export class ReplicatedAuthorityValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ReplicatedAuthorityValidationError";
  }
}

function clone(value) { return structuredClone(value); }

function assertPath(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new ReplicatedAuthorityValidationError(`${field} must be a non-empty path`);
}

function truncateIncompleteTail(filePath, journal) {
  if (!journal.recoveredTail || !existsSync(filePath)) return journal;
  const raw = readFileSync(filePath, "utf8");
  const newline = raw.lastIndexOf("\n");
  truncateSync(filePath, newline < 0 ? 0 : newline + 1);
  return readAuthorityJournal(filePath);
}

function assertSharedPrefix(primary, replica) {
  const sharedLength = Math.min(primary.entries.length, replica.entries.length);
  for (let index = 0; index < sharedLength; index += 1) {
    if (primary.entries[index].hash !== replica.entries[index].hash || primary.entries[index].checkpointId !== replica.entries[index].checkpointId) {
      throw new ReplicatedAuthorityValidationError(`replica diverges at checkpoint ${index + 1}`);
    }
  }
}

function repairShorterJournal(targetPath, target, source) {
  let repaired = target;
  for (let index = repaired.entries.length; index < source.entries.length; index += 1) {
    const entry = source.entries[index];
    appendAuthorityCheckpoint(targetPath, restoreAuthorityState(entry.snapshot), { checkpointId: entry.checkpointId });
    repaired = readAuthorityJournal(targetPath);
  }
  return repaired;
}

function selectAndRepair({ primaryPath, replicaPath, initialState }) {
  let primary = truncateIncompleteTail(primaryPath, readAuthorityJournal(primaryPath));
  let replica = truncateIncompleteTail(replicaPath, readAuthorityJournal(replicaPath));
  assertSharedPrefix(primary, replica);

  if (primary.entries.length === 0 && replica.entries.length === 0) {
    const state = restoreAuthorityState({ snapshotVersion: 1, state: clone(initialState ?? createAuthorityState()) });
    appendAuthorityCheckpoint(primaryPath, state, { checkpointId: "checkpoint:authority:initial" });
    appendAuthorityCheckpoint(replicaPath, state, { checkpointId: "checkpoint:authority:initial" });
    primary = readAuthorityJournal(primaryPath);
    replica = readAuthorityJournal(replicaPath);
    return { state, primary, replica };
  }

  const source = primary.entries.length >= replica.entries.length ? primary : replica;
  const sourcePath = source === primary ? primaryPath : replicaPath;
  const targetPath = source === primary ? replicaPath : primaryPath;
  let target = source === primary ? replica : primary;
  target = repairShorterJournal(targetPath, target, source);
  if (sourcePath === primaryPath) replica = target;
  else primary = target;
  const state = restoreLatestAuthorityCheckpoint(sourcePath).state;
  return { state, primary, replica };
}

export function createReplicatedAuthorityService({
  primaryPath,
  replicaPath,
  initialState,
  resolveIntent,
} = {}) {
  assertPath(primaryPath, "primaryPath");
  assertPath(replicaPath, "replicaPath");
  if (primaryPath === replicaPath) throw new ReplicatedAuthorityValidationError("primaryPath and replicaPath must be different");

  let selected;
  try {
    selected = selectAndRepair({ primaryPath, replicaPath, initialState });
  } catch (error) {
    if (error instanceof ReplicatedAuthorityValidationError) throw error;
    if (error instanceof AuthorityJournalValidationError) throw new ReplicatedAuthorityValidationError(`replicated startup rejected: ${error.message}`);
    throw new ReplicatedAuthorityValidationError(`replicated startup failed: ${error.message}`);
  }
  let state = selected.state;
  let journal = { primary: selected.primary, replica: selected.replica };

  return {
    get state() { return clone(state); },
    get journal() { return clone(journal); },
    request(request = {}) {
      const candidate = createAuthorityService(state, { resolveIntent });
      const result = candidate.request(request);
      const candidateState = candidate.state;
      if (result.status < 400 && candidateState.worldRevision !== state.worldRevision) {
        const checkpointId = `checkpoint:authority:${candidateState.worldRevision}`;
        appendAuthorityCheckpoint(primaryPath, candidateState, { checkpointId });
        appendAuthorityCheckpoint(replicaPath, candidateState, { checkpointId });
        state = candidateState;
        journal = { primary: readAuthorityJournal(primaryPath), replica: readAuthorityJournal(replicaPath) };
      }
      return result;
    },
  };
}
