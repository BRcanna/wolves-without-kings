import { createHash } from "node:crypto";

import { canonicalJson } from "./engine.mjs";

export const UNDERWORLD_SCHEMA_VERSION = 1;

export class UnderworldValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnderworldValidationError";
  }
}

export class UnderworldStaleRevisionError extends UnderworldValidationError {
  constructor(expectedRevision, actualRevision) {
    super(`stale Underworld command: expected revision ${expectedRevision}, actual revision ${actualRevision}`);
    this.name = "UnderworldStaleRevisionError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

function clone(value) {
  return structuredClone(value);
}

function assertObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new UnderworldValidationError(`${field} must be an object`);
}

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new UnderworldValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new UnderworldValidationError(`${field} must be an integer between ${minimum} and ${maximum}`);
  }
}

function assertArrayOfStrings(value, field) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new UnderworldValidationError(`${field} must be an array of non-empty strings`);
  }
}

function assertRevision(state, expectedRevision) {
  assertInteger(expectedRevision, "expectedRevision");
  if (expectedRevision !== state.revision) throw new UnderworldStaleRevisionError(expectedRevision, state.revision);
}

function bounded(value) {
  return Math.max(0, Math.min(100, value));
}

function pressureBand(value) {
  return value >= 70 ? "high" : value >= 35 ? "moderate" : "low";
}

function eventHash(event, previousHash) {
  const material = `${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`;
  return createHash("sha256").update(material).digest("hex");
}

function appendEvent(state, { eventType, actorId = "system:underworld", subjectIds = [], payload = {} }) {
  const next = clone(state);
  const unsignedEvent = {
    eventId: `uw-${String(next.nextEventId).padStart(6, "0")}`,
    eventType,
    revision: next.revision + 1,
    serverTick: next.serverTick,
    serverWeek: next.serverWeek,
    actorId,
    subjectIds: [...subjectIds],
    payload: clone(payload),
    previousHash: next.lastEventHash,
  };
  const event = {
    ...unsignedEvent,
    hash: eventHash(unsignedEvent, unsignedEvent.previousHash),
  };
  next.events.push(event);
  next.nextEventId += 1;
  next.revision = event.revision;
  next.lastEventHash = event.hash;
  return next;
}

function requireOrganization(state, orgId) {
  assertNonEmpty(orgId, "orgId");
  const organization = state.organizations[orgId];
  if (!organization) throw new UnderworldValidationError(`unknown organization: ${orgId}`);
  return organization;
}

function requireMarket(state, marketId) {
  assertNonEmpty(marketId, "marketId");
  const market = state.markets[marketId];
  if (!market) throw new UnderworldValidationError(`unknown market: ${marketId}`);
  return market;
}

function requireProperty(state, propertyId) {
  assertNonEmpty(propertyId, "propertyId");
  const property = state.properties[propertyId];
  if (!property) throw new UnderworldValidationError(`unknown property: ${propertyId}`);
  return property;
}

export function createUnderworldState({ shardId = "shard:sofia-coast", serverEra = "1999-Q1" } = {}) {
  assertNonEmpty(shardId, "shardId");
  assertNonEmpty(serverEra, "serverEra");
  return {
    schemaVersion: UNDERWORLD_SCHEMA_VERSION,
    shardId,
    serverEra,
    serverWeek: 0,
    serverTick: 0,
    revision: 0,
    nextEventId: 1,
    lastEventHash: null,
    organizations: {},
    markets: {},
    properties: {},
    territoryClaims: {},
    playerCharacters: {},
    playerSessions: {},
    npcPopulation: {},
    marketInfluenceLedger: {},
    seasonHistory: [],
    physicalSessions: {},
    events: [],
  };
}

export function registerOrganization(
  state,
  { expectedRevision, orgId, headquartersRegionId, roleCapacity = 8 },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(orgId, "orgId");
  assertNonEmpty(headquartersRegionId, "headquartersRegionId");
  assertInteger(roleCapacity, "roleCapacity", 1, 100);
  if (state.organizations[orgId]) throw new UnderworldValidationError(`organization already exists: ${orgId}`);
  const next = clone(state);
  next.organizations[orgId] = {
    id: orgId,
    headquartersRegionId,
    roleCapacity,
    workItems: {},
    offlineWeeks: 0,
    completedWorkCount: 0,
    history: [{ type: "created", week: state.serverWeek }],
  };
  return appendEvent(next, {
    eventType: "underworld.organization_registered",
    actorId: orgId,
    subjectIds: [orgId],
    payload: { orgId, headquartersRegionId, roleCapacity },
  });
}

