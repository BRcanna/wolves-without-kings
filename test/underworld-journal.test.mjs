import test from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  appendUnderworldCheckpoint,
  readUnderworldJournal,
  restoreLatestUnderworldCheckpoint,
  UnderworldJournalValidationError,
} from "../src/wolves-without-kings/underworld-journal.mjs";
import {
  createUnderworldState,
  registerMarket,
  settleUnderworldWeek,
} from "../src/wolves-without-kings/underworld.mjs";

function withJournal(run) {
  const directory = mkdtempSync(join(tmpdir(), "wwk-underworld-journal-"));
  const filePath = join(directory, "underworld.jsonl");
  try { return run(filePath); } finally { rmSync(directory, { recursive: true, force: true }); }
}

function builtState() {
  let state = createUnderworldState({ shardId: "shard:persistent" });
  state = registerMarket(state, { expectedRevision: state.revision, marketId: "market:coast", regionId: "region:coast", commodityClass: "vehicle-demand" });
  return settleUnderworldWeek(state, { expectedRevision: state.revision, marketShocks: { "market:coast": 12 } });
}

test("underworld journal restores hash-chained shard checkpoints", () => {
  withJournal((filePath) => {
    const initial = createUnderworldState({ shardId: "shard:persistent" });
    const first = appendUnderworldCheckpoint(filePath, initial, { checkpointId: "checkpoint:initial" });
    const final = builtState();
    const second = appendUnderworldCheckpoint(filePath, final, { checkpointId: "checkpoint:week-1" });
    assert.equal(first.sequence, 1);
    assert.equal(second.sequence, 2);
    assert.equal(second.previousHash, first.hash);
    assert.equal(readUnderworldJournal(filePath).entries.length, 2);
    const restored = restoreLatestUnderworldCheckpoint(filePath);
    assert.deepEqual(restored.state, final);
    assert.equal(restored.record.checkpointId, "checkpoint:week-1");
    assert.equal(restored.recoveredTail, false);
  });
});

test("underworld checkpoint retry is idempotent and conflicting reuse fails closed", () => {
  withJournal((filePath) => {
    const initial = createUnderworldState({ shardId: "shard:persistent" });
    const first = appendUnderworldCheckpoint(filePath, initial, { checkpointId: "checkpoint:stable" });
    const repeated = appendUnderworldCheckpoint(filePath, initial, { checkpointId: "checkpoint:stable" });
    assert.deepEqual(repeated, first);
    assert.equal(readUnderworldJournal(filePath).entries.length, 1);
    assert.throws(() => appendUnderworldCheckpoint(filePath, builtState(), { checkpointId: "checkpoint:stable" }), (error) => error instanceof UnderworldJournalValidationError && /different snapshot/.test(error.message));
  });
});

test("underworld journal recovers an incomplete crash tail but rejects complete-record tampering", () => {
  withJournal((filePath) => {
    const initial = createUnderworldState({ shardId: "shard:persistent" });
    appendUnderworldCheckpoint(filePath, initial, { checkpointId: "checkpoint:crash-safe" });
    appendFileSync(filePath, '{"journalSchemaVersion":1,"sequence":2', "utf8");
    const recovered = restoreLatestUnderworldCheckpoint(filePath);
    assert.deepEqual(recovered.state, initial);
    assert.equal(recovered.recoveredTail, true);

    const records = [JSON.parse(readFileSync(filePath, "utf8").split(/\r?\n/)[0])];
    records[0].shardRevision += 1;
    writeFileSync(filePath, `${JSON.stringify(records[0])}\n`, "utf8");
    assert.throws(() => readUnderworldJournal(filePath), (error) => error instanceof UnderworldJournalValidationError && /hash is invalid/.test(error.message));
  });
});
