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
import { dirname } from "node:path";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { canonicalJson } from "./engine.mjs";
import { readAuthorityJournal, restoreLatestAuthorityCheckpoint } from "./authority-journal.mjs";

export const AUTHORITY_BACKUP_SCHEMA_VERSION = 1;

export class AuthorityBackupValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthorityBackupValidationError";
  }
}

function clone(value) { return structuredClone(value); }

function assertPath(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new AuthorityBackupValidationError(`${field} must be a non-empty path`);
}

function backupDigest(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function assertParity(primary, replica) {
  if (primary.recoveredTail || replica.recoveredTail) throw new AuthorityBackupValidationError("cannot back up an incomplete journal tail");
  if (primary.entries.length !== replica.entries.length) throw new AuthorityBackupValidationError("primary and replica journals have different lengths");
  for (let index = 0; index < primary.entries.length; index += 1) {
    if (primary.entries[index].hash !== replica.entries[index].hash || primary.entries[index].checkpointId !== replica.entries[index].checkpointId) {
      throw new AuthorityBackupValidationError(`primary and replica diverge at checkpoint ${index + 1}`);
    }
  }
  if (primary.entries.length === 0) throw new AuthorityBackupValidationError("cannot back up an empty authority journal");
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

function writeJsonAtomically(filePath, value) {
  writeTextAtomically(filePath, `${JSON.stringify(value)}\n`);
}

function journalLines(entries) {
  return `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`;
}

function validateBackupEnvelope(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AuthorityBackupValidationError("backup must be an object");
  if (value.backupSchemaVersion !== AUTHORITY_BACKUP_SCHEMA_VERSION) throw new AuthorityBackupValidationError("unsupported authority backup schema version");
  if (!Array.isArray(value.primaryEntries) || !Array.isArray(value.replicaEntries)) throw new AuthorityBackupValidationError("backup must contain primary and replica entries");
  const { digest, ...unsigned } = value;
  if (typeof digest !== "string" || digest !== backupDigest(unsigned)) throw new AuthorityBackupValidationError("backup digest is invalid");
  const primaryPath = `${value.primaryEntries.length ? "." : ""}`;
  if (!primaryPath) throw new AuthorityBackupValidationError("backup contains no checkpoints");
  for (const entries of [value.primaryEntries, value.replicaEntries]) {
    const temporaryPath = join(tmpdir(), `wwk-backup-validate-${process.pid}-${Math.random().toString(16).slice(2)}.jsonl`);
    try {
      writeFileSync(temporaryPath, journalLines(entries), "utf8");
      const checked = readAuthorityJournal(temporaryPath);
      if (checked.entries.length !== entries.length || checked.entries.at(-1).hash !== entries.at(-1).hash) throw new AuthorityBackupValidationError("backup journal entries failed validation");
      restoreLatestAuthorityCheckpoint(temporaryPath);
    } catch (error) {
      if (error instanceof AuthorityBackupValidationError) throw error;
      throw new AuthorityBackupValidationError(`backup journal validation failed: ${error.message}`);
    } finally {
      if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    }
  }
  const primary = { entries: value.primaryEntries, recoveredTail: false };
  const replica = { entries: value.replicaEntries, recoveredTail: false };
  assertParity(primary, replica);
  return clone(value);
}

export function createAuthorityBackup({ primaryPath, replicaPath, backupPath } = {}) {
  assertPath(primaryPath, "primaryPath");
  assertPath(replicaPath, "replicaPath");
  assertPath(backupPath, "backupPath");
  const primary = readAuthorityJournal(primaryPath);
  const replica = readAuthorityJournal(replicaPath);
  assertParity(primary, replica);
  const latest = restoreLatestAuthorityCheckpoint(primaryPath).state;
  const unsigned = {
    backupSchemaVersion: AUTHORITY_BACKUP_SCHEMA_VERSION,
    authorityWorldId: latest.worldId,
    worldRevision: latest.worldRevision,
    primaryEntries: primary.entries,
    replicaEntries: replica.entries,
  };
  const backup = { ...unsigned, digest: backupDigest(unsigned) };
  writeJsonAtomically(backupPath, backup);
  return clone(backup);
}

export function readAuthorityBackup(backupPath) {
  assertPath(backupPath, "backupPath");
  let value;
  try {
    value = JSON.parse(readFileSync(backupPath, "utf8"));
  } catch (error) {
    throw new AuthorityBackupValidationError(`backup read failed: ${error.message}`);
  }
  return validateBackupEnvelope(value);
}

export function restoreAuthorityBackup(
  backupPath,
  { primaryPath, replicaPath, overwrite = false } = {},
) {
  assertPath(backupPath, "backupPath");
  assertPath(primaryPath, "primaryPath");
  assertPath(replicaPath, "replicaPath");
  if (primaryPath === replicaPath) throw new AuthorityBackupValidationError("primaryPath and replicaPath must be different");
  if (typeof overwrite !== "boolean") throw new AuthorityBackupValidationError("overwrite must be a boolean");
  if (!overwrite && (existsSync(primaryPath) || existsSync(replicaPath))) throw new AuthorityBackupValidationError("restore destination exists; set overwrite explicitly");
  const backup = readAuthorityBackup(backupPath);
  writeTextAtomically(primaryPath, journalLines(backup.primaryEntries));
  writeTextAtomically(replicaPath, journalLines(backup.replicaEntries));
  return { worldId: backup.authorityWorldId, worldRevision: backup.worldRevision, checkpointCount: backup.primaryEntries.length };
}
