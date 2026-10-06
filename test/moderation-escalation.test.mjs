import test from "node:test";
import assert from "node:assert/strict";

import {
  claimModerationEscalation,
  createModerationEscalationState,
  markModerationEscalationDeadlines,
  ModerationEscalationValidationError,
  openModerationEscalation,
  projectModerationEscalations,
  reapExpiredModerationEscalationClaims,
  respondToModerationEscalation,
  restoreModerationEscalations,
  snapshotModerationEscalations,
} from "../src/wolves-without-kings/moderation-escalation.mjs";
import {
  claimModerationCase,
  createModerationOperationsState,
  decideModerationCase,
  enqueueModerationCase,
  registerModerator,
} from "../src/wolves-without-kings/moderation-operations.mjs";

function escalatedModerationState() {
  let state = createModerationOperationsState({ claimLeaseTicks: 3 });
  state = registerModerator(state, { moderatorId: "moderator:one" });
  state = registerModerator(state, { moderatorId: "moderator:two" });
  state = enqueueModerationCase(state, { subjectId: "subject:one", sessionId: "session:one", contentDigest: "digest:private", labels: ["safety"] });
  state = claimModerationCase(state, { caseId: "moderation:000001", moderatorId: "moderator:one", currentTick: 1 });
  return decideModerationCase(state, { caseId: "moderation:000001", moderatorId: "moderator:one", decision: "escalate", reasonCode: "needs-review", decidedAtTick: 2 });
}

test("escalation routing composes an explicit escalate decision and records a bounded response", () => {
  const moderationState = escalatedModerationState();
  let state = openModerationEscalation(createModerationEscalationState({ responseTargetTicks: 3 }), {
    moderationState,
    caseId: "moderation:000001",
    route: "safety-review",
    evidenceDigest: "evidence:private",
    openedAtTick: 3,
  });
  state = claimModerationEscalation(state, { moderationState, escalationId: "escalation:000001", moderatorId: "moderator:two", currentTick: 4 });
  state = respondToModerationEscalation(state, {
    moderationState,
    escalationId: "escalation:000001",
    moderatorId: "moderator:two",
    outcome: "resolve",
    reasonCode: "reviewed",
    respondedAtTick: 5,
  });
  assert.equal(state.escalations["escalation:000001"].status, "resolved");
  assert.equal(state.escalations["escalation:000001"].responseState, "responded");
  assert.equal(moderationState.cases["moderation:000001"].status, "escalated");
  assert.equal(state.events.at(-1).eventType, "moderation.escalation.responded");
});

test("escalations record response-target breaches and still distinguish late closure", () => {
  const moderationState = escalatedModerationState();
  let state = openModerationEscalation(createModerationEscalationState({ claimLeaseTicks: 2, responseTargetTicks: 2 }), {
    moderationState,
    caseId: "moderation:000001",
    route: "policy-review",
    evidenceDigest: "evidence:private",
    openedAtTick: 3,
  });
  state = markModerationEscalationDeadlines(state, { currentTick: 6 });
  assert.equal(state.escalations["escalation:000001"].responseState, "breached");
  state = claimModerationEscalation(state, { moderationState, escalationId: "escalation:000001", moderatorId: "moderator:two", currentTick: 6 });
  state = respondToModerationEscalation(state, { moderationState, escalationId: "escalation:000001", moderatorId: "moderator:two", outcome: "refer", reasonCode: "specialist", respondedAtTick: 7 });
  assert.equal(projectModerationEscalations(state).responseBands["closed-late"], 1);
});

test("escalations reject non-escalated cases, expired claims, and invalid actions without mutation", () => {
  let notEscalated = createModerationOperationsState();
  notEscalated = registerModerator(notEscalated, { moderatorId: "moderator:one" });
  notEscalated = enqueueModerationCase(notEscalated, { subjectId: "subject:one", sessionId: "session:one", contentDigest: "digest:one" });
  assert.throws(() => openModerationEscalation(createModerationEscalationState(), { moderationState: notEscalated, caseId: "moderation:000001", route: "route", evidenceDigest: "digest" }), /not escalated/);

  const moderationState = escalatedModerationState();
  let state = openModerationEscalation(createModerationEscalationState({ claimLeaseTicks: 2 }), { moderationState, caseId: "moderation:000001", route: "route", evidenceDigest: "digest" });
  state = claimModerationEscalation(state, { moderationState, escalationId: "escalation:000001", moderatorId: "moderator:two", currentTick: 1 });
  assert.throws(() => respondToModerationEscalation(state, { moderationState, escalationId: "escalation:000001", moderatorId: "moderator:two", outcome: "resolve", reasonCode: "late", respondedAtTick: 4 }), /expired/);
  const reaped = reapExpiredModerationEscalationClaims(state, { currentTick: 4 });
  assert.equal(reaped.escalations["escalation:000001"].status, "pending");
  assert.equal(state.escalations["escalation:000001"].status, "claimed");
});

test("escalation snapshots restore audit history and public projection redacts operational details", () => {
  const moderationState = escalatedModerationState();
  const state = openModerationEscalation(createModerationEscalationState(), { moderationState, caseId: "moderation:000001", route: "private-route", evidenceDigest: "evidence:private" });
  const restored = restoreModerationEscalations(snapshotModerationEscalations(state));
  assert.deepEqual(restored, state);
  const projection = projectModerationEscalations(restored);
  assert.equal(JSON.stringify(projection).includes("private-route"), false);
  assert.equal(JSON.stringify(projection).includes("evidence:private"), false);
  const tampered = snapshotModerationEscalations(state);
  tampered.state.events[0].payload.route = "tampered";
  assert.throws(() => restoreModerationEscalations(tampered), (error) => error instanceof ModerationEscalationValidationError && /hash is invalid/.test(error.message));
});
