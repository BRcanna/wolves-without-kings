import { createHash } from "node:crypto";

import { canonicalJson } from "./engine.mjs";

export const DRUG_ECONOMY_SCHEMA_VERSION = 1;

export class DrugEconomyValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "DrugEconomyValidationError";
  }
}

export class DrugEconomyStaleRevisionError extends DrugEconomyValidationError {
  constructor(expectedRevision, actualRevision) {
    super(`stale drug-economy command: expected revision ${expectedRevision}, actual revision ${actualRevision}`);
    this.name = "DrugEconomyStaleRevisionError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

function clone(value) { return structuredClone(value); }

function assertObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new DrugEconomyValidationError(`${field} must be an object`);
}

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new DrugEconomyValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new DrugEconomyValidationError(`${field} must be an integer between ${minimum} and ${maximum}`);
}

function assertRange(value, field, minimum = 0, maximum = 100) { assertInteger(value, field, minimum, maximum); }

function assertRevision(state, expectedRevision) {
  assertInteger(expectedRevision, "expectedRevision");
  if (expectedRevision !== state.revision) throw new DrugEconomyStaleRevisionError(expectedRevision, state.revision);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function band(value) { return value >= 70 ? "high" : value >= 35 ? "moderate" : "low"; }

function priceBand(market) {
  const midpoint = Math.max(1, Math.round(market.basePrice * (1 + (market.demand - market.supply) / 100 + market.policePressure / 200)));
  return {
    low: Math.max(1, Math.round(midpoint * 0.85)),
    high: Math.max(1, Math.round(midpoint * 1.15)),
    midpoint,
  };
}

function eventHash(event, previousHash) {
  const material = `${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`;
  return createHash("sha256").update(material).digest("hex");
}

function appendEvent(state, { eventType, actorId, subjectIds = [], payload = {} }) {
  const next = clone(state);
  const unsignedEvent = {
    eventId: `drug-${String(next.nextEventId).padStart(6, "0")}`,
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

function requireMarket(state, productClass) {
  assertNonEmpty(productClass, "productClass");
  const market = state.markets[productClass];
  if (!market) throw new DrugEconomyValidationError(`unknown product class: ${productClass}`);
  return market;
}

export function createDrugEconomyState({ regionId, simulationDate = "1998-01-01", era = 1 } = {}) {
  assertNonEmpty(regionId, "regionId");
  assertNonEmpty(simulationDate, "simulationDate");
  assertInteger(era, "era", 1, 1000);
  return {
    schemaVersion: DRUG_ECONOMY_SCHEMA_VERSION,
    regionId,
    simulationDate,
    era,
    revision: 0,
    nextEventId: 1,
    lastEventHash: null,
    markets: {},
    batches: {},
    healthExternalities: { communityBand: "low", familyStressBand: "low", laborAvailabilityBand: "stable" },
    reputationEffects: [],
    events: [],
  };
}

export function createProductMarket(
  state,
  {
    expectedRevision,
    productClass,
    sourceRegion,
    destinationRegion = state.regionId,
    basePrice,
    supply = 100,
    demand = 100,
    qualityBand = "mixed",
    policePressure = 20,
    healthExternality = "moderate",
    organizationPolicy = "allowed",
  },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(productClass, "productClass");
  assertNonEmpty(sourceRegion, "sourceRegion");
  assertNonEmpty(destinationRegion, "destinationRegion");
  assertInteger(basePrice, "basePrice", 1, 100000);
  assertInteger(supply, "supply", 0, 100000);
  assertInteger(demand, "demand", 0, 100000);
  if (!["low", "mixed", "high"].includes(qualityBand)) throw new DrugEconomyValidationError(`unsupported quality band: ${qualityBand}`);
  assertRange(policePressure, "policePressure");
  if (!["low", "moderate", "high"].includes(healthExternality)) throw new DrugEconomyValidationError(`unsupported health externality: ${healthExternality}`);
  if (!["allowed", "restricted", "forbidden"].includes(organizationPolicy)) throw new DrugEconomyValidationError(`unsupported organization policy: ${organizationPolicy}`);
  if (state.markets[productClass]) throw new DrugEconomyValidationError(`product market already exists: ${productClass}`);
  const market = {
    productClass,
    sourceRegion,
    destinationRegion,
    basePrice,
    supply,
    demand,
    qualityBand,
    policePressure,
    healthExternality,
    organizationPolicy,
    shockHistory: [],
    ageDays: 0,
  };
  const next = clone(state);
  next.markets[productClass] = market;
  return appendEvent(next, {
    eventType: "drug.market_created",
    actorId: "system:economy",
    subjectIds: [productClass, state.regionId],
    payload: { market: clone(market) },
  });
}

export function createFictionalBatch(
  state,
  { expectedRevision, batchId, productClass, quantity, distributionRole = "abstract-market", organizationId = null },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(batchId, "batchId");
  const market = requireMarket(state, productClass);
  assertInteger(quantity, "quantity", 1, market.supply);
  assertNonEmpty(distributionRole, "distributionRole");
  if (organizationId !== null) assertNonEmpty(organizationId, "organizationId");
  if (market.organizationPolicy === "forbidden") throw new DrugEconomyValidationError("organization doctrine forbids this product class");
  if (state.batches[batchId]) throw new DrugEconomyValidationError(`batch already exists: ${batchId}`);
  const batch = {
    id: batchId,
    productClass,
    quantity,
    qualityBand: market.qualityBand,
    sourceRegion: market.sourceRegion,
    destinationRegion: market.destinationRegion,
    distributionRole,
    organizationId,
    status: "available",
    healthExternality: market.healthExternality,
    createdDate: state.simulationDate,
  };
  const next = clone(state);
  next.batches[batchId] = batch;
  next.markets[productClass].supply -= quantity;
  return appendEvent(next, {
    eventType: "drug.batch_created",
    actorId: organizationId ?? "system:economy",
    subjectIds: [batchId, productClass],
    payload: { batch: clone(batch), remainingSupply: next.markets[productClass].supply },
  });
}

export function applySupplyShock(
  state,
  { expectedRevision, productClass, shockType = "seizure", percent, cause = "regional-event" },
) {
  assertRevision(state, expectedRevision);
  const market = requireMarket(state, productClass);
  assertRange(percent, "percent", 1, 100);
  assertNonEmpty(cause, "cause");
  if (!["seizure", "loss", "weather", "policy"].includes(shockType)) throw new DrugEconomyValidationError(`unsupported shock type: ${shockType}`);
  const removed = Math.min(market.supply, Math.max(1, Math.floor(market.supply * percent / 100)));
  const next = clone(state);
  next.markets[productClass].supply -= removed;
  next.markets[productClass].shockHistory.push({ date: state.simulationDate, shockType, removed, cause });
  next.reputationEffects.push({ date: state.simulationDate, productClass, effect: shockType === "seizure" ? "institutional-pressure" : "scarcity-stress" });
  if (market.healthExternality === "high") next.healthExternalities.communityBand = "moderate";
  return appendEvent(next, {
    eventType: "drug.market_shock",
    actorId: "system:economy",
    subjectIds: [productClass, state.regionId],
    payload: { productClass, shockType, percent, removed, cause, nextSupply: next.markets[productClass].supply },
  });
}

export function settleDrugTime(state, { expectedRevision, days }) {
  assertRevision(state, expectedRevision);
  assertInteger(days, "days", 1, 3650);
  const next = clone(state);
  next.simulationDate = addDays(state.simulationDate, days);
  for (const market of Object.values(next.markets)) {
    market.ageDays += days;
    market.demand = Math.max(0, Math.min(100000, market.demand + (market.demand >= market.supply ? 1 : -1) * Math.max(1, Math.floor(days / 30))));
  }
  if (next.healthExternalities.communityBand === "moderate" && days >= 365) next.healthExternalities.familyStressBand = "moderate";
  return appendEvent(next, {
    eventType: "drug.time_settled",
    actorId: "system:time",
    subjectIds: [state.regionId],
    payload: { days, fromDate: state.simulationDate, toDate: next.simulationDate },
  });
}

export function projectDrugEconomy(state) {
  return {
    schemaVersion: DRUG_ECONOMY_SCHEMA_VERSION,
    regionId: state.regionId,
    simulationDate: state.simulationDate,
    markets: Object.values(state.markets).map((market) => ({
      productClass: market.productClass,
      sourceRegion: market.sourceRegion,
      destinationRegion: market.destinationRegion,
      availabilityBand: band(market.supply),
      demandBand: band(market.demand),
      qualityBand: market.qualityBand,
      priceBand: priceBand(market),
      policePressureBand: band(market.policePressure),
      healthExternality: market.healthExternality,
      policy: market.organizationPolicy,
    })),
    batchCount: Object.keys(state.batches).length,
    healthExternalities: clone(state.healthExternalities),
    omittedFields: ["batch ids", "exact quantities", "distributionRole", "organizationId", "shock causes", "reputationEffects", "events", "lastEventHash"],
  };
}

export function snapshotDrugEconomy(state) { return { snapshotVersion: 1, state: clone(state) }; }

export function restoreDrugEconomy(snapshotValue) {
  if (!snapshotValue || snapshotValue.snapshotVersion !== 1) throw new DrugEconomyValidationError("unsupported drug-economy snapshot version");
  const state = clone(snapshotValue.state);
  if (!state || state.schemaVersion !== DRUG_ECONOMY_SCHEMA_VERSION) throw new DrugEconomyValidationError("unsupported drug-economy schema version");
  let revision = 0;
  let previousHash = null;
  for (const event of state.events) {
    if (event.revision !== revision + 1) throw new DrugEconomyValidationError("drug-economy revisions are not contiguous");
    if (event.previousHash !== previousHash) throw new DrugEconomyValidationError("drug-economy event chain is broken");
    const { hash, ...unsignedEvent } = event;
    if (hash !== eventHash(unsignedEvent, event.previousHash)) throw new DrugEconomyValidationError("drug-economy event hash is invalid");
    revision = event.revision;
    previousHash = event.hash;
  }
  if (state.revision !== revision || state.lastEventHash !== previousHash) throw new DrugEconomyValidationError("drug-economy snapshot does not match history");
  return state;
}
