import { createHash } from "node:crypto";

import { canonicalJson } from "./engine.mjs";
import { restoreModerationOperations, snapshotModerationOperations } from "./moderation-operations.mjs";

export const MODERATION_ESCALATION_SCHEMA_VERSION = 1;

export class ModerationEscalationValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ModerationEscalationValidationError";
  }
}

function clone(value) { return structuredClone(value); }

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new ModerationEscalationValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) throw new ModerationEscalationValidationError(`${field} must be an integer >= ${minimum}`);
}

function eventHash(event, previousHash) {
  return createHash("sha256").update(`${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`, "utf8").digest("hex");
}

function appendEvent(state, eventType, payload) {
  const next = clone(state);
  const unsigned = {
    eventId: `escalation-${String(next.nextEventId).padStart(6, "0")}`,
    eventType,
    moderationTick: next.currentTick,
    payload: clone(payload),
    previousHash: next.lastEventHash,
  };
  const event = { ...unsigned, hash: eventHash(unsigned, unsigned.previousHash) };
  next.events.push(event);
  next.nextEventId += 1;
  next.lastEventHash = event.hash;
  return next;
}

function assertState(state) {
  if (!state || state.schemaVersion !== MODERATION_ESCALATION_SCHEMA_VERSION || !state.escalations || !Array.isArray(state.events)) {
    throw new ModerationEscalationValidationError("invalid moderation escalation state");
  }
  assertInteger(state.currentTick, "currentTick");
  assertInteger(state.claimLeaseTicks, "claimLeaseTicks", 1);
  assertInteger(state.responseTargetTicks, "responseTargetTicks", 1);
  assertInteger(state.nextEscalationId, "nextEscalationId", 1);
  assertInteger(state.nextEventId, "nextEventId", 1);
}

function assertModerationState(state) {
  try {
    restoreModerationOperations(snapshotModerationOperations(state));
  } catch (error) {
    throw new ModerationEscalationValidationError(`invalid moderation operations state: ${error.message}`);
  }
}

function reviewerOrThrow(moderationState, moderatorId) {
  assertNonEmpty(moderatorId, "moderatorId");
  const reviewer = moderationState.reviewers[moderatorId];
  if (!reviewer) throw new ModerationEscalationValidationError(`unknown moderator: ${moderatorId}`);
  if (reviewer.status !== "active") throw new ModerationEscalationValidationError(`moderator ${moderatorId} is ${reviewer.status}`);
  return reviewer;
}

function caseOrThrow(moderationState, caseId) {
  assertNonEmpty(caseId, "caseId");
  const moderationCase = moderationState.cases[caseId];
  if (!moderationCase) throw new ModerationEscalationValidationError(`unknown moderation case: ${caseId}`);
  if (moderationCase.status !== "escalated" || moderationCase.decision !== "escalate") {
    throw new ModerationEscalationValidationError(`moderation case ${caseId} is not escalated`);
  }
  return moderationCase;
}

function escalationOrThrow(state, escalationId) {
  assertNonEmpty(escalationId, "escalationId");
  const escalation = state.escalations[escalationId];
  if (!escalation) throw new ModerationEscalationValidationError(`unknown moderation escalation: ${escalationId}`);
  return escalation;
}

function assertOriginalCaseUnchanged(moderationState, escalation) {
  const moderationCase = caseOrThrow(moderationState, escalation.caseId);
  if (moderationCase.decision !== escalation.originalDecision || moderationCase.decidedBy !== escalation.originalDecidedBy) {
    throw new ModerationEscalationValidationError("original moderation escalation changed after routing");
  }
  return moderationCase;
}

function responseBand(escalation, currentTick) {
  if (escalation.responseState === "responded") return escalation.respondedAtTick > escalation.targetResponseAtTick ? "closed-late" : "closed-within-target";
  return currentTick > escalation.targetResponseAtTick ? "breached" : "within-target";
}

