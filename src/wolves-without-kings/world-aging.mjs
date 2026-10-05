import { createHash } from "node:crypto";

import { canonicalJson } from "./engine.mjs";

export const WORLD_AGING_SCHEMA_VERSION = 1;

export class WorldAgingValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "WorldAgingValidationError";
  }
}

export class WorldAgingStaleRevisionError extends WorldAgingValidationError {
  constructor(expectedRevision, actualRevision) {
    super(`stale world-aging command: expected revision ${expectedRevision}, actual revision ${actualRevision}`);
    this.name = "WorldAgingStaleRevisionError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

function clone(value) { return structuredClone(value); }

function assertObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorldAgingValidationError(`${field} must be an object`);
}

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new WorldAgingValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new WorldAgingValidationError(`${field} must be an integer between ${minimum} and ${maximum}`);
}

function assertRange(value, field, minimum = 0, maximum = 100) { assertInteger(value, field, minimum, maximum); }

function assertRevision(state, expectedRevision) {
  assertInteger(expectedRevision, "expectedRevision");
  if (expectedRevision !== state.revision) throw new WorldAgingStaleRevisionError(expectedRevision, state.revision);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function eraBand(dateString) {
  const year = Number(dateString.slice(0, 4));
  if (year < 2000) return "late-1990s";
  if (year < 2005) return "early-2000s";
  if (year < 2010) return "late-2000s";
  return "later-era";
}

function band(value) { return value >= 70 ? "high" : value >= 35 ? "moderate" : "low"; }

function eventHash(event, previousHash) {
  const material = `${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`;
  return createHash("sha256").update(material).digest("hex");
}

function appendEvent(state, { eventType, actorId, subjectIds = [], payload = {} }) {
  const next = clone(state);
  const unsignedEvent = {
    eventId: `world-age-${String(next.nextEventId).padStart(6, "0")}`,
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

function requirePlace(state, placeId) {
  assertNonEmpty(placeId, "placeId");
  const place = state.places[placeId];
  if (!place) throw new WorldAgingValidationError(`unknown place: ${placeId}`);
  return place;
}

export function createWorldAgingState({ worldId = "wwk-world", simulationDate = "1998-01-01" } = {}) {
  assertNonEmpty(worldId, "worldId");
  assertNonEmpty(simulationDate, "simulationDate");
  return {
    schemaVersion: WORLD_AGING_SCHEMA_VERSION,
    worldId,
    simulationDate,
    era: eraBand(simulationDate),
    revision: 0,
    nextEventId: 1,
    lastEventHash: null,
    places: {},
    worldHistory: [],
    events: [],
  };
}

export function createAgingPlace(
  state,
  { expectedRevision, placeId, regionId, placeType, publicLabel, condition = 70, institutionalAttention = 10 },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(placeId, "placeId");
  assertNonEmpty(regionId, "regionId");
  assertNonEmpty(placeType, "placeType");
  assertNonEmpty(publicLabel, "publicLabel");
  assertRange(condition, "condition");
  assertRange(institutionalAttention, "institutionalAttention");
  if (state.places[placeId]) throw new WorldAgingValidationError(`place already exists: ${placeId}`);
  const place = {
    id: placeId,
    regionId,
    placeType,
    publicLabel,
    condition,
    institutionalAttention,
    ageDays: 0,
    status: "open",
    scars: [],
    memory: [],
    currentMeaning: "ordinary",
    lastTransitionDate: state.simulationDate,
  };
  const next = clone(state);
  next.places[placeId] = place;
  return appendEvent(next, {
    eventType: "world.place_created",
    actorId: "system:world",
    subjectIds: [placeId, regionId],
    payload: { place: clone(place) },
  });
}

export function recordPlaceMemory(
  state,
  { expectedRevision, placeId, memoryType, severity = 20, publicVisibility = "public", meaning = "changed-place", status = null },
) {
  assertRevision(state, expectedRevision);
  const place = requirePlace(state, placeId);
  assertNonEmpty(memoryType, "memoryType");
  assertRange(severity, "severity");
  if (!["public", "local", "private"].includes(publicVisibility)) throw new WorldAgingValidationError(`unsupported public visibility: ${publicVisibility}`);
  assertNonEmpty(meaning, "meaning");
  if (status !== null && !["open", "closed", "renovating", "abandoned"].includes(status)) throw new WorldAgingValidationError(`unsupported place status: ${status}`);
  const next = clone(state);
  const memory = {
    id: `memory-${place.memory.length + 1}`,
    memoryType,
    severity,
    publicVisibility,
    meaning,
    date: state.simulationDate,
    era: state.era,
  };
  next.places[placeId].memory.push(memory);
  next.places[placeId].scars.push({ memoryType, severity, date: state.simulationDate });
  next.places[placeId].condition = Math.max(0, place.condition - Math.floor(severity / 4));
  next.places[placeId].institutionalAttention = Math.min(100, place.institutionalAttention + Math.floor(severity / 10));
  next.places[placeId].currentMeaning = meaning;
  if (status !== null) next.places[placeId].status = status;
  next.places[placeId].lastTransitionDate = state.simulationDate;
  next.worldHistory.push({ placeId, type: memoryType, date: state.simulationDate, era: state.era });
  return appendEvent(next, {
    eventType: "world.place_memory_recorded",
    actorId: "system:world-history",
    subjectIds: [placeId],
    payload: { memory: clone(memory), nextCondition: next.places[placeId].condition, nextStatus: next.places[placeId].status },
  });
}

export function settleWorldTime(state, { expectedRevision, days }) {
  assertRevision(state, expectedRevision);
  assertInteger(days, "days", 1, 3650);
  const next = clone(state);
  next.simulationDate = addDays(state.simulationDate, days);
  next.era = eraBand(next.simulationDate);
  for (const place of Object.values(next.places)) {
    place.ageDays += days;
    if (place.status === "open" && days >= 365 && place.condition < 35) place.status = "renovating";
    if (place.status === "renovating" && days >= 730) place.condition = Math.min(100, place.condition + 20);
    if (place.memory.length > 0 && place.memory.at(-1).era !== next.era) place.currentMeaning = "era-layered";
  }
  return appendEvent(next, {
    eventType: "world.time_settled",
    actorId: "system:time",
    subjectIds: [state.worldId],
    payload: { days, fromDate: state.simulationDate, toDate: next.simulationDate, era: next.era },
  });
}

export function projectWorldAging(state) {
  return {
    schemaVersion: WORLD_AGING_SCHEMA_VERSION,
    worldId: state.worldId,
    simulationDate: state.simulationDate,
    era: state.era,
    places: Object.values(state.places).map((place) => ({
      id: place.id,
      regionId: place.regionId,
      publicLabel: place.publicLabel,
      placeType: place.placeType,
      status: place.status,
      conditionBand: band(place.condition),
      attentionBand: band(place.institutionalAttention),
      meaning: place.currentMeaning,
      publicMemoryCount: place.memory.filter((memory) => memory.publicVisibility !== "private").length,
      scarBand: band(place.scars.reduce((sum, scar) => sum + scar.severity, 0)),
    })),
    omittedFields: ["private memory", "exact condition", "exact attention", "causal actors", "events", "lastEventHash"],
  };
}

export function snapshotWorldAging(state) { return { snapshotVersion: 1, state: clone(state) }; }

export function restoreWorldAging(snapshotValue) {
  if (!snapshotValue || snapshotValue.snapshotVersion !== 1) throw new WorldAgingValidationError("unsupported world-aging snapshot version");
  const state = clone(snapshotValue.state);
  if (!state || state.schemaVersion !== WORLD_AGING_SCHEMA_VERSION) throw new WorldAgingValidationError("unsupported world-aging schema version");
  let revision = 0;
  let previousHash = null;
  for (const event of state.events) {
    if (event.revision !== revision + 1) throw new WorldAgingValidationError("world-aging revisions are not contiguous");
    if (event.previousHash !== previousHash) throw new WorldAgingValidationError("world-aging event chain is broken");
    const { hash, ...unsignedEvent } = event;
    if (hash !== eventHash(unsignedEvent, event.previousHash)) throw new WorldAgingValidationError("world-aging event hash is invalid");
    revision = event.revision;
    previousHash = event.hash;
  }
  if (state.revision !== revision || state.lastEventHash !== previousHash) throw new WorldAgingValidationError("world-aging snapshot does not match history");
  return state;
}
