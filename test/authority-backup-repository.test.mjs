import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createAuthorityBackup } from "../src/wolves-without-kings/authority-backup.mjs";
import {
  publishAuthorityBackup,
  readAuthorityRepositoryBackup,
  restoreAuthorityRepositoryBackup,
  verifyAuthorityBackupRepository,
  AuthorityBackupRepositoryValidationError,
} from "../src/wolves-without-kings/authority-backup-repository.mjs";
import { createReplicatedAuthorityService } from "../src/wolves-without-kings/replicated-authority-service.mjs";

function withDirectory(run) {
  const directory = mkdtempSync(join(tmpdir(), "wwk-authority-backup-repository-"));
  try { return run(directory); }
  finally { rmSync(directory, { recursive: true, force: true }); }
}

function connect(service, sessionId) {
  return service.request({ method: "POST", path: "/sessions/connect", body: { sessionId, clientId: `client:${sessionId}`, characterId: "character:player", role: "host", regionId: "region:sofia-south" } });
}

test("backup repository publishes validated objects idempotently and restores them", () => {
  withDirectory((directory) => {
    const primaryPath = join(directory, "primary.jsonl");
    const replicaPath = join(directory, "replica.jsonl");
    const backupPath = join(directory, "backup.json");
    const repositoryRoot = join(directory, "repository");
    const restorePrimary = join(directory, "restore-primary.jsonl");
    const restoreReplica = join(directory, "restore-replica.jsonl");
    const service = createReplicatedAuthorityService({ primaryPath, replicaPath });
    assert.equal(connect(service, "session:repository").status, 201);
    createAuthorityBackup({ primaryPath, replicaPath, backupPath });
    const first = publishAuthorityBackup({ backupPath, repositoryRoot, objectId: "authority-001" });
    const second = publishAuthorityBackup({ backupPath, repositoryRoot, objectId: "authority-001" });
    assert.equal(first.idempotent, false);
    assert.equal(second.idempotent, true);
    assert.deepEqual(readAuthorityRepositoryBackup({ repositoryRoot, objectId: "authority-001" }), JSON.parse(readFileSync(backupPath, "utf8")));
    assert.deepEqual(verifyAuthorityBackupRepository({ repositoryRoot }).valid, true);
    const restored = restoreAuthorityRepositoryBackup({ repositoryRoot, objectId: "authority-001", primaryPath: restorePrimary, replicaPath: restoreReplica });
    assert.equal(restored.worldRevision, service.state.worldRevision);
  });
});

test("backup repository rejects conflicting immutable objects and unsafe object IDs", () => {
  withDirectory((directory) => {
    const primaryPath = join(directory, "primary.jsonl");
    const replicaPath = join(directory, "replica.jsonl");
    const backupPath = join(directory, "backup.json");
    const repositoryRoot = join(directory, "repository");
    const service = createReplicatedAuthorityService({ primaryPath, replicaPath });
    connect(service, "session:repository-conflict");
    createAuthorityBackup({ primaryPath, replicaPath, backupPath });
    publishAuthorityBackup({ backupPath, repositoryRoot, objectId: "authority-001" });
    const changed = JSON.parse(readFileSync(backupPath, "utf8"));
    changed.worldRevision += 1;
    writeFileSync(backupPath, `${JSON.stringify(changed)}\n`, "utf8");
    assert.throws(() => publishAuthorityBackup({ backupPath, repositoryRoot, objectId: "authority-001" }), /backup digest is invalid/);
    assert.throws(() => publishAuthorityBackup({ backupPath, repositoryRoot, objectId: "..\\escape" }), (error) => error instanceof AuthorityBackupRepositoryValidationError && /safe portable/.test(error.message));
  });
});

test("repository verification reports tampered objects without treating them as valid", () => {
  withDirectory((directory) => {
    const primaryPath = join(directory, "primary.jsonl");
    const replicaPath = join(directory, "replica.jsonl");
    const backupPath = join(directory, "backup.json");
    const repositoryRoot = join(directory, "repository");
    const service = createReplicatedAuthorityService({ primaryPath, replicaPath });
    connect(service, "session:repository-tamper");
    createAuthorityBackup({ primaryPath, replicaPath, backupPath });
    publishAuthorityBackup({ backupPath, repositoryRoot, objectId: "authority-001" });
    const objectPath = join(repositoryRoot, "objects", "authority-001.json");
    const tampered = JSON.parse(readFileSync(objectPath, "utf8"));
    tampered.worldRevision += 1;
    writeFileSync(objectPath, `${JSON.stringify(tampered)}\n`, "utf8");
    const report = verifyAuthorityBackupRepository({ repositoryRoot });
    assert.equal(report.valid, false);
    assert.equal(report.objects[0].valid, false);
  });
});
