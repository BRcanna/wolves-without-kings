import test from "node:test";
import assert from "node:assert/strict";

import {
  acquireAuthorityLease,
  assertAuthorityFencingToken,
  createAuthorityCoordinationState,
  handoffAuthorityLease,
  projectAuthorityCoordination,
  registerCoordinationNode,
  renewAuthorityLease,
  restoreAuthorityCoordination,
  setCoordinationNodeStatus,
  snapshotAuthorityCoordination,
  AuthorityCoordinationValidationError,
} from "../src/wolves-without-kings/authority-coordination.mjs";

function nodes() {
  let state = createAuthorityCoordinationState();
  state = registerCoordinationNode(state, { nodeId: "host:sofia", hostLabel: "sofia" });
  state = registerCoordinationNode(state, { nodeId: "host:coast", hostLabel: "coast" });
  return registerCoordinationNode(state, { nodeId: "host:mountain", hostLabel: "mountain" });
}

test("authority coordination acquires, renews, and hands off a fenced lease", () => {
  const acquired = acquireAuthorityLease(nodes(), { nodeId: "host:sofia", currentTick: 1, leaseTicks: 4 });
  assert.equal(acquired.term, 1);
  assert.deepEqual(assertAuthorityFencingToken(acquired.state, { nodeId: "host:sofia", fenceToken: acquired.fenceToken, currentTick: 2 }).nodeId, "host:sofia");
  const renewed = renewAuthorityLease(acquired.state, { nodeId: "host:sofia", fenceToken: acquired.fenceToken, currentTick: 3, leaseTicks: 4 });
  const handoff = handoffAuthorityLease(renewed, { fromNodeId: "host:sofia", toNodeId: "host:coast", fenceToken: acquired.fenceToken, currentTick: 4, leaseTicks: 4 });
  assert.equal(handoff.state.leaderId, "host:coast");
  assert.notEqual(handoff.fenceToken, acquired.fenceToken);
  assert.throws(() => assertAuthorityFencingToken(handoff.state, { nodeId: "host:sofia", fenceToken: acquired.fenceToken, currentTick: 4 }), /stale/);
});

test("expired leases can be acquired by another active node and suspended nodes cannot lead", () => {
  const acquired = acquireAuthorityLease(nodes(), { nodeId: "host:sofia", currentTick: 1, leaseTicks: 2 });
  const takeover = acquireAuthorityLease(acquired.state, { nodeId: "host:coast", currentTick: 3, leaseTicks: 2 });
  assert.equal(takeover.state.leaderId, "host:coast");
  const suspended = setCoordinationNodeStatus(takeover.state, { nodeId: "host:mountain", status: "suspended" });
  assert.throws(() => acquireAuthorityLease(suspended, { nodeId: "host:mountain", currentTick: 6, leaseTicks: 2 }), /suspended/);
  assert.throws(() => renewAuthorityLease(suspended, { nodeId: "host:sofia", fenceToken: acquired.fenceToken, currentTick: 3 }), /stale/);
});

test("coordination snapshot restores fencing history and public projection redacts lease material", () => {
  const acquired = acquireAuthorityLease(nodes(), { nodeId: "host:sofia", currentTick: 1, leaseTicks: 4 });
  const restored = restoreAuthorityCoordination(snapshotAuthorityCoordination(acquired.state));
  assert.deepEqual(restored, acquired.state);
  const projection = projectAuthorityCoordination(restored);
  assert.equal(JSON.stringify(projection).includes(acquired.fenceToken), false);
  const tampered = snapshotAuthorityCoordination(acquired.state);
  tampered.state.events[0].payload.nodeId = "host:tampered";
  assert.throws(() => restoreAuthorityCoordination(tampered), (error) => error instanceof AuthorityCoordinationValidationError && /hash is invalid/.test(error.message));
});
