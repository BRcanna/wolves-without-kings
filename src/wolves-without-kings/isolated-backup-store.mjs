import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

import {
  planAuthorityBackupRetention,
  readAuthorityBackupCatalog,
  registerAuthorityBackup,
} from "./authority-backup-catalog.mjs";
import {
  publishAuthorityBackup,
  readAuthorityRepositoryBackup,
  restoreAuthorityRepositoryBackup,
  verifyAuthorityBackupRepository,
} from "./authority-backup-repository.mjs";

export const ISOLATED_BACKUP_STORE_SCHEMA_VERSION = 1;

export class IsolatedBackupStoreValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "IsolatedBackupStoreValidationError";
  }
}

function clone(value) { return structuredClone(value); }

function assertPath(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new IsolatedBackupStoreValidationError(`${field} must be a non-empty path`);
}

function assertObjectId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) throw new IsolatedBackupStoreValidationError("objectId must be a safe portable identifier");
}

function isWithin(candidate, parent) {
  const childPath = resolve(candidate);
  const parentPath = resolve(parent);
  return childPath === parentPath || childPath.startsWith(`${parentPath}${sep}`);
}

function assertSeparated(sourceRoot, repositoryRoot) {
  if (isWithin(sourceRoot, repositoryRoot) || isWithin(repositoryRoot, sourceRoot)) {
    throw new IsolatedBackupStoreValidationError("sourceRoot and repositoryRoot must be separate roots");
  }
}

function objectPath(repositoryRoot, objectId) {
  assertObjectId(objectId);
  const root = resolve(repositoryRoot);
  const filePath = resolve(root, "objects", `${objectId}.json`);
  if (!isWithin(filePath, root)) throw new IsolatedBackupStoreValidationError("backup object escaped repository root");
  return filePath;
}

function writeCatalogFile(catalogPath, catalog) {
  mkdirSync(dirname(catalogPath), { recursive: true });
  const temporaryPath = `${catalogPath}.tmp`;
  const descriptor = openSync(temporaryPath, "w");
  try {
    writeFileSync(descriptor, `${JSON.stringify(catalog)}\n`, "utf8");
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
      writeFileSync(fallbackDescriptor, `${JSON.stringify(catalog)}\n`, "utf8");
      fsyncSync(fallbackDescriptor);
    } finally {
      closeSync(fallbackDescriptor);
    }
    unlinkSync(temporaryPath);
  }
}

function assertStorePaths({ sourceRoot, repositoryRoot, catalogPath }) {
  assertPath(sourceRoot, "sourceRoot");
  assertPath(repositoryRoot, "repositoryRoot");
  assertPath(catalogPath, "catalogPath");
  assertSeparated(sourceRoot, repositoryRoot);
  if (!isWithin(catalogPath, repositoryRoot)) throw new IsolatedBackupStoreValidationError("catalogPath must be inside repositoryRoot");
}

