import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createCheckpointedAuthorityService } from "../src/wolves-without-kings/authority-journal.mjs";
import { createAuthorityState } from "../src/wolves-without-kings/authority.mjs";
import {
  createQuorumAuthorityService,
  QuorumAuthorityValidationError,
} from "../src/wolves-without-kings/quorum-authority-service.mjs";

function withNodes(run) {
  const directory = mkdtempSync(join(tmpdir(), "wwk-quorum-authority-"));
  const nodes = ["host-sofia", "host-coastal", "host-mountain"].map((nodeId) => ({
    nodeId,
    journalPath: join(directory, `${nodeId}.jsonl`),
  }));
  try { return run({ directory, nodes }); }
  finally { rmSync(directory, { recursive: true, force: true }); }
}

function connect(service, sessionId = "session:quorum") {
  return service.request({
    method: "POST",
    path: "/sessions/connect",
    body: { sessionId, clientId: `client:${sessionId}`, characterId: "character:player", role: "host", regionId: "region:sofia-south" },
  });
}

function waitInput(service, clientInputSeq, baseRevision) {
  return service.request({
    method: "POST",
    path: "/sessions/session%3Aquorum/input",
    body: {
      clientInputSeq,
      baseRevision,
      intent: { type: "wait", actorId: "character:player", regionId: "region:sofia-south", entityIds: [], payload: {} },
    },
  });
}

test("quorum authority commits with a partition, fails closed without quorum, and repairs a returning node", () => {
  withNodes(({ nodes }) => {
    const service = createQuorumAuthorityService({ nodes, quorum: 2 });
    assert.equal(connect(service).status, 201);
    service.setNodeAvailability("host-mountain", false);

    const accepted = waitInput(service, 1, service.state.worldRevision);
    assert.equal(accepted.status, 200);
    assert.equal(service.health.availableNodes, 2);
    assert.equal(service.health.quorumAvailable, true);
    assert.equal(service.health.nodes.find((node) => node.nodeId === "host-mountain").needsRepair, true);

    const beforeUnavailableCommit = service.state;
    service.setNodeAvailability("host-coastal", false);
    const rejected = waitInput(service, 2, service.state.worldRevision);
    assert.equal(rejected.status, 503);
    assert.equal(rejected.body.error, "authority_quorum_unavailable");
    assert.deepEqual(service.state, beforeUnavailableCommit);

    service.setNodeAvailability("host-coastal", true);
    service.setNodeAvailability("host-mountain", true);
    assert.equal(service.health.nodes.find((node) => node.nodeId === "host-mountain").needsRepair, true);
    service.repairNode("host-mountain");
    const journalLengths = Object.values(service.journal).map((entries) => entries.length);
    assert.deepEqual(new Set(journalLengths), new Set([3]));
  });
});

test("quorum authority rejects a split-brain journal instead of selecting a convenient majority", () => {
  withNodes(({ directory, nodes }) => {
    const service = createQuorumAuthorityService({ nodes, quorum: 2 });
    assert.equal(connect(service).status, 201);

    const divergentPath = join(directory, "divergent.jsonl");
    createCheckpointedAuthorityService({
      journalPath: divergentPath,
      initialState: createAuthorityState({ worldId: "wwk-divergent-world", regionAuthority: "region:coastal", serverEra: "2004" }),
    });
    writeFileSync(nodes[2].journalPath, readFileSync(divergentPath), "utf8");

    assert.throws(
      () => createQuorumAuthorityService({ nodes, quorum: 2 }),
      (error) => error instanceof QuorumAuthorityValidationError && /diverges from quorum history/.test(error.message),
    );
  });
});

test("quorum authority requires a strict-majority configuration", () => {
  withNodes(({ nodes }) => {
    assert.throws(
      () => createQuorumAuthorityService({ nodes, quorum: 1 }),
      (error) => error instanceof QuorumAuthorityValidationError && /strict majority/.test(error.message),
    );
    assert.throws(
      () => createQuorumAuthorityService({ nodes, quorum: 4 }),
      (error) => error instanceof QuorumAuthorityValidationError && /cannot exceed node count/.test(error.message),
    );
  });
});
