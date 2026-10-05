import { createHash } from "node:crypto";

import { canonicalJson } from "./engine.mjs";

export const LOGISTICS_SCHEMA_VERSION = 1;

export class LogisticsValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "LogisticsValidationError";
  }
}

export class LogisticsStaleRevisionError extends LogisticsValidationError {
  constructor(expectedRevision, actualRevision) {
    super(`stale logistics command: expected revision ${expectedRevision}, actual revision ${actualRevision}`);
    this.name = "LogisticsStaleRevisionError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

export class LogisticsStalePlanError extends LogisticsValidationError {
  constructor(routeId, plannedVersion, actualVersion) {
    super(`stale logistics plan for ${routeId}: planned version ${plannedVersion}, actual version ${actualVersion}`);
    this.name = "LogisticsStalePlanError";
    this.routeId = routeId;
    this.plannedVersion = plannedVersion;
    this.actualVersion = actualVersion;
  }
}

function clone(value) { return structuredClone(value); }

function assertObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new LogisticsValidationError(`${field} must be an object`);
}

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new LogisticsValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new LogisticsValidationError(`${field} must be an integer between ${minimum} and ${maximum}`);
}

function assertRange(value, field, minimum = 0, maximum = 100) { assertInteger(value, field, minimum, maximum); }