export function registerMarket(
  state,
  { expectedRevision, marketId, regionId, commodityClass, baseIndex = 100, pressure = 50, npcBaselineLiquidity = 70 },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(marketId, "marketId");
  assertNonEmpty(regionId, "regionId");
  if (!["vehicle-demand", "nightlife-demand", "legitimate-goods"].includes(commodityClass)) {
    throw new UnderworldValidationError(`unsupported shared commodity class: ${commodityClass}`);
  }
  assertInteger(baseIndex, "baseIndex", 1, 1000);
  assertInteger(pressure, "pressure", 0, 100);
  assertInteger(npcBaselineLiquidity, "npcBaselineLiquidity", 1, 100);
  if (state.markets[marketId]) throw new UnderworldValidationError(`market already exists: ${marketId}`);
  const next = clone(state);
  next.markets[marketId] = {
    id: marketId,
    regionId,
    commodityClass,
    baseIndex,
    pressure,
    index: baseIndex,
    npcBaselineLiquidity,
    history: [{ week: state.serverWeek, pressure, index: baseIndex }],
  };
  return appendEvent(next, {
    eventType: "underworld.market_registered",
    subjectIds: [marketId, regionId],
    payload: { marketId, regionId, commodityClass, baseIndex },
  });
}

export function registerNpcBaseline(
  state,
  { expectedRevision, regionId, populationBand = "moderate", liquidity = 70 },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(regionId, "regionId");
  assertNonEmpty(populationBand, "populationBand");
  assertInteger(liquidity, "liquidity", 1, 100);
  if (state.npcPopulation[regionId]) throw new UnderworldValidationError(`NPC baseline already exists: ${regionId}`);
  const next = clone(state);
  next.npcPopulation[regionId] = {
    regionId,
    populationBand,
    liquidity,
    history: [{ week: state.serverWeek, liquidity }],
  };
  return appendEvent(next, {
    eventType: "underworld.npc_baseline_registered",
    subjectIds: [regionId],
    payload: { regionId, populationBand, liquidity },
  });
}

export function joinPlayerSession(
  state,
  { expectedRevision, sessionId, characterId, regionId },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(sessionId, "sessionId");
  assertNonEmpty(characterId, "characterId");
  assertNonEmpty(regionId, "regionId");
  if (state.playerSessions[sessionId]?.status === "active") throw new UnderworldValidationError(`session already active: ${sessionId}`);
  if (state.playerCharacters[characterId]?.status === "active") throw new UnderworldValidationError(`character already active: ${characterId}`);
  if (Object.values(state.playerSessions).filter((session) => session.status === "active").length >= 64) throw new UnderworldValidationError("shard active session cap reached");
  const next = clone(state);
  next.playerCharacters[characterId] = { id: characterId, regionId, sessionId, status: "active", joinedWeek: state.serverWeek };
  next.playerSessions[sessionId] = { sessionId, characterId, regionId, status: "active", joinedWeek: state.serverWeek };
  return appendEvent(next, {
    eventType: "underworld.player_joined",
    actorId: characterId,
    subjectIds: [sessionId, characterId, regionId],
    payload: { sessionId, characterId, regionId },
  });
}

export function leavePlayerSession(
  state,
  { expectedRevision, sessionId, reason = "disconnect" },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(sessionId, "sessionId");
  assertNonEmpty(reason, "reason");
  const session = state.playerSessions[sessionId];
  if (!session || session.status !== "active") throw new UnderworldValidationError(`session is not active: ${sessionId}`);
  const next = clone(state);
  next.playerSessions[sessionId].status = "offline";
  next.playerSessions[sessionId].leftWeek = state.serverWeek;
  next.playerSessions[sessionId].reason = reason;
  next.playerCharacters[session.characterId].status = "offline";
  return appendEvent(next, {
    eventType: "underworld.player_left",
    actorId: session.characterId,
    subjectIds: [sessionId, session.characterId],
    payload: { sessionId, reason, propertySurvival: "unchanged" },
  });
}

