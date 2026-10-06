import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createUnderworldBackup } from "../src/wolves-without-kings/underworld-backup.mjs";
import { createIsolatedUnderworldBackupStore, IsolatedUnderworldBackupStoreValidationError } from "../src/wolves-without-kings/isolated-underworld-backup-store.mjs";
import { createQuorumUnderworldStore } from "../src/wolves-without-kings/quorum-underworld-store.mjs";
import { createUnderworldState, registerOrganization } from "../src/wolves-without-kings/underworld.mjs";

function withDirectory(run) {
  const directory = mkdtempSync(join(tmpdir(), "wwk-isolated-underworld-backup-"));
  const sourceRoot = join(directory, "source");
  const repositoryRoot = join(directory, "repository");
  const nodes = ["shard-sofia", "shard-coastal", "shard-mountain"].map((nodeId) => ({ nodeId, journalPath: join(sourceRoot, `${nodeId}.jsonl`) }));
  try { return run({ directory, sourceRoot, repositoryRoot, nodes }); }
  finally { rmSync(directory, { recursive: true, force: true }); }
}

function createSourceBackup(sourceRoot, nodes, name = "backup.json") {
  const store = createQuorumUnderworldStore({ nodes, quorum: 2, initialState: createUnderworldState({ shardId: "shard:isolated" }) });
  store.checkpoint(registerOrganization(store.state, {
    expectedRevision: store.state.revision,
    orgId: "org:isolated",
    headquartersRegionId: "region:sofia-south",
  }), { checkpointId: "checkpoint:underworld:organization" });
  const backupPath = join(sourceRoot, name);
  createUnderworldBackup({ nodes, backupPath });
  return { store, backupPath };
}

test("isolated Underworld backup store separates roots, verifies, restores, and requires explicit deletion approval", () => {
  withDirectory(({ sourceRoot, repositoryRoot, nodes }) => {
    const { store, backupPath } = createSourceBackup(sourceRoot, nodes);
    const isolated = createIsolatedUnderworldBackupStore({ sourceRoot, repositoryRoot, keepLatest: 1 });
    const published = isolated.publish({ backupPath, backupId: "underworld-001", createdAt: "2026-10-01T00:00:00.000Z", pinned: true });
    assert.equal(published.entry.revision, store.state.revision);
    assert.equal(isolated.verify().valid, true);
    assert.deepEqual(isolated.projection.omittedFields, ["sourceRoot", "repositoryRoot", "catalogPath", "backup contents"]);
    const destinationNodes = nodes.map((node) => ({ nodeId: node.nodeId, journalPath: join(repositoryRoot, "restored", `${node.nodeId}.jsonl`) }));
    assert.equal(isolated.restore({ objectId: "underworld-001", nodes: destinationNodes }).revision, store.state.revision);
    const noApproval = isolated.executeRetention({ now: "2026-10-02T00:00:00.000Z", approveDeletion: false });
    assert.equal(noApproval.deletionAuthorized, false);
    assert.deepEqual(noApproval.executedIds, []);
  });
});

test("isolated Underworld retention executes only after a valid reviewed plan", () => {
  withDirectory(({ sourceRoot, repositoryRoot, nodes }) => {
    const { backupPath } = createSourceBackup(sourceRoot, nodes);
    const isolated = createIsolatedUnderworldBackupStore({ sourceRoot, repositoryRoot, keepLatest: 1 });
    isolated.publish({ backupPath, backupId: "underworld-old", createdAt: "2026-10-01T00:00:00.000Z" });
    isolated.publish({ backupPath, backupId: "underworld-new", createdAt: "2026-10-03T00:00:00.000Z" });
    const plan = isolated.plan({ now: "2026-10-04T00:00:00.000Z" });
    assert.deepEqual(plan.eligibleForDeletion, ["underworld-old"]);
    const executed = isolated.executeRetention({ now: "2026-10-04T00:00:00.000Z", approveDeletion: true });
    assert.deepEqual(executed.executedIds, ["underworld-old"]);
    assert.equal(isolated.verify().valid, true);
    assert.equal(isolated.verify().catalogEntries, 1);
  });
});

test("isolated Underworld backup store rejects overlapping roots", () => {
  withDirectory(({ directory, repositoryRoot }) => {
    assert.throws(
      () => createIsolatedUnderworldBackupStore({ sourceRoot: directory, repositoryRoot }),
      (error) => error instanceof IsolatedUnderworldBackupStoreValidationError && /separate roots/.test(error.message),
    );
  });
});
