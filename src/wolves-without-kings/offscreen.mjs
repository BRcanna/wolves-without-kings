import { createHash } from "node:crypto";

import { canonicalJson } from "./engine.mjs";

export const OFFSCREEN_SCHEMA_VERSION = 1;

export class OffscreenValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "OffscreenValidationError";
  }
}

export class OffscreenStaleRevisionError extends OffscreenValidationError {
  constructor(expectedRevision, actualRevision) {
    super(`stale offscreen command: expected revision ${expectedRevision}, actual revision ${actualRevision}`);
    this.name = "OffscreenStaleRevisionError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

function clone(value) { return structuredClone(value); }

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new OffscreenValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new OffscreenValidationError(`${field} must be an integer between ${minimum} and ${maximum}`);
  }
}

function assertDate(value, field) {
  assertNonEmpty(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())) {
    throw new OffscreenValidationError(`${field} must be an ISO date`);
  }
}

function assertRange(value, field, minimum = 0, maximum = 100) { assertInteger(value, field, minimum, maximum); }

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function clamp(value, minimum = 0, maximum = 100) { return Math.max(minimum, Math.min(maximum, value)); }

function band(value) { return value >= 70 ? "high" : value >= 35 ? "moderate" : "low"; }

function stableNumber(...parts) {
  const digest = createHash("sha256").update(parts.join("|"), "utf8").digest();
  return digest.readUInt32BE(0);
}

function eventHash(event, previousHash) {
  return createHash("sha256")
    .update(`${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`)
    .digest("hex");
}

function assertRevision(state, expectedRevision) {
  assertInteger(expectedRevision, "expectedRevision");
  if (expectedRevision !== state.revision) throw new OffscreenStaleRevisionError(expectedRevision, state.revision);
}