export function createModerationEscalationState({ currentTick = 0, claimLeaseTicks = 5, responseTargetTicks = 3 } = {}) {
  assertInteger(currentTick, "currentTick");
  assertInteger(claimLeaseTicks, "claimLeaseTicks", 1);
  assertInteger(responseTargetTicks, "responseTargetTicks", 1);
  return {
    schemaVersion: MODERATION_ESCALATION_SCHEMA_VERSION,
    currentTick,
    claimLeaseTicks,
    responseTargetTicks,
    nextEscalationId: 1,
    escalations: {},
    events: [],
    nextEventId: 1,
    lastEventHash: null,
  };
}

export function openModerationEscalation(state, { moderationState, escalationId = `escalation:${String(state.nextEscalationId).padStart(6, "0")}`, caseId, route, evidenceDigest, openedAtTick = state.currentTick, responseTargetTicks = state.responseTargetTicks } = {}) {
  assertState(state);
  assertModerationState(moderationState);
  assertNonEmpty(escalationId, "escalationId");
  assertNonEmpty(route, "route");
  assertNonEmpty(evidenceDigest, "evidenceDigest");
  assertInteger(openedAtTick, "openedAtTick");
  assertInteger(responseTargetTicks, "responseTargetTicks", 1);
  if (state.escalations[escalationId]) throw new ModerationEscalationValidationError(`moderation escalation already exists: ${escalationId}`);
  const moderationCase = caseOrThrow(moderationState, caseId);
  if (Object.values(state.escalations).some((escalation) => escalation.caseId === caseId && escalation.status !== "dismissed")) {
    throw new ModerationEscalationValidationError(`moderation case ${caseId} already has an active escalation`);
  }
  const next = clone(state);
  next.currentTick = openedAtTick;
  next.escalations[escalationId] = {
    escalationId,
    caseId,
    route,
    evidenceDigest,
    openedAtTick,
    targetResponseAtTick: openedAtTick + responseTargetTicks,
    originalDecision: moderationCase.decision,
    originalDecidedBy: moderationCase.decidedBy,
    status: "pending",
    responseState: "open",
    claimedBy: null,
    claimExpiresAtTick: null,
    outcome: null,
    respondedBy: null,
    respondedAtTick: null,
    reasonCode: null,
  };
  next.nextEscalationId += 1;
  return appendEvent(next, "moderation.escalation.opened", { escalationId, caseId, route, targetResponseAtTick: next.escalations[escalationId].targetResponseAtTick });
}

export function markModerationEscalationDeadlines(state, { currentTick = state.currentTick } = {}) {
  assertState(state);
  assertInteger(currentTick, "currentTick");
  const next = clone(state);
  next.currentTick = currentTick;
  const breached = Object.values(next.escalations).filter((escalation) => escalation.responseState === "open" && currentTick > escalation.targetResponseAtTick);
  for (const escalation of breached) escalation.responseState = "breached";
  return breached.length > 0 ? appendEvent(next, "moderation.escalation.deadlines.breached", { escalationIds: breached.map((escalation) => escalation.escalationId) }) : next;
}

export function claimModerationEscalation(state, { moderationState, escalationId, moderatorId, currentTick = state.currentTick } = {}) {
  assertState(state);
  assertModerationState(moderationState);
  assertInteger(currentTick, "currentTick");
  let next = markModerationEscalationDeadlines(state, { currentTick });
  reviewerOrThrow(moderationState, moderatorId);
  const escalation = escalationOrThrow(next, escalationId);
  assertOriginalCaseUnchanged(moderationState, escalation);
  if (escalation.status !== "pending") throw new ModerationEscalationValidationError(`moderation escalation ${escalationId} is ${escalation.status}`);
  escalation.status = "claimed";
  escalation.claimedBy = moderatorId;
  escalation.claimExpiresAtTick = currentTick + next.claimLeaseTicks;
  next = appendEvent(next, "moderation.escalation.claimed", { escalationId, moderatorId, claimExpiresAtTick: escalation.claimExpiresAtTick });
  return next;
}

