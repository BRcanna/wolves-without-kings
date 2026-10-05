import { createHash } from "node:crypto";

export const ENGINE_SCHEMA_VERSION = 1;

export class StaleRevisionError extends Error {
  constructor(expectedRevision, actualRevision) {
    super(`stale command: expected revision ${expectedRevision}, actual revision ${actualRevision}`);
    this.name = "StaleRevisionError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

export class InvalidCommandError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidCommandError";
  }
}

function clone(value) {
  return structuredClone(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function eventHash(event, previousHash) {
  const material = `${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`;
  return createHash("sha256").update(material).digest("hex");
}

function assertDate(value, field = "date") {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InvalidCommandError(`${field} must be an ISO calendar date (YYYY-MM-DD)`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new InvalidCommandError(`${field} is not a valid calendar date`);
  }
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function assertNonEmptyString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new InvalidCommandError(`${field} must be a non-empty string`);
  }
}

function assertInteger(value, field, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) {
    throw new InvalidCommandError(`${field} must be an integer >= ${minimum}`);
  }
}

function normalizeIds(value, field) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((id) => typeof id !== "string" || id.trim() === "")) {
    throw new InvalidCommandError(`${field} must be an array of non-empty strings`);
  }
  return [...value];
}

export function createInitialWorld({ worldId = "wwk-demo", startDate = "1998-01-01" } = {}) {
  assertNonEmptyString(worldId, "worldId");
  assertDate(startDate, "startDate");
  return {
    schemaVersion: ENGINE_SCHEMA_VERSION,
    worldId,
    startDate,
    date: startDate,
    tick: 0,
    revision: 0,
    nextEventId: 1,
    lastEventHash: null,
    district: {
      id: "sofia-south",
      label: "South Sofia (fictionalized)",
      condition: "stable",
    },
    relationships: {},
    events: [],
  };
}

function nextEventId(world) {
  return `evt-${String(world.nextEventId).padStart(6, "0")}`;
}

function makeEvent(world, { eventType, actors, subjects, location, cause, payload, visibility }) {
  const event = {
    eventId: nextEventId(world),
    eventType,
    tick: world.tick,
    worldRevision: world.revision + 1,
    actors,
    subjects,
    location: location ?? null,
    cause: cause ?? null,
    payload: payload ?? {},
    visibility: visibility ?? "local",
    provenance: {
      engineSchemaVersion: ENGINE_SCHEMA_VERSION,
      source: "wolves-without-kings",
    },
  };
  const withParent = {
    ...event,
    previousHash: world.lastEventHash,
  };
  return {
    ...withParent,
    hash: eventHash(withParent, world.lastEventHash),
  };
}

function reduceEvent(world, event, { verifyChain = true } = {}) {
  const expectedId = nextEventId(world);
  if (event.eventId !== expectedId) {
    throw new InvalidCommandError(`event id ${event.eventId} does not follow ${expectedId}`);
  }
  if (event.worldRevision !== world.revision + 1) {
    throw new InvalidCommandError(`event ${event.eventId} has a non-contiguous world revision`);
  }
  if (verifyChain) {
    if (event.previousHash !== world.lastEventHash) {
      throw new InvalidCommandError(`event ${event.eventId} has a broken parent hash`);
    }
    const { hash, ...unsignedEvent } = event;
    if (hash !== eventHash(unsignedEvent, event.previousHash)) {
      throw new InvalidCommandError(`event ${event.eventId} has an invalid hash`);
    }
  }

  const next = clone(world);
  if (event.eventType === "world.time_advanced") {
    next.date = event.payload.toDate;
    next.tick = event.payload.toTick;
  } else if (event.eventType === "district.condition_changed") {
    next.district = {
      ...next.district,
      condition: event.payload.condition,
    };
  } else if (event.eventType === "social.contact_resolved") {
    const relationshipId = event.payload.relationshipId;
    next.relationships[relationshipId] = {
      trust: event.payload.nextTrust,
      respect: event.payload.nextRespect,
      lastEventId: event.eventId,
    };
  }

  next.events.push(clone(event));
  next.revision = event.worldRevision;
  next.nextEventId += 1;
  next.lastEventHash = event.hash;
  return next;
}

function commit(world, command) {
  const next = clone(world);
  const event = makeEvent(next, command);
  return reduceEvent(next, event);
}

function assertExpectedRevision(world, command) {
  assertInteger(command.expectedRevision, "expectedRevision");
  if (command.expectedRevision !== world.revision) {
    throw new StaleRevisionError(command.expectedRevision, world.revision);
  }
}

