import { canonicalJson } from "./engine.mjs";

export const EVENT_PROJECTIONS_SCHEMA_VERSION = 1;

export class EventProjectionValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "EventProjectionValidationError";
  }
}

export class EventProjectionStaleRevisionError extends EventProjectionValidationError {
  constructor(expectedRevision, actualRevision) {
    super(`stale event-projection command: expected revision ${expectedRevision}, actual revision ${actualRevision}`);
    this.name = "EventProjectionStaleRevisionError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

function clone(value) { return structuredClone(value); }

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new EventProjectionValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) throw new EventProjectionValidationError(`${field} must be an integer >= ${minimum}`);
}

function assertRevision(state, expectedRevision) {
  assertInteger(expectedRevision, "expectedRevision");
  if (expectedRevision !== state.revision) throw new EventProjectionStaleRevisionError(expectedRevision, state.revision);
}

function validateEvent(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) throw new EventProjectionValidationError("committed event must be an object");
  assertNonEmpty(event.eventId, "eventId");
  assertNonEmpty(event.eventType, "eventType");
  assertInteger(event.worldRevision, "worldRevision", 1);
  if (!Array.isArray(event.actors) || !Array.isArray(event.subjects)) throw new EventProjectionValidationError("event actors and subjects must be arrays");
  if (event.payload !== undefined && (!event.payload || typeof event.payload !== "object" || Array.isArray(event.payload))) throw new EventProjectionValidationError("event payload must be an object");
}

function familyFor(eventType) {
  return eventType.split(".")[0];
}

function activityBand(count) {
  if (count >= 5) return "active";
  if (count >= 2) return "steady";
  return "new";
}

function rebuildProjection(state) {
  const events = Object.values(state.events).sort((left, right) => left.worldRevision - right.worldRevision || left.eventId.localeCompare(right.eventId));
  const familyCounts = {};
  const subjectCounts = {};
  const orderedEventIds = [];
  for (const event of events) {
    const family = familyFor(event.eventType);
    familyCounts[family] = (familyCounts[family] ?? 0) + 1;
    for (const subjectId of event.subjects) subjectCounts[subjectId] = (subjectCounts[subjectId] ?? 0) + 1;
    orderedEventIds.push(event.eventId);
  }
  return {
    ...state,
    projection: { familyCounts, subjectCounts, orderedEventIds },
    lastSourceRevision: events.at(-1)?.worldRevision ?? 0,
  };
}

export function createEventProjectionState({ worldId = "wwk-event-projections" } = {}) {
  assertNonEmpty(worldId, "worldId");
  return {
    schemaVersion: EVENT_PROJECTIONS_SCHEMA_VERSION,
    worldId,
    revision: 0,
    lastSourceRevision: 0,
    events: {},
    projection: { familyCounts: {}, subjectCounts: {}, orderedEventIds: [] },
  };
}

export function ingestCommittedEvents(state, { expectedRevision, events }) {
  assertRevision(state, expectedRevision);
  if (!Array.isArray(events) || events.length === 0) throw new EventProjectionValidationError("events must be a non-empty array");
  const next = clone(state);
  let added = 0;
  for (const event of events) {
    validateEvent(event);
    const existing = next.events[event.eventId];
    if (existing) {
      if (canonicalJson(existing) !== canonicalJson(event)) throw new EventProjectionValidationError(`conflicting duplicate event: ${event.eventId}`);
      continue;
    }
    next.events[event.eventId] = clone(event);
    added += 1;
  }
  if (added === 0) return state;
  next.revision += 1;
  return rebuildProjection(next);
}

export function projectEventProjections(state, { scope = "public" } = {}) {
  if (scope !== "public") throw new EventProjectionValidationError("event projection requires public scope");
  return {
    schemaVersion: EVENT_PROJECTIONS_SCHEMA_VERSION,
    worldId: state.worldId,
    sourceRevision: state.lastSourceRevision,
    families: Object.fromEntries(Object.entries(state.projection.familyCounts).map(([family, count]) => [family, activityBand(count)])),
    subjectActivity: Object.fromEntries(Object.entries(state.projection.subjectCounts).map(([subjectId, count]) => [subjectId, activityBand(count)])),
    omittedFields: ["events", "payloads", "actors", "exact counts", "ordered event IDs"],
  };
}

export function snapshotEventProjections(state) {
  const current = clone(state);
  return { snapshotVersion: 1, state: current, stateDigest: canonicalJson(current) };
}

export function restoreEventProjections(snapshotValue) {
  if (!snapshotValue || snapshotValue.snapshotVersion !== 1) throw new EventProjectionValidationError("unsupported event-projection snapshot version");
  const state = clone(snapshotValue.state);
  if (!state || state.schemaVersion !== EVENT_PROJECTIONS_SCHEMA_VERSION) throw new EventProjectionValidationError("unsupported event-projection schema version");
  if (snapshotValue.stateDigest !== canonicalJson(state)) throw new EventProjectionValidationError("event-projection snapshot digest is invalid");
  const rebuilt = rebuildProjection(state);
  if (canonicalJson(rebuilt.projection) !== canonicalJson(state.projection) || rebuilt.lastSourceRevision !== state.lastSourceRevision) {
    throw new EventProjectionValidationError("event-projection snapshot does not match its event set");
  }
  return state;
}
