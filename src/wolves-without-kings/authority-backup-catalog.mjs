import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { dirname } from "node:path";

import { readAuthorityBackup } from "./authority-backup.mjs";

export const AUTHORITY_BACKUP_CATALOG_SCHEMA_VERSION = 1;

export class AuthorityBackupCatalogValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthorityBackupCatalogValidationError";
  }
}

function clone(value) { return structuredClone(value); }

function assertPath(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new AuthorityBackupCatalogValidationError(`${field} must be a non-empty path`);
}

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new AuthorityBackupCatalogValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) throw new AuthorityBackupCatalogValidationError(`${field} must be an integer >= ${minimum}`);
}

function assertTimestamp(value, field) {
  assertNonEmpty(value, field);
  if (Number.isNaN(Date.parse(value))) throw new AuthorityBackupCatalogValidationError(`${field} must be an ISO timestamp`);
}

function readCatalogFile(catalogPath) {
  if (!existsSync(catalogPath)) return { catalogSchemaVersion: AUTHORITY_BACKUP_CATALOG_SCHEMA_VERSION, entries: [] };
  let value;
  try { value = JSON.parse(readFileSync(catalogPath, "utf8")); }
  catch (error) { throw new AuthorityBackupCatalogValidationError(`catalog read failed: ${error.message}`); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AuthorityBackupCatalogValidationError("catalog must be an object");
  if (value.catalogSchemaVersion !== AUTHORITY_BACKUP_CATALOG_SCHEMA_VERSION) throw new AuthorityBackupCatalogValidationError("unsupported backup catalog schema version");
  if (!Array.isArray(value.entries)) throw new AuthorityBackupCatalogValidationError("catalog entries must be an array");
  for (const [index, entry] of value.entries.entries()) {
    assertNonEmpty(entry?.backupId, `catalog entry ${index + 1} backupId`);
    assertPath(entry?.backupPath, `catalog entry ${index + 1} backupPath`);
    assertNonEmpty(entry?.authorityWorldId, `catalog entry ${index + 1} authorityWorldId`);
    assertInteger(entry?.worldRevision, `catalog entry ${index + 1} worldRevision`);
    assertTimestamp(entry?.createdAt, `catalog entry ${index + 1} createdAt`);
    assertNonEmpty(entry?.digest, `catalog entry ${index + 1} digest`);
    if (typeof entry.pinned !== "boolean") throw new AuthorityBackupCatalogValidationError(`catalog entry ${index + 1} pinned must be boolean`);
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

export function readAuthorityBackupCatalog(catalogPath) {
  assertPath(catalogPath, "catalogPath");
  return readCatalogFile(catalogPath);
}

export function registerAuthorityBackup({ catalogPath, backupPath, backupId, createdAt, pinned = false } = {}) {
  assertPath(catalogPath, "catalogPath");
  assertPath(backupPath, "backupPath");
  assertNonEmpty(backupId, "backupId");
  assertTimestamp(createdAt, "createdAt");
  if (typeof pinned !== "boolean") throw new AuthorityBackupCatalogValidationError("pinned must be boolean");
  const backup = readAuthorityBackup(backupPath);
  const catalog = readCatalogFile(catalogPath);
  const existingById = catalog.entries.find((entry) => entry.backupId === backupId);
  const entry = {
    backupId,
    backupPath,
    authorityWorldId: backup.authorityWorldId,
    worldRevision: backup.worldRevision,
    createdAt,
    digest: backup.digest,
    pinned,
  };
  if (existingById) {
    if (JSON.stringify(existingById) !== JSON.stringify(entry)) throw new AuthorityBackupCatalogValidationError(`backupId ${backupId} is already registered with different metadata`);
    return clone(existingById);
  }
  if (catalog.entries.some((candidate) => candidate.backupPath === backupPath && candidate.digest !== backup.digest)) {
    throw new AuthorityBackupCatalogValidationError(`backup path ${backupPath} already names a different backup`);
  }
  catalog.entries.push(entry);
  catalog.entries.sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt) || left.backupId.localeCompare(right.backupId));
  writeCatalogFile(catalogPath, catalog);
  return clone(entry);
}

export function planAuthorityBackupRetention({ catalogPath, now = new Date().toISOString(), keepLatest = 2 } = {}) {
  assertPath(catalogPath, "catalogPath");
  assertTimestamp(now, "now");
  assertInteger(keepLatest, "keepLatest", 1);
  const catalog = readCatalogFile(catalogPath);
  const eligibleCandidates = [...catalog.entries]
    .filter((entry) => !entry.pinned && Date.parse(entry.createdAt) <= Date.parse(now))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt) || right.backupId.localeCompare(left.backupId));
  const retainedIds = new Set(eligibleCandidates.slice(0, keepLatest).map((entry) => entry.backupId));
  const eligibleForDeletion = eligibleCandidates
    .filter((entry) => !retainedIds.has(entry.backupId))
    .map((entry) => entry.backupId);
  const futureIds = catalog.entries.filter((entry) => Date.parse(entry.createdAt) > Date.parse(now)).map((entry) => entry.backupId);
  const pinnedIds = catalog.entries.filter((entry) => entry.pinned).map((entry) => entry.backupId);
  return {
    catalogSchemaVersion: AUTHORITY_BACKUP_CATALOG_SCHEMA_VERSION,
    now,
    keepLatest,
    retainedIds: [...new Set([...retainedIds, ...pinnedIds, ...futureIds])],
    eligibleForDeletion,
    pinnedIds,
    futureIds,
    destructiveActionRequired: eligibleForDeletion.length > 0,
  };
}
