import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

import { readAuthorityBackup, restoreAuthorityBackup } from "./authority-backup.mjs";

export const AUTHORITY_BACKUP_REPOSITORY_SCHEMA_VERSION = 1;

export class AuthorityBackupRepositoryValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthorityBackupRepositoryValidationError";
  }
}

function clone(value) { return structuredClone(value); }

function assertPath(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new AuthorityBackupRepositoryValidationError(`${field} must be a non-empty path`);
}

function assertObjectId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) throw new AuthorityBackupRepositoryValidationError("objectId must be a safe portable identifier");
}

function objectsRoot(repositoryRoot) {
  const root = resolve(repositoryRoot);
  const objects = resolve(root, "objects");
  if (!objects.startsWith(root + "\\") && !objects.startsWith(`${root}/`)) throw new AuthorityBackupRepositoryValidationError("repository object root escaped repository root");
  return objects;
}

function objectPath(repositoryRoot, objectId) {
  assertPath(repositoryRoot, "repositoryRoot");
  assertObjectId(objectId);
  return join(objectsRoot(repositoryRoot), `${objectId}.json`);
}

function writeImmutable(filePath, text) {
  mkdirSync(resolve(filePath, ".."), { recursive: true });
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

function readRepositoryObject(repositoryRoot, objectId) {
  const filePath = objectPath(repositoryRoot, objectId);
  if (!existsSync(filePath)) throw new AuthorityBackupRepositoryValidationError(`repository object does not exist: ${objectId}`);
  let backup;
  try { backup = readAuthorityBackup(filePath); }
  catch (error) { throw new AuthorityBackupRepositoryValidationError(`repository object ${objectId} is invalid: ${error.message}`); }
  return { filePath, backup };
}

export function publishAuthorityBackup({ backupPath, repositoryRoot, objectId } = {}) {
  assertPath(backupPath, "backupPath");
  assertPath(repositoryRoot, "repositoryRoot");
  assertObjectId(objectId);
  const backup = readAuthorityBackup(backupPath);
  const filePath = objectPath(repositoryRoot, objectId);
  if (existsSync(filePath)) {
    const existing = readRepositoryObject(repositoryRoot, objectId).backup;
    if (existing.digest !== backup.digest) throw new AuthorityBackupRepositoryValidationError(`repository object ${objectId} is immutable and has a different digest`);
    return { schemaVersion: AUTHORITY_BACKUP_REPOSITORY_SCHEMA_VERSION, objectId, digest: existing.digest, worldRevision: existing.worldRevision, idempotent: true };
  }
  writeImmutable(filePath, `${JSON.stringify(backup)}\n`);
  return { schemaVersion: AUTHORITY_BACKUP_REPOSITORY_SCHEMA_VERSION, objectId, digest: backup.digest, worldRevision: backup.worldRevision, idempotent: false };
}

export function readAuthorityRepositoryBackup({ repositoryRoot, objectId } = {}) {
  const { backup } = readRepositoryObject(repositoryRoot, objectId);
  return clone(backup);
}

export function verifyAuthorityBackupRepository({ repositoryRoot } = {}) {
  assertPath(repositoryRoot, "repositoryRoot");
  const root = objectsRoot(repositoryRoot);
  if (!existsSync(root)) return { schemaVersion: AUTHORITY_BACKUP_REPOSITORY_SCHEMA_VERSION, objectCount: 0, valid: true, objects: [] };
  const objects = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const objectId = entry.name.slice(0, -5);
    try {
      assertObjectId(objectId);
      const { backup } = readRepositoryObject(repositoryRoot, objectId);
      objects.push({ objectId, digest: backup.digest, worldRevision: backup.worldRevision, valid: true });
    } catch (error) {
      objects.push({ objectId, valid: false, error: error.message });
    }
  }
  objects.sort((left, right) => left.objectId.localeCompare(right.objectId));
  return { schemaVersion: AUTHORITY_BACKUP_REPOSITORY_SCHEMA_VERSION, objectCount: objects.length, valid: objects.every((object) => object.valid), objects };
}

export function restoreAuthorityRepositoryBackup({ repositoryRoot, objectId, primaryPath, replicaPath, overwrite = false } = {}) {
  const filePath = readRepositoryObject(repositoryRoot, objectId).filePath;
  return restoreAuthorityBackup(filePath, { primaryPath, replicaPath, overwrite });
}
