import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createCoordinatedUnderworldStore, UnderworldCoordinationValidationError } from "../src/wolves-without-kings/underworld-coordination.mjs";
import { createUnderworldState, registerOrganization } from "../src/wolves-without-kings/underworld.mjs";

function withNodes(run) {
  const directory = mkdtempSync(join(tmpdir(), "wwk-underworld-coordination-"));
  const nodes = ["shard-sofia", "shard-coastal", "shard-mountain"].map((nodeId) => ({ nodeId, journalPath: join(directory, `${nodeId}.jsonl`) }));
  try { return run({ directory, nodes }); }
  finally { rmSync(directory, { recursive: true, force: true }); }
}

function organizationState(store) {
  return registerOrganization(store.state, {
    expectedRevision: store.state.revision,
    orgId: "org:coordinated",
    headquartersRegionId: "region:sofia-south",
  });
}

test("coordinated Underworld store admits current leader, fences stale terms, and supports handoff", () => {
  withNodes(({ nodes }) => {
    const store = createCoordinatedUnderworldStore({ nodes, quorum: 2, leaseTicks: 3, initialState: createUnderworldState({ shardId: "shard:coordinated" }) });
    assert.equal(store.health.leaderId, "shard-sofia");
    assert.equal(store.health.fencingTerm, 1);
    store.checkpoint(organizationState(store), { nodeId: "shard-sofia", fenceTerm: 1, checkpointId: "checkpoint:underworld:organization" });
    assert.equal(store.state.revision, 1);
    assert.throws(
      () => store.checkpoint(store.state, { nodeId: "shard-sofia", fenceTerm: 99, checkpointId: "checkpoint:underworld:stale" }),
      (error) => error instanceof UnderworldCoordinationValidationError && /stale/.test(error.message),
    );
    const handoff = store.handoff({ fromNodeId: "shard-sofia", fromFenceTerm: 1, targetNodeId: "shard-coastal" });
    assert.equal(handoff.leaderId, "shard-coastal");
    assert.equal(handoff.fencingTerm, 2);
    assert.throws(
      () => store.checkpoint(store.state, { nodeId: "shard-sofia", fenceTerm: 1 }),
      (error) => error instanceof UnderworldCoordinationValidationError && /stale/.test(error.message),
    );
  });
});

test("coordinated Underworld store expires a leader lease and elects only with quorum", () => {
  withNodes(({ nodes }) => {
    const store = createCoordinatedUnderworldStore({ nodes, quorum: 2, leaseTicks: 2 });
    store.advanceClock(2);
    assert.equal(store.health.leaderId, null);
    const elected = store.elect({ targetNodeId: "shard-mountain" });
    assert.equal(elected.leaderId, "shard-mountain");
    assert.equal(elected.fencingTerm, 2);
    store.setNodeAvailability("shard-sofia", false);
    store.setNodeAvailability("shard-coastal", false);
    assert.throws(
      () => store.renew({ nodeId: "shard-mountain", fenceTerm: 2 }),
      (error) => error.availableNodes === 1 && error.quorum === 2,
    );
  });
});

test("coordinated Underworld store rejects unavailable handoff targets and expired writes", () => {
  withNodes(({ nodes }) => {
    const store = createCoordinatedUnderworldStore({ nodes, quorum: 2, leaseTicks: 2 });
    store.setNodeAvailability("shard-coastal", false);
    assert.throws(
      () => store.handoff({ fromNodeId: "shard-sofia", fromFenceTerm: 1, targetNodeId: "shard-coastal" }),
      (error) => error instanceof UnderworldCoordinationValidationError && /unavailable/.test(error.message),
    );
    store.advanceClock(2);
    assert.throws(
      () => store.checkpoint(store.state, { nodeId: "shard-sofia", fenceTerm: 1 }),
      (error) => error instanceof UnderworldCoordinationValidationError && /lease/.test(error.message),
    );
  });
});