function assertRevision(state, expectedRevision) {
  assertInteger(expectedRevision, "expectedRevision");
  if (expectedRevision !== state.revision) throw new LogisticsStaleRevisionError(expectedRevision, state.revision);
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
    eventId: `logistics-${String(next.nextEventId).padStart(6, "0")}`,
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

function requireRoute(state, routeId) {
  assertNonEmpty(routeId, "routeId");
  const route = state.routes[routeId];
  if (!route) throw new LogisticsValidationError(`unknown route: ${routeId}`);
  return route;
}

function calculateRisk(route, { weatherCost = 0, policePressure = 0, familiarity = 50, vehicleFit = 50, contactReliability = 50 }) {
  const risk = Math.max(0, Math.min(100, route.baseRisk + weatherCost + route.hazardCost + policePressure - Math.floor(familiarity / 5) - Math.floor(vehicleFit / 10) - Math.floor(contactReliability / 10)));
  return { score: risk, band: band(risk) };
}

export function createLogisticsState({ simulationDate = "1998-01-01", regionId = "region:sofia" } = {}) {
  assertNonEmpty(simulationDate, "simulationDate");
  assertNonEmpty(regionId, "regionId");
  return {
    schemaVersion: LOGISTICS_SCHEMA_VERSION,
    simulationDate,
    regionId,
    revision: 0,
    nextEventId: 1,
    nextPlanId: 1,
    lastEventHash: null,
    routes: {},
    plans: {},
    transitHistory: [],
    events: [],
  };
}

export function createRoute(
  state,
  {
    expectedRevision,
    routeId,
    segments,
    accessRequirements = [],
    travelTimeHours,
    weatherCost = 0,
    hazardCost = 0,
    borderState = "open",
    contacts = [],
    coverBusiness = null,
    fallbacks = [],
  },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(routeId, "routeId");
  if (!Array.isArray(segments) || segments.length === 0 || segments.some((segment) => typeof segment !== "string" || segment.trim() === "")) throw new LogisticsValidationError("segments must contain non-empty strings");
  if (!Array.isArray(accessRequirements) || accessRequirements.some((item) => typeof item !== "string" || item.trim() === "")) throw new LogisticsValidationError("accessRequirements must contain non-empty strings");
  assertInteger(travelTimeHours, "travelTimeHours", 1, 10000);
  assertRange(weatherCost, "weatherCost");
  assertRange(hazardCost, "hazardCost");
  if (!["open", "strained", "closed"].includes(borderState)) throw new LogisticsValidationError(`unsupported border state: ${borderState}`);
  if (!Array.isArray(contacts) || contacts.some((item) => typeof item !== "string" || item.trim() === "")) throw new LogisticsValidationError("contacts must contain non-empty strings");
  if (coverBusiness !== null) assertNonEmpty(coverBusiness, "coverBusiness");
  if (!Array.isArray(fallbacks) || fallbacks.some((item) => typeof item !== "string" || item.trim() === "")) throw new LogisticsValidationError("fallbacks must contain non-empty strings");
  if (state.routes[routeId]) throw new LogisticsValidationError(`route already exists: ${routeId}`);
  const route = {
    id: routeId,
    segments: [...segments],
    accessRequirements: [...new Set(accessRequirements)],
    travelTimeHours,
    weatherCost,
    hazardCost,
    borderState,
    contacts: [...new Set(contacts)],
    coverBusiness,
    fallbacks: [...new Set(fallbacks)],
    baseRisk: 20,
    version: 1,
    status: "available",
    lastChangedDate: state.simulationDate,
  };
  const next = clone(state);
  next.routes[routeId] = route;
  return appendEvent(next, {
    eventType: "logistics.route_created",
    actorId: "system:logistics",
    subjectIds: [routeId],
    payload: { route: clone(route) },
  });
}

export function changeRouteCondition(
  state,
  { expectedRevision, routeId, status, weatherCost, hazardCost, borderState, reason = "regional-change" },
) {
  assertRevision(state, expectedRevision);
  const route = requireRoute(state, routeId);
  if (!["available", "compromised", "obsolete", "closed"].includes(status)) throw new LogisticsValidationError(`unsupported route status: ${status}`);
  assertRange(weatherCost, "weatherCost");
  assertRange(hazardCost, "hazardCost");
  if (!["open", "strained", "closed"].includes(borderState)) throw new LogisticsValidationError(`unsupported border state: ${borderState}`);
  assertNonEmpty(reason, "reason");
  const next = clone(state);
  next.routes[routeId] = {
    ...route,
    status,
    weatherCost,
    hazardCost,
    borderState,
    version: route.version + 1,
    lastChangedDate: state.simulationDate,
  };
  return appendEvent(next, {
    eventType: "logistics.route_condition_changed",
    actorId: "system:regional-state",
    subjectIds: [routeId],
    payload: { routeId, status, weatherCost, hazardCost, borderState, reason, version: next.routes[routeId].version },
  });
}

export function planTransit(
  state,
  { expectedRevision, routeId, cargoClass, departureDate = state.simulationDate, familiarity = 50, vehicleFit = 50, contactReliability = 50, policePressure = 0 },
) {
  assertRevision(state, expectedRevision);
  const route = requireRoute(state, routeId);
  assertNonEmpty(cargoClass, "cargoClass");
  assertNonEmpty(departureDate, "departureDate");
  assertRange(familiarity, "familiarity");
  assertRange(vehicleFit, "vehicleFit");
  assertRange(contactReliability, "contactReliability");
  assertRange(policePressure, "policePressure");
  if (route.status === "closed" || route.status === "obsolete") throw new LogisticsValidationError(`route cannot be planned: ${route.status}`);
  const risk = calculateRisk(route, { policePressure, familiarity, vehicleFit, contactReliability });
  const plan = {
    id: `plan-${String(state.nextPlanId).padStart(6, "0")}`,
    routeId,
    routeVersion: route.version,
    cargoClass,
    departureDate,
    estimatedTravelHours: route.travelTimeHours + Math.ceil(route.weatherCost / 10),
    risk,
    fallbackCount: route.fallbacks.length,
    status: "planned",
  };
  const next = clone(state);
  next.nextPlanId += 1;
  next.plans[plan.id] = plan;
  return appendEvent(next, {
    eventType: "logistics.transit_planned",
    actorId: "system:logistics",
    subjectIds: [routeId, plan.id],
    payload: { plan: clone(plan) },
  });
}

export function executeTransit(
  state,
  { expectedRevision, planId, choice = "proceed", actorId = "system:logistics" },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(planId, "planId");
  assertNonEmpty(actorId, "actorId");
  if (!["proceed", "delay", "reroute", "cancel"].includes(choice)) throw new LogisticsValidationError(`unsupported transit choice: ${choice}`);
  const plan = state.plans[planId];
  if (!plan) throw new LogisticsValidationError(`unknown plan: ${planId}`);
  const route = requireRoute(state, plan.routeId);
  if (plan.status !== "planned") throw new LogisticsValidationError(`plan is not executable: ${planId}`);
  if (plan.routeVersion !== route.version) throw new LogisticsStalePlanError(route.id, plan.routeVersion, route.version);
  if (choice === "proceed" && route.status === "compromised") {
    if (route.fallbacks.length === 0) throw new LogisticsValidationError("compromised route requires an explicit delay, reroute, or cancel choice");
  }
  const outcome = choice === "proceed"
    ? (plan.risk.band === "high" ? "delayed-and-observed" : "completed")
    : choice === "delay" ? "delayed"
      : choice === "reroute" ? "replanned-required" : "cancelled";
  const next = clone(state);
  next.plans[planId].status = outcome === "replanned-required" ? "replan-required" : outcome;
  const record = {
    planId,
    routeId: route.id,
    cargoClass: plan.cargoClass,
    choice,
    outcome,
    riskBand: plan.risk.band,
    completedDate: state.simulationDate,
  };
  next.transitHistory.push(record);
  return appendEvent(next, {
    eventType: "logistics.transit_resolved",
    actorId,
    subjectIds: [route.id, planId],
    payload: { record },
  });
}

export function settleLogisticsTime(state, { expectedRevision, days }) {
  assertRevision(state, expectedRevision);
  assertInteger(days, "days", 1, 3650);
  const next = clone(state);
  next.simulationDate = addDays(state.simulationDate, days);
  for (const route of Object.values(next.routes)) {
    if (route.status === "compromised" && days >= 30) route.status = "obsolete";
  }
  return appendEvent(next, {
    eventType: "logistics.time_settled",
    actorId: "system:time",
    subjectIds: [state.regionId],
    payload: { days, fromDate: state.simulationDate, toDate: next.simulationDate },
  });
}

export function projectLogistics(state) {
  return {
    schemaVersion: LOGISTICS_SCHEMA_VERSION,
    simulationDate: state.simulationDate,
    routes: Object.values(state.routes).map((route) => ({
      id: route.id,
      status: route.status,
      travelTimeBand: route.travelTimeHours >= 24 ? "long" : route.travelTimeHours >= 8 ? "medium" : "short",
      riskBand: band(route.baseRisk + route.weatherCost + route.hazardCost),
      borderState: route.borderState,
      fallbackCount: route.fallbacks.length,
    })),
    planCount: Object.keys(state.plans).length,
    transitCount: state.transitHistory.length,
    omittedFields: ["segments", "accessRequirements", "contacts", "coverBusiness", "cargoClass", "exact travel hours", "risk score", "events", "lastEventHash"],
  };
}

export function snapshotLogistics(state) { return { snapshotVersion: 1, state: clone(state) }; }

export function restoreLogistics(snapshotValue) {
  if (!snapshotValue || snapshotValue.snapshotVersion !== 1) throw new LogisticsValidationError("unsupported logistics snapshot version");
  const state = clone(snapshotValue.state);
  if (!state || state.schemaVersion !== LOGISTICS_SCHEMA_VERSION) throw new LogisticsValidationError("unsupported logistics schema version");
  let revision = 0;
  let previousHash = null;
  for (const event of state.events) {
    if (event.revision !== revision + 1) throw new LogisticsValidationError("logistics revisions are not contiguous");
    if (event.previousHash !== previousHash) throw new LogisticsValidationError("logistics event chain is broken");
    const { hash, ...unsignedEvent } = event;
    if (hash !== eventHash(unsignedEvent, event.previousHash)) throw new LogisticsValidationError("logistics event hash is invalid");
    revision = event.revision;
    previousHash = event.hash;
  }
  if (state.revision !== revision || state.lastEventHash !== previousHash) throw new LogisticsValidationError("logistics snapshot does not match history");
  return state;
}
