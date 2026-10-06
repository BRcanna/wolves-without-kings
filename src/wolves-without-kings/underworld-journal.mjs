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
import { restoreUnderworld, snapshotUnderworld } from "./underworld.mjs";

export const UNDERWORLD_JOURNAL_SCHEMA_VERSION = 1;

export class UnderworldJournalValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnderworldJournalValidationError";
  }
}

function clone(value) { return structuredClone(value); }

function assertFilePath(filePath) {
  if (typeof filePath !== "string" || filePath.trim() === "") throw new UnderworldJournalValidationError("filePath must be a non-empty string");
}

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new UnderworldJournalValidationError(`${field} must be a non-empty string`);
}

function recordHash(record, previousHash) {
  return createHash("sha256").update(`${previousHash ?? "GENESIS"}\n${canonicalJson(record)}`, "utf8").digest("hex");
}

function parseJournal(filePath) {
  assertFilePath(filePath);
  if (!existsSync(filePath)) return { entries: [], recoveredTail: false };

  let raw;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (error) {
    throw new UnderworldJournalValidationError(`journal read failed: ${error.message}`);
  }
  if (raw.length === 0) return { entries: [], recoveredTail: false };

  const hasCompleteFinalLine = raw.endsWith("\n");
  const lines = raw.split(/\r?\n/);
  let recoveredTail = false;
  if (lines.at(-1) === "") lines.pop();
  else if (!hasCompleteFinalLine) {
    lines.pop();
    recoveredTail = true;
  }

  const entries = [];
  let previousHash = null;
  for (const [index, line] of lines.entries()) {
    if (line.trim() === "") throw new UnderworldJournalValidationError(`journal contains a blank record at line ${index + 1}`);
    let record;
    try {
      record = JSON.parse(line);
    } catch (error) {
      throw new UnderworldJournalValidationError(`journal record ${index + 1} is not valid JSON: ${error.message}`);
    }
    if (!record || typeof record !== "object" || Array.isArray(record)) throw new UnderworldJournalValidationError(`journal record ${index + 1} must be an object`);
    if (record.journalSchemaVersion !== UNDERWORLD_JOURNAL_SCHEMA_VERSION) throw new UnderworldJournalValidationError(`unsupported journal schema at record ${index + 1}`);
    if (record.sequence !== index + 1) throw new UnderworldJournalValidationError(`journal sequence is not contiguous at record ${index + 1}`);
    assertNonEmpty(record.checkpointId, `record ${index + 1} checkpointId`);
    assertNonEmpty(record.shardId, `record ${index + 1} shardId`);
    if (record.previousHash !== previousHash) throw new UnderworldJournalValidationError(`journal hash chain is broken at record ${index + 1}`);
    const { hash, ...unsignedRecord } = record;
    if (typeof hash !== "string" || hash !== recordHash(unsignedRecord, record.previousHash)) throw new UnderworldJournalValidationError(`journal record ${index + 1} hash is invalid`);

    let state;
    try {
      state = restoreUnderworld(record.snapshot);
    } catch (error) {
      throw new UnderworldJournalValidationError(`journal record ${index + 1} snapshot is invalid: ${error.message}`);
    }
    if (state.shardId !== record.shardId || state.serverWeek !== record.serverWeek || state.revision !== record.shardRevision) {
      throw new UnderworldJournalValidationError(`journal record ${index + 1} metadata does not match its snapshot`);
    }
    entries.push(clone(record));
    previousHash = record.hash;
  }
  return { entries, recoveredTail };
}

export function readUnderworldJournal(filePath) {
  return parseJournal(filePath);
}

export function appendUnderworldCheckpoint(filePath, state, { checkpointId = "checkpoint:underworld" } = {}) {
  assertFilePath(filePath);
  assertNonEmpty(checkpointId, "checkpointId");

  const existing = parseJournal(filePath);
  const snapshot = snapshotUnderworld(state);
  let restored;
  try {
    restored = restoreUnderworld(snapshot);
  } catch (error) {
    throw new UnderworldJournalValidationError(`cannot checkpoint invalid Underworld state: ${error.message}`);
  }

  const previous = existing.entries.at(-1);
  if (previous?.checkpointId === checkpointId) {
    if (canonicalJson(previous.snapshot) !== canonicalJson(snapshot)) throw new UnderworldJournalValidationError(`checkpointId ${checkpointId} already names a different snapshot`);
    return clone(previous);
  }

  const unsignedRecord = {
    journalSchemaVersion: UNDERWORLD_JOURNAL_SCHEMA_VERSION,
    sequence: existing.entries.length + 1,
    checkpointId,
    shardId: restored.shardId,
    serverWeek: restored.serverWeek,
    shardRevision: restored.revision,
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
    throw new UnderworldJournalValidationError(`journal append failed: ${error.message}`);
  }
  return clone(record);
}

export function restoreLatestUnderworldCheckpoint(filePath) {
  const journal = parseJournal(filePath);
  const record = journal.entries.at(-1);
  if (!record) throw new UnderworldJournalValidationError("journal has no complete checkpoints");
  try {
    return { state: restoreUnderworld(record.snapshot), record: clone(record), recoveredTail: journal.recoveredTail };
  } catch (error) {
    throw new UnderworldJournalValidationError(`latest checkpoint restore failed: ${error.message}`);
  }
}
