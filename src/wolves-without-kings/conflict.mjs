import { createHash } from "node:crypto";

import { canonicalJson } from "./engine.mjs";

export const CONFLICT_SCHEMA_VERSION = 1;

export class ConflictValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConflictValidationError";
  }
}

export class ConflictStaleRevisionError extends ConflictValidationError {
  constructor(expectedRevision, actualRevision) {
    super(`stale conflict command: expected revision ${expectedRevision}, actual revision ${actualRevision}`);
    this.name = "ConflictStaleRevisionError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

function clone(value) { return structuredClone(value); }

function assertObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ConflictValidationError(`${field} must be an object`);
}

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new ConflictValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new ConflictValidationError(`${field} must be an integer between ${minimum} and ${maximum}`);
}

function assertRevision(state, expectedRevision) {
  assertInteger(expectedRevision, "expectedRevision");
  if (expectedRevision !== state.revision) throw new ConflictStaleRevisionError(expectedRevision, state.revision);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function eventHash(event, previousHash) {
  const material = `${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`;
  return createHash("sha256").update(material).digest("hex");
}

function appendEvent(state, { eventType, actorId, subjectIds = [], payload = {} }) {
  const next = clone(state);
  const unsignedEvent = {
    eventId: `conflict-${String(next.nextEventId).padStart(6, "0")}`,
    eventType,
    revision: next.revision + 1,
    simulationDate: next.simulationDate,
    actorId,
    subjectIds: [...subjectIds],
    payload: clone(payload),
    previousHash: next.lastEventHash,
  };
  const event = { ...unsignedEvent, hash: eventHash(unsignedEvent, unsignedEvent.previousHash) };
  next.events.push(event);
  next.nextEventId += 1;
  next.revision = event.revision;
  next.lastEventHash = event.hash;
  return next;
}

function requireConflict(state, conflictId) {
  assertNonEmpty(conflictId, "conflictId");
  const conflict = state.conflicts[conflictId];
  if (!conflict) throw new ConflictValidationError(`unknown conflict: ${conflictId}`);
  return conflict;
}

export function createConflictState({ worldId = "wwk-shard", simulationDate = "1998-01-01", offlineProtectionDays = 14 } = {}) {
  assertNonEmpty(worldId, "worldId");
  assertNonEmpty(simulationDate, "simulationDate");
  assertInteger(offlineProtectionDays, "offlineProtectionDays", 1, 90);
  return {
    schemaVersion: CONFLICT_SCHEMA_VERSION,
    worldId,
    simulationDate,
    offlineProtectionDays,
    revision: 0,
    nextEventId: 1,
    lastEventHash: null,
    conflicts: {},
    properties: {},
    actorCooldowns: {},
    events: [],
  };
}

export function registerProtectedProperty(
  state,
  { expectedRevision, propertyId, ownerId, offline = true },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(propertyId, "propertyId");
  assertNonEmpty(ownerId, "ownerId");
  if (state.properties[propertyId]) throw new ConflictValidationError(`property already registered: ${propertyId}`);
  const next = clone(state);
  next.properties[propertyId] = {
    id: propertyId,
    ownerId,
    offline,
    vulnerability: "protected",
    contestedBy: [],
    lastConflictDate: null,
  };
  return appendEvent(next, {
    eventType: "conflict.property_registered",
    actorId: ownerId,
    subjectIds: [propertyId],
    payload: { propertyId, ownerId, offline },
  });
}

export function declareConflict(
  state,
  {
    expectedRevision,
    conflictId,
    initiatorId,
    participantIds,
    casusBelli,
    location,
    mode = "business-rivalry",
    windowDays = 1,
    propertyId = null,
  },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(conflictId, "conflictId");
  assertNonEmpty(initiatorId, "initiatorId");
  assertNonEmpty(casusBelli, "casusBelli");
  assertNonEmpty(location, "location");
  if (!Array.isArray(participantIds) || participantIds.length < 2 || participantIds.some((id) => typeof id !== "string" || id.trim() === "")) throw new ConflictValidationError("participantIds must contain at least two non-empty IDs");
  if (new Set(participantIds).size !== participantIds.length) throw new ConflictValidationError("participantIds must be unique");
  if (!participantIds.includes(initiatorId)) throw new ConflictValidationError("initiator must participate");
  if (!["race", "business-rivalry", "theft", "surveillance", "violent-window"].includes(mode)) throw new ConflictValidationError(`unsupported conflict mode: ${mode}`);
  assertInteger(windowDays, "windowDays", 1, 7);
  if (propertyId !== null) {
    assertNonEmpty(propertyId, "propertyId");
    if (!state.properties[propertyId]) throw new ConflictValidationError(`unknown protected property: ${propertyId}`);
  }
  if (mode === "violent-window" && windowDays > 2) throw new ConflictValidationError("violent windows are limited to two days");
  if (state.conflicts[conflictId]) throw new ConflictValidationError(`conflict already exists: ${conflictId}`);
  const conflict = {
    id: conflictId,
    initiatorId,
    participantIds: [...participantIds],
    casusBelli,
    location,
    mode,
    propertyId,
    declaredDate: state.simulationDate,
    windowStart: state.simulationDate,
    windowDays,
    daysRemaining: windowDays,
    status: "active",
    actionCounts: Object.fromEntries(participantIds.map((id) => [id, 0])),
    evidence: [],
    recoveryBand: "low",
    cooldownBand: "none",
  };
  const next = clone(state);
  next.conflicts[conflictId] = conflict;
  return appendEvent(next, {
    eventType: "conflict.declared",
    actorId: initiatorId,
    subjectIds: [conflictId, ...participantIds],
    payload: { conflict: clone(conflict) },
  });
}

export function recordConflictAction(
  state,
  { expectedRevision, conflictId, actorId, actionType, evidenceTag = "observed" },
) {
  assertRevision(state, expectedRevision);
  const conflict = requireConflict(state, conflictId);
  assertNonEmpty(actorId, "actorId");
  assertNonEmpty(actionType, "actionType");
  assertNonEmpty(evidenceTag, "evidenceTag");
  if (!conflict.participantIds.includes(actorId)) throw new ConflictValidationError("actor is not a conflict participant");
  if (conflict.status !== "active" || conflict.daysRemaining <= 0) throw new ConflictValidationError("conflict window is not active");
  if (!["contest", "nonlethal-competition", "property-pressure", "harassment", "abstract-escalation"].includes(actionType)) throw new ConflictValidationError(`unsupported conflict action: ${actionType}`);
  const cooldownKey = `${actorId}:${conflict.participantIds.filter((id) => id !== actorId).sort().join(",")}`;
  const cooldownUntil = state.actorCooldowns[cooldownKey];
  if (cooldownUntil && cooldownUntil > state.simulationDate) throw new ConflictValidationError("actor is in an anti-harassment cooldown");
  const next = clone(state);
  const count = next.conflicts[conflictId].actionCounts[actorId] + 1;
  if (actionType === "harassment" && count > 2) throw new ConflictValidationError("repeated harassment is rate-limited");
  next.conflicts[conflictId].actionCounts[actorId] = count;
  next.conflicts[conflictId].evidence.push({ actorId, actionType, evidenceTag, date: state.simulationDate });
  if (actionType === "harassment") {
    next.actorCooldowns[cooldownKey] = addDays(state.simulationDate, 3);
    next.conflicts[conflictId].cooldownBand = "active";
  }
  return appendEvent(next, {
    eventType: "conflict.action_recorded",
    actorId,
    subjectIds: [conflictId],
    payload: { conflictId, actorId, actionType, evidenceTag, actionCount: count },
  });
}

export function settleConflict(
  state,
  { expectedRevision, conflictId, outcome = "contested", actorId = "system:conflict" },
) {
  assertRevision(state, expectedRevision);
  const conflict = requireConflict(state, conflictId);
  assertNonEmpty(actorId, "actorId");
  if (!["contested", "nonlethal-resolution", "property-contested", "injury-risk-abstract", "cancelled"].includes(outcome)) throw new ConflictValidationError(`unsupported conflict outcome: ${outcome}`);
  if (conflict.status !== "active") throw new ConflictValidationError("conflict is already settled");
  const next = clone(state);
  next.conflicts[conflictId].status = "settled";
  next.conflicts[conflictId].settlement = { outcome, date: state.simulationDate };
  next.conflicts[conflictId].recoveryBand = outcome === "injury-risk-abstract" ? "high" : outcome === "contested" ? "moderate" : "low";
  if (conflict.propertyId && outcome === "property-contested") {
    next.properties[conflict.propertyId].vulnerability = "contested";
    next.properties[conflict.propertyId].contestedBy = [...new Set(conflict.participantIds.filter((id) => id !== next.properties[conflict.propertyId].ownerId))];
    next.properties[conflict.propertyId].lastConflictDate = state.simulationDate;
  }
  return appendEvent(next, {
    eventType: "conflict.settled",
    actorId,
    subjectIds: [conflictId, ...(conflict.propertyId ? [conflict.propertyId] : [])],
    payload: { conflictId, outcome, recoveryBand: next.conflicts[conflictId].recoveryBand },
  });
}

export function settleConflictTime(state, { expectedRevision, days }) {
  assertRevision(state, expectedRevision);
  assertInteger(days, "days", 1, 3650);
  const next = clone(state);
  next.simulationDate = addDays(state.simulationDate, days);
  for (const conflict of Object.values(next.conflicts)) {
    if (conflict.status === "active") {
      conflict.daysRemaining = Math.max(0, conflict.daysRemaining - days);
      if (conflict.daysRemaining === 0) conflict.status = "expired";
    }
    if (conflict.recoveryBand === "high" && days >= 30) conflict.recoveryBand = "moderate";
    else if (conflict.recoveryBand === "moderate" && days >= 60) conflict.recoveryBand = "low";
  }
  for (const [key, until] of Object.entries(next.actorCooldowns)) if (until <= next.simulationDate) delete next.actorCooldowns[key];
  return appendEvent(next, {
    eventType: "conflict.time_settled",
    actorId: "system:time",
    subjectIds: [state.worldId],
    payload: { days, fromDate: state.simulationDate, toDate: next.simulationDate },
  });
}

export function projectConflicts(state) {
  return {
    schemaVersion: CONFLICT_SCHEMA_VERSION,
    worldId: state.worldId,
    simulationDate: state.simulationDate,
    conflicts: Object.values(state.conflicts).map((conflict) => ({
      id: conflict.id,
      mode: conflict.mode,
      status: conflict.status,
      windowBand: conflict.daysRemaining > 0 ? "active" : "closed",
      propertyProtected: conflict.propertyId ? state.properties[conflict.propertyId]?.vulnerability !== "contested" : null,
      recoveryBand: conflict.recoveryBand,
      cooldownBand: conflict.cooldownBand,
      evidenceCount: conflict.evidence.length,
    })),
    properties: Object.values(state.properties).map((property) => ({
      id: property.id,
      vulnerability: property.vulnerability,
      offlineProtected: property.offline,
    })),
    omittedFields: ["participantIds", "casusBelli", "location", "actionCounts", "evidence tags", "ownerId", "actorCooldowns", "events", "lastEventHash"],
  };
}

export function snapshotConflicts(state) { return { snapshotVersion: 1, state: clone(state) }; }

export function restoreConflicts(snapshotValue) {
  if (!snapshotValue || snapshotValue.snapshotVersion !== 1) throw new ConflictValidationError("unsupported conflict snapshot version");
  const state = clone(snapshotValue.state);
  if (!state || state.schemaVersion !== CONFLICT_SCHEMA_VERSION) throw new ConflictValidationError("unsupported conflict schema version");
  let revision = 0;
  let previousHash = null;
  for (const event of state.events) {
    if (event.revision !== revision + 1) throw new ConflictValidationError("conflict revisions are not contiguous");
    if (event.previousHash !== previousHash) throw new ConflictValidationError("conflict event chain is broken");
    const { hash, ...unsignedEvent } = event;
    if (hash !== eventHash(unsignedEvent, event.previousHash)) throw new ConflictValidationError("conflict event hash is invalid");
    revision = event.revision;
    previousHash = event.hash;
  }
  if (state.revision !== revision || state.lastEventHash !== previousHash) throw new ConflictValidationError("conflict snapshot does not match history");
  return state;
}
