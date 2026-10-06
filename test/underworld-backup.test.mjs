import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createUnderworldBackup, UnderworldBackupValidationError, restoreUnderworldBackup } from "../src/wolves-without-kings/underworld-backup.mjs";
import { appendUnderworldCheckpoint } from "../src/wolves-without-kings/underworld-journal.mjs";
import { createQuorumUnderworldStore } from "../src/wolves-without-kings/quorum-underworld-store.mjs";
import { createUnderworldState, registerMarket, registerOrganization } from "../src/wolves-without-kings/underworld.mjs";

function withDirectory(run) {
  const directory = mkdtempSync(join(tmpdir(), "wwk-underworld-backup-"));
  const nodes = ["shard-sofia", "shard-coastal", "shard-mountain"].map((nodeId) => ({
    nodeId,
    journalPath: join(directory, `${nodeId}.jsonl`),
  }));
  try { return run({ directory, nodes }); }
  finally { rmSync(directory, { recursive: true, force: true }); }
}

function buildStore(nodes) {
  const store = createQuorumUnderworldStore({ nodes, quorum: 2, initialState: createUnderworldState({ shardId: "shard:backup" }) });
  store.checkpoint(registerOrganization(store.state, {
    expectedRevision: store.state.revision,
    orgId: "org:backup",
    headquartersRegionId: "region:sofia-south",
  }), { checkpointId: "checkpoint:underworld:organization" });
  store.checkpoint(registerMarket(store.state, {
    expectedRevision: store.state.revision,
    marketId: "market:backup",
    regionId: "region:sofia-south",
    commodityClass: "legitimate-goods",
  }), { checkpointId: "checkpoint:underworld:market" });
  return store;
}

test("Underworld backup round-trips a parity-checked quorum journal set and protects destinations", () => {
  withDirectory(({ directory, nodes }) => {
    const store = buildStore(nodes);
    const backupPath = join(directory, "backup.json");
    const restoreNodes = nodes.map((node) => ({ nodeId: node.nodeId, journalPath: join(directory, "restore", `${node.nodeId}.jsonl`) }));
    const backup = createUnderworldBackup({ nodes, backupPath });
    assert.equal(backup.shardId, store.state.shardId);
    assert.equal(backup.revision, store.state.revision);
    const restored = restoreUnderworldBackup(backupPath, { nodes: restoreNodes });
    assert.equal(restored.checkpointCount, 3);
    const restarted = createQuorumUnderworldStore({ nodes: restoreNodes, quorum: 2 });
    assert.deepEqual(restarted.state, store.state);
    assert.throws(
      () => restoreUnderworldBackup(backupPath, { nodes: restoreNodes }),
      (error) => error instanceof UnderworldBackupValidationError && /destination exists/.test(error.message),
    );
  });
});

test("Underworld backup rejects a tampered envelope and divergent source journals", () => {
  withDirectory(({ directory, nodes }) => {
    buildStore(nodes);
    const backupPath = join(directory, "backup.json");
    createUnderworldBackup({ nodes, backupPath });
    const tampered = JSON.parse(readFileSync(backupPath, "utf8"));
    tampered.revision += 1;
    writeFileSync(backupPath, `${JSON.stringify(tampered)}\n`, "utf8");
    assert.throws(
      () => restoreUnderworldBackup(backupPath, { nodes: nodes.map((node) => ({ nodeId: node.nodeId, journalPath: join(directory, "tampered", `${node.nodeId}.jsonl`) })) }),
      (error) => error instanceof UnderworldBackupValidationError && /digest is invalid/.test(error.message),
    );

    const freshBackupPath = join(directory, "fresh-backup.json");
    const divergentPath = join(directory, "divergent.jsonl");
    appendUnderworldCheckpoint(divergentPath, createUnderworldState({ shardId: "shard:alternate" }), { checkpointId: "checkpoint:underworld:alternate" });
    writeFileSync(nodes[2].journalPath, readFileSync(divergentPath), "utf8");
    assert.throws(
      () => createUnderworldBackup({ nodes, backupPath: freshBackupPath }),
      (error) => error instanceof UnderworldBackupValidationError && /different lengths|diverge/.test(error.message),
    );
  });
});

test("Underworld backup requires three distinct parity-checked journals", () => {
  withDirectory(({ nodes }) => {
    assert.throws(
      () => createUnderworldBackup({ nodes: nodes.slice(0, 2), backupPath: join(tmpdir(), "wwk-underworld-empty-backup.json") }),
      (error) => error instanceof UnderworldBackupValidationError && /at least three/.test(error.message),
    );
  });
});
