import { createHash } from "node:crypto";

import { canonicalJson } from "./engine.mjs";

export const MODERATION_OPERATIONS_SCHEMA_VERSION = 1;

export class ModerationOperationsValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ModerationOperationsValidationError";
  }
}

function clone(value) { return structuredClone(value); }

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new ModerationOperationsValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) throw new ModerationOperationsValidationError(`${field} must be an integer >= ${minimum}`);
}

function assertArrayOfStrings(value, field) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) throw new ModerationOperationsValidationError(`${field} must contain non-empty strings`);
}

function eventHash(event, previousHash) {
  return createHash("sha256").update(`${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`, "utf8").digest("hex");
}

function appendEvent(state, eventType, payload) {
  const next = clone(state);
  const unsigned = {
    eventId: `moderation-${String(next.nextEventId).padStart(6, "0")}`,
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
  if (!state || state.schemaVersion !== MODERATION_OPERATIONS_SCHEMA_VERSION || !state.reviewers || !state.cases || !Array.isArray(state.events)) throw new ModerationOperationsValidationError("invalid moderation operations state");
  assertInteger(state.currentTick, "currentTick");
  assertInteger(state.claimLeaseTicks, "claimLeaseTicks", 1);
}

function reviewerOrThrow(state, moderatorId) {
  assertNonEmpty(moderatorId, "moderatorId");
  const reviewer = state.reviewers[moderatorId];
  if (!reviewer) throw new ModerationOperationsValidationError(`unknown moderator: ${moderatorId}`);
  if (reviewer.status !== "active") throw new ModerationOperationsValidationError(`moderator ${moderatorId} is ${reviewer.status}`);
  return reviewer;
}

function caseOrThrow(state, caseId) {
  assertNonEmpty(caseId, "caseId");
  const moderationCase = state.cases[caseId];
  if (!moderationCase) throw new ModerationOperationsValidationError(`unknown moderation case: ${caseId}`);
  return moderationCase;
}

export function createModerationOperationsState({ currentTick = 0, claimLeaseTicks = 5 } = {}) {
  assertInteger(currentTick, "currentTick");
  assertInteger(claimLeaseTicks, "claimLeaseTicks", 1);
  return { schemaVersion: MODERATION_OPERATIONS_SCHEMA_VERSION, currentTick, claimLeaseTicks, nextCaseId: 1, reviewers: {}, cases: {}, events: [], nextEventId: 1, lastEventHash: null };
}

export function registerModerator(state, { moderatorId, role = "reviewer" } = {}) {
  assertState(state);
  assertNonEmpty(moderatorId, "moderatorId");
  assertNonEmpty(role, "role");
  if (state.reviewers[moderatorId]) throw new ModerationOperationsValidationError(`moderator already exists: ${moderatorId}`);
  const next = clone(state);
  next.reviewers[moderatorId] = { moderatorId, role, status: "active", reviewedCount: 0 };
  return appendEvent(next, "moderation.reviewer.registered", { moderatorId, role });
}

export function setModeratorStatus(state, { moderatorId, status } = {}) {
  assertState(state);
  assertNonEmpty(moderatorId, "moderatorId");
  if (!["active", "suspended"].includes(status)) throw new ModerationOperationsValidationError("moderator status must be active or suspended");
  reviewerOrThrow(state, moderatorId);
  const next = clone(state);
  next.reviewers[moderatorId].status = status;
  return appendEvent(next, `moderation.reviewer.${status}`, { moderatorId });
}

export function enqueueModerationCase(state, { caseId = `moderation:${String(state.nextCaseId).padStart(6, "0")}`, subjectId, sessionId, contentDigest, labels = [], createdAtTick = state.currentTick, expiresAtTick = null } = {}) {
  assertState(state);
  assertNonEmpty(caseId, "caseId");
  assertNonEmpty(subjectId, "subjectId");
  assertNonEmpty(sessionId, "sessionId");
  assertNonEmpty(contentDigest, "contentDigest");
  assertArrayOfStrings(labels, "labels");
  assertInteger(createdAtTick, "createdAtTick");
  if (expiresAtTick !== null) assertInteger(expiresAtTick, "expiresAtTick");
  if (expiresAtTick !== null && expiresAtTick <= createdAtTick) throw new ModerationOperationsValidationError("expiresAtTick must be after createdAtTick");
  if (state.cases[caseId]) throw new ModerationOperationsValidationError(`moderation case already exists: ${caseId}`);
  const next = clone(state);
  next.cases[caseId] = {
    caseId,
    subjectId,
    sessionId,
    contentDigest,
    labels: [...labels],
    createdAtTick,
    expiresAtTick,
    status: "pending",
    claimedBy: null,
    claimExpiresAtTick: null,
    decision: null,
    decidedBy: null,
    decidedAtTick: null,
    reasonCode: null,
  };
  next.nextCaseId += 1;
  return appendEvent(next, "moderation.case.enqueued", { caseId, subjectId, sessionId, labelCount: labels.length, expiresAtTick });
}

export function reapExpiredModerationClaims(state, { currentTick = state.currentTick } = {}) {
  assertState(state);
  assertInteger(currentTick, "currentTick");
  const next = clone(state);
  next.currentTick = currentTick;
  const expired = Object.values(next.cases).filter((moderationCase) => moderationCase.status === "claimed" && moderationCase.claimExpiresAtTick <= currentTick);
  for (const moderationCase of expired) {
    moderationCase.status = "pending";
    moderationCase.claimedBy = null;
    moderationCase.claimExpiresAtTick = null;
  }
  return expired.length > 0 ? appendEvent(next, "moderation.claims.reaped", { caseIds: expired.map((moderationCase) => moderationCase.caseId) }) : next;
}

export function claimModerationCase(state, { caseId, moderatorId, currentTick = state.currentTick } = {}) {
  assertState(state);
  assertInteger(currentTick, "currentTick");
  let next = reapExpiredModerationClaims(state, { currentTick });
  reviewerOrThrow(next, moderatorId);
  const moderationCase = caseOrThrow(next, caseId);
  if (moderationCase.status !== "pending") throw new ModerationOperationsValidationError(`moderation case ${caseId} is ${moderationCase.status}`);
  moderationCase.status = "claimed";
  moderationCase.claimedBy = moderatorId;
  moderationCase.claimExpiresAtTick = currentTick + next.claimLeaseTicks;
  next = appendEvent(next, "moderation.case.claimed", { caseId, moderatorId, claimExpiresAtTick: moderationCase.claimExpiresAtTick });
  return next;
}

export function decideModerationCase(state, { caseId, moderatorId, decision, reasonCode, decidedAtTick = state.currentTick } = {}) {
  assertState(state);
  assertInteger(decidedAtTick, "decidedAtTick");
  if (!["allow", "deny", "escalate"].includes(decision)) throw new ModerationOperationsValidationError("decision must be allow, deny, or escalate");
  assertNonEmpty(reasonCode, "reasonCode");
  reviewerOrThrow(state, moderatorId);
  const moderationCase = caseOrThrow(state, caseId);
  if (moderationCase.status !== "claimed" || moderationCase.claimedBy !== moderatorId) throw new ModerationOperationsValidationError("moderation case is not claimed by this moderator");
  if (moderationCase.claimExpiresAtTick <= decidedAtTick) throw new ModerationOperationsValidationError("moderation claim has expired");
  const next = clone(state);
  const target = next.cases[caseId];
  target.status = decision === "allow" ? "allowed" : decision === "deny" ? "denied" : "escalated";
  target.decision = decision;
  target.decidedBy = moderatorId;
  target.decidedAtTick = decidedAtTick;
  target.reasonCode = reasonCode;
  target.claimExpiresAtTick = null;
  next.reviewers[moderatorId].reviewedCount += 1;
  return appendEvent(next, "moderation.case.decided", { caseId, moderatorId, decision, reasonCode });
}

export function projectModerationOperations(state) {
  assertState(state);
  const counts = Object.fromEntries(["pending", "claimed", "allowed", "denied", "escalated"].map((status) => [status, 0]));
  for (const moderationCase of Object.values(state.cases)) counts[moderationCase.status] += 1;
  return {
    schemaVersion: MODERATION_OPERATIONS_SCHEMA_VERSION,
    currentTick: state.currentTick,
    queueBands: counts,
    activeReviewerCount: Object.values(state.reviewers).filter((reviewer) => reviewer.status === "active").length,
    omittedFields: ["content digests", "raw content", "session IDs", "labels", "reviewer identities", "reason codes", "event hashes"],
  };
}

export function snapshotModerationOperations(state) {
  assertState(state);
  return { snapshotVersion: 1, state: clone(state) };
}

export function restoreModerationOperations(snapshot) {
  if (!snapshot || snapshot.snapshotVersion !== 1) throw new ModerationOperationsValidationError("unsupported moderation snapshot version");
  const state = clone(snapshot.state);
  assertState(state);
  let previousHash = null;
  let nextEventId = 1;
  for (const event of state.events) {
    if (event.eventId !== `moderation-${String(nextEventId).padStart(6, "0")}`) throw new ModerationOperationsValidationError("moderation event IDs are not contiguous");
    if (event.previousHash !== previousHash) throw new ModerationOperationsValidationError("moderation event chain is broken");
    const { hash, ...unsigned } = event;
    if (hash !== eventHash(unsigned, event.previousHash)) throw new ModerationOperationsValidationError("moderation event hash is invalid");
    previousHash = hash;
    nextEventId += 1;
  }
  if (state.nextEventId !== nextEventId || state.lastEventHash !== previousHash) throw new ModerationOperationsValidationError("moderation snapshot does not match history");
  return state;
}
