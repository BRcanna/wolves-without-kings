import { createHash } from "node:crypto";

import { canonicalJson } from "./engine.mjs";
import {
  connectGeographyRegions,
  createGeographyState,
  projectGeography,
  registerGeographyRegion,
  restoreGeography,
  settleGeographyTime,
  snapshotGeography,
} from "./geography.mjs";
import {
  applyMarketEcologyShock,
  connectEcologyMarkets,
  createMarketEcologyState,
  projectMarketEcology,
  registerEcologyMarket,
  restoreMarketEcology,
  settleMarketEcology,
  snapshotMarketEcology,
} from "./market-ecology.mjs";
import {
  createLogisticsState,
  createRoute,
  executeTransit,
  planTransit,
  projectLogistics,
  restoreLogistics,
  settleLogisticsTime,
  snapshotLogistics,
} from "./logistics.mjs";
import {
  claimProperty,
  createUnderworldState,
  joinPlayerSession,
  leavePlayerSession,
  projectUnderworld,
  queueOrganizationWork,
  registerMarket,
  registerNpcBaseline,
  registerOrganization,
  registerProperty,
  restoreUnderworld,
  settleUnderworldWeek,
  snapshotUnderworld,
} from "./underworld.mjs";

export const REGIONAL_RUNTIME_SCHEMA_VERSION = 1;

export class RegionalRuntimeValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "RegionalRuntimeValidationError";
  }
}