export function advanceTime(world, { expectedRevision, days, actorId = "system:time" }) {
  assertExpectedRevision(world, { expectedRevision });
  assertInteger(days, "days", 1);
  assertNonEmptyString(actorId, "actorId");
  const toDate = addDays(world.date, days);
  return commit(world, {
    eventType: "world.time_advanced",
    actors: [actorId],
    subjects: [world.worldId],
    location: null,
    payload: {
      fromDate: world.date,
      toDate,
      fromTick: world.tick,
      toTick: world.tick + days,
      days,
    },
    visibility: "local",
  });
}

export function changeDistrictCondition(
  world,
  { expectedRevision, condition, actorId = "system:district", districtId = world.district.id },
) {
  assertExpectedRevision(world, { expectedRevision });
  assertNonEmptyString(condition, "condition");
  assertNonEmptyString(actorId, "actorId");
  assertNonEmptyString(districtId, "districtId");
  if (districtId !== world.district.id) {
    throw new InvalidCommandError(`unknown district: ${districtId}`);
  }
  return commit(world, {
    eventType: "district.condition_changed",
    actors: [actorId],
    subjects: [districtId],
    location: districtId,
    payload: { districtId, condition },
    visibility: "local",
  });
}

export function resolveSocialContact(
  world,
  {
    expectedRevision,
    actorId,
    subjectId,
    locationId,
    outcome = "uncertain",
  },
) {
  assertExpectedRevision(world, { expectedRevision });
  assertNonEmptyString(actorId, "actorId");
  assertNonEmptyString(subjectId, "subjectId");
  assertNonEmptyString(locationId, "locationId");
  if (!["welcomed", "declined", "uncertain"].includes(outcome)) {
    throw new InvalidCommandError(`unsupported social contact outcome: ${outcome}`);
  }
  const relationshipId = `${actorId}|${subjectId}`;
  const previous = world.relationships[relationshipId] ?? { trust: 0, respect: 0 };
  const delta = { welcomed: 1, declined: -1, uncertain: 0 }[outcome];
  const nextTrust = Math.max(-5, Math.min(5, previous.trust + delta));
  const nextRespect = Math.max(-5, Math.min(5, previous.respect + (outcome === "welcomed" ? 1 : 0)));
  return commit(world, {
    eventType: "social.contact_resolved",
    actors: [actorId],
    subjects: [subjectId],
    location: locationId,
    payload: {
      relationshipId,
      outcome,
      previousTrust: previous.trust,
      nextTrust,
      previousRespect: previous.respect,
      nextRespect,
      informationScope: "local-observation",
    },
    visibility: "local",
  });
}

export function recordEvent(
  world,
  {
    expectedRevision,
    eventType,
    actors = [],
    subjects = [],
    location = null,
    cause = null,
    payload = {},
    visibility = "local",
  },
) {
  assertExpectedRevision(world, { expectedRevision });
  assertNonEmptyString(eventType, "eventType");
  const normalizedActors = normalizeIds(actors, "actors");
  const normalizedSubjects = normalizeIds(subjects, "subjects");
  if (location !== null) assertNonEmptyString(location, "location");
  if (cause !== null) assertNonEmptyString(cause, "cause");
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new InvalidCommandError("payload must be an object");
  }
  assertNonEmptyString(visibility, "visibility");
  return commit(world, {
    eventType,
    actors: normalizedActors,
    subjects: normalizedSubjects,
    location,
    cause,
    payload: clone(payload),
    visibility,
  });
}

export function snapshot(world) {
  return {
    snapshotVersion: 1,
    engineSchemaVersion: ENGINE_SCHEMA_VERSION,
    world: clone(world),
  };
}

export function restore(snapshotValue) {
  if (!snapshotValue || snapshotValue.snapshotVersion !== 1) {
    throw new InvalidCommandError("unsupported snapshot version");
  }
  const savedWorld = snapshotValue.world;
  if (!savedWorld || savedWorld.schemaVersion !== ENGINE_SCHEMA_VERSION) {
    throw new InvalidCommandError("unsupported engine schema version");
  }
  const base = createInitialWorld({ worldId: savedWorld.worldId, startDate: savedWorld.startDate });
  let rebuilt = base;
  for (const event of savedWorld.events) rebuilt = reduceEvent(rebuilt, event);
  if (canonicalJson(rebuilt) !== canonicalJson(savedWorld)) {
    throw new InvalidCommandError("snapshot state does not match its event history");
  }
  return rebuilt;
}

export function inspect(world) {
  return {
    worldId: world.worldId,
    date: world.date,
    tick: world.tick,
    revision: world.revision,
    district: clone(world.district),
    eventCount: world.events.length,
    lastEventHash: world.lastEventHash,
  };
}
