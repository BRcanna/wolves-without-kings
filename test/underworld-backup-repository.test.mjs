import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createUnderworldBackup } from "../src/wolves-without-kings/underworld-backup.mjs";
import {
  publishUnderworldBackup,
  readUnderworldRepositoryBackup,
  restoreUnderworldRepositoryBackup,
  UnderworldBackupRepositoryValidationError,
  verifyUnderworldBackupRepository,
} from "../src/wolves-without-kings/underworld-backup-repository.mjs";
import { createQuorumUnderworldStore } from "../src/wolves-without-kings/quorum-underworld-store.mjs";
import { createUnderworldState, registerOrganization } from "../src/wolves-without-kings/underworld.mjs";

function withDirectory(run) {
  const directory = mkdtempSync(join(tmpdir(), "wwk-underworld-backup-repository-"));
  const nodes = ["shard-sofia", "shard-coastal", "shard-mountain"].map((nodeId) => ({ nodeId, journalPath: join(directory, `${nodeId}.jsonl`) }));
  try { return run({ directory, nodes }); }
  finally { rmSync(directory, { recursive: true, force: true }); }
}

function createBackup(directory, nodes) {
  const store = createQuorumUnderworldStore({ nodes, quorum: 2, initialState: createUnderworldState({ shardId: "shard:repository" }) });
  store.checkpoint(registerOrganization(store.state, {
    expectedRevision: store.state.revision,
    orgId: "org:repository",
    headquartersRegionId: "region:sofia-south",
  }), { checkpointId: "checkpoint:underworld:organization" });
  const backupPath = join(directory, "backup.json");
  createUnderworldBackup({ nodes, backupPath });
  return { store, backupPath };
}

test("Underworld backup repository publishes idempotently, verifies, and restores validated objects", () => {
  withDirectory(({ directory, nodes }) => {
    const { store, backupPath } = createBackup(directory, nodes);
    const repositoryRoot = join(directory, "repository");
    const first = publishUnderworldBackup({ backupPath, repositoryRoot, objectId: "underworld-001" });
    const second = publishUnderworldBackup({ backupPath, repositoryRoot, objectId: "underworld-001" });
    assert.equal(first.idempotent, false);
    assert.equal(second.idempotent, true);
    assert.deepEqual(readUnderworldRepositoryBackup({ repositoryRoot, objectId: "underworld-001" }), JSON.parse(readFileSync(backupPath, "utf8")));
    assert.equal(verifyUnderworldBackupRepository({ repositoryRoot }).valid, true);
    const restoreNodes = nodes.map((node) => ({ nodeId: node.nodeId, journalPath: join(directory, "restore", `${node.nodeId}.jsonl`) }));
    const restored = restoreUnderworldRepositoryBackup({ repositoryRoot, objectId: "underworld-001", nodes: restoreNodes });
    assert.equal(restored.revision, store.state.revision);
  });
});

test("Underworld backup repository rejects immutable conflicts, unsafe IDs, and tampered objects", () => {
  withDirectory(({ directory, nodes }) => {
    const { backupPath } = createBackup(directory, nodes);
    const repositoryRoot = join(directory, "repository");
    publishUnderworldBackup({ backupPath, repositoryRoot, objectId: "underworld-001" });
    const changed = JSON.parse(readFileSync(backupPath, "utf8"));
    changed.revision += 1;
    writeFileSync(backupPath, `${JSON.stringify(changed)}\n`, "utf8");
    assert.throws(() => publishUnderworldBackup({ backupPath, repositoryRoot, objectId: "underworld-001" }), /digest is invalid/);
    assert.throws(
      () => publishUnderworldBackup({ backupPath: join(directory, "backup-original.json") , repositoryRoot, objectId: "..\\escape" }),
      (error) => error instanceof UnderworldBackupRepositoryValidationError && /safe portable/.test(error.message),
    );

    const objectPath = join(repositoryRoot, "objects", "underworld-001.json");
    const tampered = JSON.parse(readFileSync(objectPath, "utf8"));
    tampered.revision += 1;
    writeFileSync(objectPath, `${JSON.stringify(tampered)}\n`, "utf8");
    const report = verifyUnderworldBackupRepository({ repositoryRoot });
    assert.equal(report.valid, false);
    assert.equal(report.objects[0].valid, false);
  });
});
