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
  AUTHORITY_SCHEMA_VERSION,
  createAuthorityState,
  restoreAuthorityState,
  snapshotAuthorityState,
} from "./authority.mjs";
import { createAuthorityService } from "./service.mjs";

export const AUTHORITY_JOURNAL_SCHEMA_VERSION = 1;

export class AuthorityJournalValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthorityJournalValidationError";
  }
}

function clone(value) { return structuredClone(value); }

function assertFilePath(filePath) {
  if (typeof filePath !== "string" || filePath.trim() === "") throw new AuthorityJournalValidationError("filePath must be a non-empty string");
}

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new AuthorityJournalValidationError(`${field} must be a non-empty string`);
}

function hashRecord(record, previousHash) {
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
    throw new AuthorityJournalValidationError(`journal read failed: ${error.message}`);
  }
  if (raw.length === 0) return { entries: [], recoveredTail: false };
  const lines = raw.split(/\r?\n/);
  let recoveredTail = false;
  if (lines.at(-1) === "") lines.pop();
  else { lines.pop(); recoveredTail = true; }

  const entries = [];
  let previousHash = null;
  for (const [index, line] of lines.entries()) {
    let record;
    try { record = JSON.parse(line); }
    catch (error) { throw new AuthorityJournalValidationError(`journal record ${index + 1} is not valid JSON: ${error.message}`); }
    if (!record || typeof record !== "object" || Array.isArray(record)) throw new AuthorityJournalValidationError(`journal record ${index + 1} must be an object`);
    if (record.journalSchemaVersion !== AUTHORITY_JOURNAL_SCHEMA_VERSION) throw new AuthorityJournalValidationError(`unsupported journal schema at record ${index + 1}`);
    if (record.authoritySchemaVersion !== AUTHORITY_SCHEMA_VERSION) throw new AuthorityJournalValidationError(`unsupported authority schema at record ${index + 1}`);
    if (record.sequence !== index + 1) throw new AuthorityJournalValidationError(`journal sequence is not contiguous at record ${index + 1}`);
    assertNonEmpty(record.checkpointId, `record ${index + 1} checkpointId`);
    if (record.previousHash !== previousHash) throw new AuthorityJournalValidationError(`journal hash chain is broken at record ${index + 1}`);
    const { hash, ...unsignedRecord } = record;
    if (typeof hash !== "string" || hash !== hashRecord(unsignedRecord, record.previousHash)) throw new AuthorityJournalValidationError(`journal record ${index + 1} hash is invalid`);
    let state;
    try { state = restoreAuthorityState(record.snapshot); }
    catch (error) { throw new AuthorityJournalValidationError(`journal record ${index + 1} snapshot is invalid: ${error.message}`); }
    if (state.worldId !== record.worldId || state.worldRevision !== record.worldRevision) throw new AuthorityJournalValidationError(`journal record ${index + 1} metadata does not match its snapshot`);
    entries.push(clone(record));
    previousHash = record.hash;
  }
  return { entries, recoveredTail };
}

export function readAuthorityJournal(filePath) {
  return parseJournal(filePath);
}

export function appendAuthorityCheckpoint(filePath, state, { checkpointId = `checkpoint:authority:${state.worldRevision}` } = {}) {
  assertFilePath(filePath);
  assertNonEmpty(checkpointId, "checkpointId");
  const existing = parseJournal(filePath);
  const snapshot = snapshotAuthorityState(state);
  let restored;
  try { restored = restoreAuthorityState(snapshot); }
  catch (error) { throw new AuthorityJournalValidationError(`cannot checkpoint invalid authority state: ${error.message}`); }

  const previous = existing.entries.at(-1);
  if (previous?.checkpointId === checkpointId) {
    if (canonicalJson(previous.snapshot) !== canonicalJson(snapshot)) throw new AuthorityJournalValidationError(`checkpointId ${checkpointId} already names a different snapshot`);
    return clone(previous);
  }

  const unsignedRecord = {
    journalSchemaVersion: AUTHORITY_JOURNAL_SCHEMA_VERSION,
    authoritySchemaVersion: AUTHORITY_SCHEMA_VERSION,
    sequence: existing.entries.length + 1,
    checkpointId,
    worldId: restored.worldId,
    worldRevision: restored.worldRevision,
    snapshot,
    previousHash: previous?.hash ?? null,
  };
  const record = { ...unsignedRecord, hash: hashRecord(unsignedRecord, unsignedRecord.previousHash) };
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
    throw new AuthorityJournalValidationError(`journal append failed: ${error.message}`);
  }
  return clone(record);
}

export function restoreLatestAuthorityCheckpoint(filePath) {
  const journal = parseJournal(filePath);
  const record = journal.entries.at(-1);
  if (!record) throw new AuthorityJournalValidationError("journal has no complete checkpoints");
  try {
    return { state: restoreAuthorityState(record.snapshot), record: clone(record), recoveredTail: journal.recoveredTail };
  } catch (error) {
    throw new AuthorityJournalValidationError(`latest checkpoint restore failed: ${error.message}`);
  }
}

export function createCheckpointedAuthorityService({
  journalPath,
  initialState,
  resolveIntent,
} = {}) {
  assertFilePath(journalPath);
  let journal = parseJournal(journalPath);
  let state;
  if (journal.entries.length > 0) {
    state = restoreLatestAuthorityCheckpoint(journalPath).state;
  } else {
    const base = initialState ?? createAuthorityState();
    state = restoreAuthorityState(snapshotAuthorityState(base));
    appendAuthorityCheckpoint(journalPath, state, { checkpointId: "checkpoint:authority:initial" });
    journal = parseJournal(journalPath);
  }

  return {
    get state() { return clone(state); },
    get journal() { return clone(journal); },
    request(request = {}) {
      const candidate = createAuthorityService(state, { resolveIntent });
      const result = candidate.request(request);
      const candidateState = candidate.state;
      if (result.status < 400 && candidateState.worldRevision !== state.worldRevision) {
        appendAuthorityCheckpoint(journalPath, candidateState, { checkpointId: `checkpoint:authority:${candidateState.worldRevision}` });
        state = candidateState;
        journal = parseJournal(journalPath);
      }
      return result;
    },
  };
}