export function reapExpiredModerationEscalationClaims(state, { currentTick = state.currentTick } = {}) {
  assertState(state);
  assertInteger(currentTick, "currentTick");
  const next = clone(state);
  next.currentTick = currentTick;
  const expired = Object.values(next.escalations).filter((escalation) => escalation.status === "claimed" && escalation.claimExpiresAtTick <= currentTick);
  for (const escalation of expired) {
    escalation.status = "pending";
    escalation.claimedBy = null;
    escalation.claimExpiresAtTick = null;
  }
  return expired.length > 0 ? appendEvent(next, "moderation.escalation.claims.reaped", { escalationIds: expired.map((escalation) => escalation.escalationId) }) : next;
}

export function respondToModerationEscalation(state, { moderationState, escalationId, moderatorId, outcome, reasonCode, respondedAtTick = state.currentTick } = {}) {
  assertState(state);
  assertModerationState(moderationState);
  assertInteger(respondedAtTick, "respondedAtTick");
  if (!["resolve", "refer", "dismiss"].includes(outcome)) throw new ModerationEscalationValidationError("outcome must be resolve, refer, or dismiss");
  assertNonEmpty(reasonCode, "reasonCode");
  reviewerOrThrow(moderationState, moderatorId);
  const escalation = escalationOrThrow(state, escalationId);
  assertOriginalCaseUnchanged(moderationState, escalation);
  if (escalation.status !== "claimed" || escalation.claimedBy !== moderatorId) throw new ModerationEscalationValidationError("moderation escalation is not claimed by this moderator");
  if (escalation.claimExpiresAtTick <= respondedAtTick) throw new ModerationEscalationValidationError("moderation escalation claim has expired");
  const next = clone(state);
  next.currentTick = respondedAtTick;
  const target = next.escalations[escalationId];
  target.status = outcome === "resolve" ? "resolved" : outcome === "refer" ? "referred" : "dismissed";
  target.responseState = "responded";
  target.outcome = outcome;
  target.respondedBy = moderatorId;
  target.respondedAtTick = respondedAtTick;
  target.reasonCode = reasonCode;
  target.claimExpiresAtTick = null;
  return appendEvent(next, "moderation.escalation.responded", { escalationId, moderatorId, outcome, reasonCode });
}

export function projectModerationEscalations(state) {
  assertState(state);
  const queueBands = Object.fromEntries(["pending", "claimed", "resolved", "referred", "dismissed"].map((status) => [status, 0]));
  const responseBands = Object.fromEntries(["within-target", "breached", "closed-within-target", "closed-late"].map((status) => [status, 0]));
  for (const escalation of Object.values(state.escalations)) {
    queueBands[escalation.status] += 1;
    responseBands[responseBand(escalation, state.currentTick)] += 1;
  }
  return {
    schemaVersion: MODERATION_ESCALATION_SCHEMA_VERSION,
    currentTick: state.currentTick,
    queueBands,
    responseBands,
    omittedFields: ["case IDs", "routes", "evidence digests", "reviewer identities", "reason codes", "event hashes", "exact target ticks"],
  };
}

export function snapshotModerationEscalations(state) {
  assertState(state);
  return { snapshotVersion: 1, state: clone(state) };
}

export function restoreModerationEscalations(snapshot) {
  if (!snapshot || snapshot.snapshotVersion !== 1) throw new ModerationEscalationValidationError("unsupported moderation escalation snapshot version");
  const state = clone(snapshot.state);
  assertState(state);
  let previousHash = null;
  let nextEventId = 1;
  for (const event of state.events) {
    if (event.eventId !== `escalation-${String(nextEventId).padStart(6, "0")}`) throw new ModerationEscalationValidationError("moderation escalation event IDs are not contiguous");
    if (event.previousHash !== previousHash) throw new ModerationEscalationValidationError("moderation escalation event chain is broken");
    const { hash, ...unsigned } = event;
    if (hash !== eventHash(unsigned, event.previousHash)) throw new ModerationEscalationValidationError("moderation escalation event hash is invalid");
    previousHash = hash;
    nextEventId += 1;
  }
  if (state.nextEventId !== nextEventId || state.lastEventHash !== previousHash) throw new ModerationEscalationValidationError("moderation escalation snapshot does not match history");
  return state;
}
