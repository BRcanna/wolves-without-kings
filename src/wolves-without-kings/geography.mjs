import { createHash } from "node:crypto";

import { canonicalJson } from "./engine.mjs";

export const GEOGRAPHY_SCHEMA_VERSION = 1;

export class GeographyValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "GeographyValidationError";
  }
}

export class GeographyStaleRevisionError extends GeographyValidationError {
  constructor(expectedRevision, actualRevision) {
    super(`stale geography command: expected revision ${expectedRevision}, actual revision ${actualRevision}`);
    this.name = "GeographyStaleRevisionError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

function clone(value) { return structuredClone(value); }

function assertObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new GeographyValidationError(`${field} must be an object`);
  }
}

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new GeographyValidationError(`${field} must be a non-empty string`);
  }
}

function assertInteger(value, field, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new GeographyValidationError(`${field} must be an integer between ${minimum} and ${maximum}`);
  }
}

function assertDate(value, field) {
  assertNonEmpty(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())) {
    throw new GeographyValidationError(`${field} must be an ISO date`);
  }
}

function assertRange(value, field, minimum = 0, maximum = 100) {
  assertInteger(value, field, minimum, maximum);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function eraFor(dateString) {
  const year = Number(dateString.slice(0, 4));
  if (year < 2000) return "late-1990s";
  if (year < 2005) return "early-2000s";
  if (year < 2010) return "late-2000s";
  return "later-era";
}

function seasonFor(dateString) {
  const month = Number(dateString.slice(5, 7));
  if ([12, 1, 2].includes(month)) return "winter";
  if ([3, 4, 5].includes(month)) return "spring";
  if ([6, 7, 8].includes(month)) return "summer";
  return "autumn";
}

function seasonBand(role, season) {
  if (role === "coastal") return season === "summer" ? "seasonal-high" : season === "winter" ? "seasonal-low" : "seasonal-middle";
  if (role === "mountain") return season === "winter" ? "weathered" : "passable";
  if (role === "rural") return season === "summer" ? "busy" : "quiet";
  return "continuous";
}

function linkStatus(link, season, fromRole, toRole) {
  const seasonalPenalty = season === "winter" && [fromRole, toRole].includes("mountain") ? 25 :
    season === "winter" && [fromRole, toRole].includes("coastal") ? 10 : 0;
  return link.baseFriction + seasonalPenalty >= 85 ? "restricted" : "open";
}

function band(value) { return value >= 70 ? "high" : value >= 35 ? "moderate" : "low"; }

function eventHash(event, previousHash) {
  return createHash("sha256")
    .update(`${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`)
    .digest("hex");
}

function assertRevision(state, expectedRevision) {
  assertInteger(expectedRevision, "expectedRevision");
  if (expectedRevision !== state.revision) throw new GeographyStaleRevisionError(expectedRevision, state.revision);
}

function appendEvent(state, { eventType, actorId, subjectIds = [], payload = {} }) {
  const next = clone(state);
  const unsignedEvent = {
    eventId: `geography-${String(next.nextEventId).padStart(6, "0")}`,
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
  if (!region) throw new GeographyValidationError(`unknown geography region: ${regionId}`);
  return region;
}

export function createGeographyState({ worldId = "wwk-bulgaria", simulationDate = "1998-01-01" } = {}) {
  assertNonEmpty(worldId, "worldId");
  assertDate(simulationDate, "simulationDate");
  return {
    schemaVersion: GEOGRAPHY_SCHEMA_VERSION,
    worldId,
    simulationDate,
    era: eraFor(simulationDate),
    season: seasonFor(simulationDate),
    revision: 0,
    nextEventId: 1,
    lastEventHash: null,
    regions: {},
    links: {},
    events: [],
  };
}

export function registerGeographyRegion(
  state,
  {
    expectedRevision,
    regionId,
    cityOrArea,
    publicLabel,
    role,
    socialLayers,
    architecture,
    policeDomain,
    economyProfile,
    simulationMode = "aggregate",
    seasonalPressure = 30,
  },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(regionId, "regionId");
  assertNonEmpty(cityOrArea, "cityOrArea");
  assertNonEmpty(publicLabel, "publicLabel");
  if (!["capital", "coastal", "rural", "mountain"].includes(role)) throw new GeographyValidationError(`unsupported geography role: ${role}`);
  if (!Array.isArray(socialLayers) || socialLayers.length === 0 || socialLayers.some((value) => typeof value !== "string" || value.trim() === "")) {
    throw new GeographyValidationError("socialLayers must contain at least one label");
  }
  if (!Array.isArray(architecture) || architecture.length === 0 || architecture.some((value) => typeof value !== "string" || value.trim() === "")) {
    throw new GeographyValidationError("architecture must contain at least one label");
  }
  assertNonEmpty(policeDomain, "policeDomain");
  assertNonEmpty(economyProfile, "economyProfile");
  if (!["full", "aggregate"].includes(simulationMode)) throw new GeographyValidationError(`unsupported simulation mode: ${simulationMode}`);
  assertRange(seasonalPressure, "seasonalPressure");
  if (state.regions[regionId]) throw new GeographyValidationError(`geography region already exists: ${regionId}`);
  const region = {
    id: regionId,
    cityOrArea,
    publicLabel,
    role,
    socialLayers: [...socialLayers],
    architecture: [...architecture],
    policeDomain,
    economyProfile,
    simulationMode,
    seasonalPressure,
    seasonBand: seasonBand(role, state.season),
    ageDays: 0,
    memory: [],
    history: [{ type: "created", date: state.simulationDate, era: state.era }],
    lastTransitionDate: state.simulationDate,
  };
  const next = clone(state);
  next.regions[regionId] = region;
  return appendEvent(next, {
    eventType: "geography.region_registered",
    actorId: "system:geography",
    subjectIds: [regionId],
    payload: { region: clone(region) },
  });
}

export function connectGeographyRegions(
  state,
  { expectedRevision, linkId, fromRegionId, toRegionId, linkType, travelDays, baseFriction, capacity = 50 },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(linkId, "linkId");
  assertNonEmpty(fromRegionId, "fromRegionId");
  assertNonEmpty(toRegionId, "toRegionId");
  if (fromRegionId === toRegionId) throw new GeographyValidationError("geography link endpoints must differ");
  if (!["road", "rail", "sea"].includes(linkType)) throw new GeographyValidationError(`unsupported link type: ${linkType}`);
  assertInteger(travelDays, "travelDays", 1, 30);
  assertRange(baseFriction, "baseFriction");
  assertInteger(capacity, "capacity", 1, 100);
  const from = requireRegion(state, fromRegionId);
  const to = requireRegion(state, toRegionId);
  if (state.links[linkId]) throw new GeographyValidationError(`geography link already exists: ${linkId}`);
  const link = {
    id: linkId,
    fromRegionId,
    toRegionId,
    linkType,
    travelDays,
    baseFriction,
    capacity,
    status: linkStatus({ baseFriction }, state.season, from.role, to.role),
    history: [{ type: "created", date: state.simulationDate, season: state.season }],
  };
  const next = clone(state);
  next.links[linkId] = link;
  return appendEvent(next, {
    eventType: "geography.link_connected",
    actorId: "system:geography",
    subjectIds: [linkId, fromRegionId, toRegionId],
    payload: { link: clone(link) },
  });
}

export function recordGeographyMemory(
  state,
  { expectedRevision, regionId, memoryType, meaning, severity = 20, visibility = "public" },
) {
  assertRevision(state, expectedRevision);
  const region = requireRegion(state, regionId);
  assertNonEmpty(memoryType, "memoryType");
  assertNonEmpty(meaning, "meaning");
  assertRange(severity, "severity");
  if (!["public", "local", "private"].includes(visibility)) throw new GeographyValidationError(`unsupported memory visibility: ${visibility}`);
  const memory = {
    id: `geography-memory-${region.memory.length + 1}`,
    memoryType,
    meaning,
    severity,
    visibility,
    date: state.simulationDate,
    era: state.era,
  };
  const next = clone(state);
  next.regions[regionId].memory.push(memory);
  next.regions[regionId].history.push({ type: "memory", date: state.simulationDate, era: state.era, memoryType });
  next.regions[regionId].lastTransitionDate = state.simulationDate;
  return appendEvent(next, {
    eventType: "geography.region_memory_recorded",
    actorId: "system:geography-history",
    subjectIds: [regionId],
    payload: { memory: clone(memory) },
  });
}

export function settleGeographyTime(state, { expectedRevision, days }) {
  assertRevision(state, expectedRevision);
  assertInteger(days, "days", 1, 3650);
  const nextDate = addDays(state.simulationDate, days);
  const nextSeason = seasonFor(nextDate);
  const nextEra = eraFor(nextDate);
  const next = clone(state);
  next.simulationDate = nextDate;
  next.season = nextSeason;
  next.era = nextEra;
  for (const region of Object.values(next.regions)) {
    region.ageDays += days;
    region.seasonBand = seasonBand(region.role, nextSeason);
    if (region.history.at(-1)?.era !== nextEra) region.history.push({ type: "era-transition", date: nextDate, era: nextEra });
    region.lastTransitionDate = nextDate;
  }
  for (const link of Object.values(next.links)) {
    const from = next.regions[link.fromRegionId];
    const to = next.regions[link.toRegionId];
    link.status = linkStatus(link, nextSeason, from.role, to.role);
    if (link.history.at(-1)?.season !== nextSeason) link.history.push({ type: "season-change", date: nextDate, season: nextSeason, status: link.status });
  }
  return appendEvent(next, {
    eventType: "geography.time_settled",
    actorId: "system:geography-time",
    subjectIds: [state.worldId],
    payload: { fromDate: state.simulationDate, toDate: nextDate, days, era: nextEra, season: nextSeason },
  });
}

export function projectGeography(state, { scope = "public" } = {}) {
  assertObject(state, "state");
  if (!["public", "debug"].includes(scope)) throw new GeographyValidationError(`unsupported projection scope: ${scope}`);
  return {
    schemaVersion: GEOGRAPHY_SCHEMA_VERSION,
    worldId: state.worldId,
    simulationDate: state.simulationDate,
    era: state.era,
    season: state.season,
    regions: Object.values(state.regions).map((region) => ({
      id: region.id,
      publicLabel: region.publicLabel,
      role: region.role,
      cityOrArea: region.cityOrArea,
      socialLayers: [...region.socialLayers],
      architecture: [...region.architecture],
      simulationMode: region.simulationMode,
      seasonBand: region.seasonBand,
      memoryCount: region.memory.filter((memory) => memory.visibility !== "private").length,
      ageBand: band(region.ageDays >= 3650 ? 100 : region.ageDays / 36.5),
      ...(scope === "debug" ? { policeDomain: region.policeDomain, economyProfile: region.economyProfile, history: clone(region.history) } : {}),
    })),
    links: Object.values(state.links).map((link) => ({
      id: link.id,
      fromRegionId: link.fromRegionId,
      toRegionId: link.toRegionId,
      linkType: link.linkType,
      travelBand: band(100 - link.travelDays * 3 - link.baseFriction / 2),
      status: link.status,
      ...(scope === "debug" ? { exactTravelDays: link.travelDays, baseFriction: link.baseFriction, history: clone(link.history) } : {}),
    })),
    omittedFields: scope === "public" ? ["policeDomain", "economyProfile", "privateMemory", "exactTravelDays", "baseFriction", "event payload", "lastEventHash"] : [],
  };
}

export function snapshotGeography(state) { return { snapshotVersion: 1, state: clone(state) }; }

export function restoreGeography(snapshotValue) {
  if (!snapshotValue || snapshotValue.snapshotVersion !== 1) throw new GeographyValidationError("unsupported geography snapshot version");
  const state = clone(snapshotValue.state);
  if (!state || state.schemaVersion !== GEOGRAPHY_SCHEMA_VERSION) throw new GeographyValidationError("unsupported geography schema version");
  let revision = 0;
  let previousHash = null;
  for (const event of state.events) {
    if (event.revision !== revision + 1) throw new GeographyValidationError("geography revisions are not contiguous");
    if (event.previousHash !== previousHash) throw new GeographyValidationError("geography event chain is broken");
    const { hash, ...unsignedEvent } = event;
    if (hash !== eventHash(unsignedEvent, event.previousHash)) throw new GeographyValidationError("geography event hash is invalid");
    revision = event.revision;
    previousHash = event.hash;
  }
  if (state.revision !== revision || state.lastEventHash !== previousHash) throw new GeographyValidationError("geography snapshot does not match history");
  return state;
}
