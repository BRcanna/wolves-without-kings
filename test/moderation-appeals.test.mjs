import test from "node:test";
import assert from "node:assert/strict";

import {
  claimModerationAppeal,
  createModerationAppealsState,
  decideModerationAppeal,
  ModerationAppealsValidationError,
  projectModerationAppeals,
  reapExpiredModerationAppealClaims,
  restoreModerationAppeals,
  snapshotModerationAppeals,
  submitModerationAppeal,
} from "../src/wolves-without-kings/moderation-appeals.mjs";
import {
  claimModerationCase,
  createModerationOperationsState,
  decideModerationCase,
  enqueueModerationCase,
  registerModerator,
} from "../src/wolves-without-kings/moderation-operations.mjs";

function decidedModerationState() {
  let state = createModerationOperationsState({ claimLeaseTicks: 3 });
  state = registerModerator(state, { moderatorId: "moderator:original" });
  state = registerModerator(state, { moderatorId: "moderator:appeal" });
  state = enqueueModerationCase(state, { subjectId: "subject:one", sessionId: "session:one", contentDigest: "digest:private", labels: ["review"] });
  state = claimModerationCase(state, { caseId: "moderation:000001", moderatorId: "moderator:original", currentTick: 1 });
  return decideModerationCase(state, { caseId: "moderation:000001", moderatorId: "moderator:original", decision: "deny", reasonCode: "policy", decidedAtTick: 2 });
}

test("appeal flow composes a decided moderation case and requires an independent reviewer", () => {
  const moderationState = decidedModerationState();
  let state = submitModerationAppeal(createModerationAppealsState(), {
    moderationState,
    caseId: "moderation:000001",
    appellantDigest: "appellant:digest",
    reasonDigest: "reason:digest",
    submittedAtTick: 3,
  });
  state = claimModerationAppeal(state, { moderationState, appealId: "appeal:000001", moderatorId: "moderator:appeal", currentTick: 4 });
  state = decideModerationAppeal(state, {
    moderationState,
    appealId: "appeal:000001",
    moderatorId: "moderator:appeal",
    decision: "overturn",
    reasonCode: "new-context",
    decidedAtTick: 5,
  });
  assert.equal(state.appeals["appeal:000001"].status, "overturned");
  assert.equal(state.appeals["appeal:000001"].originalDecision, "deny");
  assert.equal(moderationState.cases["moderation:000001"].status, "denied");
  assert.equal(state.events.at(-1).eventType, "moderation.appeal.decided");
});

test("appeals reject unresolved cases, duplicate submissions, and conflicted reviewers", () => {
  let unresolved = createModerationOperationsState();
  unresolved = registerModerator(unresolved, { moderatorId: "moderator:one" });
  unresolved = enqueueModerationCase(unresolved, { subjectId: "subject:one", sessionId: "session:one", contentDigest: "digest:one" });
  const appealState = createModerationAppealsState();
  assert.throws(() => submitModerationAppeal(appealState, { moderationState: unresolved, caseId: "moderation:000001", appellantDigest: "a", reasonDigest: "r" }), /not appealable/);

  const moderationState = decidedModerationState();
  let state = submitModerationAppeal(appealState, { moderationState, caseId: "moderation:000001", appellantDigest: "a", reasonDigest: "r" });
  assert.throws(() => submitModerationAppeal(state, { moderationState, caseId: "moderation:000001", appealId: "appeal:000002", appellantDigest: "b", reasonDigest: "r2" }), /already has an appeal/);
  assert.throws(() => claimModerationAppeal(state, { moderationState, appealId: "appeal:000001", moderatorId: "moderator:original", currentTick: 1 }), /independent/);
});

test("appeal leases expire and rejected actions do not mutate the state", () => {
  const moderationState = decidedModerationState();
  let state = submitModerationAppeal(createModerationAppealsState({ claimLeaseTicks: 2 }), { moderationState, caseId: "moderation:000001", appellantDigest: "a", reasonDigest: "r" });
  state = claimModerationAppeal(state, { moderationState, appealId: "appeal:000001", moderatorId: "moderator:appeal", currentTick: 1 });
  assert.throws(() => decideModerationAppeal(state, { moderationState, appealId: "appeal:000001", moderatorId: "moderator:appeal", decision: "uphold", reasonCode: "late", decidedAtTick: 3 }), /expired/);
  const reaped = reapExpiredModerationAppealClaims(state, { currentTick: 3 });
  assert.equal(reaped.appeals["appeal:000001"].status, "pending");
  assert.equal(state.appeals["appeal:000001"].status, "claimed");
});

test("appeal snapshots restore the audit chain and public projection omits sensitive fields", () => {
  const moderationState = decidedModerationState();
  const state = submitModerationAppeal(createModerationAppealsState(), { moderationState, caseId: "moderation:000001", appellantDigest: "appellant:private", reasonDigest: "reason:private" });
  const restored = restoreModerationAppeals(snapshotModerationAppeals(state));
  assert.deepEqual(restored, state);
  const projection = projectModerationAppeals(restored);
  assert.equal(JSON.stringify(projection).includes("appellant:private"), false);
  assert.equal(JSON.stringify(projection).includes("moderation:000001"), false);
  const tampered = snapshotModerationAppeals(state);
  tampered.state.events[0].payload.caseId = "moderation:tampered";
  assert.throws(() => restoreModerationAppeals(tampered), (error) => error instanceof ModerationAppealsValidationError && /hash is invalid/.test(error.message));
});
