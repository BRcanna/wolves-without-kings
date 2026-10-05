import { createHash } from "node:crypto";

import { canonicalJson } from "./engine.mjs";

export const TATTOO_SCHEMA_VERSION = 1;

export class TattooValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "TattooValidationError";
  }
}

export class TattooStaleRevisionError extends TattooValidationError {
  constructor(expectedRevision, actualRevision) {
    super(`stale tattoo command: expected revision ${expectedRevision}, actual revision ${actualRevision}`);
    this.name = "TattooStaleRevisionError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

function clone(value) {
  return structuredClone(value);
}

function assertObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TattooValidationError(`${field} must be an object`);
  }
}

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TattooValidationError(`${field} must be a non-empty string`);
  }
}

function assertInteger(value, field, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new TattooValidationError(`${field} must be an integer between ${minimum} and ${maximum}`);
  }
}

function assertArrayOfStrings(value, field) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new TattooValidationError(`${field} must be an array of non-empty strings`);
  }
}

function assertRevision(state, expectedRevision) {
  assertInteger(expectedRevision, "expectedRevision");
  if (expectedRevision !== state.revision) throw new TattooStaleRevisionError(expectedRevision, state.revision);
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
    eventId: `tattoo-${String(next.nextEventId).padStart(6, "0")}`,
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

function requireMarker(state, markerId) {
  assertNonEmpty(markerId, "markerId");
  const marker = state.markers[markerId];
  if (!marker) throw new TattooValidationError(`unknown marker: ${markerId}`);
  return marker;
}

function requireObserver(state, observerId) {
  assertNonEmpty(observerId, "observerId");
  const observer = state.observers[observerId];
  if (!observer) throw new TattooValidationError(`unknown observer: ${observerId}`);
  return observer;
}

function historicalBand(ageDays, eraCreated, currentEra) {
  if (eraCreated < currentEra || ageDays >= 3650) return "old-guard";
  if (ageDays >= 730) return "aged";
  return "current";
}

function recognitionFor(marker, observer, { visibility = "public", claimedOrganizationId = null } = {}) {
  const visible = marker.publicVisibility === "visible"
    || (marker.publicVisibility === "covered" && visibility === "private");
  if (!visible) {
    return {
      interpretation: "not-observed",
      confidence: "none",
      accessBand: "unknown",
      consequence: "none",
    };
  }
  const knowsOrganization = marker.organizationId !== null
    && observer.knownOrganizationIds.includes(marker.organizationId);
  const knowsEra = observer.knownEras.includes(marker.eraCreated)
    || observer.eraAwareness === "broad";
  const mismatchedClaim = claimedOrganizationId !== null
    && claimedOrganizationId !== marker.organizationId;
  if (mismatchedClaim && knowsOrganization && marker.earned) {
    return {
      interpretation: "unauthorized-claim",
      confidence: knowsEra ? "high" : "moderate",
      accessBand: "closed",
      consequence: marker.misuseConsequence,
    };
  }
  if (marker.category === "organizational" && !marker.earned) {
    return {
      interpretation: "unearned-status",
      confidence: knowsOrganization ? "moderate" : "low",
      accessBand: "closed",
      consequence: marker.misuseConsequence,
    };
  }
  if (knowsOrganization && knowsEra) {
    return {
      interpretation: "recognized-affiliation",
      confidence: "high",
      accessBand: "opened",
      consequence: "none",
    };
  }
  if (knowsOrganization) {
    return {
      interpretation: "recognized-but-uncertain-era",
      confidence: "moderate",
      accessBand: "conditional",
      consequence: "distrust",
    };
  }
  return {
    interpretation: marker.category === "cosmetic" ? "cosmetic-or-unknown" : "unfamiliar-marker",
    confidence: "low",
    accessBand: "conditional",
    consequence: "none",
  };
}

export function createTattooState({ characterId, simulationDate = "1998-01-01", era = 1 } = {}) {
  assertNonEmpty(characterId, "characterId");
  assertNonEmpty(simulationDate, "simulationDate");
  assertInteger(era, "era", 1, 1000);
  return {
    schemaVersion: TATTOO_SCHEMA_VERSION,
    characterId,
    simulationDate,
    era,
    revision: 0,
    nextEventId: 1,
    lastEventHash: null,
    markers: {},
    observers: {},
    recognitions: [],
    events: [],
  };
}

export function createMarker(
  state,
  {
    expectedRevision,
    markerId,
    bodyLocation,
    category = "historical",
    meaningDomains = [],
    issuerOrOrigin = "unknown-origin",
    organizationId = null,
    prisonContext = null,
    earnedEventId = null,
    publicVisibility = "visible",
    misuseConsequence = "distrust",
  },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(markerId, "markerId");
  assertNonEmpty(bodyLocation, "bodyLocation");
  assertArrayOfStrings(meaningDomains, "meaningDomains");
  assertNonEmpty(issuerOrOrigin, "issuerOrOrigin");
  if (organizationId !== null) assertNonEmpty(organizationId, "organizationId");
  if (prisonContext !== null) {
    assertObject(prisonContext, "prisonContext");
    assertNonEmpty(prisonContext.facilityId, "prisonContext.facilityId");
  }
  if (earnedEventId !== null) assertNonEmpty(earnedEventId, "earnedEventId");
  if (!["cosmetic", "historical", "organizational", "restricted"].includes(category)) {
    throw new TattooValidationError(`unsupported marker category: ${category}`);
  }
  if (!["visible", "covered", "concealed"].includes(publicVisibility)) {
    throw new TattooValidationError(`unsupported public visibility: ${publicVisibility}`);
  }
  if (!["none", "ridicule", "challenge", "violence-risk", "distrust", "investigation"].includes(misuseConsequence)) {
    throw new TattooValidationError(`unsupported misuse consequence: ${misuseConsequence}`);
  }
  if (state.markers[markerId]) throw new TattooValidationError(`marker already exists: ${markerId}`);
  const marker = {
    id: markerId,
    bodyLocation,
    category,
    meaningDomains: [...new Set(meaningDomains)],
    issuerOrOrigin,
    organizationId,
    prisonContext: prisonContext ? clone(prisonContext) : null,
    earnedEventId,
    earned: earnedEventId !== null,
    publicVisibility,
    misuseConsequence,
    eraCreated: state.era,
    ageDays: 0,
    historicalBand: "current",
    lastUpdatedDate: state.simulationDate,
  };
  const next = clone(state);
  next.markers[markerId] = marker;
  return appendEvent(next, {
    eventType: "tattoo.marker_created",
    actorId: state.characterId,
    subjectIds: [markerId],
    payload: { markerId, category, bodyLocation, organizationId, prisonContext: clone(prisonContext), earned: marker.earned },
  });
}

export function earnMarker(state, { expectedRevision, markerId, earnedEventId }) {
  assertRevision(state, expectedRevision);
  const marker = requireMarker(state, markerId);
  assertNonEmpty(earnedEventId, "earnedEventId");
  if (marker.earned) throw new TattooValidationError(`marker is already earned: ${markerId}`);
  const next = clone(state);
  next.markers[markerId] = { ...marker, earned: true, earnedEventId, lastUpdatedDate: state.simulationDate };
  return appendEvent(next, {
    eventType: "tattoo.marker_earned",
    actorId: state.characterId,
    subjectIds: [markerId],
    payload: { markerId, earnedEventId },
  });
}

export function registerObserver(
  state,
  { expectedRevision, observerId, knownOrganizationIds = [], knownEras = [], eraAwareness = "narrow" },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(observerId, "observerId");
  assertArrayOfStrings(knownOrganizationIds, "knownOrganizationIds");
  if (!Array.isArray(knownEras) || knownEras.some((value) => !Number.isInteger(value) || value < 1)) {
    throw new TattooValidationError("knownEras must be an array of positive integers");
  }
  if (!["narrow", "broad"].includes(eraAwareness)) throw new TattooValidationError(`unsupported era awareness: ${eraAwareness}`);
  const next = clone(state);
  next.observers[observerId] = {
    id: observerId,
    knownOrganizationIds: [...new Set(knownOrganizationIds)],
    knownEras: [...new Set(knownEras)],
    eraAwareness,
    lastUpdatedDate: state.simulationDate,
  };
  return appendEvent(next, {
    eventType: "tattoo.observer_registered",
    actorId: state.characterId,
    subjectIds: [observerId],
    payload: { observerId, knownOrganizationIds: [...new Set(knownOrganizationIds)], knownEras: [...new Set(knownEras)], eraAwareness },
  });
}

export function resolveMarkerEncounter(
  state,
  { expectedRevision, markerId, observerId, visibility = "public", claimedOrganizationId = null, context = "street" },
) {
  assertRevision(state, expectedRevision);
  const marker = requireMarker(state, markerId);
  const observer = requireObserver(state, observerId);
  if (!["public", "private"].includes(visibility)) throw new TattooValidationError(`unsupported visibility: ${visibility}`);
  if (claimedOrganizationId !== null) assertNonEmpty(claimedOrganizationId, "claimedOrganizationId");
  assertNonEmpty(context, "context");
  const recognition = recognitionFor(marker, observer, { visibility, claimedOrganizationId });
  const record = {
    id: `recognition-${state.recognitions.length + 1}`,
    markerId,
    observerId,
    context,
    date: state.simulationDate,
    historicalBand: marker.historicalBand,
    ...recognition,
  };
  const next = clone(state);
  next.recognitions.push(record);
  return appendEvent(next, {
    eventType: "tattoo.marker_interpreted",
    actorId: observerId,
    subjectIds: [state.characterId, markerId],
    payload: { record },
  });
}

export function advanceTattooTime(state, { expectedRevision, days }) {
  assertRevision(state, expectedRevision);
  assertInteger(days, "days", 1, 3650);
  const next = clone(state);
  next.simulationDate = addDays(state.simulationDate, days);
  for (const marker of Object.values(next.markers)) {
    marker.ageDays += days;
    marker.historicalBand = historicalBand(marker.ageDays, marker.eraCreated, next.era);
    marker.lastUpdatedDate = next.simulationDate;
  }
  return appendEvent(next, {
    eventType: "tattoo.time_settled",
    actorId: state.characterId,
    subjectIds: [state.characterId],
    payload: { days, fromDate: state.simulationDate, toDate: next.simulationDate },
  });
}

export function projectTattoos(state) {
  return {
    schemaVersion: TATTOO_SCHEMA_VERSION,
    characterId: state.characterId,
    simulationDate: state.simulationDate,
    markerCount: Object.keys(state.markers).length,
    markers: Object.values(state.markers).map((marker) => ({
      id: marker.id,
      bodyLocation: marker.bodyLocation,
      category: marker.category,
      publicVisibility: marker.publicVisibility,
      historicalBand: marker.historicalBand,
      earned: marker.earned,
      meaningBand: marker.category === "cosmetic" ? "cosmetic" : marker.historicalBand,
    })),
    omittedFields: ["issuerOrOrigin", "organizationId", "recognitionRules", "misuseConsequence", "observers", "recognitions", "events", "lastEventHash"],
  };
}

export function snapshotTattoos(state) {
  return { snapshotVersion: 1, state: clone(state) };
}

export function restoreTattoos(snapshotValue) {
  if (!snapshotValue || snapshotValue.snapshotVersion !== 1) throw new TattooValidationError("unsupported tattoo snapshot version");
  const state = clone(snapshotValue.state);
  if (!state || state.schemaVersion !== TATTOO_SCHEMA_VERSION) throw new TattooValidationError("unsupported tattoo schema version");
  let revision = 0;
  let previousHash = null;
  for (const event of state.events) {
    if (event.revision !== revision + 1) throw new TattooValidationError("tattoo revisions are not contiguous");
    if (event.previousHash !== previousHash) throw new TattooValidationError("tattoo event chain is broken");
    const { hash, ...unsignedEvent } = event;
    if (hash !== eventHash(unsignedEvent, event.previousHash)) throw new TattooValidationError("tattoo event hash is invalid");
    revision = event.revision;
    previousHash = event.hash;
  }
  if (state.revision !== revision || state.lastEventHash !== previousHash) throw new TattooValidationError("tattoo snapshot does not match history");
  return state;
}
