import { createHash } from "node:crypto";

import { canonicalJson } from "./engine.mjs";

export const NPC_AI_SCHEMA_VERSION = 1;
const AGENT_TIERS = ["major", "background"];
const BELIEF_STATES = ["known", "told", "uncertain"];
const OUTCOMES = ["successful", "failed", "detected", "missed"];
const ORDER_OUTCOMES = ["complies", "hesitates", "deviates"];

export class NpcAiValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "NpcAiValidationError";
  }
}

export class NpcAiStaleRevisionError extends NpcAiValidationError {
  constructor(expectedRevision, actualRevision) {
    super(`stale NPC AI command: expected revision ${expectedRevision}, actual revision ${actualRevision}`);
    this.name = "NpcAiStaleRevisionError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

function clone(value) { return structuredClone(value); }

function assertObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new NpcAiValidationError(`${field} must be an object`);
}

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new NpcAiValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new NpcAiValidationError(`${field} must be an integer between ${minimum} and ${maximum}`);
}

function assertDate(value, field = "simulationDate") {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new NpcAiValidationError(`${field} must be an ISO date`);
  }
}

function assertRevision(state, expectedRevision) {
  assertInteger(expectedRevision, "expectedRevision");
  if (expectedRevision !== state.revision) throw new NpcAiStaleRevisionError(expectedRevision, state.revision);
}

function assertBand(value, field) {
  assertInteger(value, field, 0, 100);
}

function eventHash(event, previousHash) {
  const material = `${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`;
  return createHash("sha256").update(material).digest("hex");
}

