import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createReplicatedAuthorityService, ReplicatedAuthorityValidationError } from "../src/wolves-without-kings/replicated-authority-service.mjs";

function withReplicas(run) {
  const directory = mkdtempSync(join(tmpdir(), "wwk-replicated-authority-"));
  const paths = { primaryPath: join(directory, "primary.jsonl"), replicaPath: join(directory, "replica.jsonl") };
  try { return run(paths); }
  finally { rmSync(directory, { recursive: true, force: true }); }
}

function connect(service, sessionId = "session:replicated") {
  return service.request({
    method: "POST",
    path: "/sessions/connect",
    body: { sessionId, clientId: `client:${sessionId}`, characterId: "character:player", role: "host", regionId: "region:sofia-south" },
  });
}

test("replicated authority mirrors revisions and recovers from a missing primary", () => {
  withReplicas((paths) => {
    const service = createReplicatedAuthorityService(paths);
    assert.equal(connect(service).status, 201);
    assert.equal(service.journal.primary.entries.length, service.journal.replica.entries.length);
    const expected = service.state;
    unlinkSync(paths.primaryPath);

    const recovered = createReplicatedAuthorityService(paths);
    assert.deepEqual(recovered.state, expected);
    assert.equal(recovered.journal.primary.entries.length, recovered.journal.replica.entries.length);
    const next = connect(recovered, "session:after-failover");
    assert.equal(next.status, 201);
    assert.equal(recovered.journal.primary.entries.at(-1).hash, recovered.journal.replica.entries.at(-1).hash);
  });
});

test("replicated authority repairs a stale replica and rejects divergent history", () => {
  withReplicas((paths) => {
    const service = createReplicatedAuthorityService(paths);
    connect(service);
    const primaryLines = readFileSync(paths.primaryPath, "utf8").trimEnd().split(/\r?\n/);
    writeFileSync(paths.replicaPath, `${primaryLines[0]}\n`, "utf8");
    const repaired = createReplicatedAuthorityService(paths);
    assert.equal(repaired.journal.primary.entries.length, repaired.journal.replica.entries.length);

    const divergent = JSON.parse(primaryLines[0]);
    divergent.worldRevision += 1;
    writeFileSync(paths.replicaPath, `${JSON.stringify(divergent)}\n`, "utf8");
    assert.throws(
      () => createReplicatedAuthorityService(paths),
      (error) => error instanceof ReplicatedAuthorityValidationError,
    );
  });
});
