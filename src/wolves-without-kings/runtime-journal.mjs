import { createHash } from "node:crypto";
import {
  appendFileSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
} from "node:fs";
import { dirname } from "node:path";

import { canonicalJson } from "./engine.mjs";
import {
  REGIONAL_RUNTIME_SCHEMA_VERSION,
  restoreRegionalRuntime,
  snapshotRegionalRuntime,
} from "./regional-runtime.mjs";

export const RUNTIME_JOURNAL_SCHEMA_VERSION = 1;

export class RuntimeJournalValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "RuntimeJournalValidationError";
  }
}

function clone(value) {
  return structuredClone(value);
}

function assertFilePath(filePath) {
  if (typeof filePath !== "string" || filePath.trim() === "") {
    throw new RuntimeJournalValidationError("filePath must be a non-empty string");
  }
}

function assertNonEmptyString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new RuntimeJournalValidationError(`${field} must be a non-empty string`);
  }
}

function recordHash(record, previousHash) {
  return createHash("sha256")
    .update(`${previousHash ?? "GENESIS"}\n${canonicalJson(record)}`)
    .digest("hex");
}

function parseJournal(filePath) {
  assertFilePath(filePath);
  if (!existsSync(filePath)) return { entries: [], recoveredTail: false };

  let raw;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (error) {
    throw new RuntimeJournalValidationError(`journal read failed: ${error.message}`);
  }

  if (raw.length === 0) return { entries: [], recoveredTail: false };
  const hasCompleteFinalLine = raw.endsWith("\n");
  const lines = raw.split(/\r?\n/);
  let recoveredTail = false;
  if (lines.at(-1) === "") {
    lines.pop();
  } else if (!hasCompleteFinalLine) {
    lines.pop();
    recoveredTail = true;
  }

  const entries = [];
  let previousHash = null;
  for (const [index, line] of lines.entries()) {
    if (line.trim() === "") {
      throw new RuntimeJournalValidationError(`journal contains a blank record at line ${index + 1}`);
    }

    let record;
    try {
      record = JSON.parse(line);
    } catch (error) {
      throw new RuntimeJournalValidationError(`journal record ${index + 1} is not valid JSON: ${error.message}`);
    }
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new RuntimeJournalValidationError(`journal record ${index + 1} must be an object`);
    }
    if (record.journalSchemaVersion !== RUNTIME_JOURNAL_SCHEMA_VERSION) {
      throw new RuntimeJournalValidationError(`unsupported journal schema at record ${index + 1}`);
    }
    if (record.sequence !== index + 1) {
      throw new RuntimeJournalValidationError(`journal sequence is not contiguous at record ${index + 1}`);
    }
    assertNonEmptyString(record.checkpointId, `record ${index + 1} checkpointId`);
    assertNonEmptyString(record.runtimeId, `record ${index + 1} runtimeId`);
    if (record.previousHash !== previousHash) {
      throw new RuntimeJournalValidationError(`journal hash chain is broken at record ${index + 1}`);
    }
    const { hash, ...unsignedRecord } = record;
    if (typeof hash !== "string" || hash !== recordHash(unsignedRecord, record.previousHash)) {
      throw new RuntimeJournalValidationError(`journal record ${index + 1} hash is invalid`);
    }

    let state;
    try {
      state = restoreRegionalRuntime(record.snapshot);
    } catch (error) {
      throw new RuntimeJournalValidationError(`journal record ${index + 1} snapshot is invalid: ${error.message}`);
    }
    if (state.runtimeId !== record.runtimeId || state.simulationDate !== record.simulationDate || state.revision !== record.runtimeRevision) {
      throw new RuntimeJournalValidationError(`journal record ${index + 1} metadata does not match its snapshot`);
    }
    entries.push(clone(record));
    previousHash = record.hash;
  }
  return { entries, recoveredTail };
}

export function readRegionalRuntimeJournal(filePath) {
  return parseJournal(filePath);
}

export function appendRegionalRuntimeCheckpoint(
  filePath,
  state,
  { checkpointId = "checkpoint:regional-runtime" } = {},
) {
  assertFilePath(filePath);
  assertNonEmptyString(checkpointId, "checkpointId");

  const existing = parseJournal(filePath);
  const snapshot = snapshotRegionalRuntime(state);
  let restored;
  try {
    restored = restoreRegionalRuntime(snapshot);
  } catch (error) {
    throw new RuntimeJournalValidationError(`cannot checkpoint invalid regional runtime: ${error.message}`);
  }

  const previous = existing.entries.at(-1);
  if (previous?.checkpointId === checkpointId) {
    if (canonicalJson(previous.snapshot) !== canonicalJson(snapshot)) {
      throw new RuntimeJournalValidationError(`checkpointId ${checkpointId} already names a different snapshot`);
    }
    return clone(previous);
  }

  const unsignedRecord = {
    journalSchemaVersion: RUNTIME_JOURNAL_SCHEMA_VERSION,
    sequence: existing.entries.length + 1,
    checkpointId,
    runtimeId: restored.runtimeId,
    simulationDate: restored.simulationDate,
    runtimeRevision: restored.revision,
    snapshot,
    previousHash: previous?.hash ?? null,
  };
  const record = { ...unsignedRecord, hash: recordHash(unsignedRecord, unsignedRecord.previousHash) };

  try {
    mkdirSync(dirname(filePath), { recursive: true });
    const descriptor = openSync(filePath, "a");
    try {
      appendFileSync(descriptor, `${JSON.stringify(record)}\n`, "utf8");
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
  } catch (error) {
    throw new RuntimeJournalValidationError(`journal append failed: ${error.message}`);
  }
  return clone(record);
}

export function restoreLatestRegionalRuntimeCheckpoint(filePath) {
  const journal = parseJournal(filePath);
  const record = journal.entries.at(-1);
  if (!record) throw new RuntimeJournalValidationError("journal has no complete checkpoints");
  try {
    return {
      state: restoreRegionalRuntime(record.snapshot),
      record: clone(record),
      recoveredTail: journal.recoveredTail,
    };
  } catch (error) {
    throw new RuntimeJournalValidationError(`latest checkpoint restore failed: ${error.message}`);
  }
}