function appendEvent(state, { eventType, actorId, subjectIds = [], payload = {} }) {
  const next = clone(state);
  const unsignedEvent = {
    eventId: `npc-ai-${String(next.nextEventId).padStart(6, "0")}`,
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

function normalizeMap(value, field, defaultValue) {
  if (value === undefined) return { ...defaultValue };
  assertObject(value, field);
  return { ...value };
}

function normalizeAgent({ agentId, tier = "background", needs = {}, obligations = {}, beliefs = {}, values = {} }) {
  assertNonEmpty(agentId, "agentId");
  if (!AGENT_TIERS.includes(tier)) throw new NpcAiValidationError(`unsupported agent tier: ${tier}`);
  const normalizedNeeds = normalizeMap(needs, "needs", { safety: 20, sleep: 20, family: 20, money: 20 });
  const normalizedObligations = normalizeMap(obligations, "obligations", { family: 0, organization: 0 });
  const normalizedBeliefs = normalizeMap(beliefs, "beliefs", {});
  const normalizedValues = normalizeMap(values, "values", { loyalty: 50, fear: 20, competence: 50 });
  for (const [key, value] of Object.entries({ ...normalizedNeeds, ...normalizedObligations, ...normalizedValues })) assertBand(value, `agent.${key}`);
  for (const belief of Object.values(normalizedBeliefs)) {
    if (!BELIEF_STATES.includes(belief)) throw new NpcAiValidationError(`unsupported belief state: ${belief}`);
  }
  return {
    id: agentId,
    tier,
    needs: normalizedNeeds,
    obligations: normalizedObligations,
    beliefs: normalizedBeliefs,
    values: normalizedValues,
    observations: {},
    adaptivePressure: 0,
    plans: [],
    orders: [],
  };
}

function pressureBand(value) {
  if (value >= 3) return "high";
  if (value >= 1) return "guarded";
  return "low";
}

function knowledgeBand(agent, requiredBeliefs) {
  if (requiredBeliefs.length === 0) return "open";
  const knownCount = requiredBeliefs.filter((claim) => ["known", "told"].includes(agent.beliefs[claim])).length;
  if (knownCount === requiredBeliefs.length) return "grounded";
  if (knownCount > 0) return "partial";
  return "uncertain";
}

function addDays(date, days) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function createNpcAiState({ worldId = "wwk-npc-ai", simulationDate = "1998-01-01", maxObservationHistory = 6, maxAdaptivePressure = 3 } = {}) {
  assertNonEmpty(worldId, "worldId");
  assertDate(simulationDate);
  assertInteger(maxObservationHistory, "maxObservationHistory", 2, 100);
  assertInteger(maxAdaptivePressure, "maxAdaptivePressure", 1, 10);
  return {
    schemaVersion: NPC_AI_SCHEMA_VERSION,
    worldId,
    simulationDate,
    maxObservationHistory,
    maxAdaptivePressure,
    revision: 0,
    nextEventId: 1,
    lastEventHash: null,
    agents: {},
    events: [],
  };
}

export function registerNpcAiAgent(state, { expectedRevision, agentId, tier = "background", needs, obligations, beliefs, values }) {
  assertRevision(state, expectedRevision);
  if (state.agents[agentId]) throw new NpcAiValidationError(`NPC AI agent already exists: ${agentId}`);
  const agent = normalizeAgent({ agentId, tier, needs, obligations, beliefs, values });
  const next = clone(state);
  next.agents[agentId] = agent;
  return appendEvent(next, {
    eventType: "npc_ai.agent_registered",
    actorId: "system:npc-ai",
    subjectIds: [agentId],
    payload: { tier, beliefCount: Object.keys(agent.beliefs).length },
  });
}

export function recordNpcObservation(state, { expectedRevision, agentId, patternKey, outcome }) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(agentId, "agentId");
  assertNonEmpty(patternKey, "patternKey");
  if (!OUTCOMES.includes(outcome)) throw new NpcAiValidationError(`unsupported observation outcome: ${outcome}`);
  const agent = state.agents[agentId];
  if (!agent) throw new NpcAiValidationError(`unknown NPC AI agent: ${agentId}`);
  const next = clone(state);
  const history = [...(next.agents[agentId].observations[patternKey] ?? []), { date: state.simulationDate, outcome }].slice(-state.maxObservationHistory);
  next.agents[agentId].observations[patternKey] = history;
  const repeatCount = history.length;
  if (repeatCount > 1) next.agents[agentId].adaptivePressure = Math.min(state.maxAdaptivePressure, agent.adaptivePressure + 1);
  return appendEvent(next, {
    eventType: "npc_ai.observation_recorded",
    actorId: agentId,
    subjectIds: [agentId],
    payload: {
      patternKey,
      outcome,
      repeatCount,
      adaptivePressureBand: pressureBand(next.agents[agentId].adaptivePressure),
    },
  });
}

export function planNpcAgent(state, { expectedRevision, agentId, goal, requiredBeliefs = [] }) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(agentId, "agentId");
  assertNonEmpty(goal, "goal");
  if (!Array.isArray(requiredBeliefs) || requiredBeliefs.some((claim) => typeof claim !== "string" || claim.trim() === "")) throw new NpcAiValidationError("requiredBeliefs must be non-empty strings");
  const agent = state.agents[agentId];
  if (!agent) throw new NpcAiValidationError(`unknown NPC AI agent: ${agentId}`);
  const knowledge = knowledgeBand(agent, requiredBeliefs);
  const urgentNeed = Math.max(...Object.values(agent.needs), 0);
  const obligation = Math.max(...Object.values(agent.obligations), 0);
  const posture = urgentNeed >= 80 ? "need-led" : knowledge === "uncertain" ? "hesitant" : obligation >= urgentNeed ? "obligation-led" : "goal-led";
  const plan = {
    planId: `plan-${String(state.nextEventId).padStart(6, "0")}`,
    goal,
    tier: agent.tier,
    knowledgeBand: knowledge,
    posture,
    steps: agent.tier === "major" ? ["assess", "choose", "act", "settle"] : ["choose", "settle"],
    adaptivePressureBand: pressureBand(agent.adaptivePressure),
    status: "proposed",
  };
  const next = clone(state);
  next.agents[agentId].plans = [...next.agents[agentId].plans, plan].slice(-10);
  return appendEvent(next, {
    eventType: "npc_ai.plan_proposed",
    actorId: agentId,
    subjectIds: [agentId],
    payload: { plan: clone(plan), requiredBeliefCount: requiredBeliefs.length },
  });
}

