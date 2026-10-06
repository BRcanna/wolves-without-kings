import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { appendUnderworldCheckpoint } from "../src/wolves-without-kings/underworld-journal.mjs";
import { createUnderworldState, registerMarket, registerOrganization } from "../src/wolves-without-kings/underworld.mjs";
import {
  createQuorumUnderworldStore,
  QuorumUnderworldValidationError,
  UnderworldQuorumUnavailableError,
} from "../src/wolves-without-kings/quorum-underworld-store.mjs";

function withNodes(run) {
  const directory = mkdtempSync(join(tmpdir(), "wwk-quorum-underworld-"));
  const nodes = ["shard-sofia", "shard-coastal", "shard-mountain"].map((nodeId) => ({
    nodeId,
    journalPath: join(directory, `${nodeId}.jsonl`),
  }));
  try { return run({ directory, nodes }); }
  finally { rmSync(directory, { recursive: true, force: true }); }
}

function nextOrganization(state) {
  return registerOrganization(state, {
    expectedRevision: state.revision,
    orgId: "org:quorum",
    headquartersRegionId: "region:sofia-south",
  });
}

function nextMarket(state) {
  return registerMarket(state, {
    expectedRevision: state.revision,
    marketId: "market:quorum",
    regionId: "region:sofia-south",
    commodityClass: "legitimate-goods",
  });
}

test("Underworld quorum commits with a partition, fails closed below quorum, and repairs a returning node", () => {
  withNodes(({ nodes }) => {
    const store = createQuorumUnderworldStore({ nodes, quorum: 2 });
    store.setNodeAvailability("shard-mountain", false);
    store.checkpoint(nextOrganization(store.state), { checkpointId: "checkpoint:underworld:organization" });

    assert.equal(store.health.availableNodes, 2);
    assert.equal(store.health.quorumAvailable, true);
    assert.equal(store.health.authoritativeRevision, 1);
    assert.equal(store.health.nodes.find((node) => node.nodeId === "shard-mountain").needsRepair, true);

    const beforeUnavailableCommit = store.state;
    store.setNodeAvailability("shard-coastal", false);
    assert.throws(
      () => store.checkpoint(nextMarket(store.state), { checkpointId: "checkpoint:underworld:market" }),
      (error) => error instanceof UnderworldQuorumUnavailableError && error.availableNodes === 1 && error.quorum === 2,
    );
    assert.deepEqual(store.state, beforeUnavailableCommit);

    store.setNodeAvailability("shard-coastal", true);
    store.setNodeAvailability("shard-mountain", true);
    assert.equal(store.health.nodes.find((node) => node.nodeId === "shard-mountain").needsRepair, true);
    store.repairNode("shard-mountain");
    assert.deepEqual(new Set(Object.values(store.journal).map((entries) => entries.length)), new Set([2]));
  });
});

test("Underworld quorum repairs a stale node at startup and rejects divergent history", () => {
  withNodes(({ directory, nodes }) => {
    const store = createQuorumUnderworldStore({ nodes, quorum: 2 });
    store.setNodeAvailability("shard-mountain", false);
    store.checkpoint(nextOrganization(store.state), { checkpointId: "checkpoint:underworld:organization" });

    const restarted = createQuorumUnderworldStore({ nodes, quorum: 2 });
    assert.equal(restarted.state.revision, 1);
    assert.deepEqual(new Set(Object.values(restarted.journal).map((entries) => entries.length)), new Set([2]));

    const divergentPath = join(directory, "divergent.jsonl");
    appendUnderworldCheckpoint(divergentPath, createUnderworldState({ shardId: "shard:alternate" }), { checkpointId: "checkpoint:underworld:alternate" });
    writeFileSync(nodes[2].journalPath, readFileSync(divergentPath), "utf8");

    assert.throws(
      () => createQuorumUnderworldStore({ nodes, quorum: 2 }),
      (error) => error instanceof QuorumUnderworldValidationError && /diverges from quorum history/.test(error.message),
    );
  });
});

test("Underworld quorum requires strict-majority configuration and matching shard revisions", () => {
  withNodes(({ nodes }) => {
    assert.throws(
      () => createQuorumUnderworldStore({ nodes, quorum: 1 }),
      (error) => error instanceof QuorumUnderworldValidationError && /strict majority/.test(error.message),
    );
    assert.throws(
      () => createQuorumUnderworldStore({ nodes, quorum: 4 }),
      (error) => error instanceof QuorumUnderworldValidationError && /cannot exceed node count/.test(error.message),
    );

    const store = createQuorumUnderworldStore({ nodes, quorum: 2, initialState: createUnderworldState({ shardId: "shard:primary" }) });
    assert.throws(
      () => store.checkpoint(createUnderworldState({ shardId: "shard:other" })),
      (error) => error instanceof QuorumUnderworldValidationError && /shardId/.test(error.message),
    );
  });
});

test("Underworld quorum does not reset a non-empty outlier behind an empty majority", () => {
  withNodes(({ nodes }) => {
    appendUnderworldCheckpoint(nodes[2].journalPath, createUnderworldState(), { checkpointId: "checkpoint:underworld:outlier" });
    assert.throws(
      () => createQuorumUnderworldStore({ nodes, quorum: 2 }),
      (error) => error instanceof QuorumUnderworldValidationError && /ahead of empty quorum history/.test(error.message),
    );
  });
});
