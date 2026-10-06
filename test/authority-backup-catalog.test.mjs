import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createAuthorityBackup } from "../src/wolves-without-kings/authority-backup.mjs";
import {
  planAuthorityBackupRetention,
  readAuthorityBackupCatalog,
  registerAuthorityBackup,
  AuthorityBackupCatalogValidationError,
} from "../src/wolves-without-kings/authority-backup-catalog.mjs";
import { createReplicatedAuthorityService } from "../src/wolves-without-kings/replicated-authority-service.mjs";

function withDirectory(run) {
  const directory = mkdtempSync(join(tmpdir(), "wwk-authority-backup-catalog-"));
  try { return run(directory); }
  finally { rmSync(directory, { recursive: true, force: true }); }
}

function connect(service, sessionId) {
  return service.request({ method: "POST", path: "/sessions/connect", body: { sessionId, clientId: `client:${sessionId}`, characterId: "character:player", role: "host", regionId: "region:sofia-south" } });
}

test("backup catalog registration is digest-backed and idempotent", () => {
  withDirectory((directory) => {
    const primaryPath = join(directory, "primary.jsonl");
    const replicaPath = join(directory, "replica.jsonl");
    const backupPath = join(directory, "backup.json");
    const catalogPath = join(directory, "catalog.json");
    const service = createReplicatedAuthorityService({ primaryPath, replicaPath });
    assert.equal(connect(service, "session:catalog").status, 201);
    createAuthorityBackup({ primaryPath, replicaPath, backupPath });
    const entry = registerAuthorityBackup({ catalogPath, backupPath, backupId: "backup:001", createdAt: "2026-10-01T00:00:00.000Z" });
    assert.equal(entry.worldRevision, service.state.worldRevision);
    assert.deepEqual(registerAuthorityBackup({ catalogPath, backupPath, backupId: "backup:001", createdAt: "2026-10-01T00:00:00.000Z" }), entry);
    assert.equal(readAuthorityBackupCatalog(catalogPath).entries.length, 1);
  });
});

test("retention planning retains newest and pinned backups without deleting anything", () => {
  withDirectory((directory) => {
    const primaryPath = join(directory, "primary.jsonl");
    const replicaPath = join(directory, "replica.jsonl");
    const catalogPath = join(directory, "catalog.json");
    const service = createReplicatedAuthorityService({ primaryPath, replicaPath });
    assert.equal(connect(service, "session:retention").status, 201);
    for (const [backupId, createdAt, pinned] of [
      ["backup:old", "2026-10-01T00:00:00.000Z", false],
      ["backup:middle", "2026-10-02T00:00:00.000Z", true],
      ["backup:new", "2026-10-03T00:00:00.000Z", false],
    ]) {
      const backupPath = join(directory, `${backupId.replaceAll(":", "-")}.json`);
      createAuthorityBackup({ primaryPath, replicaPath, backupPath });
      registerAuthorityBackup({ catalogPath, backupPath, backupId, createdAt, pinned });
    }
    const plan = planAuthorityBackupRetention({ catalogPath, now: "2026-10-04T00:00:00.000Z", keepLatest: 1 });
    assert.deepEqual(plan.eligibleForDeletion, ["backup:old"]);
    assert.deepEqual(new Set(plan.retainedIds), new Set(["backup:new", "backup:middle"]));
    assert.equal(plan.destructiveActionRequired, true);
    assert.equal(readAuthorityBackupCatalog(catalogPath).entries.length, 3);
  });
});

test("backup catalog rejects changed metadata and tampered backup files", () => {
  withDirectory((directory) => {
    const primaryPath = join(directory, "primary.jsonl");
    const replicaPath = join(directory, "replica.jsonl");
    const backupPath = join(directory, "backup.json");
    const catalogPath = join(directory, "catalog.json");
    const service = createReplicatedAuthorityService({ primaryPath, replicaPath });
    connect(service, "session:catalog-tamper");
    createAuthorityBackup({ primaryPath, replicaPath, backupPath });
    registerAuthorityBackup({ catalogPath, backupPath, backupId: "backup:tamper", createdAt: "2026-10-01T00:00:00.000Z" });
    assert.throws(
      () => registerAuthorityBackup({ catalogPath, backupPath, backupId: "backup:tamper", createdAt: "2026-10-02T00:00:00.000Z" }),
      (error) => error instanceof AuthorityBackupCatalogValidationError && /different metadata/.test(error.message),
    );
    const tampered = JSON.parse(readFileSync(backupPath, "utf8"));
    tampered.worldRevision += 1;
    writeFileSync(backupPath, `${JSON.stringify(tampered)}\n`, "utf8");
    assert.throws(
      () => registerAuthorityBackup({ catalogPath, backupPath, backupId: "backup:new-tamper", createdAt: "2026-10-03T00:00:00.000Z" }),
      /backup digest is invalid/,
    );
  });
});
