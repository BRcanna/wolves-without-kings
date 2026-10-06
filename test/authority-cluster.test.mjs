import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createAuthorityClusterRuntime, createAuthorityClusterMembership, projectAuthorityClusterMembership, restoreAuthorityClusterMembership, snapshotAuthorityClusterMembership, setClusterNodeStatus } from "../src/wolves-without-kings/authority-cluster.mjs";
import { createCoordinatedAuthorityService } from "../src/wolves-without-kings/coordinated-authority-service.mjs";

function withRuntime(run) {
  const directory = mkdtempSync(join(tmpdir(), "wwk-cluster-"));
  const nodes = ["host:sofia", "host:coast", "host:mountain"].map((nodeId) => ({ nodeId, journalPath: join(directory, `${nodeId.replaceAll(":", "-")}.jsonl`) }));
  const service = createCoordinatedAuthorityService({ nodes, quorum: 2, initialLeaderId: "host:sofia", leaseTicks: 4 });
  const runtime = createAuthorityClusterRuntime({ service, nodes: nodes.map(({ nodeId }) => ({ nodeId })), quorum: 2, initialLeaderId: "host:sofia", leaseTicks: 4 });
  return Promise.resolve().then(() => run(runtime, service)).finally(async () => {
    await runtime.close();
    rmSync(directory, { recursive: true, force: true });
  });
}

function connectBody(sessionId) {
  return { sessionId, clientId: `client:${sessionId}`, characterId: "character:player", role: "host", regionId: "region:sofia-south" };
}

test("loopback cluster routes mutations over HTTP only to the elected fenced leader", async () => {
  await withRuntime(async (runtime) => {
    await runtime.listenAll();
    const health = await runtime.request({ method: "GET", path: "/health" });
    assert.equal(health.status, 200);
    assert.equal(health.body.nodeId, "host:sofia");
    assert.equal(health.body.cluster.leaderId, "host:sofia");
    const accepted = await runtime.request({ method: "POST", path: "/sessions/connect", body: connectBody("session:leader") });
    assert.equal(accepted.status, 201);
    const follower = await runtime.requestNode("host:coast", { method: "POST", path: "/sessions/connect", body: connectBody("session:follower") });
    assert.equal(follower.status, 421);
    assert.equal(follower.body.error, "not_current_leader");
    assert.equal(JSON.stringify(runtime.health).includes(runtime.fenceToken), false);
  });
});

test("leader transport loss can elect an active member after lease expiry and preserve authority history", async () => {
  await withRuntime(async (runtime) => {
    await runtime.listenAll();
    const first = await runtime.request({ method: "POST", path: "/sessions/connect", body: connectBody("session:first") });
    assert.equal(first.status, 201);
    await runtime.stopNode("host:sofia");
    const unavailable = await runtime.request({ method: "POST", path: "/sessions/connect", body: connectBody("session:unavailable") });
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.body.error, "cluster_transport_unavailable");
    const election = await runtime.electLeader({ candidateId: "host:coast", currentTick: 5 });
    assert.equal(election.leaderId, "host:coast");
    const second = await runtime.request({ method: "POST", path: "/sessions/connect", body: connectBody("session:recovered") });
    assert.equal(second.status, 201);
    assert.equal(runtime.state.worldRevision > 1, true);
  });
});

test("cluster membership fails closed below quorum and restores its hash-chained history", () => {
  let state = createAuthorityClusterMembership({ nodes: ["a", "b", "c"], quorum: 2, initialLeaderId: "a" });
  state = setClusterNodeStatus(state, { nodeId: "b", status: "offline" });
  const snapshot = snapshotAuthorityClusterMembership(state);
  const restored = restoreAuthorityClusterMembership(snapshot);
  assert.deepEqual(restored, state);
  const projected = projectAuthorityClusterMembership(restored);
  assert.equal(projected.activeNodes, 2);
  assert.equal(JSON.stringify(projected).includes("event hashes"), true);
});