export function applyPlayerMarketInfluence(
  state,
  { expectedRevision, sessionId, marketId, pressureDelta },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(sessionId, "sessionId");
  const session = state.playerSessions[sessionId];
  if (!session || session.status !== "active") throw new UnderworldValidationError(`session is not active: ${sessionId}`);
  const market = requireMarket(state, marketId);
  assertInteger(pressureDelta, "pressureDelta", -50, 50);
  const ledger = state.marketInfluenceLedger[marketId]?.week === state.serverWeek
    ? state.marketInfluenceLedger[marketId]
    : { week: state.serverWeek, appliedDelta: 0, contributorCount: 0 };
  const remaining = 10 - Math.abs(ledger.appliedDelta);
  const appliedDelta = Math.sign(pressureDelta) * Math.min(Math.abs(pressureDelta), Math.max(0, remaining));
  if (appliedDelta === 0) throw new UnderworldValidationError(`player market influence cap reached: ${marketId}`);
  const next = clone(state);
  const nextMarket = next.markets[marketId];
  nextMarket.pressure = bounded(nextMarket.pressure + appliedDelta);
  nextMarket.index = Math.max(1, Math.round(nextMarket.baseIndex * (0.6 + nextMarket.pressure / 100)));
  nextMarket.history.push({ week: state.serverWeek, pressure: nextMarket.pressure, index: nextMarket.index, shock: appliedDelta, source: "player-capped" });
  next.marketInfluenceLedger[marketId] = { week: state.serverWeek, appliedDelta: ledger.appliedDelta + appliedDelta, contributorCount: ledger.contributorCount + 1 };
  return appendEvent(next, {
    eventType: "underworld.player_market_influence",
    actorId: session.characterId,
    subjectIds: [sessionId, marketId],
    payload: { requestedDelta: pressureDelta, appliedDelta, weeklyCap: 10, npcBaselineLiquidity: market.npcBaselineLiquidity },
  });
}

export function registerProperty(
  state,
  { expectedRevision, propertyId, regionId, propertyType = "business-site", ownerOrgId = null },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(propertyId, "propertyId");
  assertNonEmpty(regionId, "regionId");
  assertNonEmpty(propertyType, "propertyType");
  if (ownerOrgId !== null) requireOrganization(state, ownerOrgId);
  if (state.properties[propertyId]) throw new UnderworldValidationError(`property already exists: ${propertyId}`);
  const next = clone(state);
  next.properties[propertyId] = {
    id: propertyId,
    regionId,
    propertyType,
    ownerOrgId,
    status: ownerOrgId ? "held" : "unclaimed",
    history: [{ type: "created", week: state.serverWeek, ownerOrgId }],
  };
  return appendEvent(next, {
    eventType: "underworld.property_registered",
    actorId: ownerOrgId ?? "system:underworld",
    subjectIds: [propertyId, regionId],
    payload: { propertyId, regionId, propertyType, ownerOrgId },
  });
}

export function queueOrganizationWork(
  state,
  { expectedRevision, orgId, workId, requiredRole = "operator", offlineEligible = true },
) {
  assertRevision(state, expectedRevision);
  const organization = requireOrganization(state, orgId);
  assertNonEmpty(workId, "workId");
  assertNonEmpty(requiredRole, "requiredRole");
  if (typeof offlineEligible !== "boolean") throw new UnderworldValidationError("offlineEligible must be a boolean");
  if (organization.workItems[workId]) throw new UnderworldValidationError(`work item already exists: ${workId}`);
  const next = clone(state);
  next.organizations[orgId].workItems[workId] = {
    id: workId,
    requiredRole,
    offlineEligible,
    status: "queued",
    progressWeeks: 0,
    lastSettledWeek: state.serverWeek,
  };
  return appendEvent(next, {
    eventType: "underworld.work_queued",
    actorId: orgId,
    subjectIds: [orgId, workId],
    payload: { orgId, workId, requiredRole, offlineEligible },
  });
}

