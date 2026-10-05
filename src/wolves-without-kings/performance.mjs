import { createHash } from "node:crypto";

import { canonicalJson } from "./engine.mjs";

export const PERFORMANCE_SCHEMA_VERSION = 1;

export class PerformanceValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "PerformanceValidationError";
  }
}

export class PerformanceStaleRevisionError extends PerformanceValidationError {
  constructor(expectedRevision, actualRevision) {
    super(`stale performance command: expected revision ${expectedRevision}, actual revision ${actualRevision}`);
    this.name = "PerformanceStaleRevisionError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

function clone(value) { return structuredClone(value); }

function assertObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new PerformanceValidationError(`${field} must be an object`);
}

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new PerformanceValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new PerformanceValidationError(`${field} must be an integer between ${minimum} and ${maximum}`);
}

function assertRange(value, field, minimum = 0, maximum = 100) { assertInteger(value, field, minimum, maximum); }

function assertRevision(state, expectedRevision) {
  assertInteger(expectedRevision, "expectedRevision");
  if (expectedRevision !== state.revision) throw new PerformanceStaleRevisionError(expectedRevision, state.revision);
}

function eventHash(event, previousHash) {
  const material = `${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`;
  return createHash("sha256").update(material).digest("hex");
}

function appendEvent(state, { eventType, actorId, subjectIds = [], payload = {} }) {
  const next = clone(state);
  const unsignedEvent = {
    eventId: `performance-${String(next.nextEventId).padStart(6, "0")}`,
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

function tierForEntity(entity, counts, budgets) {
  if (entity.importance >= 80 || entity.networkInterest >= 80) return "promoted";
  if (entity.distanceBand === "local") return "full";
  if (entity.distanceBand === "near") return counts.full < budgets.maxFullEntities ? "full" : "aggregate";
  return "aggregate";
}

export function createPerformanceState({ simulationDate = "1998-01-01", budgets = {} } = {}) {
  assertNonEmpty(simulationDate, "simulationDate");
  const normalizedBudgets = {
    frameMs: budgets.frameMs ?? 16.67,
    simulationMs: budgets.simulationMs ?? 8,
    networkMs: budgets.networkMs ?? 4,
    maxFullEntities: budgets.maxFullEntities ?? 32,
    maxPromotedEntities: budgets.maxPromotedEntities ?? 16,
  };
  for (const key of ["frameMs", "simulationMs", "networkMs"]) {
    if (typeof normalizedBudgets[key] !== "number" || normalizedBudgets[key] <= 0) throw new PerformanceValidationError(`budgets.${key} must be positive`);
  }
  for (const key of ["maxFullEntities", "maxPromotedEntities"]) assertInteger(normalizedBudgets[key], `budgets.${key}`, 1, 100000);
  return {
    schemaVersion: PERFORMANCE_SCHEMA_VERSION,
    simulationDate,
    budgets: normalizedBudgets,
    revision: 0,
    nextEventId: 1,
    lastEventHash: null,
    entities: {},
    stressReports: [],
    events: [],
  };
}

export function registerPerformanceEntity(
  state,
  { expectedRevision, entityId, importance = 20, distanceBand = "distant", simulationMode = "aggregate", historyTier = "summary", networkInterest = 0 },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(entityId, "entityId");
  assertRange(importance, "importance");
  if (!["local", "near", "distant"].includes(distanceBand)) throw new PerformanceValidationError(`unsupported distance band: ${distanceBand}`);
  if (!["full", "aggregate"].includes(simulationMode)) throw new PerformanceValidationError(`unsupported simulation mode: ${simulationMode}`);
  if (!["detail", "summary"].includes(historyTier)) throw new PerformanceValidationError(`unsupported history tier: ${historyTier}`);
  assertRange(networkInterest, "networkInterest");
  if (state.entities[entityId]) throw new PerformanceValidationError(`performance entity already exists: ${entityId}`);
  const entity = {
    id: entityId,
    importance,
    distanceBand,
    simulationMode,
    updateRate: simulationMode === "full" ? "per-tick" : "scheduled",
    aiTier: simulationMode === "full" ? "local" : "aggregate",
    physicsTier: simulationMode === "full" ? "local" : "none",
    historyTier,
    networkInterest,
    promotionReason: null,
    demotionReason: null,
  };
  const next = clone(state);
  next.entities[entityId] = entity;
  return appendEvent(next, {
    eventType: "performance.entity_registered",
    actorId: "system:performance",
    subjectIds: [entityId],
    payload: { entity: clone(entity) },
  });
}

export function updatePerformanceInterest(
  state,
  { expectedRevision, entityId, distanceBand, importance, networkInterest, reason = "interest-change" },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(entityId, "entityId");
  const entity = state.entities[entityId];
  if (!entity) throw new PerformanceValidationError(`unknown performance entity: ${entityId}`);
  if (distanceBand !== undefined && !["local", "near", "distant"].includes(distanceBand)) throw new PerformanceValidationError(`unsupported distance band: ${distanceBand}`);
  if (importance !== undefined) assertRange(importance, "importance");
  if (networkInterest !== undefined) assertRange(networkInterest, "networkInterest");
  assertNonEmpty(reason, "reason");
  const next = clone(state);
  next.entities[entityId] = {
    ...entity,
    distanceBand: distanceBand ?? entity.distanceBand,
    importance: importance ?? entity.importance,
    networkInterest: networkInterest ?? entity.networkInterest,
  };
  return appendEvent(next, {
    eventType: "performance.interest_updated",
    actorId: "system:interest",
    subjectIds: [entityId],
    payload: { entityId, distanceBand: next.entities[entityId].distanceBand, importance: next.entities[entityId].importance, networkInterest: next.entities[entityId].networkInterest, reason },
  });
}

export function rebalancePerformance(state, { expectedRevision, reason = "deterministic-interest-pass" }) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(reason, "reason");
  const next = clone(state);
  const counts = { full: 0, promoted: 0, aggregate: 0 };
  const entities = Object.values(next.entities).sort((a, b) => b.importance - a.importance || a.id.localeCompare(b.id));
  for (const entity of entities) {
    const previous = entity.simulationMode;
    const desired = tierForEntity(entity, counts, next.budgets);
    if (desired === "promoted") {
      if (counts.promoted >= next.budgets.maxPromotedEntities) {
        entity.simulationMode = "aggregate";
        entity.aiTier = "aggregate";
        entity.physicsTier = "none";
        entity.updateRate = "scheduled";
        entity.demotionReason = "promotion-cap";
        counts.aggregate += 1;
        continue;
      }
      entity.simulationMode = "full";
      entity.aiTier = "promoted";
      entity.physicsTier = "local";
      entity.updateRate = "per-tick";
      entity.promotionReason = entity.importance >= 80 ? "importance" : "network-interest";
      counts.promoted += 1;
    } else if (desired === "full" && counts.full < next.budgets.maxFullEntities) {
      entity.simulationMode = "full";
      entity.aiTier = "local";
      entity.physicsTier = "local";
      entity.updateRate = "per-tick";
      if (previous === "aggregate") entity.promotionReason = reason;
      counts.full += 1;
    } else {
      entity.simulationMode = "aggregate";
      entity.aiTier = "aggregate";
      entity.physicsTier = "none";
      entity.updateRate = "scheduled";
      if (previous === "full") entity.demotionReason = "budget-or-distance";
      counts.aggregate += 1;
    }
  }
  return appendEvent(next, {
    eventType: "performance.rebalanced",
    actorId: "system:performance",
    subjectIds: Object.keys(next.entities),
    payload: { counts, reason },
  });
}

export function recordStressReport(
  state,
  { expectedRevision, population, organizationCount, marketEvents, localCombatEvents, rendererMs, simulationMs, networkMs },
) {
  assertRevision(state, expectedRevision);
  assertInteger(population, "population", 0, 10000000);
  assertInteger(organizationCount, "organizationCount", 0, 100000);
  assertInteger(marketEvents, "marketEvents", 0, 100000);
  assertInteger(localCombatEvents, "localCombatEvents", 0, 100000);
  for (const [field, value] of [["rendererMs", rendererMs], ["simulationMs", simulationMs], ["networkMs", networkMs]]) {
    if (typeof value !== "number" || value < 0) throw new PerformanceValidationError(`${field} must be a non-negative number`);
  }
  const report = {
    population,
    organizationCount,
    marketEvents,
    localCombatEvents,
    rendererMs,
    simulationMs,
    networkMs,
    rendererWithinBudget: rendererMs <= state.budgets.frameMs,
    simulationWithinBudget: simulationMs <= state.budgets.simulationMs,
    networkWithinBudget: networkMs <= state.budgets.networkMs,
    separateBudgets: true,
  };
  const next = clone(state);
  next.stressReports.push(report);
  return appendEvent(next, {
    eventType: "performance.stress_reported",
    actorId: "system:performance",
    subjectIds: [state.simulationDate],
    payload: { report: clone(report) },
  });
}

export function projectPerformance(state) {
  const latest = state.stressReports.at(-1) ?? null;
  return {
    schemaVersion: PERFORMANCE_SCHEMA_VERSION,
    budgets: clone(state.budgets),
    counts: {
      total: Object.keys(state.entities).length,
      full: Object.values(state.entities).filter((entity) => entity.simulationMode === "full").length,
      aggregate: Object.values(state.entities).filter((entity) => entity.simulationMode === "aggregate").length,
      promoted: Object.values(state.entities).filter((entity) => entity.aiTier === "promoted").length,
    },
    latestReport: latest ? {
      rendererWithinBudget: latest.rendererWithinBudget,
      simulationWithinBudget: latest.simulationWithinBudget,
      networkWithinBudget: latest.networkWithinBudget,
      separateBudgets: latest.separateBudgets,
    } : null,
    omittedFields: ["exact entity interest", "promotion/demotion reasons", "exact timings", "events", "lastEventHash"],
  };
}

export function snapshotPerformance(state) { return { snapshotVersion: 1, state: clone(state) }; }

export function restorePerformance(snapshotValue) {
  if (!snapshotValue || snapshotValue.snapshotVersion !== 1) throw new PerformanceValidationError("unsupported performance snapshot version");
  const state = clone(snapshotValue.state);
  if (!state || state.schemaVersion !== PERFORMANCE_SCHEMA_VERSION) throw new PerformanceValidationError("unsupported performance schema version");
  let revision = 0;
  let previousHash = null;
  for (const event of state.events) {
    if (event.revision !== revision + 1) throw new PerformanceValidationError("performance revisions are not contiguous");
    if (event.previousHash !== previousHash) throw new PerformanceValidationError("performance event chain is broken");
    const { hash, ...unsignedEvent } = event;
    if (hash !== eventHash(unsignedEvent, event.previousHash)) throw new PerformanceValidationError("performance event hash is invalid");
    revision = event.revision;
    previousHash = event.hash;
  }
  if (state.revision !== revision || state.lastEventHash !== previousHash) throw new PerformanceValidationError("performance snapshot does not match history");
  return state;
}
