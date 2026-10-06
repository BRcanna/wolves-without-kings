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

import { readUnderworldBackup } from "./underworld-backup.mjs";

export const UNDERWORLD_BACKUP_CATALOG_SCHEMA_VERSION = 1;

export class UnderworldBackupCatalogValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnderworldBackupCatalogValidationError";
  }
}

function clone(value) { return structuredClone(value); }

function assertPath(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new UnderworldBackupCatalogValidationError(`${field} must be a non-empty path`);
}

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new UnderworldBackupCatalogValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) throw new UnderworldBackupCatalogValidationError(`${field} must be an integer >= ${minimum}`);
}

function assertTimestamp(value, field) {
  assertNonEmpty(value, field);
  if (Number.isNaN(Date.parse(value))) throw new UnderworldBackupCatalogValidationError(`${field} must be an ISO timestamp`);
}

function readCatalogFile(catalogPath) {
  if (!existsSync(catalogPath)) return { catalogSchemaVersion: UNDERWORLD_BACKUP_CATALOG_SCHEMA_VERSION, entries: [] };
  let value;
  try { value = JSON.parse(readFileSync(catalogPath, "utf8")); }
  catch (error) { throw new UnderworldBackupCatalogValidationError(`catalog read failed: ${error.message}`); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new UnderworldBackupCatalogValidationError("catalog must be an object");
  if (value.catalogSchemaVersion !== UNDERWORLD_BACKUP_CATALOG_SCHEMA_VERSION) throw new UnderworldBackupCatalogValidationError("unsupported Underworld backup catalog schema version");
  if (!Array.isArray(value.entries)) throw new UnderworldBackupCatalogValidationError("catalog entries must be an array");
  for (const [index, entry] of value.entries.entries()) {
    assertNonEmpty(entry?.backupId, `catalog entry ${index + 1} backupId`);
    assertPath(entry?.backupPath, `catalog entry ${index + 1} backupPath`);
    assertNonEmpty(entry?.shardId, `catalog entry ${index + 1} shardId`);
    assertInteger(entry?.serverWeek, `catalog entry ${index + 1} serverWeek`);
    assertInteger(entry?.revision, `catalog entry ${index + 1} revision`);
    assertTimestamp(entry?.createdAt, `catalog entry ${index + 1} createdAt`);
    assertNonEmpty(entry?.digest, `catalog entry ${index + 1} digest`);
    if (typeof entry.pinned !== "boolean") throw new UnderworldBackupCatalogValidationError(`catalog entry ${index + 1} pinned must be boolean`);
  }
  return clone(value);
}

function writeCatalogFile(catalogPath, catalog) {
  mkdirSync(dirname(catalogPath), { recursive: true });
  const temporaryPath = `${catalogPath}.tmp`;
  const descriptor = openSync(temporaryPath, "w");
  const text = `${JSON.stringify(catalog)}\n`;
  try {
    writeFileSync(descriptor, text, "utf8");
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  try {
    renameSync(temporaryPath, catalogPath);
  } catch (error) {
    if (!['EPERM', 'EXDEV'].includes(error.code)) throw error;
    const fallbackDescriptor = openSync(catalogPath, "w");
    try {
      writeFileSync(fallbackDescriptor, text, "utf8");
      fsyncSync(fallbackDescriptor);
    } finally {
      closeSync(fallbackDescriptor);
    }
    unlinkSync(temporaryPath);
  }
}

export function readUnderworldBackupCatalog(catalogPath) {
  assertPath(catalogPath, "catalogPath");
  return readCatalogFile(catalogPath);
}

export function registerUnderworldBackup({ catalogPath, backupPath, backupId, createdAt, pinned = false } = {}) {
  assertPath(catalogPath, "catalogPath");
  assertPath(backupPath, "backupPath");
  assertNonEmpty(backupId, "backupId");
  assertTimestamp(createdAt, "createdAt");
  if (typeof pinned !== "boolean") throw new UnderworldBackupCatalogValidationError("pinned must be a boolean");
  const backup = readUnderworldBackup(backupPath);
  const catalog = readCatalogFile(catalogPath);
  const entry = {
    backupId,
    backupPath,
    shardId: backup.shardId,
    serverWeek: backup.serverWeek,
    revision: backup.revision,
    createdAt,
    digest: backup.digest,
    pinned,
  };
  const existing = catalog.entries.find((candidate) => candidate.backupId === backupId);
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(entry)) throw new UnderworldBackupCatalogValidationError(`backupId ${backupId} is already registered with different metadata`);
    return clone(existing);
  }
  if (catalog.entries.some((candidate) => candidate.backupPath === backupPath && candidate.digest !== backup.digest)) {
    throw new UnderworldBackupCatalogValidationError(`backup path ${backupPath} already names a different backup`);
  }
  catalog.entries.push(entry);
  catalog.entries.sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt) || left.backupId.localeCompare(right.backupId));
  writeCatalogFile(catalogPath, catalog);
  return clone(entry);
}

export function planUnderworldBackupRetention({ catalogPath, now = new Date().toISOString(), keepLatest = 2 } = {}) {
  assertPath(catalogPath, "catalogPath");
  assertTimestamp(now, "now");
  assertInteger(keepLatest, "keepLatest", 1);
  const catalog = readCatalogFile(catalogPath);
  const eligible = [...catalog.entries]
    .filter((entry) => !entry.pinned && Date.parse(entry.createdAt) <= Date.parse(now))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt) || right.backupId.localeCompare(left.backupId));
  const retained = new Set(eligible.slice(0, keepLatest).map((entry) => entry.backupId));
  const eligibleForDeletion = eligible.filter((entry) => !retained.has(entry.backupId)).map((entry) => entry.backupId);
  const futureIds = catalog.entries.filter((entry) => Date.parse(entry.createdAt) > Date.parse(now)).map((entry) => entry.backupId);
  const pinnedIds = catalog.entries.filter((entry) => entry.pinned).map((entry) => entry.backupId);
  return {
    catalogSchemaVersion: UNDERWORLD_BACKUP_CATALOG_SCHEMA_VERSION,
    now,
    keepLatest,
    retainedIds: [...new Set([...retained, ...pinnedIds, ...futureIds])],
    eligibleForDeletion,
    pinnedIds,
    futureIds,
    destructiveActionRequired: eligibleForDeletion.length > 0,
  };
}