export function claimProperty(state, { expectedRevision, propertyId, orgId }) {
  assertRevision(state, expectedRevision);
  const property = requireProperty(state, propertyId);
  requireOrganization(state, orgId);
  if (property.ownerOrgId === orgId) throw new UnderworldValidationError(`organization already owns property: ${propertyId}`);
  const next = clone(state);
  if (property.ownerOrgId === null) {
    next.properties[propertyId].ownerOrgId = orgId;
    next.properties[propertyId].status = "held";
    next.properties[propertyId].history.push({ type: "claimed", week: state.serverWeek, orgId });
  } else {
    next.properties[propertyId].status = "contested";
    next.territoryClaims[propertyId] = {
      propertyId,
      claimants: [...new Set([property.ownerOrgId, orgId])],
      status: "contested",
      openedWeek: state.serverWeek,
    };
    next.properties[propertyId].history.push({ type: "contested", week: state.serverWeek, orgId });
  }
  return appendEvent(next, {
    eventType: "underworld.property_claimed",
    actorId: orgId,
    subjectIds: [propertyId, orgId],
    payload: { propertyId, orgId, status: next.properties[propertyId].status },
  });
}

export function settleUnderworldWeek(
  state,
  {
    expectedRevision,
    marketShocks = {},
    organizationOutcomes = {},
    physicalSessions = [],
  },
) {
  assertRevision(state, expectedRevision);
  assertObject(marketShocks, "marketShocks");
  assertObject(organizationOutcomes, "organizationOutcomes");
  if (!Array.isArray(physicalSessions) || physicalSessions.length > 16) {
    throw new UnderworldValidationError("physicalSessions must contain at most 16 bounded sessions");
  }
  const sessionIds = new Set();
  for (const session of physicalSessions) {
    assertObject(session, "physicalSessions[]");
    assertNonEmpty(session.sessionId, "physicalSessions[].sessionId");
    assertNonEmpty(session.regionId, "physicalSessions[].regionId");
    assertInteger(session.participantCount, "physicalSessions[].participantCount", 1, 8);
    if (!["completed", "interrupted", "disconnected"].includes(session.outcome)) {
      throw new UnderworldValidationError(`unsupported physical session outcome: ${session.outcome}`);
    }
    if (sessionIds.has(session.sessionId)) throw new UnderworldValidationError(`duplicate physical session: ${session.sessionId}`);
    sessionIds.add(session.sessionId);
    for (const forbidden of ["worldState", "guestWorld", "privatePayload", "rawEvents"]) {
      if (Object.hasOwn(session, forbidden)) throw new UnderworldValidationError(`physical session contains private field: ${forbidden}`);
    }
  }
  for (const [marketId, shock] of Object.entries(marketShocks)) {
    requireMarket(state, marketId);
    assertInteger(shock, `marketShocks.${marketId}`, -50, 50);
  }
  const next = clone(state);
  next.serverWeek += 1;
  next.serverTick += 7;
  next.marketInfluenceLedger = {};
  const marketUpdates = [];
  for (const [marketId, market] of Object.entries(next.markets)) {
    const shock = marketShocks[marketId] ?? 0;
    const pressure = bounded(market.pressure + shock);
    const index = Math.max(1, Math.round(market.baseIndex * (0.6 + pressure / 100)));
    next.markets[marketId] = {
      ...market,
      pressure,
      index,
      history: [...market.history, { week: next.serverWeek, pressure, index, shock }],
    };
    marketUpdates.push({ marketId, pressure, index, shock });
  }
  const organizationUpdates = [];
  for (const [orgId, organization] of Object.entries(next.organizations)) {
    const outcome = organizationOutcomes[orgId] ?? {};
    if (Object.hasOwn(outcome, "completedWorkIds")) assertArrayOfStrings(outcome.completedWorkIds, `organizationOutcomes.${orgId}.completedWorkIds`);
    if (Object.hasOwn(outcome, "stalledWorkIds")) assertArrayOfStrings(outcome.stalledWorkIds, `organizationOutcomes.${orgId}.stalledWorkIds`);
    for (const item of Object.values(organization.workItems)) {
      if (!["queued", "active"].includes(item.status)) continue;
      const completed = (outcome.completedWorkIds ?? []).includes(item.id);
      const stalled = (outcome.stalledWorkIds ?? []).includes(item.id);
      next.organizations[orgId].workItems[item.id] = {
        ...item,
        status: completed ? "completed" : stalled ? "stalled" : item.offlineEligible ? "active" : "queued",
        progressWeeks: item.progressWeeks + (item.offlineEligible ? 1 : 0),
        lastSettledWeek: next.serverWeek,
      };
      if (completed) next.organizations[orgId].completedWorkCount += 1;
    }
    next.organizations[orgId].offlineWeeks += 1;
    organizationUpdates.push({
      orgId,
      offlineWeeks: next.organizations[orgId].offlineWeeks,
      completedWorkCount: next.organizations[orgId].completedWorkCount,
    });
  }
  for (const session of physicalSessions) {
    next.physicalSessions[session.sessionId] = {
      sessionId: session.sessionId,
      regionId: session.regionId,
      participantCount: session.participantCount,
      outcome: session.outcome,
      week: next.serverWeek,
    };
  }
  next.seasonHistory.push({
    week: next.serverWeek,
    marketUpdates,
    organizationUpdates,
    physicalSessionCount: physicalSessions.length,
  });
  return appendEvent(next, {
    eventType: "underworld.week_settled",
    subjectIds: [state.shardId],
    payload: {
      week: next.serverWeek,
      marketUpdates,
      organizationUpdates,
      physicalSessionCount: physicalSessions.length,
    },
  });
}

