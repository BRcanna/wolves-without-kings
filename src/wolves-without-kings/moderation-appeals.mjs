import { createHash } from "node:crypto";

import { canonicalJson } from "./engine.mjs";
import { restoreModerationOperations, snapshotModerationOperations } from "./moderation-operations.mjs";

export const MODERATION_APPEALS_SCHEMA_VERSION = 1;

export class ModerationAppealsValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ModerationAppealsValidationError";
  }
}

function clone(value) { return structuredClone(value); }

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new ModerationAppealsValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) throw new ModerationAppealsValidationError(`${field} must be an integer >= ${minimum}`);
}

function eventHash(event, previousHash) {
  return createHash("sha256").update(`${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`, "utf8").digest("hex");
}

function appendEvent(state, eventType, payload) {
  const next = clone(state);
  const unsigned = {
    eventId: `appeal-${String(next.nextEventId).padStart(6, "0")}`,
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
  if (!state || state.schemaVersion !== MODERATION_APPEALS_SCHEMA_VERSION || !state.appeals || !Array.isArray(state.events)) {
    throw new ModerationAppealsValidationError("invalid moderation appeals state");
  }
  assertInteger(state.currentTick, "currentTick");
  assertInteger(state.claimLeaseTicks, "claimLeaseTicks", 1);
  assertInteger(state.nextAppealId, "nextAppealId", 1);
  assertInteger(state.nextEventId, "nextEventId", 1);
}

function assertModerationState(state) {
  try {
    restoreModerationOperations(snapshotModerationOperations(state));
  } catch (error) {
    throw new ModerationAppealsValidationError(`invalid moderation operations state: ${error.message}`);
  }
}

function reviewerOrThrow(moderationState, moderatorId) {
  assertNonEmpty(moderatorId, "moderatorId");
  const reviewer = moderationState.reviewers[moderatorId];
  if (!reviewer) throw new ModerationAppealsValidationError(`unknown moderator: ${moderatorId}`);
  if (reviewer.status !== "active") throw new ModerationAppealsValidationError(`moderator ${moderatorId} is ${reviewer.status}`);
  return reviewer;
}

function caseOrThrow(moderationState, caseId) {
  assertNonEmpty(caseId, "caseId");
  const moderationCase = moderationState.cases[caseId];
  if (!moderationCase) throw new ModerationAppealsValidationError(`unknown moderation case: ${caseId}`);
  if (!["allowed", "denied"].includes(moderationCase.status) || !["allow", "deny"].includes(moderationCase.decision)) {
    throw new ModerationAppealsValidationError(`moderation case ${caseId} is not appealable`);
  }
  return moderationCase;
}

function appealOrThrow(state, appealId) {
  assertNonEmpty(appealId, "appealId");
  const appeal = state.appeals[appealId];
  if (!appeal) throw new ModerationAppealsValidationError(`unknown moderation appeal: ${appealId}`);
  return appeal;
}

function assertOriginalCaseUnchanged(moderationState, appeal) {
  const moderationCase = caseOrThrow(moderationState, appeal.caseId);
  if (moderationCase.decision !== appeal.originalDecision || moderationCase.decidedBy !== appeal.originalDecidedBy) {
    throw new ModerationAppealsValidationError("original moderation decision changed after appeal submission");
  }
  return moderationCase;
}

export function createModerationAppealsState({ currentTick = 0, claimLeaseTicks = 5 } = {}) {
  assertInteger(currentTick, "currentTick");
  assertInteger(claimLeaseTicks, "claimLeaseTicks", 1);
  return {
    schemaVersion: MODERATION_APPEALS_SCHEMA_VERSION,
    currentTick,
    claimLeaseTicks,
    nextAppealId: 1,
    appeals: {},
    events: [],
    nextEventId: 1,
    lastEventHash: null,
  };
}

export function submitModerationAppeal(state, { moderationState, appealId = `appeal:${String(state.nextAppealId).padStart(6, "0")}`, caseId, appellantDigest, reasonDigest, submittedAtTick = state.currentTick } = {}) {
  assertState(state);
  assertModerationState(moderationState);
  assertNonEmpty(appealId, "appealId");
  assertNonEmpty(appellantDigest, "appellantDigest");
  assertNonEmpty(reasonDigest, "reasonDigest");
  assertInteger(submittedAtTick, "submittedAtTick");
  if (state.appeals[appealId]) throw new ModerationAppealsValidationError(`moderation appeal already exists: ${appealId}`);
  const moderationCase = caseOrThrow(moderationState, caseId);
  if (Object.values(state.appeals).some((appeal) => appeal.caseId === caseId)) {
    throw new ModerationAppealsValidationError(`moderation case ${caseId} already has an appeal`);
  }
  const next = clone(state);
  next.currentTick = submittedAtTick;
  next.appeals[appealId] = {
    appealId,
    caseId,
    appellantDigest,
    reasonDigest,
    submittedAtTick,
    originalDecision: moderationCase.decision,
    originalDecidedBy: moderationCase.decidedBy,
    status: "pending",
    claimedBy: null,
    claimExpiresAtTick: null,
    decision: null,
    decidedBy: null,
    decidedAtTick: null,
    reasonCode: null,
  };
  next.nextAppealId += 1;
  return appendEvent(next, "moderation.appeal.submitted", { appealId, caseId, originalDecision: moderationCase.decision });
}

export function reapExpiredModerationAppealClaims(state, { currentTick = state.currentTick } = {}) {
  assertState(state);
  assertInteger(currentTick, "currentTick");
  const next = clone(state);
  next.currentTick = currentTick;
  const expired = Object.values(next.appeals).filter((appeal) => appeal.status === "claimed" && appeal.claimExpiresAtTick <= currentTick);
  for (const appeal of expired) {
    appeal.status = "pending";
    appeal.claimedBy = null;
    appeal.claimExpiresAtTick = null;
  }
  return expired.length > 0 ? appendEvent(next, "moderation.appeal.claims.reaped", { appealIds: expired.map((appeal) => appeal.appealId) }) : next;
}

export function claimModerationAppeal(state, { moderationState, appealId, moderatorId, currentTick = state.currentTick } = {}) {
  assertState(state);
  assertModerationState(moderationState);
  assertInteger(currentTick, "currentTick");
  let next = reapExpiredModerationAppealClaims(state, { currentTick });
  const reviewer = reviewerOrThrow(moderationState, moderatorId);
  const appeal = appealOrThrow(next, appealId);
  assertOriginalCaseUnchanged(moderationState, appeal);
  if (appeal.originalDecidedBy === reviewer.moderatorId) throw new ModerationAppealsValidationError("appeal reviewer must be independent of the original decision");
  if (appeal.status !== "pending") throw new ModerationAppealsValidationError(`moderation appeal ${appealId} is ${appeal.status}`);
  appeal.status = "claimed";
  appeal.claimedBy = moderatorId;
  appeal.claimExpiresAtTick = currentTick + next.claimLeaseTicks;
  next = appendEvent(next, "moderation.appeal.claimed", { appealId, moderatorId, claimExpiresAtTick: appeal.claimExpiresAtTick });
  return next;
}

export function decideModerationAppeal(state, { moderationState, appealId, moderatorId, decision, reasonCode, decidedAtTick = state.currentTick } = {}) {
  assertState(state);
  assertModerationState(moderationState);
  assertInteger(decidedAtTick, "decidedAtTick");
  if (!["uphold", "overturn", "dismiss"].includes(decision)) throw new ModerationAppealsValidationError("decision must be uphold, overturn, or dismiss");
  assertNonEmpty(reasonCode, "reasonCode");
  reviewerOrThrow(moderationState, moderatorId);
  const appeal = appealOrThrow(state, appealId);
  assertOriginalCaseUnchanged(moderationState, appeal);
  if (appeal.status !== "claimed" || appeal.claimedBy !== moderatorId) throw new ModerationAppealsValidationError("moderation appeal is not claimed by this moderator");
  if (appeal.claimExpiresAtTick <= decidedAtTick) throw new ModerationAppealsValidationError("moderation appeal claim has expired");
  if (appeal.originalDecidedBy === moderatorId) throw new ModerationAppealsValidationError("appeal reviewer must be independent of the original decision");
  const next = clone(state);
  next.currentTick = decidedAtTick;
  const target = next.appeals[appealId];
  target.status = decision === "uphold" ? "upheld" : decision === "overturn" ? "overturned" : "dismissed";
  target.decision = decision;
  target.decidedBy = moderatorId;
  target.decidedAtTick = decidedAtTick;
  target.reasonCode = reasonCode;
  target.claimExpiresAtTick = null;
  return appendEvent(next, "moderation.appeal.decided", { appealId, moderatorId, decision, reasonCode });
}

export function projectModerationAppeals(state) {
  assertState(state);
  const counts = Object.fromEntries(["pending", "claimed", "upheld", "overturned", "dismissed"].map((status) => [status, 0]));
  for (const appeal of Object.values(state.appeals)) counts[appeal.status] += 1;
  return {
    schemaVersion: MODERATION_APPEALS_SCHEMA_VERSION,
    currentTick: state.currentTick,
    queueBands: counts,
    omittedFields: ["appellant digests", "reason digests", "case IDs", "reviewer identities", "reason codes", "event hashes", "exact claim expiry"],
  };
}

export function snapshotModerationAppeals(state) {
  assertState(state);
  return { snapshotVersion: 1, state: clone(state) };
}

export function restoreModerationAppeals(snapshot) {
  if (!snapshot || snapshot.snapshotVersion !== 1) throw new ModerationAppealsValidationError("unsupported moderation appeal snapshot version");
  const state = clone(snapshot.state);
  assertState(state);
  let previousHash = null;
  let nextEventId = 1;
  for (const event of state.events) {
    if (event.eventId !== `appeal-${String(nextEventId).padStart(6, "0")}`) throw new ModerationAppealsValidationError("moderation appeal event IDs are not contiguous");
    if (event.previousHash !== previousHash) throw new ModerationAppealsValidationError("moderation appeal event chain is broken");
    const { hash, ...unsigned } = event;
    if (hash !== eventHash(unsigned, event.previousHash)) throw new ModerationAppealsValidationError("moderation appeal event hash is invalid");
    previousHash = hash;
    nextEventId += 1;
  }
  if (state.nextEventId !== nextEventId || state.lastEventHash !== previousHash) throw new ModerationAppealsValidationError("moderation appeal snapshot does not match history");
  return state;
}
