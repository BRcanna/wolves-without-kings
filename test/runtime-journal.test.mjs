import test from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  applyRegionalPropertyConflict,
  createRegionalRuntime,
  joinRegionalSession,
  settleRegionalSeason,
} from "../src/wolves-without-kings/regional-runtime.mjs";
import {
  appendRegionalRuntimeCheckpoint,
  readRegionalRuntimeJournal,
  restoreLatestRegionalRuntimeCheckpoint,
  RuntimeJournalValidationError,
} from "../src/wolves-without-kings/runtime-journal.mjs";

function withJournal(run) {
  const directory = mkdtempSync(join(tmpdir(), "wwk-runtime-journal-"));
  const filePath = join(directory, "regional-runtime.jsonl");
  try {
    return run(filePath);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function buildSeason() {
  let state = createRegionalRuntime();
  state = joinRegionalSession(state, {
    expectedRevision: state.revision,
    sessionId: "session:journal-player",
    characterId: "character:player",
    regionId: "region:capital",
  });
  state = applyRegionalPropertyConflict(state, {
    expectedRevision: state.revision,
    propertyId: "property:coastal-warehouse",
    orgId: "organization:rivals",
  });
  return settleRegionalSeason(state, { expectedRevision: state.revision, days: 14 });
}

test("regional runtime journal appends hash-chained checkpoints and restores the latest state", () => {
  withJournal((filePath) => {
    const initial = createRegionalRuntime();
    const first = appendRegionalRuntimeCheckpoint(filePath, initial, { checkpointId: "checkpoint:initial" });
    const final = buildSeason();
    const second = appendRegionalRuntimeCheckpoint(filePath, final, { checkpointId: "checkpoint:season-14" });

    assert.equal(first.sequence, 1);
    assert.equal(second.sequence, 2);
    assert.equal(second.previousHash, first.hash);
    assert.equal(readRegionalRuntimeJournal(filePath).entries.length, 2);

    const restored = restoreLatestRegionalRuntimeCheckpoint(filePath);
    assert.deepEqual(restored.state, final);
    assert.equal(restored.record.checkpointId, "checkpoint:season-14");
    assert.equal(restored.recoveredTail, false);
  });
});

test("repeating a checkpoint is idempotent and conflicting reuse fails closed", () => {
  withJournal((filePath) => {
    const state = createRegionalRuntime();
    const first = appendRegionalRuntimeCheckpoint(filePath, state, { checkpointId: "checkpoint:stable" });
    const repeated = appendRegionalRuntimeCheckpoint(filePath, state, { checkpointId: "checkpoint:stable" });

    assert.deepEqual(repeated, first);
    assert.equal(readRegionalRuntimeJournal(filePath).entries.length, 1);
    assert.throws(
      () => appendRegionalRuntimeCheckpoint(filePath, buildSeason(), { checkpointId: "checkpoint:stable" }),
      (error) => error instanceof RuntimeJournalValidationError && /different snapshot/.test(error.message),
    );
  });
});

test("an incomplete final write is recoverable while complete-record tampering is rejected", () => {
  withJournal((filePath) => {
    const state = createRegionalRuntime();
    appendRegionalRuntimeCheckpoint(filePath, state, { checkpointId: "checkpoint:crash-safe" });
    appendFileSync(filePath, '{"journalSchemaVersion":1,"sequence":2', "utf8");

    const recovered = restoreLatestRegionalRuntimeCheckpoint(filePath);
    assert.deepEqual(recovered.state, state);
    assert.equal(recovered.recoveredTail, true);

    const records = [JSON.parse(readFileSync(filePath, "utf8").split(/\r?\n/)[0])];
    records[0].runtimeRevision += 1;
    writeFileSync(filePath, `${JSON.stringify(records[0])}\n`, "utf8");
    assert.throws(
      () => readRegionalRuntimeJournal(filePath),
      (error) => error instanceof RuntimeJournalValidationError && /hash is invalid/.test(error.message),
    );
  });
});
