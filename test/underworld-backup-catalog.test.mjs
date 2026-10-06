import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createUnderworldBackup } from "../src/wolves-without-kings/underworld-backup.mjs";
import {
  planUnderworldBackupRetention,
  readUnderworldBackupCatalog,
  registerUnderworldBackup,
  UnderworldBackupCatalogValidationError,
} from "../src/wolves-without-kings/underworld-backup-catalog.mjs";
import { createQuorumUnderworldStore } from "../src/wolves-without-kings/quorum-underworld-store.mjs";
import { createUnderworldState, registerOrganization } from "../src/wolves-without-kings/underworld.mjs";

function withDirectory(run) {
  const directory = mkdtempSync(join(tmpdir(), "wwk-underworld-backup-catalog-"));
  const nodes = ["shard-sofia", "shard-coastal", "shard-mountain"].map((nodeId) => ({ nodeId, journalPath: join(directory, `${nodeId}.jsonl`) }));
  try { return run({ directory, nodes }); }
  finally { rmSync(directory, { recursive: true, force: true }); }
}

function createBackup(directory, nodes, backupName = "backup.json") {
  const store = createQuorumUnderworldStore({ nodes, quorum: 2, initialState: createUnderworldState({ shardId: "shard:catalog" }) });
  store.checkpoint(registerOrganization(store.state, {
    expectedRevision: store.state.revision,
    orgId: "org:catalog",
    headquartersRegionId: "region:sofia-south",
  }), { checkpointId: "checkpoint:underworld:organization" });
  const backupPath = join(directory, backupName);
  createUnderworldBackup({ nodes, backupPath });
  return { store, backupPath };
}

test("Underworld backup catalog registration is digest-backed and idempotent", () => {
  withDirectory(({ directory, nodes }) => {
    const { store, backupPath } = createBackup(directory, nodes);
    const catalogPath = join(directory, "catalog.json");
    const entry = registerUnderworldBackup({ catalogPath, backupPath, backupId: "backup:001", createdAt: "2026-10-01T00:00:00.000Z" });
    assert.equal(entry.revision, store.state.revision);
    assert.deepEqual(registerUnderworldBackup({ catalogPath, backupPath, backupId: "backup:001", createdAt: "2026-10-01T00:00:00.000Z" }), entry);
    assert.equal(readUnderworldBackupCatalog(catalogPath).entries.length, 1);
  });
});

test("Underworld retention planning retains newest and pinned backups without deleting", () => {
  withDirectory(({ directory, nodes }) => {
    const catalogPath = join(directory, "catalog.json");
    const store = createQuorumUnderworldStore({ nodes, quorum: 2, initialState: createUnderworldState({ shardId: "shard:catalog" }) });
    store.checkpoint(registerOrganization(store.state, {
      expectedRevision: store.state.revision,
      orgId: "org:catalog",
      headquartersRegionId: "region:sofia-south",
    }), { checkpointId: "checkpoint:underworld:organization" });
    for (const [backupId, createdAt, pinned, name] of [
      ["backup:old", "2026-10-01T00:00:00.000Z", false, "old.json"],
      ["backup:middle", "2026-10-02T00:00:00.000Z", true, "middle.json"],
      ["backup:new", "2026-10-03T00:00:00.000Z", false, "new.json"],
    ]) {
      const backupPath = join(directory, name);
      createUnderworldBackup({ nodes, backupPath });
      registerUnderworldBackup({ catalogPath, backupPath, backupId, createdAt, pinned });
    }
    const plan = planUnderworldBackupRetention({ catalogPath, now: "2026-10-04T00:00:00.000Z", keepLatest: 1 });
    assert.deepEqual(plan.eligibleForDeletion, ["backup:old"]);
    assert.deepEqual(new Set(plan.retainedIds), new Set(["backup:new", "backup:middle"]));
    assert.equal(plan.destructiveActionRequired, true);
    assert.equal(readUnderworldBackupCatalog(catalogPath).entries.length, 3);
  });
});

test("Underworld backup catalog rejects changed metadata and tampered backups", () => {
  withDirectory(({ directory, nodes }) => {
    const { backupPath } = createBackup(directory, nodes);
    const catalogPath = join(directory, "catalog.json");
    registerUnderworldBackup({ catalogPath, backupPath, backupId: "backup:tamper", createdAt: "2026-10-01T00:00:00.000Z" });
    assert.throws(
      () => registerUnderworldBackup({ catalogPath, backupPath, backupId: "backup:tamper", createdAt: "2026-10-02T00:00:00.000Z" }),
      (error) => error instanceof UnderworldBackupCatalogValidationError && /different metadata/.test(error.message),
    );
    const tampered = JSON.parse(readFileSync(backupPath, "utf8"));
    tampered.revision += 1;
    writeFileSync(backupPath, `${JSON.stringify(tampered)}\n`, "utf8");
    assert.throws(
      () => registerUnderworldBackup({ catalogPath, backupPath, backupId: "backup:new-tamper", createdAt: "2026-10-03T00:00:00.000Z" }),
      /backup digest is invalid/,
    );
  });
});