export function createIsolatedAuthorityBackupStore({
  sourceRoot,
  repositoryRoot,
  catalogPath = join(repositoryRoot ?? "", "catalog.json"),
  keepLatest = 2,
} = {}) {
  assertStorePaths({ sourceRoot, repositoryRoot, catalogPath });
  if (!Number.isInteger(keepLatest) || keepLatest < 1) throw new IsolatedBackupStoreValidationError("keepLatest must be an integer >= 1");
  const source = resolve(sourceRoot);
  const repository = resolve(repositoryRoot);
  const catalog = resolve(catalogPath);

  function assertSourceBackup(backupPath) {
    assertPath(backupPath, "backupPath");
    if (!isWithin(backupPath, source) || isWithin(backupPath, repository)) {
      throw new IsolatedBackupStoreValidationError("backupPath must be inside sourceRoot and outside repositoryRoot");
    }
  }

  function publish({ backupPath, backupId, createdAt, pinned = false } = {}) {
    assertSourceBackup(backupPath);
    assertObjectId(backupId);
    const publication = publishAuthorityBackup({ backupPath, repositoryRoot: repository, objectId: backupId });
    const objectBackupPath = objectPath(repository, backupId);
    const entry = registerAuthorityBackup({ catalogPath: catalog, backupPath: objectBackupPath, backupId, createdAt, pinned });
    return { schemaVersion: ISOLATED_BACKUP_STORE_SCHEMA_VERSION, isolated: true, publication, entry: clone(entry) };
  }

  function verify() {
    const repositoryReport = verifyAuthorityBackupRepository({ repositoryRoot: repository });
    const catalogState = readAuthorityBackupCatalog(catalog);
    const catalogObjects = [];
    for (const entry of catalogState.entries) {
      const expectedPath = objectPath(repository, entry.backupId);
      try {
        const backup = readAuthorityRepositoryBackup({ repositoryRoot: repository, objectId: entry.backupId });
        catalogObjects.push({ backupId: entry.backupId, valid: backup.digest === entry.digest && expectedPath === resolve(entry.backupPath) });
      } catch (error) {
        catalogObjects.push({ backupId: entry.backupId, valid: false, error: error.message });
      }
    }
    return {
      schemaVersion: ISOLATED_BACKUP_STORE_SCHEMA_VERSION,
      isolated: true,
      repository: repositoryReport,
      catalogEntries: catalogState.entries.length,
      catalogValid: catalogObjects.every((entry) => entry.valid),
      catalogObjects,
      valid: repositoryReport.valid && catalogObjects.every((entry) => entry.valid),
    };
  }

  function plan({ now = new Date().toISOString(), keepLatest: requestedKeepLatest = keepLatest } = {}) {
    return planAuthorityBackupRetention({ catalogPath: catalog, now, keepLatest: requestedKeepLatest });
  }

  function executeRetention({ now = new Date().toISOString(), keepLatest: requestedKeepLatest = keepLatest, approveDeletion = false } = {}) {
    const retentionPlan = plan({ now, keepLatest: requestedKeepLatest });
    if (!approveDeletion) return { ...clone(retentionPlan), deletionAuthorized: false, executedIds: [] };
    if (!retentionPlan.destructiveActionRequired) return { ...clone(retentionPlan), deletionAuthorized: true, executedIds: [] };
    const before = verify();
    if (!before.valid) throw new IsolatedBackupStoreValidationError("retention execution requires a valid repository and catalog");
    const catalogState = readAuthorityBackupCatalog(catalog);
    const deletions = new Set(retentionPlan.eligibleForDeletion);
    for (const backupId of deletions) {
      const filePath = objectPath(repository, backupId);
      if (!existsSync(filePath)) throw new IsolatedBackupStoreValidationError(`retention object is missing: ${backupId}`);
      readAuthorityRepositoryBackup({ repositoryRoot: repository, objectId: backupId });
    }
    for (const backupId of deletions) unlinkSync(objectPath(repository, backupId));
    writeCatalogFile(catalog, {
      catalogSchemaVersion: catalogState.catalogSchemaVersion,
      entries: catalogState.entries.filter((entry) => !deletions.has(entry.backupId)),
    });
    return { ...clone(retentionPlan), deletionAuthorized: true, executedIds: [...deletions] };
  }

  return {
    get projection() {
      const report = verify();
      return {
        schemaVersion: ISOLATED_BACKUP_STORE_SCHEMA_VERSION,
        mode: "isolated-local-backup",
        repositoryValid: report.repository.valid,
        catalogValid: report.catalogValid,
        catalogEntries: report.catalogEntries,
        omittedFields: ["sourceRoot", "repositoryRoot", "catalogPath", "backup contents"],
      };
    },
    publish,
    verify,
    plan,
    executeRetention,
    read({ objectId } = {}) {
      assertObjectId(objectId);
      return readAuthorityRepositoryBackup({ repositoryRoot: repository, objectId });
    },
    restore({ objectId, primaryPath, replicaPath, overwrite = false } = {}) {
      assertPath(primaryPath, "primaryPath");
      assertPath(replicaPath, "replicaPath");
      return restoreAuthorityRepositoryBackup({ repositoryRoot: repository, objectId, primaryPath, replicaPath, overwrite });
    },
  };
}
