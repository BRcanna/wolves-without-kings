import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createAuthorityBackup } from "../src/wolves-without-kings/authority-backup.mjs";
import { createIsolatedAuthorityBackupStore, IsolatedBackupStoreValidationError } from "../src/wolves-without-kings/isolated-backup-store.mjs";
import { createReplicatedAuthorityService } from "../src/wolves-without-kings/replicated-authority-service.mjs";

function withDirectory(run) {
  const directory = mkdtempSync(join(tmpdir(), "wwk-isolated-backup-"));
  try { return run(directory); }
  finally { rmSync(directory, { recursive: true, force: true }); }
}

function connect(service, sessionId) {
  return service.request({ method: "POST", path: "/sessions/connect", body: { sessionId, clientId: `client:${sessionId}`, characterId: "character:player", role: "host", regionId: "region:sofia-south" } });
}

function createBackup(service, primaryPath, replicaPath, sourceRoot, id) {
  const backupPath = join(sourceRoot, `${id}.json`);
  createAuthorityBackup({ primaryPath, replicaPath, backupPath });
  return backupPath;
}

function setup(directory) {
  const sourceRoot = join(directory, "source");
  const repositoryRoot = join(directory, "remote-style-store");
  const primaryPath = join(sourceRoot, "primary.jsonl");
  const replicaPath = join(sourceRoot, "replica.jsonl");
  const service = createReplicatedAuthorityService({ primaryPath, replicaPath });
  const store = createIsolatedAuthorityBackupStore({ sourceRoot, repositoryRoot, catalogPath: join(repositoryRoot, "catalog.json"), keepLatest: 1 });
  return { sourceRoot, repositoryRoot, primaryPath, replicaPath, service, store };
}

test("isolated backup store publishes, verifies, restores, and executes authorized retention", () => {
  withDirectory((directory) => {
    const { sourceRoot, primaryPath, replicaPath, service, store } = setup(directory);
    assert.equal(connect(service, "session:old").status, 201);
    const oldBackup = createBackup(service, primaryPath, replicaPath, sourceRoot, "old");
    store.publish({ backupPath: oldBackup, backupId: "authority-old", createdAt: "2026-10-01T00:00:00.000Z" });
    assert.equal(connect(service, "session:new").status, 201);
    const middleBackup = createBackup(service, primaryPath, replicaPath, sourceRoot, "middle");
    store.publish({ backupPath: middleBackup, backupId: "authority-middle", createdAt: "2026-10-02T00:00:00.000Z" });
    assert.equal(connect(service, "session:pinned").status, 201);
    const newBackup = createBackup(service, primaryPath, replicaPath, sourceRoot, "new");
    store.publish({ backupPath: newBackup, backupId: "authority-new", createdAt: "2026-10-03T00:00:00.000Z", pinned: true });
    assert.equal(store.verify().valid, true);
    assert.equal(store.projection.mode, "isolated-local-backup");
    const planned = store.executeRetention({ now: "2026-10-04T00:00:00.000Z", approveDeletion: false });
    assert.deepEqual(planned.eligibleForDeletion, ["authority-old"]);
    assert.deepEqual(planned.executedIds, []);
    assert.equal(store.verify().catalogEntries, 3);
    const executed = store.executeRetention({ now: "2026-10-04T00:00:00.000Z", approveDeletion: true });
    assert.deepEqual(executed.executedIds, ["authority-old"]);
    assert.equal(store.verify().valid, true);
    assert.equal(store.verify().catalogEntries, 2);
    const restorePrimary = join(directory, "restore-primary.jsonl");
    const restoreReplica = join(directory, "restore-replica.jsonl");
    assert.equal(store.restore({ objectId: "authority-new", primaryPath: restorePrimary, replicaPath: restoreReplica }).worldRevision, service.state.worldRevision);
  });
});

test("isolated backup store refuses overlapping roots, unsafe sources, and unapproved destructive execution", () => {
  withDirectory((directory) => {
    assert.throws(
      () => createIsolatedAuthorityBackupStore({ sourceRoot: directory, repositoryRoot: join(directory, "nested-store") }),
      (error) => error instanceof IsolatedBackupStoreValidationError && /separate roots/.test(error.message),
    );
    const sourceRoot = join(directory, "source");
    const repositoryRoot = join(directory, "repository");
    const store = createIsolatedAuthorityBackupStore({ sourceRoot, repositoryRoot });
    assert.throws(() => store.publish({ backupPath: join(directory, "outside.json"), backupId: "authority-1", createdAt: "2026-10-01T00:00:00.000Z" }), /inside sourceRoot/);
    assert.equal(store.executeRetention({ approveDeletion: false }).deletionAuthorized, false);
  });
});
