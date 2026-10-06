import test from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { AuthorityJournalValidationError, createCheckpointedAuthorityService, readAuthorityJournal } from "../src/wolves-without-kings/authority-journal.mjs";

function withJournal(run) {
  const directory = mkdtempSync(join(tmpdir(), "wwk-authority-journal-"));
  const filePath = join(directory, "authority.jsonl");
  try { return run(filePath); }
  finally { rmSync(directory, { recursive: true, force: true }); }
}

function connect(service, sessionId = "session:journal") {
  return service.request({
    method: "POST",
    path: "/sessions/connect",
    body: { sessionId, clientId: `client:${sessionId}`, characterId: "character:player", role: "host", regionId: "region:sofia-south" },
  });
}

test("checkpointed authority restores sessions and revisions across service restart", () => {
  withJournal((filePath) => {
    const first = createCheckpointedAuthorityService({ journalPath: filePath });
    assert.equal(first.journal.entries.length, 1);
    assert.equal(connect(first).status, 201);
    const baseRevision = first.state.worldRevision;
    const accepted = first.request({
      method: "POST",
      path: "/sessions/session%3Ajournal/input",
      body: {
        clientInputSeq: 1,
        baseRevision,
        intent: { type: "wait", actorId: "character:player", regionId: "region:sofia-south", entityIds: [], payload: {} },
      },
    });
    assert.equal(accepted.status, 200);

    const restarted = createCheckpointedAuthorityService({ journalPath: filePath });
    assert.deepEqual(restarted.state, first.state);
    const duplicate = restarted.request({
      method: "POST",
      path: "/sessions/session%3Ajournal/input",
      body: {
        clientInputSeq: 1,
        baseRevision: restarted.state.worldRevision,
        intent: { type: "wait", actorId: "character:player", regionId: "region:sofia-south", entityIds: [], payload: {} },
      },
    });
    assert.equal(duplicate.status, 409);
    assert.equal(restarted.state.worldRevision, first.state.worldRevision);
    assert.equal(readAuthorityJournal(filePath).entries.length, 3);
  });
});

test("checkpoint journal recovers an incomplete tail but rejects complete-record tampering", () => {
  withJournal((filePath) => {
    const service = createCheckpointedAuthorityService({ journalPath: filePath });
    connect(service);
    appendFileSync(filePath, '{"journalSchemaVersion":1,"sequence":99', "utf8");
    const recovered = createCheckpointedAuthorityService({ journalPath: filePath });
    assert.equal(recovered.state.worldRevision, service.state.worldRevision);
    assert.equal(recovered.journal.recoveredTail, true);

    const firstLine = readFileSync(filePath, "utf8").split(/\r?\n/)[0];
    const record = JSON.parse(firstLine);
    record.worldRevision += 1;
    writeFileSync(filePath, `${JSON.stringify(record)}\n`, "utf8");
    assert.throws(
      () => createCheckpointedAuthorityService({ journalPath: filePath }),
      (error) => error instanceof AuthorityJournalValidationError && /hash is invalid/.test(error.message),
    );
  });
});

