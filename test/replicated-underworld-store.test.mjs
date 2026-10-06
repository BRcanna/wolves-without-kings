import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  createReplicatedUnderworldStore,
  ReplicatedUnderworldValidationError,
} from "../src/wolves-without-kings/replicated-underworld-store.mjs";
import { appendUnderworldCheckpoint } from "../src/wolves-without-kings/underworld-journal.mjs";
import {
  createUnderworldState,
  registerMarket,
  settleUnderworldWeek,
} from "../src/wolves-without-kings/underworld.mjs";

function withReplicas(run) {
  const directory = mkdtempSync(join(tmpdir(), "wwk-replicated-underworld-"));
  const paths = { primaryPath: join(directory, "primary.jsonl"), replicaPath: join(directory, "replica.jsonl") };
  try { return run(paths); } finally { rmSync(directory, { recursive: true, force: true }); }
}

function weekState() {
  let state = createUnderworldState({ shardId: "shard:replicated" });
  state = registerMarket(state, { expectedRevision: state.revision, marketId: "market:coast", regionId: "region:coast", commodityClass: "vehicle-demand" });
  return settleUnderworldWeek(state, { expectedRevision: state.revision, marketShocks: { "market:coast": 10 } });
}

test("replicated underworld store mirrors checkpoints and recovers a missing primary", () => {
  withReplicas((paths) => {
    const store = createReplicatedUnderworldStore({ ...paths, initialState: createUnderworldState({ shardId: "shard:replicated" }) });
    store.checkpoint(weekState(), { checkpointId: "checkpoint:week-1" });
    const expected = store.state;
    assert.equal(store.journal.primary.entries.length, store.journal.replica.entries.length);
    unlinkSync(paths.primaryPath);
    const recovered = createReplicatedUnderworldStore({ ...paths, initialState: createUnderworldState({ shardId: "shard:replicated" }) });
    assert.deepEqual(recovered.state, expected);
    assert.equal(recovered.journal.primary.entries.length, recovered.journal.replica.entries.length);
  });
});

test("replicated underworld store repairs a stale copy and rejects divergent history", () => {
  withReplicas((paths) => {
    const store = createReplicatedUnderworldStore({ ...paths, initialState: createUnderworldState({ shardId: "shard:replicated" }) });
    store.checkpoint(weekState(), { checkpointId: "checkpoint:week-1" });
    const primaryLines = readFileSync(paths.primaryPath, "utf8").trimEnd().split(/\r?\n/);
    writeFileSync(paths.replicaPath, `${primaryLines[0]}\n`, "utf8");
    const repaired = createReplicatedUnderworldStore({ ...paths });
    assert.equal(repaired.journal.primary.entries.length, repaired.journal.replica.entries.length);

    writeFileSync(paths.replicaPath, "", "utf8");
    appendUnderworldCheckpoint(paths.replicaPath, createUnderworldState({ shardId: "shard:alternate" }), { checkpointId: "checkpoint:underworld:initial" });
    assert.throws(() => createReplicatedUnderworldStore({ ...paths }), (error) => error instanceof ReplicatedUnderworldValidationError && /diverges/.test(error.message));
  });
});

test("replicated underworld store rejects same-path configuration and invalid checkpoint state", () => {
  withReplicas((paths) => {
    assert.throws(() => createReplicatedUnderworldStore({ primaryPath: paths.primaryPath, replicaPath: paths.primaryPath }), /different/);
    const store = createReplicatedUnderworldStore({ ...paths });
    assert.throws(() => store.checkpoint({ schemaVersion: 1, revision: 0 }), ReplicatedUnderworldValidationError);
  });
});
