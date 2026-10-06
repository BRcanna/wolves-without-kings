import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  createCoordinatedAuthorityService,
  CoordinatedAuthorityValidationError,
} from "../src/wolves-without-kings/coordinated-authority-service.mjs";

function withService(run) {
  const directory = mkdtempSync(join(tmpdir(), "wwk-coordinated-authority-"));
  const nodes = ["host:sofia", "host:coast", "host:mountain"].map((nodeId) => ({ nodeId, journalPath: join(directory, `${nodeId.replaceAll(":", "-")}.jsonl`) }));
  try { return run(createCoordinatedAuthorityService({ nodes, quorum: 2, initialLeaderId: "host:sofia", leaseTicks: 4 })); }
  finally { rmSync(directory, { recursive: true, force: true }); }
}

function connect(service, nodeId, fenceToken, sessionId) {
  return service.request({ nodeId, fenceToken, method: "POST", path: "/sessions/connect", body: { sessionId, clientId: `client:${sessionId}`, characterId: "character:player", role: "host", regionId: "region:sofia-south" } });
}

test("coordinated authority admits only the fenced leader and invalidates it on handoff", () => {
  withService((service) => {
    const oldFence = service.fenceToken;
    assert.equal(connect(service, "host:sofia", oldFence, "session:leader").status, 201);
    const handoff = service.handoff({ fromNodeId: "host:sofia", toNodeId: "host:coast", fenceToken: oldFence, currentTick: 1 });
    assert.equal(service.leaderId, "host:coast");
    assert.notEqual(handoff.fenceToken, oldFence);
    const stale = connect(service, "host:sofia", oldFence, "session:stale");
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error, "authority_fence_rejected");
    assert.equal(connect(service, "host:coast", handoff.fenceToken, "session:new-leader").status, 201);
  });
});

test("coordinated authority rejects an unavailable leader and preserves quorum failure semantics", () => {
  withService((service) => {
    const fence = service.fenceToken;
    service.setNodeAvailability("host:coast", false);
    service.setNodeAvailability("host:mountain", false);
    const before = service.state;
    const result = connect(service, "host:sofia", fence, "session:no-quorum");
    assert.equal(result.status, 503);
    assert.deepEqual(service.state, before);
    service.setNodeAvailability("host:coast", true);
    const unavailable = service.setNodeAvailability("host:sofia", false);
    assert.equal(unavailable.nodes.some((node) => node.nodeId === "host:sofia" && !node.available), true);
    const rejectedLeader = connect(service, "host:sofia", fence, "session:unavailable");
    assert.equal(rejectedLeader.status, 409);
  });
});

test("coordinated health projection exposes quorum and coordination without requiring a mutation claim", () => {
  withService((service) => {
    const health = service.request({ method: "GET", path: "/health" });
    assert.equal(health.status, 200);
    assert.equal(health.body.mode, "coordinated");
    assert.equal(health.body.quorum.quorumAvailable, true);
    assert.equal(health.body.coordination.coordinationTick, undefined);
    assert.equal(JSON.stringify(health.body).includes(service.fenceToken), false);
  });
});
