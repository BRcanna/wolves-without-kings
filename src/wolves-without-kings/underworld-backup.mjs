import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { canonicalJson } from "./engine.mjs";
import { readUnderworldJournal, restoreLatestUnderworldCheckpoint } from "./underworld-journal.mjs";

export const UNDERWORLD_BACKUP_SCHEMA_VERSION = 1;

export class UnderworldBackupValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnderworldBackupValidationError";
  }
}

function clone(value) { return structuredClone(value); }

function assertPath(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new UnderworldBackupValidationError(`${field} must be a non-empty path`);
}

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new UnderworldBackupValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) throw new UnderworldBackupValidationError(`${field} must be an integer >= ${minimum}`);
}

function backupDigest(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function journalLines(entries) {
  return `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`;
}

function writeTextAtomically(filePath, text) {
  mkdirSync(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  const descriptor = openSync(temporaryPath, "w");
  try {
    writeFileSync(descriptor, text, "utf8");
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  try {
    renameSync(temporaryPath, filePath);
  } catch (error) {
    if (!['EPERM', 'EXDEV'].includes(error.code)) throw error;
    const fallbackDescriptor = openSync(filePath, "w");
    try {
      writeFileSync(fallbackDescriptor, text, "utf8");
      fsyncSync(fallbackDescriptor);
    } finally {
      closeSync(fallbackDescriptor);
    }
    unlinkSync(temporaryPath);
  }
}

function validateNodeSpecs(nodes, field = "nodes") {
  if (!Array.isArray(nodes) || nodes.length < 3) throw new UnderworldBackupValidationError(`${field} must contain at least three nodes`);
  const seenIds = new Set();
  const seenPaths = new Set();
  return nodes.map((node, index) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) throw new UnderworldBackupValidationError(`${field}[${index}] must be an object`);
    assertNonEmpty(node.nodeId, `${field}[${index}].nodeId`);
    assertPath(node.journalPath, `${field}[${index}].journalPath`);
    if (seenIds.has(node.nodeId)) throw new UnderworldBackupValidationError(`duplicate Underworld node ${node.nodeId}`);
    if (seenPaths.has(node.journalPath)) throw new UnderworldBackupValidationError(`${field} journal paths must be distinct`);
    seenIds.add(node.nodeId);
    seenPaths.add(node.journalPath);
    return { nodeId: node.nodeId, journalPath: node.journalPath };
  });
}

function assertParity(journals) {
  const reference = journals[0];
  if (reference.recoveredTail) throw new UnderworldBackupValidationError("cannot back up an incomplete Underworld journal tail");
  if (reference.entries.length === 0) throw new UnderworldBackupValidationError("cannot back up an empty Underworld journal");
  for (const candidate of journals.slice(1)) {
    if (candidate.recoveredTail) throw new UnderworldBackupValidationError("cannot back up an incomplete Underworld journal tail");
    if (candidate.entries.length !== reference.entries.length) throw new UnderworldBackupValidationError("Underworld journals have different lengths");
    for (let index = 0; index < reference.entries.length; index += 1) {
      if (candidate.entries[index].hash !== reference.entries[index].hash || candidate.entries[index].checkpointId !== reference.entries[index].checkpointId) {
        throw new UnderworldBackupValidationError(`Underworld journals diverge at checkpoint ${index + 1}`);
      }
    }
  }
}

function validateJournalEntries(entries, index) {
  const temporaryPath = join(tmpdir(), `wwk-underworld-backup-${process.pid}-${Math.random().toString(16).slice(2)}-${index}.jsonl`);
  try {
    writeFileSync(temporaryPath, journalLines(entries), "utf8");
    const checked = readUnderworldJournal(temporaryPath);
    if (checked.recoveredTail || checked.entries.length !== entries.length) throw new UnderworldBackupValidationError("backup journal contains an incomplete tail");
    const latest = restoreLatestUnderworldCheckpoint(temporaryPath).state;
    return { entries: checked.entries, state: latest };
  } catch (error) {
    if (error instanceof UnderworldBackupValidationError) throw error;
    throw new UnderworldBackupValidationError(`backup journal validation failed: ${error.message}`);
  } finally {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
  }
}

function validateBackupEnvelope(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new UnderworldBackupValidationError("backup must be an object");
  if (value.backupSchemaVersion !== UNDERWORLD_BACKUP_SCHEMA_VERSION) throw new UnderworldBackupValidationError("unsupported Underworld backup schema version");
  assertNonEmpty(value.shardId, "backup.shardId");
  assertInteger(value.serverWeek, "backup.serverWeek");
  assertInteger(value.revision, "backup.revision");
  if (!Array.isArray(value.nodes) || value.nodes.length < 3) throw new UnderworldBackupValidationError("backup must contain at least three nodes");
  const { digest, ...unsigned } = value;
  if (typeof digest !== "string" || digest !== backupDigest(unsigned)) throw new UnderworldBackupValidationError("backup digest is invalid");

  const seen = new Set();
  const validated = value.nodes.map((node, index) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) throw new UnderworldBackupValidationError(`backup.nodes[${index}] must be an object`);
    assertNonEmpty(node.nodeId, `backup.nodes[${index}].nodeId`);
    if (seen.has(node.nodeId)) throw new UnderworldBackupValidationError(`duplicate backup node ${node.nodeId}`);
    seen.add(node.nodeId);
    if (!Array.isArray(node.entries)) throw new UnderworldBackupValidationError(`backup.nodes[${index}].entries must be an array`);
    const checked = validateJournalEntries(node.entries, index);
    if (checked.state.shardId !== value.shardId || checked.state.serverWeek !== value.serverWeek || checked.state.revision !== value.revision) {
      throw new UnderworldBackupValidationError(`backup node ${node.nodeId} metadata does not match the envelope`);
    }
    return { nodeId: node.nodeId, entries: checked.entries, recoveredTail: false };
  });
  assertParity(validated);
  return clone(value);
}

