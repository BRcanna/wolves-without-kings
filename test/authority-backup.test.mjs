import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createAuthorityBackup, AuthorityBackupValidationError, restoreAuthorityBackup } from "../src/wolves-without-kings/authority-backup.mjs";
import { createReplicatedAuthorityService } from "../src/wolves-without-kings/replicated-authority-service.mjs";

function withDirectory(run) {
  const directory = mkdtempSync(join(tmpdir(), "wwk-authority-backup-"));
  try { return run(directory); }
  finally { rmSync(directory, { recursive: true, force: true }); }
}

function connect(service) {
  return service.request({ method: "POST", path: "/sessions/connect", body: { sessionId: "session:backup", clientId: "client:backup", characterId: "character:player", role: "host", regionId: "region:sofia-south" } });
}

test("authority backup round-trips mirrored journals and protects existing destinations", () => {
  withDirectory((directory) => {
    const primaryPath = join(directory, "primary.jsonl");
    const replicaPath = join(directory, "replica.jsonl");
    const backupPath = join(directory, "backup.json");
    const restorePrimary = join(directory, "restore-primary.jsonl");
    const restoreReplica = join(directory, "restore-replica.jsonl");
    const service = createReplicatedAuthorityService({ primaryPath, replicaPath });
    connect(service);
    const backup = createAuthorityBackup({ primaryPath, replicaPath, backupPath });
    assert.equal(backup.worldRevision, service.state.worldRevision);
    const restored = restoreAuthorityBackup(backupPath, { primaryPath: restorePrimary, replicaPath: restoreReplica });
    assert.equal(restored.checkpointCount, 2);
    const restarted = createReplicatedAuthorityService({ primaryPath: restorePrimary, replicaPath: restoreReplica });
    assert.deepEqual(restarted.state, service.state);
    assert.throws(
      () => restoreAuthorityBackup(backupPath, { primaryPath: restorePrimary, replicaPath: restoreReplica }),
      (error) => error instanceof AuthorityBackupValidationError && /destination exists/.test(error.message),
    );
  });
});

test("authority backup rejects tampered manifests before restore", () => {
  withDirectory((directory) => {
    const primaryPath = join(directory, "primary.jsonl");
    const replicaPath = join(directory, "replica.jsonl");
    const backupPath = join(directory, "backup.json");
    const service = createReplicatedAuthorityService({ primaryPath, replicaPath });
    connect(service);
    createAuthorityBackup({ primaryPath, replicaPath, backupPath });
    const tampered = JSON.parse(readFileSync(backupPath, "utf8"));
    tampered.worldRevision += 1;
    writeFileSync(backupPath, `${JSON.stringify(tampered)}\n`, "utf8");
    assert.throws(
      () => restoreAuthorityBackup(backupPath, { primaryPath: join(directory, "new-primary.jsonl"), replicaPath: join(directory, "new-replica.jsonl") }),
      (error) => error instanceof AuthorityBackupValidationError && /digest is invalid/.test(error.message),
    );
  });
});

