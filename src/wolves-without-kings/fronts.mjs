import { createHash } from "node:crypto";

import { canonicalJson } from "./engine.mjs";

export const FRONTS_SCHEMA_VERSION = 1;

export class FrontsValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "FrontsValidationError";
  }
}

export class FrontsStaleRevisionError extends FrontsValidationError {
  constructor(expectedRevision, actualRevision) {
    super(`stale fronts command: expected revision ${expectedRevision}, actual revision ${actualRevision}`);
    this.name = "FrontsStaleRevisionError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

function clone(value) { return structuredClone(value); }

function assertObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new FrontsValidationError(`${field} must be an object`);
}

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new FrontsValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new FrontsValidationError(`${field} must be an integer between ${minimum} and ${maximum}`);
}

function assertRange(value, field, minimum = 0, maximum = 100) { assertInteger(value, field, minimum, maximum); }

function assertRevision(state, expectedRevision) {
  assertInteger(expectedRevision, "expectedRevision");
  if (expectedRevision !== state.revision) throw new FrontsStaleRevisionError(expectedRevision, state.revision);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function band(value) { return value >= 70 ? "high" : value >= 35 ? "moderate" : "low"; }

function eventHash(event, previousHash) {
  const material = `${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`;
  return createHash("sha256").update(material).digest("hex");
}

function appendEvent(state, { eventType, actorId, subjectIds = [], payload = {} }) {
  const next = clone(state);
  const unsignedEvent = {
    eventId: `front-${String(next.nextEventId).padStart(6, "0")}`,
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

function requireBusiness(state, businessId) {
  assertNonEmpty(businessId, "businessId");
  const business = state.businesses[businessId];
  if (!business) throw new FrontsValidationError(`unknown business: ${businessId}`);
  return business;
}

function normalizeManager(manager = {}) {
  assertObject(manager, "manager");
  assertNonEmpty(manager.managerId, "manager.managerId");
  assertRange(manager.competence ?? 50, "manager.competence");
  assertRange(manager.loyalty ?? 50, "manager.loyalty");
  assertRange(manager.personalIncentive ?? 50, "manager.personalIncentive");
  return {
    managerId: manager.managerId,
    competence: manager.competence ?? 50,
    loyalty: manager.loyalty ?? 50,
    personalIncentive: manager.personalIncentive ?? 50,
    status: "active",
  };
}

function settleOneMonth(business) {
  const next = clone(business);
  const competenceEffect = Math.round((next.manager.competence - 50) / 5);
  const loyaltyEffect = Math.round((next.manager.loyalty - 50) / 10);
  const legitimateRevenue = Math.max(0, 100 + competenceEffect * 10 + loyaltyEffect * 4 + Math.floor(next.staffCount / 2));
  const legitimateCost = 70 + next.staffCount * 4 + (next.manager.status === "absent" ? 35 : 0);
  const cashflow = legitimateRevenue - legitimateCost;
  next.ageDays += 30;
  next.operatingMonths += 1;
  next.legitimateCash += Math.max(0, cashflow);
  next.legitimateExpenses += legitimateCost;
  next.cashflowHistory.push({ month: next.operatingMonths, revenue: legitimateRevenue, cost: legitimateCost, cashflow });
  next.publicReputation = Math.max(0, Math.min(100, next.publicReputation + (cashflow >= 0 ? 1 : -2) + (next.manager.competence >= 70 ? 1 : 0)));
  next.managerRisk = next.manager.personalIncentive > next.manager.loyalty ? "elevated" : "contained";
  next.taxAttention = Math.max(0, Math.min(100, next.taxAttention + (next.legitimateCash > next.capital * 2 ? 2 : 0) + (next.criminalDependency > 60 ? 1 : 0) + (next.managerRisk === "elevated" ? 1 : 0)));
  next.debt = Math.max(0, next.debt + (cashflow < 0 ? Math.abs(cashflow) : -Math.min(next.debt, Math.floor(cashflow / 4))));
  next.businessMaturity = next.operatingMonths >= 48 ? "mature" : next.operatingMonths >= 24 ? "established" : next.operatingMonths >= 6 ? "growing" : "new";
  if (next.managerRisk === "elevated" && next.operatingMonths % 6 === 0) {
    next.legitimateCash = Math.max(0, next.legitimateCash - 40);
    next.fraudBand = "suspected";
  }
  if (next.debt > next.capital * 2) next.status = "distressed";
  else if (next.legitimateCash > next.capital && next.debt === 0) next.status = "healthy";
  return next;
}

export function createFrontsState({ simulationDate = "1998-01-01", regionId = "region:sofia" } = {}) {
  assertNonEmpty(simulationDate, "simulationDate");
  assertNonEmpty(regionId, "regionId");
  return {
    schemaVersion: FRONTS_SCHEMA_VERSION,
    simulationDate,
    regionId,
    revision: 0,
    nextEventId: 1,
    lastEventHash: null,
    businesses: {},
    events: [],
  };
}

export function createFront(
  state,
  {
    expectedRevision,
    businessId,
    sector,
    capital,
    manager,
    staffCount = 1,
    publicReputation = 20,
    criminalDependency = 0,
    debt = 0,
    taxAttention = 10,
    politicalConnections = 0,
    propertyId = null,
  },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(businessId, "businessId");
  assertNonEmpty(sector, "sector");
  assertInteger(capital, "capital", 1, 100000000);
  assertInteger(staffCount, "staffCount", 0, 10000);
  assertRange(publicReputation, "publicReputation");
  assertRange(criminalDependency, "criminalDependency");
  assertRange(taxAttention, "taxAttention");
  assertRange(politicalConnections, "politicalConnections");
  assertInteger(debt, "debt", 0, 100000000);
  if (propertyId !== null) assertNonEmpty(propertyId, "propertyId");
  if (state.businesses[businessId]) throw new FrontsValidationError(`business already exists: ${businessId}`);
  const business = {
    id: businessId,
    sector,
    capital,
    propertyId,
    staffCount,
    manager: normalizeManager(manager),
    ageDays: 0,
    operatingMonths: 0,
    businessMaturity: "new",
    legitimateCash: 0,
    legitimateExpenses: 0,
    cashflowHistory: [],
    criminalDependency,
    debt,
    publicReputation,
    taxAttention,
    politicalConnections,
    fraudBand: "unknown",
    managerRisk: "unknown",
    status: "new",
  };
  const next = clone(state);
  next.businesses[businessId] = business;
  return appendEvent(next, {
    eventType: "front.business_created",
    actorId: manager.managerId,
    subjectIds: [businessId],
    payload: { business: clone(business) },
  });
}

export function changeFrontManager(
  state,
  { expectedRevision, businessId, manager },
) {
  assertRevision(state, expectedRevision);
  const business = requireBusiness(state, businessId);
  const nextManager = normalizeManager(manager);
  const next = clone(state);
  next.businesses[businessId].manager = nextManager;
  return appendEvent(next, {
    eventType: "front.manager_changed",
    actorId: nextManager.managerId,
    subjectIds: [businessId],
    payload: { businessId, managerId: nextManager.managerId },
  });
}

export function settleFrontTime(state, { expectedRevision, days }) {
  assertRevision(state, expectedRevision);
  assertInteger(days, "days", 1, 3650);
  const next = clone(state);
  next.simulationDate = addDays(state.simulationDate, days);
  const months = Math.floor(days / 30);
  for (const business of Object.values(next.businesses)) {
    let settled = business;
    for (let month = 0; month < months; month += 1) settled = settleOneMonth(settled);
    next.businesses[business.id] = settled;
  }
  return appendEvent(next, {
    eventType: "front.time_settled",
    actorId: "system:time",
    subjectIds: [state.regionId],
    payload: { days, months, fromDate: state.simulationDate, toDate: next.simulationDate },
  });
}

export function projectFronts(state) {
  return {
    schemaVersion: FRONTS_SCHEMA_VERSION,
    simulationDate: state.simulationDate,
    businesses: Object.values(state.businesses).map((business) => ({
      id: business.id,
      sector: business.sector,
      maturity: business.businessMaturity,
      status: business.status,
      publicReputationBand: band(business.publicReputation),
      debtBand: band(business.debt),
      taxAttentionBand: band(business.taxAttention),
      managerRisk: business.managerRisk,
      criminalDependencyBand: band(business.criminalDependency),
    })),
    omittedFields: ["capital", "legitimateCash", "legitimateExpenses", "cashflowHistory", "managerId", "manager competence", "manager loyalty", "personalIncentive", "politicalConnections", "events", "lastEventHash"],
  };
}

export function snapshotFronts(state) { return { snapshotVersion: 1, state: clone(state) }; }

export function restoreFronts(snapshotValue) {
  if (!snapshotValue || snapshotValue.snapshotVersion !== 1) throw new FrontsValidationError("unsupported fronts snapshot version");
  const state = clone(snapshotValue.state);
  if (!state || state.schemaVersion !== FRONTS_SCHEMA_VERSION) throw new FrontsValidationError("unsupported fronts schema version");
  let revision = 0;
  let previousHash = null;
  for (const event of state.events) {
    if (event.revision !== revision + 1) throw new FrontsValidationError("fronts revisions are not contiguous");
    if (event.previousHash !== previousHash) throw new FrontsValidationError("fronts event chain is broken");
    const { hash, ...unsignedEvent } = event;
    if (hash !== eventHash(unsignedEvent, event.previousHash)) throw new FrontsValidationError("fronts event hash is invalid");
    revision = event.revision;
    previousHash = event.hash;
  }
  if (state.revision !== revision || state.lastEventHash !== previousHash) throw new FrontsValidationError("fronts snapshot does not match history");
  return state;
}