export function resolveNpcOrganizationOrder(state, { expectedRevision, agentId, orderId, consequenceBand = "moderate" }) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(agentId, "agentId");
  assertNonEmpty(orderId, "orderId");
  if (!["low", "moderate", "high"].includes(consequenceBand)) throw new NpcAiValidationError(`unsupported consequence band: ${consequenceBand}`);
  const agent = state.agents[agentId];
  if (!agent) throw new NpcAiValidationError(`unknown NPC AI agent: ${agentId}`);
  const score = agent.values.loyalty * 0.5 + agent.values.fear * 0.2 + agent.values.competence * 0.3;
  const outcome = score >= 65 ? "complies" : score <= 30 || (consequenceBand === "high" && agent.values.fear < 20) ? "deviates" : "hesitates";
  const order = { orderId, consequenceBand, outcome, status: "settled" };
  const next = clone(state);
  next.agents[agentId].orders = [...next.agents[agentId].orders, order].slice(-10);
  return appendEvent(next, {
    eventType: "npc_ai.organization_order_settled",
    actorId: agentId,
    subjectIds: [agentId, orderId],
    payload: clone(order),
  });
}

export function advanceNpcAiTime(state, { expectedRevision, days }) {
  assertRevision(state, expectedRevision);
  assertInteger(days, "days", 1, 3650);
  const next = clone(state);
  next.simulationDate = addDays(state.simulationDate, days);
  const drift = Math.max(1, Math.floor(days / 30));
  for (const agent of Object.values(next.agents)) {
    agent.needs.sleep = Math.min(100, agent.needs.sleep + drift);
    agent.needs.family = Math.min(100, agent.needs.family + Math.floor(drift / 2));
    if (agent.plans.at(-1) && days >= 30) agent.plans[agent.plans.length - 1].status = "stale";
  }
  return appendEvent(next, {
    eventType: "npc_ai.time_settled",
    actorId: "system:npc-ai-time",
    subjectIds: Object.keys(state.agents),
    payload: { days, drift },
  });
}

export function projectNpcAi(state, { scope = "public" } = {}) {
  if (scope !== "public") throw new NpcAiValidationError("NPC AI projection requires public scope");
  return {
    schemaVersion: NPC_AI_SCHEMA_VERSION,
    worldId: state.worldId,
    simulationDate: state.simulationDate,
    agents: Object.values(state.agents).map((agent) => ({
      id: agent.id,
      tier: agent.tier,
      planPosture: agent.plans.at(-1)?.posture ?? "uncommitted",
      planComplexity: agent.plans.at(-1)?.steps.length > 2 ? "multi-step" : agent.plans.at(-1) ? "bounded" : "none",
      adaptivePressureBand: pressureBand(agent.adaptivePressure),
      organizationDisposition: agent.orders.at(-1)?.outcome === "complies" ? "aligned" : agent.orders.at(-1)?.outcome === "deviates" ? "independent" : agent.orders.at(-1) ? "uncertain" : "unassigned",
    })),
    omittedFields: ["beliefs", "needs", "obligations", "values", "observations", "exact adaptive pressure", "plan goals", "events", "lastEventHash"],
  };
}

export function snapshotNpcAi(state) {
  const snapshotState = clone(state);
  const digestState = { ...snapshotState, events: [] };
  return { snapshotVersion: 1, state: snapshotState, stateDigest: canonicalJson(digestState) };
}

export function restoreNpcAi(snapshotValue) {
  if (!snapshotValue || snapshotValue.snapshotVersion !== 1) throw new NpcAiValidationError("unsupported NPC AI snapshot version");
  const state = clone(snapshotValue.state);
  if (!state || state.schemaVersion !== NPC_AI_SCHEMA_VERSION) throw new NpcAiValidationError("unsupported NPC AI schema version");
  if (snapshotValue.stateDigest !== canonicalJson({ ...state, events: [] })) throw new NpcAiValidationError("NPC AI snapshot digest is invalid");
  let revision = 0;
  let previousHash = null;
  for (const event of state.events) {
    if (event.revision !== revision + 1) throw new NpcAiValidationError("NPC AI revisions are not contiguous");
    if (event.previousHash !== previousHash) throw new NpcAiValidationError("NPC AI event chain is broken");
    const { hash, ...unsignedEvent } = event;
    if (hash !== eventHash(unsignedEvent, event.previousHash)) throw new NpcAiValidationError("NPC AI event hash is invalid");
    revision = event.revision;
    previousHash = event.hash;
  }
  if (state.revision !== revision || state.lastEventHash !== previousHash) throw new NpcAiValidationError("NPC AI snapshot does not match history");
  return state;
}
