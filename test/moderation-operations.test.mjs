import test from "node:test";
import assert from "node:assert/strict";

import {
  claimModerationCase,
  createModerationOperationsState,
  decideModerationCase,
  enqueueModerationCase,
  projectModerationOperations,
  registerModerator,
  reapExpiredModerationClaims,
  restoreModerationOperations,
  setModeratorStatus,
  snapshotModerationOperations,
  ModerationOperationsValidationError,
} from "../src/wolves-without-kings/moderation-operations.mjs";

function queuedState() {
  let state = createModerationOperationsState({ claimLeaseTicks: 3 });
  state = registerModerator(state, { moderatorId: "moderator:one" });
  return enqueueModerationCase(state, { subjectId: "subject:one", sessionId: "session:one", contentDigest: "digest:one", labels: ["review"] });
}

test("moderation queue claims and decisions are explicit and audited", () => {
  let state = claimModerationCase(queuedState(), { caseId: "moderation:000001", moderatorId: "moderator:one", currentTick: 1 });
  state = decideModerationCase(state, { caseId: "moderation:000001", moderatorId: "moderator:one", decision: "allow", reasonCode: "reviewed", decidedAtTick: 2 });
  assert.equal(state.cases["moderation:000001"].status, "allowed");
  assert.equal(state.reviewers["moderator:one"].reviewedCount, 1);
  assert.equal(state.events.at(-1).eventType, "moderation.case.decided");
  assert.equal(state.cases["moderation:000001"].contentDigest, "digest:one");
});

test("expired claims are reclaimed and unauthorized moderation actions fail closed", () => {
  let state = claimModerationCase(queuedState(), { caseId: "moderation:000001", moderatorId: "moderator:one", currentTick: 1 });
  assert.throws(() => decideModerationCase(state, { caseId: "moderation:000001", moderatorId: "moderator:other", decision: "deny", reasonCode: "bad", decidedAtTick: 2 }), /unknown moderator/);
  state = reapExpiredModerationClaims(state, { currentTick: 4 });
  assert.equal(state.cases["moderation:000001"].status, "pending");
  state = setModeratorStatus(state, { moderatorId: "moderator:one", status: "suspended" });
  assert.throws(() => claimModerationCase(state, { caseId: "moderation:000001", moderatorId: "moderator:one", currentTick: 5 }), /suspended/);
});

test("moderation snapshots restore audit history and public projection omits sensitive fields", () => {
  const state = claimModerationCase(queuedState(), { caseId: "moderation:000001", moderatorId: "moderator:one", currentTick: 1 });
  const restored = restoreModerationOperations(snapshotModerationOperations(state));
  assert.deepEqual(restored, state);
  const projection = projectModerationOperations(restored);
  assert.equal(JSON.stringify(projection).includes("digest:one"), false);
  assert.equal(JSON.stringify(projection).includes("moderator:one"), false);
  const tampered = snapshotModerationOperations(state);
  tampered.state.events[0].payload.moderatorId = "moderator:tampered";
  assert.throws(() => restoreModerationOperations(tampered), (error) => error instanceof ModerationOperationsValidationError && /hash is invalid/.test(error.message));
});
