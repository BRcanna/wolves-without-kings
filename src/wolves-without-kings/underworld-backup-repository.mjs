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

import { readUnderworldBackup, restoreUnderworldBackup } from "./underworld-backup.mjs";

export const UNDERWORLD_BACKUP_REPOSITORY_SCHEMA_VERSION = 1;

export class UnderworldBackupRepositoryValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnderworldBackupRepositoryValidationError";
  }
}

function clone(value) { return structuredClone(value); }

function assertPath(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new UnderworldBackupRepositoryValidationError(`${field} must be a non-empty path`);
}

function assertObjectId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) throw new UnderworldBackupRepositoryValidationError("objectId must be a safe portable identifier");
}

function objectsRoot(repositoryRoot) {
  const root = resolve(repositoryRoot);
  const objects = resolve(root, "objects");
  if (!objects.startsWith(`${root}\\`) && !objects.startsWith(`${root}/`)) throw new UnderworldBackupRepositoryValidationError("repository object root escaped repository root");
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
  if (!existsSync(filePath)) throw new UnderworldBackupRepositoryValidationError(`repository object does not exist: ${objectId}`);
  let backup;
  try { backup = readUnderworldBackup(filePath); }
  catch (error) { throw new UnderworldBackupRepositoryValidationError(`repository object ${objectId} is invalid: ${error.message}`); }
  return { filePath, backup };
}

export function publishUnderworldBackup({ backupPath, repositoryRoot, objectId } = {}) {
  assertPath(backupPath, "backupPath");
  assertPath(repositoryRoot, "repositoryRoot");
  assertObjectId(objectId);
  const backup = readUnderworldBackup(backupPath);
  const filePath = objectPath(repositoryRoot, objectId);
  if (existsSync(filePath)) {
    const existing = readRepositoryObject(repositoryRoot, objectId).backup;
    if (existing.digest !== backup.digest) throw new UnderworldBackupRepositoryValidationError(`repository object ${objectId} is immutable and has a different digest`);
    return { schemaVersion: UNDERWORLD_BACKUP_REPOSITORY_SCHEMA_VERSION, objectId, digest: existing.digest, shardId: existing.shardId, revision: existing.revision, idempotent: true };
  }
  writeImmutable(filePath, `${JSON.stringify(backup)}\n`);
  return { schemaVersion: UNDERWORLD_BACKUP_REPOSITORY_SCHEMA_VERSION, objectId, digest: backup.digest, shardId: backup.shardId, revision: backup.revision, idempotent: false };
}

export function readUnderworldRepositoryBackup({ repositoryRoot, objectId } = {}) {
  return clone(readRepositoryObject(repositoryRoot, objectId).backup);
}

export function verifyUnderworldBackupRepository({ repositoryRoot } = {}) {
  assertPath(repositoryRoot, "repositoryRoot");
  const root = objectsRoot(repositoryRoot);
  if (!existsSync(root)) return { schemaVersion: UNDERWORLD_BACKUP_REPOSITORY_SCHEMA_VERSION, objectCount: 0, valid: true, objects: [] };
  const objects = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const objectId = entry.name.slice(0, -5);
    try {
      assertObjectId(objectId);
      const { backup } = readRepositoryObject(repositoryRoot, objectId);
      objects.push({ objectId, digest: backup.digest, shardId: backup.shardId, revision: backup.revision, valid: true });
    } catch (error) {
      objects.push({ objectId, valid: false, error: error.message });
    }
  }
  objects.sort((left, right) => left.objectId.localeCompare(right.objectId));
  return { schemaVersion: UNDERWORLD_BACKUP_REPOSITORY_SCHEMA_VERSION, objectCount: objects.length, valid: objects.every((object) => object.valid), objects };
}

export function restoreUnderworldRepositoryBackup({ repositoryRoot, objectId, nodes, overwrite = false } = {}) {
  const filePath = readRepositoryObject(repositoryRoot, objectId).filePath;
  try {
    return restoreUnderworldBackup(filePath, { nodes, overwrite });
  } catch (error) {
    if (error instanceof UnderworldBackupRepositoryValidationError) throw error;
    throw new UnderworldBackupRepositoryValidationError(`repository restore failed: ${error.message}`);
  }
}