export function createUnderworldBackup({ nodes, backupPath } = {}) {
  const sourceNodes = validateNodeSpecs(nodes);
  assertPath(backupPath, "backupPath");
  const journals = sourceNodes.map((node) => readUnderworldJournal(node.journalPath));
  assertParity(journals);
  const latest = restoreLatestUnderworldCheckpoint(sourceNodes[0].journalPath).state;
  const unsigned = {
    backupSchemaVersion: UNDERWORLD_BACKUP_SCHEMA_VERSION,
    shardId: latest.shardId,
    serverWeek: latest.serverWeek,
    revision: latest.revision,
    nodes: sourceNodes.map((node, index) => ({ nodeId: node.nodeId, entries: journals[index].entries })),
  };
  const backup = { ...unsigned, digest: backupDigest(unsigned) };
  writeTextAtomically(backupPath, `${JSON.stringify(backup)}\n`);
  return clone(backup);
}

export function readUnderworldBackup(backupPath) {
  assertPath(backupPath, "backupPath");
  let value;
  try {
    value = JSON.parse(readFileSync(backupPath, "utf8"));
  } catch (error) {
    throw new UnderworldBackupValidationError(`backup read failed: ${error.message}`);
  }
  return validateBackupEnvelope(value);
}

export function restoreUnderworldBackup(backupPath, { nodes, overwrite = false } = {}) {
  assertPath(backupPath, "backupPath");
  const destinationNodes = validateNodeSpecs(nodes, "destinationNodes");
  if (typeof overwrite !== "boolean") throw new UnderworldBackupValidationError("overwrite must be a boolean");
  const backup = readUnderworldBackup(backupPath);
  const backupIds = backup.nodes.map((node) => node.nodeId).sort();
  const destinationIds = destinationNodes.map((node) => node.nodeId).sort();
  if (JSON.stringify(backupIds) !== JSON.stringify(destinationIds)) throw new UnderworldBackupValidationError("destination node IDs do not match the backup");
  if (!overwrite && destinationNodes.some((node) => existsSync(node.journalPath))) {
    throw new UnderworldBackupValidationError("restore destination exists; set overwrite explicitly");
  }
  const byId = new Map(backup.nodes.map((node) => [node.nodeId, node]));
  for (const node of destinationNodes) writeTextAtomically(node.journalPath, journalLines(byId.get(node.nodeId).entries));
  return {
    shardId: backup.shardId,
    serverWeek: backup.serverWeek,
    revision: backup.revision,
    checkpointCount: backup.nodes[0].entries.length,
    nodeCount: backup.nodes.length,
  };
}