export class RegionalRuntimeStaleRevisionError extends RegionalRuntimeValidationError {
  constructor(expectedRevision, actualRevision) {
    super(`stale regional-runtime command: expected revision ${expectedRevision}, actual revision ${actualRevision}`);
    this.name = "RegionalRuntimeStaleRevisionError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

function clone(value) { return structuredClone(value); }
function assertRevision(state, expectedRevision) {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw new RegionalRuntimeValidationError("expectedRevision must be a non-negative integer");
  if (expectedRevision !== state.revision) throw new RegionalRuntimeStaleRevisionError(expectedRevision, state.revision);
}
function eventHash(event, previousHash) {
  return createHash("sha256").update(`${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`).digest("hex");
}
function appendEvent(state, eventType, payload = {}) {
  const next = clone(state);
  const unsignedEvent = {
    eventId: `regional-runtime-${String(next.nextEventId).padStart(6, "0")}`,
    eventType,
    revision: next.revision + 1,
    simulationDate: next.simulationDate,
    actorId: "system:regional-runtime",
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

function buildGeography() {
  let state = createGeographyState({ worldId: "wwk-regional-runtime", simulationDate: "1999-01-01" });
  const regions = [
    ["region:capital", "Sofia Basin", "Capital Network", "capital", ["government", "estates", "nightlife"], ["estate", "industrial"]],
    ["region:coast", "Black Sea Corridor", "Coastal Network", "coastal", ["tourism", "port-work", "construction"], ["resort", "port-edge"]],
    ["region:rural", "North Valley Towns", "Rural Network", "rural", ["family-business", "agriculture"], ["village", "warehouse"]],
    ["region:mountain", "Mountain Pass Country", "Mountain Network", "mountain", ["seasonal-work", "old-families"], ["stone", "forest-edge"]],
  ];
  for (const [regionId, cityOrArea, publicLabel, role, socialLayers, architecture] of regions) {
    state = registerGeographyRegion(state, {
      expectedRevision: state.revision,
      regionId,
      cityOrArea,
      publicLabel: `${publicLabel} (fictionalized)`,
      role,
      socialLayers,
      architecture,
      policeDomain: `${role}-domain-fictional`,
      economyProfile: `${role}-mixed-fictional`,
      simulationMode: regionId === "region:capital" ? "full" : "aggregate",
    });
  }
  state = connectGeographyRegions(state, { expectedRevision: state.revision, linkId: "link:capital-coast", fromRegionId: "region:capital", toRegionId: "region:coast", linkType: "rail", travelDays: 2, baseFriction: 40 });
  state = connectGeographyRegions(state, { expectedRevision: state.revision, linkId: "link:rural-mountain", fromRegionId: "region:rural", toRegionId: "region:mountain", linkType: "road", travelDays: 3, baseFriction: 70 });
  return state;
}

function buildMarkets() {
  let state = createMarketEcologyState({ worldId: "wwk-regional-runtime", simulationDate: "1999-01-01" });
  state = registerEcologyMarket(state, { expectedRevision: state.revision, marketId: "market:capital", regionId: "region:capital", commodity: "nightlife-demand", supply: 70, demand: 45, inventory: 180, resilience: 65 });
  state = registerEcologyMarket(state, { expectedRevision: state.revision, marketId: "market:coast", regionId: "region:coast", commodity: "seasonal-hospitality", supply: 35, demand: 70, inventory: 40, resilience: 35 });
  state = connectEcologyMarkets(state, { expectedRevision: state.revision, linkId: "link:capital-coast-market", fromMarketId: "market:capital", toMarketId: "market:coast", capacity: 30, friction: 35, latencyDays: 3 });
  return state;
}

function buildLogistics() {
  let state = createLogisticsState({ simulationDate: "1999-01-01", regionId: "region:capital" });
  return createRoute(state, {
    expectedRevision: state.revision,
    routeId: "route:capital-coast-fictional",
    segments: ["urban", "corridor", "coastal"],
    accessRequirements: ["regional-familiarity"],
    travelTimeHours: 18,
    weatherCost: 10,
    hazardCost: 15,
    borderState: "open",
    contacts: ["contact:regional-fictional"],
    coverBusiness: "business:regional-transport-fictional",
    fallbacks: ["route:river-alternate-fictional"],
  });
}

function buildUnderworld() {
  let state = createUnderworldState({ shardId: "shard:regional-runtime", serverEra: "1999-Q1-fictional" });
  state = registerOrganization(state, { expectedRevision: state.revision, orgId: "organization:lanterns", headquartersRegionId: "region:capital" });
  state = registerOrganization(state, { expectedRevision: state.revision, orgId: "organization:rivals", headquartersRegionId: "region:coast" });
  state = registerMarket(state, { expectedRevision: state.revision, marketId: "market:shared-vehicle-demand", regionId: "region:coast", commodityClass: "vehicle-demand" });
  state = registerNpcBaseline(state, { expectedRevision: state.revision, regionId: "region:coast", populationBand: "high", liquidity: 80 });
  state = registerProperty(state, { expectedRevision: state.revision, propertyId: "property:coastal-warehouse", regionId: "region:coast", ownerOrgId: "organization:lanterns" });
  state = queueOrganizationWork(state, { expectedRevision: state.revision, orgId: "organization:lanterns", workId: "work:regional-transport", requiredRole: "logistics" });
  state = queueOrganizationWork(state, { expectedRevision: state.revision, orgId: "organization:rivals", workId: "work:regional-market", requiredRole: "market" });
  return state;
}

export function createRegionalRuntime() {
  return appendEvent({
    schemaVersion: REGIONAL_RUNTIME_SCHEMA_VERSION,
    runtimeId: "wwk-regional-runtime",
    simulationDate: "1999-01-01",
    revision: 0,
    nextEventId: 1,
    lastEventHash: null,
    geography: buildGeography(),
    markets: buildMarkets(),
    logistics: buildLogistics(),
    underworld: buildUnderworld(),
    events: [],
  }, "regional_runtime.created", { regionCount: 4, marketCount: 2, organizationCount: 2 });
}

export function joinRegionalSession(state, { expectedRevision, sessionId, characterId, regionId }) {
  assertRevision(state, expectedRevision);
  const next = clone(state);
  next.underworld = joinPlayerSession(next.underworld, { expectedRevision: next.underworld.revision, sessionId, characterId, regionId });
  return appendEvent(next, "regional_runtime.session_joined", { sessionId, characterId, regionId, underworldRevision: next.underworld.revision });
}

export function applyRegionalPropertyConflict(state, { expectedRevision, propertyId, orgId }) {
  assertRevision(state, expectedRevision);
  const next = clone(state);
  next.underworld = claimProperty(next.underworld, { expectedRevision: next.underworld.revision, propertyId, orgId });
  return appendEvent(next, "regional_runtime.property_contested", { propertyId, orgId, underworldRevision: next.underworld.revision });
}

export function settleRegionalSeason(state, { expectedRevision, days = 180 } = {}) {
  assertRevision(state, expectedRevision);
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new RegionalRuntimeValidationError("days must be an integer between 1 and 365");
  let next = clone(state);
  next.geography = settleGeographyTime(next.geography, { expectedRevision: next.geography.revision, days });
  next.markets = applyMarketEcologyShock(next.markets, { expectedRevision: next.markets.revision, marketId: "market:coast", source: "seasonal-coastal-shift", sink: "regional-hospitality", supplyDelta: -10, demandDelta: 15, inventoryDelta: -12, ecologicalDelta: 5 });
  next.markets = settleMarketEcology(next.markets, { expectedRevision: next.markets.revision, days, seasonalDemandShift: 8 });
  next.logistics = planTransit(next.logistics, { expectedRevision: next.logistics.revision, routeId: "route:capital-coast-fictional", cargoClass: "fictional-regional-goods", familiarity: 70, vehicleFit: 60, contactReliability: 80 });
  next.logistics = executeTransit(next.logistics, { expectedRevision: next.logistics.revision, planId: "plan-000001", choice: "proceed" });
  next.logistics = settleLogisticsTime(next.logistics, { expectedRevision: next.logistics.revision, days });
  for (let week = 0; week < Math.floor(days / 7); week += 1) {
    next.underworld = settleUnderworldWeek(next.underworld, {
      expectedRevision: next.underworld.revision,
      marketShocks: week === 0 ? { "market:shared-vehicle-demand": 20 } : {},
      organizationOutcomes: week === 0 ? { "organization:lanterns": { completedWorkIds: ["work:regional-transport"] } } : {},
      physicalSessions: week === 0 ? [{ sessionId: "session:regional-physical", regionId: "region:coast", participantCount: 3, outcome: "completed" }] : [],
    });
  }
  next.simulationDate = next.geography.simulationDate;
  return appendEvent(next, "regional_runtime.season_settled", {
    days,
    simulationDate: next.simulationDate,
    geographyRevision: next.geography.revision,
    marketRevision: next.markets.revision,
    logisticsRevision: next.logistics.revision,
    underworldRevision: next.underworld.revision,
  });
}

export function leaveRegionalSession(state, { expectedRevision, sessionId, reason = "season-end-disconnect" }) {
  assertRevision(state, expectedRevision);
  const next = clone(state);
  next.underworld = leavePlayerSession(next.underworld, { expectedRevision: next.underworld.revision, sessionId, reason });
  return appendEvent(next, "regional_runtime.session_left", { sessionId, reason, underworldRevision: next.underworld.revision });
}

export function projectRegionalRuntime(state) {
  return {
    schemaVersion: REGIONAL_RUNTIME_SCHEMA_VERSION,
    runtimeId: state.runtimeId,
    simulationDate: state.simulationDate,
    revision: state.revision,
    geography: projectGeography(state.geography, { scope: "public" }),
    markets: projectMarketEcology(state.markets, { scope: "public" }),
    logistics: projectLogistics(state.logistics),
    underworld: projectUnderworld(state.underworld),
    omittedFields: ["coordinator events", "exact transport contacts", "private organization work", "player session identity", "event hashes"],
  };
}

export function snapshotRegionalRuntime(state) {
  return {
    snapshotVersion: 1,
    state: {
      ...clone(state),
      geography: snapshotGeography(state.geography),
      markets: snapshotMarketEcology(state.markets),
      logistics: snapshotLogistics(state.logistics),
      underworld: snapshotUnderworld(state.underworld),
    },
  };
}

export function restoreRegionalRuntime(snapshotValue) {
  if (!snapshotValue || snapshotValue.snapshotVersion !== 1) throw new RegionalRuntimeValidationError("unsupported regional runtime snapshot version");
  const state = clone(snapshotValue.state);
  if (!state || state.schemaVersion !== REGIONAL_RUNTIME_SCHEMA_VERSION) throw new RegionalRuntimeValidationError("unsupported regional runtime schema version");
  state.geography = restoreGeography(state.geography);
  state.markets = restoreMarketEcology(state.markets);
  state.logistics = restoreLogistics(state.logistics);
  state.underworld = restoreUnderworld(state.underworld);
  let revision = 0;
  let previousHash = null;
  for (const event of state.events) {
    if (event.revision !== revision + 1) throw new RegionalRuntimeValidationError("regional runtime revisions are not contiguous");
    if (event.previousHash !== previousHash) throw new RegionalRuntimeValidationError("regional runtime event chain is broken");
    const { hash, ...unsignedEvent } = event;
    if (hash !== eventHash(unsignedEvent, event.previousHash)) throw new RegionalRuntimeValidationError("regional runtime event hash is invalid");
    revision = event.revision;
    previousHash = event.hash;
  }
  if (state.revision !== revision || state.lastEventHash !== previousHash) throw new RegionalRuntimeValidationError("regional runtime snapshot does not match history");
  return state;
}