function appendEvent(state, { eventType, actorId = "system:offscreen", subjectIds = [], payload = {} }) {
  const next = clone(state);
  const unsignedEvent = {
    eventId: `offscreen-${String(next.nextEventId).padStart(6, "0")}`,
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

function requireRegion(state, regionId) {
  assertNonEmpty(regionId, "regionId");
  const region = state.regions[regionId];
  if (!region) throw new OffscreenValidationError(`unknown offscreen region: ${regionId}`);
  return region;
}

export function createOffscreenState({ worldId = "wwk-offscreen", simulationDate = "1998-01-01" } = {}) {
  assertNonEmpty(worldId, "worldId");
  assertDate(simulationDate, "simulationDate");
  return {
    schemaVersion: OFFSCREEN_SCHEMA_VERSION,
    worldId,
    simulationDate,
    revision: 0,
    nextEventId: 1,
    lastEventHash: null,
    regions: {},
    events: [],
  };
}

export function registerOffscreenRegion(
  state,
  { expectedRevision, regionId, mode = "aggregate", populationBand = "moderate", marketPressure = 50, organizationPressure = 30 },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(regionId, "regionId");
  if (!["full", "aggregate"].includes(mode)) throw new OffscreenValidationError(`unsupported simulation mode: ${mode}`);
  assertNonEmpty(populationBand, "populationBand");
  assertRange(marketPressure, "marketPressure");
  assertRange(organizationPressure, "organizationPressure");
  if (state.regions[regionId]) throw new OffscreenValidationError(`offscreen region already exists: ${regionId}`);
  const region = {
    id: regionId,
    mode,
    lastFullTick: 0,
    aggregateElapsed: 0,
    populationBand,
    marketPressure,
    organizationPressure,
    importantEntities: {},
    scheduledEvents: {},
    reconciliationState: "clean",
    materializationSeed: stableNumber(state.worldId, regionId),
    history: [{ type: "registered", date: state.simulationDate, mode }],
  };
  const next = clone(state);
  next.regions[regionId] = region;
  return appendEvent(next, {
    eventType: "offscreen.region_registered",
    subjectIds: [regionId],
    payload: { region: clone(region) },
  });
}

export function promoteImportantEntity(
  state,
  { expectedRevision, regionId, entityId, entityType = "named-entity" },
) {
  assertRevision(state, expectedRevision);
  const region = requireRegion(state, regionId);
  assertNonEmpty(entityId, "entityId");
  assertNonEmpty(entityType, "entityType");
  if (region.importantEntities[entityId]) throw new OffscreenValidationError(`important entity already promoted: ${entityId}`);
  const next = clone(state);
  next.regions[regionId].importantEntities[entityId] = {
    id: entityId,
    entityType,
    promoted: true,
    sourceMode: region.mode,
    lastKnownDate: state.simulationDate,
  };
  return appendEvent(next, {
    eventType: "offscreen.entity_promoted",
    subjectIds: [regionId, entityId],
    payload: { entityId, entityType, remainsPromoted: true },
  });
}

export function scheduleOffscreenEvent(
  state,
  { expectedRevision, regionId, eventId, eventType, dueInDays, entityIds = [], outcomeBands = ["stable", "disrupted"] },
) {
  assertRevision(state, expectedRevision);
  const region = requireRegion(state, regionId);
  assertNonEmpty(eventId, "eventId");
  assertNonEmpty(eventType, "eventType");
  assertInteger(dueInDays, "dueInDays", 1, 3650);
  if (!Array.isArray(entityIds) || entityIds.some((entityId) => typeof entityId !== "string" || entityId.trim() === "")) {
    throw new OffscreenValidationError("entityIds must contain only non-empty strings");
  }
  if (!Array.isArray(outcomeBands) || outcomeBands.length === 0 || outcomeBands.some((bandValue) => typeof bandValue !== "string" || bandValue.trim() === "")) {
    throw new OffscreenValidationError("outcomeBands must contain at least one label");
  }
  if (region.scheduledEvents[eventId]) throw new OffscreenValidationError(`scheduled event already exists: ${eventId}`);
  const scheduled = {
    id: eventId,
    eventType,
    dueDate: addDays(state.simulationDate, dueInDays),
    entityIds: [...entityIds],
    outcomeBands: [...outcomeBands],
    status: "scheduled",
    outcome: null,
    exactWitnessDetail: null,
  };
  const next = clone(state);
  next.regions[regionId].scheduledEvents[eventId] = scheduled;
  return appendEvent(next, {
    eventType: "offscreen.event_scheduled",
    subjectIds: [regionId, eventId, ...entityIds],
    payload: { scheduled: clone(scheduled) },
  });
}

export function settleOffscreenTime(state, { expectedRevision, days, actorId = "system:offscreen-time" }) {
  assertRevision(state, expectedRevision);
  assertInteger(days, "days", 1, 3650);
  const nextDate = addDays(state.simulationDate, days);
  const next = clone(state);
  next.simulationDate = nextDate;
  const materializedEvents = [];
  for (const region of Object.values(next.regions)) {
    if (region.mode === "full") {
      region.lastFullTick += days;
      region.reconciliationState = "clean";
      region.history.push({ type: "full-settlement", date: nextDate, days });
      continue;
    }
    region.aggregateElapsed += days;
    region.marketPressure = clamp(region.marketPressure + (stableNumber(state.worldId, region.id, nextDate) % 9) - 4);
    region.organizationPressure = clamp(region.organizationPressure + (stableNumber(region.id, nextDate, "org") % 7) - 3);
    region.reconciliationState = "aggregate-updated";
    region.history.push({ type: "aggregate-settlement", date: nextDate, days });
    for (const scheduled of Object.values(region.scheduledEvents)) {
      if (scheduled.status === "scheduled" && nextDate >= scheduled.dueDate) {
        const choice = stableNumber(state.worldId, region.id, scheduled.id, scheduled.dueDate) % scheduled.outcomeBands.length;
        scheduled.status = "materialized";
        scheduled.outcome = scheduled.outcomeBands[choice];
        scheduled.exactWitnessDetail = "unknown-untracked";
        materializedEvents.push({ regionId: region.id, eventId: scheduled.id, outcome: scheduled.outcome });
      }
    }
  }
  const settled = appendEvent(next, {
    eventType: "offscreen.time_settled",
    actorId,
    subjectIds: [state.worldId],
    payload: { fromDate: state.simulationDate, toDate: nextDate, days, materializedEvents },
  });
  return materializedEvents.reduce((current, item) => appendEvent(current, {
    eventType: "offscreen.event_materialized",
    actorId: "system:offscreen-materializer",
    subjectIds: [item.regionId, item.eventId],
    payload: { outcome: item.outcome, exactWitnessDetail: "unknown-untracked" },
  }), settled);
}

export function materializeOffscreenRegion(state, { expectedRevision, regionId }) {
  assertRevision(state, expectedRevision);
  const region = requireRegion(state, regionId);
  if (region.mode !== "aggregate") throw new OffscreenValidationError(`region is not aggregated: ${regionId}`);
  const next = clone(state);
  next.regions[regionId].mode = "full";
  next.regions[regionId].reconciliationState = "materialized";
  next.regions[regionId].lastFullTick += region.aggregateElapsed;
  next.regions[regionId].history.push({ type: "materialized", date: state.simulationDate, aggregateElapsed: region.aggregateElapsed });
  return appendEvent(next, {
    eventType: "offscreen.region_materialized",
    subjectIds: [regionId],
    payload: {
      aggregateElapsed: region.aggregateElapsed,
      promotedEntityIds: Object.keys(region.importantEntities),
      scheduledEventIds: Object.values(region.scheduledEvents).filter((event) => event.status === "materialized").map((event) => event.id),
      uncertainty: "exact witness detail unavailable",
    },
  });
}

export function projectOffscreen(state, { scope = "public" } = {}) {
  if (!["public", "debug"].includes(scope)) throw new OffscreenValidationError(`unsupported offscreen projection scope: ${scope}`);
  return {
    schemaVersion: OFFSCREEN_SCHEMA_VERSION,
    worldId: state.worldId,
    simulationDate: state.simulationDate,
    regions: Object.values(state.regions).map((region) => ({
      id: region.id,
      mode: region.mode,
      aggregateElapsedBand: band(region.aggregateElapsed),
      populationBand: region.populationBand,
      marketPressureBand: band(region.marketPressure),
      organizationPressureBand: band(region.organizationPressure),
      importantEntityCount: Object.keys(region.importantEntities).length,
      scheduledOutcomeBands: Object.values(region.scheduledEvents).map((event) => event.status === "materialized" ? event.outcome : "pending"),
      reconciliationState: region.reconciliationState,
      ...(scope === "debug" ? { materializationSeed: region.materializationSeed, exactEvents: clone(region.scheduledEvents), history: clone(region.history) } : {}),
    })),
    omittedFields: scope === "public" ? ["materializationSeed", "exact witness detail", "scheduled event payload", "event hashes"] : [],
  };
}

export function snapshotOffscreen(state) { return { snapshotVersion: 1, state: clone(state) }; }

export function restoreOffscreen(snapshotValue) {
  if (!snapshotValue || snapshotValue.snapshotVersion !== 1) throw new OffscreenValidationError("unsupported offscreen snapshot version");
  const state = clone(snapshotValue.state);
  if (!state || state.schemaVersion !== OFFSCREEN_SCHEMA_VERSION) throw new OffscreenValidationError("unsupported offscreen schema version");
  let revision = 0;
  let previousHash = null;
  for (const event of state.events) {
    if (event.revision !== revision + 1) throw new OffscreenValidationError("offscreen revisions are not contiguous");
    if (event.previousHash !== previousHash) throw new OffscreenValidationError("offscreen event chain is broken");
    const { hash, ...unsignedEvent } = event;
    if (hash !== eventHash(unsignedEvent, event.previousHash)) throw new OffscreenValidationError("offscreen event hash is invalid");
    revision = event.revision;
    previousHash = event.hash;
  }
  if (state.revision !== revision || state.lastEventHash !== previousHash) throw new OffscreenValidationError("offscreen snapshot does not match history");
  return state;
}