export function projectUnderworld(state) {
  return {
    schemaVersion: UNDERWORLD_SCHEMA_VERSION,
    shardId: state.shardId,
    serverEra: state.serverEra,
    serverWeek: state.serverWeek,
    markets: Object.values(state.markets).map((market) => ({
      id: market.id,
      regionId: market.regionId,
      commodityClass: market.commodityClass,
      pressureBand: pressureBand(market.pressure),
      indexBand: market.index >= 140 ? "high" : market.index >= 80 ? "moderate" : "low",
    })),
    npcBaselines: Object.values(state.npcPopulation).map((baseline) => ({ regionId: baseline.regionId, populationBand: baseline.populationBand, liquidityBand: pressureBand(baseline.liquidity) })),
    organizations: Object.values(state.organizations).map((organization) => ({
      id: organization.id,
      headquartersRegionId: organization.headquartersRegionId,
      offlineWeeks: organization.offlineWeeks,
      completedWorkCount: organization.completedWorkCount,
      activeWorkCount: Object.values(organization.workItems).filter((item) => item.status === "active").length,
    })),
    properties: Object.values(state.properties).map((property) => ({
      id: property.id,
      regionId: property.regionId,
      propertyType: property.propertyType,
      status: property.status,
    })),
    physicalSessionCount: Object.keys(state.physicalSessions).length,
    activePlayerCount: Object.values(state.playerSessions).filter((session) => session.status === "active").length,
    omittedFields: ["pressure", "index", "history", "playerCharacters", "playerSessions", "marketInfluenceLedger", "events", "lastEventHash"],
  };
}

export function snapshotUnderworld(state) {
  return { snapshotVersion: 1, state: clone(state) };
}

export function restoreUnderworld(snapshotValue) {
  if (!snapshotValue || snapshotValue.snapshotVersion !== 1) throw new UnderworldValidationError("unsupported Underworld snapshot version");
  const state = clone(snapshotValue.state);
  if (!state || state.schemaVersion !== UNDERWORLD_SCHEMA_VERSION) throw new UnderworldValidationError("unsupported Underworld schema version");
  let revision = 0;
  let previousHash = null;
  for (const event of state.events) {
    if (event.revision !== revision + 1) throw new UnderworldValidationError("Underworld revisions are not contiguous");
    if (event.previousHash !== previousHash) throw new UnderworldValidationError("Underworld event chain is broken");
    const { hash, ...unsignedEvent } = event;
    if (hash !== eventHash(unsignedEvent, event.previousHash)) throw new UnderworldValidationError("Underworld event hash is invalid");
    revision = event.revision;
    previousHash = event.hash;
  }
  if (state.revision !== revision || state.lastEventHash !== previousHash) throw new UnderworldValidationError("Underworld snapshot does not match history");
  return state;
}
