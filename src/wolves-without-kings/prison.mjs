import { createHash } from "node:crypto";

import { canonicalJson } from "./engine.mjs";

export const PRISON_SCHEMA_VERSION = 1;

export class PrisonValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "PrisonValidationError";
  }
}

export class PrisonStaleRevisionError extends PrisonValidationError {
  constructor(expectedRevision, actualRevision) {
    super(`stale prison command: expected revision ${expectedRevision}, actual revision ${actualRevision}`);
    this.name = "PrisonStaleRevisionError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

function clone(value) {
  return structuredClone(value);
}

function assertObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new PrisonValidationError(`${field} must be an object`);
}

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new PrisonValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new PrisonValidationError(`${field} must be an integer between ${minimum} and ${maximum}`);
}

function assertRevision(state, expectedRevision) {
  assertInteger(expectedRevision, "expectedRevision");
  if (expectedRevision !== state.revision) throw new PrisonStaleRevisionError(expectedRevision, state.revision);
}

function bounded(value) {
  return Math.max(0, Math.min(100, value));
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function band(value) {
  return value >= 70 ? "high" : value >= 35 ? "moderate" : "low";
}

function eventHash(event, previousHash) {
  const material = `${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`;
  return createHash("sha256").update(material).digest("hex");
}

function appendEvent(state, { eventType, actorId, subjectIds = [], payload = {} }) {
  const next = clone(state);
  const unsignedEvent = {
    eventId: `prison-${String(next.nextEventId).padStart(6, "0")}`,
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

const TIME_PROFILES = {
  routine: { prisonReputation: 0, relationship: 0, injury: 0, workCredits: 1 },
  education: { prisonReputation: 2, relationship: 1, injury: 0, workCredits: 2 },
  connection: { prisonReputation: 1, relationship: 3, injury: 0, workCredits: 0 },
  isolation: { prisonReputation: -2, relationship: -2, injury: 0, workCredits: 0 },
  conflict: { prisonReputation: 1, relationship: -3, injury: 4, workCredits: 0 },
};

export function createPrisonState({
  characterId,
  sentenceDays,
  facilityId,
  cellBlock = "general",
  startDate = "1999-01-01",
  outsideRegionId = "region:sofia",
  outsideWorldRevision = 0,
} = {}) {
  assertNonEmpty(characterId, "characterId");
  assertInteger(sentenceDays, "sentenceDays", 1, 3650);
  assertNonEmpty(facilityId, "facilityId");
  assertNonEmpty(cellBlock, "cellBlock");
  assertNonEmpty(startDate, "startDate");
  assertNonEmpty(outsideRegionId, "outsideRegionId");
  assertInteger(outsideWorldRevision, "outsideWorldRevision");
  return {
    schemaVersion: PRISON_SCHEMA_VERSION,
    characterId,
    facilityId,
    cellBlock,
    sentenceDays,
    timeServedDays: 0,
    simulationDate: startDate,
    status: "incarcerated",
    outsideRegionId,
    outsideWorldRevision,
    prisonReputation: 0,
    prisonRelationships: {},
    outsideRelationships: {},
    visitationCount: 0,
    prisonWork: [],
    statusMarks: [],
    injury: 0,
    outsideDrift: {
      elapsedDays: 0,
      businessBand: "stable",
      relationshipBand: "current",
      marketBand: "stable",
      organizationControlBand: "stable",
    },
    reentry: null,
    revision: 0,
    nextEventId: 1,
    lastEventHash: null,
    events: [],
  };
}

export function recordPrisonRelationship(
  state,
  { expectedRevision, relationshipId, relationshipType = "associate", delta = 0 },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(relationshipId, "relationshipId");
  assertNonEmpty(relationshipType, "relationshipType");
  assertInteger(delta, "delta", -100, 100);
  const previous = state.prisonRelationships[relationshipId] ?? { trust: 0, respect: 0, ageDays: 0, type: relationshipType };
  const next = clone(state);
  next.prisonRelationships[relationshipId] = {
    ...previous,
    type: relationshipType,
    trust: bounded(previous.trust + delta),
    respect: bounded(previous.respect + Math.trunc(delta / 2)),
    lastUpdatedDate: state.simulationDate,
  };
  return appendEvent(next, {
    eventType: "prison.relationship_updated",
    actorId: state.characterId,
    subjectIds: [relationshipId],
    payload: { relationshipId, relationshipType, delta },
  });
}

export function recordVisitation(
  state,
  { expectedRevision, visitorId, quality = "ordinary" },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(visitorId, "visitorId");
  if (!["missed", "ordinary", "supportive", "strained"].includes(quality)) throw new PrisonValidationError(`unsupported visitation quality: ${quality}`);
  const next = clone(state);
  next.visitationCount += 1;
  next.outsideRelationships[visitorId] = {
    visits: (next.outsideRelationships[visitorId]?.visits ?? 0) + 1,
    quality,
    lastVisitDate: state.simulationDate,
  };
  return appendEvent(next, {
    eventType: "prison.visitation_recorded",
    actorId: state.characterId,
    subjectIds: [visitorId],
    payload: { visitorId, quality },
  });
}

export function recordPrisonStatusMark(
  state,
  { expectedRevision, markId, category = "status", publicLabel },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(markId, "markId");
  assertNonEmpty(category, "category");
  assertNonEmpty(publicLabel, "publicLabel");
  if (state.statusMarks.some((mark) => mark.id === markId)) throw new PrisonValidationError(`status mark already exists: ${markId}`);
  const next = clone(state);
  next.statusMarks.push({ id: markId, category, publicLabel, date: state.simulationDate });
  return appendEvent(next, {
    eventType: "prison.status_mark_recorded",
    actorId: state.characterId,
    subjectIds: [markId],
    payload: { markId, category, publicLabel },
  });
}

export function settlePrisonTime(
  state,
  { expectedRevision, days, mode = "compressed", timeProfile = "routine" },
) {
  assertRevision(state, expectedRevision);
  assertInteger(days, "days", 1, 365);
  if (!["playable", "compressed"].includes(mode)) throw new PrisonValidationError(`unsupported prison time mode: ${mode}`);
  const profile = TIME_PROFILES[timeProfile];
  if (!profile) throw new PrisonValidationError(`unsupported prison time profile: ${timeProfile}`);
  if (state.status !== "incarcerated") throw new PrisonValidationError("prison time can only settle while incarcerated");
  const remaining = state.sentenceDays - state.timeServedDays;
  if (days > remaining) throw new PrisonValidationError("settlement exceeds remaining sentence");
  const next = clone(state);
  next.timeServedDays += days;
  next.simulationDate = addDays(state.simulationDate, days);
  next.outsideDrift.elapsedDays += days;
  next.prisonReputation = bounded(state.prisonReputation + profile.prisonReputation * Math.max(1, Math.floor(days / 30)));
  next.injury = bounded(state.injury + profile.injury);
  for (const relationship of Object.values(next.prisonRelationships)) relationship.ageDays += days;
  next.outsideDrift.relationshipBand = next.outsideDrift.elapsedDays >= 90 ? "stale" : "current";
  next.outsideDrift.businessBand = next.outsideDrift.elapsedDays >= 365 ? "drifted" : next.outsideDrift.elapsedDays >= 180 ? "changed" : "stable";
  next.outsideDrift.marketBand = next.outsideDrift.elapsedDays >= 365 ? "changed" : "stable";
  next.outsideDrift.organizationControlBand = next.outsideDrift.elapsedDays >= 180 ? "reconsolidated" : "stable";
  next.prisonWork.push({ profile: timeProfile, mode, days, credits: profile.workCredits * Math.max(1, Math.floor(days / 30)), date: next.simulationDate });
  if (next.timeServedDays === next.sentenceDays) {
    next.status = "released";
    next.reentry = {
      releaseDate: next.simulationDate,
      streetRelationships: next.outsideDrift.relationshipBand,
      businessState: next.outsideDrift.businessBand,
      marketState: next.outsideDrift.marketBand,
      organizationControl: next.outsideDrift.organizationControlBand,
      reentryCondition: next.injury > 0 ? "injured-return" : "changed-world",
    };
  }
  return appendEvent(next, {
    eventType: next.status === "released" ? "prison.released" : "prison.time_settled",
    actorId: state.characterId,
    subjectIds: [state.characterId, state.facilityId],
    payload: {
      days,
      mode,
      timeProfile,
      fromDate: state.simulationDate,
      toDate: next.simulationDate,
      timeServedDays: next.timeServedDays,
      status: next.status,
      outsideDrift: clone(next.outsideDrift),
    },
  });
}

export function projectPrison(state) {
  return {
    schemaVersion: PRISON_SCHEMA_VERSION,
    characterId: state.characterId,
    facilityId: state.facilityId,
    cellBlock: state.cellBlock,
    status: state.status,
    sentenceBand: state.sentenceDays >= 1095 ? "long" : state.sentenceDays >= 365 ? "medium" : "short",
    timeServedDays: state.timeServedDays,
    prisonReputationBand: band(state.prisonReputation),
    visitationCount: state.visitationCount,
    statusMarks: clone(state.statusMarks),
    outsideDrift: clone(state.outsideDrift),
    reentry: clone(state.reentry),
    omittedFields: ["prisonRelationships", "outsideRelationships", "injury", "prisonWork", "events", "lastEventHash"],
  };
}

export function snapshotPrison(state) {
  return { snapshotVersion: 1, state: clone(state) };
}

export function restorePrison(snapshotValue) {
  if (!snapshotValue || snapshotValue.snapshotVersion !== 1) throw new PrisonValidationError("unsupported prison snapshot version");
  const state = clone(snapshotValue.state);
  if (!state || state.schemaVersion !== PRISON_SCHEMA_VERSION) throw new PrisonValidationError("unsupported prison schema version");
  let revision = 0;
  let previousHash = null;
  for (const event of state.events) {
    if (event.revision !== revision + 1) throw new PrisonValidationError("prison revisions are not contiguous");
    if (event.previousHash !== previousHash) throw new PrisonValidationError("prison event chain is broken");
    const { hash, ...unsignedEvent } = event;
    if (hash !== eventHash(unsignedEvent, event.previousHash)) throw new PrisonValidationError("prison event hash is invalid");
    revision = event.revision;
    previousHash = event.hash;
  }
  if (state.revision !== revision || state.lastEventHash !== previousHash) throw new PrisonValidationError("prison snapshot does not match history");
  return state;
}
