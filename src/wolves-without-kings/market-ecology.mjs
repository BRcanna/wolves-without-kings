import { createHash } from "node:crypto";

import { canonicalJson } from "./engine.mjs";

export const MARKET_ECOLOGY_SCHEMA_VERSION = 1;

export class MarketEcologyValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "MarketEcologyValidationError";
  }
}

export class MarketEcologyStaleRevisionError extends MarketEcologyValidationError {
  constructor(expectedRevision, actualRevision) {
    super(`stale market-ecology command: expected revision ${expectedRevision}, actual revision ${actualRevision}`);
    this.name = "MarketEcologyStaleRevisionError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

function clone(value) { return structuredClone(value); }
function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
function band(value) { return value >= 70 ? "high" : value >= 35 ? "moderate" : "low"; }

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new MarketEcologyValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new MarketEcologyValidationError(`${field} must be an integer between ${minimum} and ${maximum}`);
}

function assertRange(value, field, minimum = 0, maximum = 100) { assertInteger(value, field, minimum, maximum); }

function assertDate(value, field) {
  assertNonEmpty(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())) throw new MarketEcologyValidationError(`${field} must be an ISO date`);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function eventHash(event, previousHash) {
  return createHash("sha256").update(`${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`).digest("hex");
}

function priceFor(market) {
  const pressure = market.demand - market.supply;
  const midpoint = Math.max(1, Math.round(market.basePrice * (
    1 + pressure / 100 + market.transportCost / 100 + market.legalPressure / 200 + market.factionControl / 200 + market.ecologicalPressure / 300
  )));
  const spread = Math.max(1, Math.round(midpoint * (10 + market.volatility) / 100));
  return { low: Math.max(1, midpoint - spread), high: midpoint + spread, midpoint, confidence: Math.max(0, 100 - market.volatility - Math.abs(pressure)) };
}

function assertRevision(state, expectedRevision) {
  assertInteger(expectedRevision, "expectedRevision");
  if (expectedRevision !== state.revision) throw new MarketEcologyStaleRevisionError(expectedRevision, state.revision);
}

function appendEvent(state, { eventType, actorId = "system:market-ecology", subjectIds = [], payload = {} }) {
  const next = clone(state);
  const unsignedEvent = {
    eventId: `market-ecology-${String(next.nextEventId).padStart(6, "0")}`,
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

function requireMarket(state, marketId) {
  assertNonEmpty(marketId, "marketId");
  const market = state.markets[marketId];
  if (!market) throw new MarketEcologyValidationError(`unknown market: ${marketId}`);
  return market;
}

export function createMarketEcologyState({ worldId = "wwk-market-ecology", simulationDate = "1998-01-01" } = {}) {
  assertNonEmpty(worldId, "worldId");
  assertDate(simulationDate, "simulationDate");
  return {
    schemaVersion: MARKET_ECOLOGY_SCHEMA_VERSION,
    worldId,
    simulationDate,
    revision: 0,
    nextEventId: 1,
    lastEventHash: null,
    markets: {},
    links: {},
    events: [],
  };
}

export function registerEcologyMarket(
  state,
  {
    expectedRevision,
    marketId,
    regionId,
    commodity,
    basePrice = 100,
    supply = 50,
    demand = 50,
    inventory = 100,
    volatility = 15,
    transportCost = 20,
    legalPressure = 20,
    factionControl = 20,
    ecologicalPressure = 10,
    resilience = 50,
  },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(marketId, "marketId");
  assertNonEmpty(regionId, "regionId");
  assertNonEmpty(commodity, "commodity");
  assertInteger(basePrice, "basePrice", 1, 10000);
  for (const [field, value] of Object.entries({ supply, demand, volatility, transportCost, legalPressure, factionControl, ecologicalPressure, resilience })) assertRange(value, field);
  assertInteger(inventory, "inventory", 0, 10000);
  if (state.markets[marketId]) throw new MarketEcologyValidationError(`market already exists: ${marketId}`);
  const market = {
    id: marketId,
    regionId,
    commodity,
    basePrice,
    supply,
    demand,
    inventory,
    volatility,
    transportCost,
    legalPressure,
    factionControl,
    ecologicalPressure,
    resilience,
    shockHistory: [],
    lastSettledDate: state.simulationDate,
  };
  const next = clone(state);
  next.markets[marketId] = market;
  return appendEvent(next, { eventType: "market.registered", subjectIds: [marketId, regionId], payload: { market: clone(market) } });
}

export function connectEcologyMarkets(
  state,
  { expectedRevision, linkId, fromMarketId, toMarketId, capacity = 20, friction = 30, latencyDays = 2 },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(linkId, "linkId");
  const from = requireMarket(state, fromMarketId);
  const to = requireMarket(state, toMarketId);
  if (fromMarketId === toMarketId) throw new MarketEcologyValidationError("market link endpoints must differ");
  assertRange(capacity, "capacity");
  assertRange(friction, "friction");
  assertInteger(latencyDays, "latencyDays", 1, 30);
  if (state.links[linkId]) throw new MarketEcologyValidationError(`market link already exists: ${linkId}`);
  const link = { id: linkId, fromMarketId, toMarketId, capacity, friction, latencyDays, status: friction >= 80 ? "restricted" : "open", history: [{ date: state.simulationDate, type: "created" }] };
  const next = clone(state);
  next.links[linkId] = link;
  return appendEvent(next, { eventType: "market.link_connected", subjectIds: [linkId, from.id, to.id], payload: { link: clone(link) } });
}

export function applyMarketEcologyShock(
  state,
  { expectedRevision, marketId, source, sink = "market-shock", supplyDelta = 0, demandDelta = 0, inventoryDelta = 0, ecologicalDelta = 0, legalDelta = 0 },
) {
  assertRevision(state, expectedRevision);
  const market = requireMarket(state, marketId);
  assertNonEmpty(source, "source");
  assertNonEmpty(sink, "sink");
  for (const [field, value] of Object.entries({ supplyDelta, demandDelta, ecologicalDelta, legalDelta })) assertInteger(value, field, -100, 100);
  assertInteger(inventoryDelta, "inventoryDelta", -1000, 1000);
  const next = clone(state);
  const changed = next.markets[marketId];
  changed.supply = clamp(changed.supply + supplyDelta, 0, 100);
  changed.demand = clamp(changed.demand + demandDelta, 0, 100);
  changed.inventory = clamp(changed.inventory + inventoryDelta, 0, 10000);
  changed.ecologicalPressure = clamp(changed.ecologicalPressure + ecologicalDelta, 0, 100);
  changed.legalPressure = clamp(changed.legalPressure + legalDelta, 0, 100);
  changed.shockHistory.push({ source, sink, date: state.simulationDate, supplyDelta, demandDelta, inventoryDelta, ecologicalDelta, legalDelta });
  return appendEvent(next, { eventType: "market.shock_applied", subjectIds: [marketId], payload: { source, sink, deltas: { supplyDelta, demandDelta, inventoryDelta, ecologicalDelta, legalDelta } } });
}

export function settleMarketEcology(state, { expectedRevision, days, seasonalDemandShift = 0, actorId = "system:market-time" }) {
  assertRevision(state, expectedRevision);
  assertInteger(days, "days", 1, 3650);
  assertInteger(seasonalDemandShift, "seasonalDemandShift", -30, 30);
  const nextDate = addDays(state.simulationDate, days);
  const next = clone(state);
  const flows = [];
  for (const market of Object.values(next.markets)) {
    market.demand = clamp(market.demand + seasonalDemandShift, 0, 100);
    const recovery = Math.max(0, Math.floor((market.resilience * days) / 365));
    market.ecologicalPressure = clamp(market.ecologicalPressure - recovery, 0, 100);
    market.inventory = clamp(market.inventory + Math.floor((market.supply * days) / 365), 0, 10000);
    market.lastSettledDate = nextDate;
  }
  for (const link of Object.values(next.links)) {
    if (link.status !== "open") continue;
    const source = next.markets[link.fromMarketId];
    const target = next.markets[link.toMarketId];
    const gap = Math.max(0, target.demand - target.supply);
    const available = Math.max(0, source.inventory - Math.floor(source.demand / 2));
    const transfer = Math.min(available, gap, Math.max(1, Math.floor((link.capacity * days) / (30 + link.friction))));
    if (transfer === 0) continue;
    source.inventory -= transfer;
    target.inventory += transfer;
    target.supply = clamp(target.supply + Math.floor(transfer / 5), 0, 100);
    flows.push({ linkId: link.id, fromMarketId: source.id, toMarketId: target.id, transfer });
    link.history.push({ date: nextDate, type: "bounded-flow", transfer });
  }
  return appendEvent(next, { eventType: "market.time_settled", actorId, subjectIds: [state.worldId], payload: { fromDate: state.simulationDate, toDate: nextDate, days, flows } });
}

export function projectMarketEcology(state, { scope = "public" } = {}) {
  if (!["public", "debug"].includes(scope)) throw new MarketEcologyValidationError(`unsupported market projection scope: ${scope}`);
  return {
    schemaVersion: MARKET_ECOLOGY_SCHEMA_VERSION,
    worldId: state.worldId,
    simulationDate: state.simulationDate,
    markets: Object.values(state.markets).map((market) => ({
      id: market.id,
      regionId: market.regionId,
      commodity: market.commodity,
      priceBand: band(priceFor(market).midpoint),
      supplyBand: band(market.supply),
      demandBand: band(market.demand),
      inventoryBand: band(clamp(market.inventory / 10, 0, 100)),
      ecologicalPressureBand: band(market.ecologicalPressure),
      confidenceBand: band(priceFor(market).confidence),
      ...(scope === "debug" ? { exactPrice: priceFor(market), shockHistory: clone(market.shockHistory) } : {}),
    })),
    links: Object.values(state.links).map((link) => ({ id: link.id, status: link.status, capacityBand: band(link.capacity), latencyBand: band(100 - link.latencyDays * 4), ...(scope === "debug" ? { exactCapacity: link.capacity, history: clone(link.history) } : {}) })),
    omittedFields: scope === "public" ? ["exact supply", "exact demand", "exact inventory", "legal pressure", "faction control", "shock history", "event hashes"] : [],
  };
}

export function snapshotMarketEcology(state) { return { snapshotVersion: 1, state: clone(state) }; }

export function restoreMarketEcology(snapshotValue) {
  if (!snapshotValue || snapshotValue.snapshotVersion !== 1) throw new MarketEcologyValidationError("unsupported market-ecology snapshot version");
  const state = clone(snapshotValue.state);
  if (!state || state.schemaVersion !== MARKET_ECOLOGY_SCHEMA_VERSION) throw new MarketEcologyValidationError("unsupported market-ecology schema version");
  let revision = 0;
  let previousHash = null;
  for (const event of state.events) {
    if (event.revision !== revision + 1) throw new MarketEcologyValidationError("market-ecology revisions are not contiguous");
    if (event.previousHash !== previousHash) throw new MarketEcologyValidationError("market-ecology event chain is broken");
    const { hash, ...unsignedEvent } = event;
    if (hash !== eventHash(unsignedEvent, event.previousHash)) throw new MarketEcologyValidationError("market-ecology event hash is invalid");
    revision = event.revision;
    previousHash = event.hash;
  }
  if (state.revision !== revision || state.lastEventHash !== previousHash) throw new MarketEcologyValidationError("market-ecology snapshot does not match history");
  return state;
}
