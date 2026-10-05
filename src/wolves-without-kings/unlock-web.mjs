import { createHash } from "node:crypto";

import { canonicalJson } from "./engine.mjs";

export const UNLOCK_WEB_SCHEMA_VERSION = 1;

export class UnlockWebValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnlockWebValidationError";
  }
}

export class UnlockWebStaleRevisionError extends UnlockWebValidationError {
  constructor(expectedRevision, actualRevision) {
    super(`stale unlock-web command: expected revision ${expectedRevision}, actual revision ${actualRevision}`);
    this.name = "UnlockWebStaleRevisionError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

function clone(value) { return structuredClone(value); }

function assertObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new UnlockWebValidationError(`${field} must be an object`);
}

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new UnlockWebValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new UnlockWebValidationError(`${field} must be an integer between ${minimum} and ${maximum}`);
}

function assertRange(value, field, minimum = 0, maximum = 100) { assertInteger(value, field, minimum, maximum); }

function assertRevision(state, expectedRevision) {
  assertInteger(expectedRevision, "expectedRevision");
  if (expectedRevision !== state.revision) throw new UnlockWebStaleRevisionError(expectedRevision, state.revision);
}

function eventHash(event, previousHash) {
  const material = `${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`;
  return createHash("sha256").update(material).digest("hex");
}

function appendEvent(state, { eventType, actorId, subjectIds = [], payload = {} }) {
  const next = clone(state);
  const unsignedEvent = {
    eventId: `unlock-${String(next.nextEventId).padStart(6, "0")}`,
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

function requireNode(state, nodeId) {
  assertNonEmpty(nodeId, "nodeId");
  const node = state.nodes[nodeId];
  if (!node) throw new UnlockWebValidationError(`unknown unlock node: ${nodeId}`);
  return node;
}

function normalizeRequirements(requirements = {}) {
  assertObject(requirements, "requirements");
  const practice = requirements.practice ?? [];
  const familiarity = requirements.familiarity ?? [];
  const relationships = requirements.relationships ?? [];
  const context = requirements.context ?? [];
  assertInteger(requirements.timeFloorDays ?? 0, "requirements.timeFloorDays", 0, 100000);
  for (const [field, value] of [["practice", practice], ["familiarity", familiarity], ["relationships", relationships], ["context", context]]) {
    if (!Array.isArray(value)) throw new UnlockWebValidationError(`requirements.${field} must be an array`);
  }
  return {
    practice: practice.map((item, index) => {
      assertObject(item, `requirements.practice[${index}]`);
      assertNonEmpty(item.contextId, `requirements.practice[${index}].contextId`);
      assertInteger(item.amount, `requirements.practice[${index}].amount`, 1, 100000);
      return { contextId: item.contextId, amount: item.amount };
    }),
    knowledge: [...new Set((requirements.knowledge ?? []).map((item) => {
      assertNonEmpty(item, "requirements.knowledge");
      return item;
    }))],
    familiarity: familiarity.map((item, index) => {
      assertObject(item, `requirements.familiarity[${index}]`);
      assertNonEmpty(item.contextId, `requirements.familiarity[${index}].contextId`);
      assertRange(item.level, `requirements.familiarity[${index}].level`);
      return { contextId: item.contextId, level: item.level };
    }),
    timeFloorDays: requirements.timeFloorDays ?? 0,
    relationships: relationships.map((item, index) => {
      assertObject(item, `requirements.relationships[${index}]`);
      assertNonEmpty(item.relationshipId, `requirements.relationships[${index}].relationshipId`);
      assertNonEmpty(item.axis, `requirements.relationships[${index}].axis`);
      assertRange(item.minimum, `requirements.relationships[${index}].minimum`, -100, 100);
      return { relationshipId: item.relationshipId, axis: item.axis, minimum: item.minimum };
    }),
    context: context.map((item, index) => {
      assertObject(item, `requirements.context[${index}]`);
      assertNonEmpty(item.key, `requirements.context[${index}].key`);
      assertNonEmpty(item.value, `requirements.context[${index}].value`);
      return { key: item.key, value: item.value };
    }),
    status: clone(requirements.status ?? {}),
  };
}

function evaluate(state, node) {
  const unmet = [];
  for (const requirement of node.requirements.practice) {
    const actual = state.evidence.practice[requirement.contextId] ?? 0;
    if (actual < requirement.amount) unmet.push(`practice:${requirement.contextId}`);
  }
  for (const knowledgeId of node.requirements.knowledge) if (!state.evidence.knowledge[knowledgeId]) unmet.push(`knowledge:${knowledgeId}`);
  for (const requirement of node.requirements.familiarity) {
    const actual = state.evidence.familiarity[requirement.contextId] ?? 0;
    if (actual < requirement.level) unmet.push(`familiarity:${requirement.contextId}`);
  }
  if (state.evidence.elapsedDays < node.requirements.timeFloorDays) unmet.push("time-floor");
  for (const requirement of node.requirements.relationships) {
    const actual = state.evidence.relationships[requirement.relationshipId]?.[requirement.axis] ?? null;
    if (actual === null || actual < requirement.minimum) unmet.push(`relationship:${requirement.relationshipId}:${requirement.axis}`);
  }
  for (const requirement of node.requirements.context) if (state.evidence.context[requirement.key] !== requirement.value) unmet.push(`context:${requirement.key}`);
  for (const [key, value] of Object.entries(node.requirements.status)) if (state.evidence.status[key] !== value) unmet.push(`status:${key}`);
  const owned = state.owned[node.id];
  return { status: owned?.status ?? (unmet.length === 0 ? "eligible" : node.visibility === "hidden" ? "hidden" : "locked"), unmet };
}

export function createUnlockWebState({ characterId, simulationDate = "1998-01-01" } = {}) {
  assertNonEmpty(characterId, "characterId");
  assertNonEmpty(simulationDate, "simulationDate");
  return {
    schemaVersion: UNLOCK_WEB_SCHEMA_VERSION,
    characterId,
    simulationDate,
    revision: 0,
    nextEventId: 1,
    lastEventHash: null,
    nodes: {},
    owned: {},
    evidence: {
      elapsedDays: 0,
      practice: {},
      knowledge: {},
      familiarity: {},
      relationships: {},
      context: {},
      status: {},
    },
    events: [],
  };
}

export function registerUnlockNode(
  state,
  { expectedRevision, nodeId, label, visibility = "discovered", requirements = {}, unlockEffects = [], revocationRules = {} },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(nodeId, "nodeId");
  assertNonEmpty(label, "label");
  if (!["hidden", "discovered"].includes(visibility)) throw new UnlockWebValidationError(`unsupported node visibility: ${visibility}`);
  if (!Array.isArray(unlockEffects)) throw new UnlockWebValidationError("unlockEffects must be an array");
  const normalized = {
    id: nodeId,
    label,
    visibility,
    requirements: normalizeRequirements(requirements),
    unlockEffects: [...unlockEffects],
    revocationRules: clone(revocationRules),
  };
  if (state.nodes[nodeId]) throw new UnlockWebValidationError(`unlock node already exists: ${nodeId}`);
  const next = clone(state);
  next.nodes[nodeId] = normalized;
  return appendEvent(next, {
    eventType: "unlock.node_registered",
    actorId: state.characterId,
    subjectIds: [nodeId],
    payload: { nodeId, visibility },
  });
}

export function recordUnlockEvidence(state, { expectedRevision, domain, key, amount = 1, source = "direct-experience", axis = null, value = null }) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(domain, "domain");
  assertNonEmpty(key, "key");
  assertNonEmpty(source, "source");
  const next = clone(state);
  if (domain === "practice") {
    assertInteger(amount, "amount", 1, 100000);
    next.evidence.practice[key] = (next.evidence.practice[key] ?? 0) + amount;
  } else if (domain === "knowledge") {
    next.evidence.knowledge[key] = { source, learnedDate: state.simulationDate };
  } else if (domain === "familiarity") {
    assertRange(amount, "amount");
    next.evidence.familiarity[key] = Math.max(next.evidence.familiarity[key] ?? 0, amount);
  } else if (domain === "relationship") {
    assertNonEmpty(axis, "axis");
    assertRange(value, "value", -100, 100);
    if (!next.evidence.relationships[key]) next.evidence.relationships[key] = {};
    next.evidence.relationships[key][axis] = value;
  } else if (domain === "context" || domain === "status") {
    assertNonEmpty(value, "value");
    next.evidence[domain][key] = value;
  } else {
    throw new UnlockWebValidationError(`unsupported evidence domain: ${domain}`);
  }
  return appendEvent(next, {
    eventType: "unlock.evidence_recorded",
    actorId: state.characterId,
    subjectIds: [key],
    payload: { domain, key, source, axis, value, amount },
  });
}

export function settleUnlockTime(state, { expectedRevision, days }) {
  assertRevision(state, expectedRevision);
  assertInteger(days, "days", 1, 3650);
  const next = clone(state);
  const date = new Date(`${state.simulationDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  next.simulationDate = date.toISOString().slice(0, 10);
  next.evidence.elapsedDays += days;
  return appendEvent(next, {
    eventType: "unlock.time_settled",
    actorId: "system:time",
    subjectIds: [state.characterId],
    payload: { days, fromDate: state.simulationDate, toDate: next.simulationDate },
  });
}

export function evaluateUnlockNode(state, { expectedRevision, nodeId }) {
  assertRevision(state, expectedRevision);
  const node = requireNode(state, nodeId);
  const result = evaluate(state, node);
  const next = appendEvent(state, {
    eventType: "unlock.node_evaluated",
    actorId: state.characterId,
    subjectIds: [nodeId],
    payload: { nodeId, status: result.status, unmet: result.unmet },
  });
  return { state: next, result };
}

export function claimUnlockNode(state, { expectedRevision, nodeId }) {
  assertRevision(state, expectedRevision);
  const node = requireNode(state, nodeId);
  const result = evaluate(state, node);
  if (result.status !== "eligible") throw new UnlockWebValidationError(`unlock node is not eligible: ${nodeId}`);
  const next = clone(state);
  next.owned[nodeId] = { status: "owned", acquiredDate: state.simulationDate, effects: clone(node.unlockEffects) };
  return appendEvent(next, {
    eventType: "unlock.node_claimed",
    actorId: state.characterId,
    subjectIds: [nodeId],
    payload: { nodeId, effects: clone(node.unlockEffects) },
  });
}

export function projectUnlockWeb(state) {
  return {
    schemaVersion: UNLOCK_WEB_SCHEMA_VERSION,
    characterId: state.characterId,
    simulationDate: state.simulationDate,
    nodes: Object.values(state.nodes).map((node) => {
      const result = evaluate(state, node);
      return { id: node.id, label: node.label, visibility: node.visibility, status: result.status, unmetCount: result.unmet.length };
    }),
    omittedFields: ["exact evidence", "evidence sources", "unlockEffects", "revocationRules", "events", "lastEventHash"],
  };
}

export function snapshotUnlockWeb(state) { return { snapshotVersion: 1, state: clone(state) }; }

export function restoreUnlockWeb(snapshotValue) {
  if (!snapshotValue || snapshotValue.snapshotVersion !== 1) throw new UnlockWebValidationError("unsupported unlock-web snapshot version");
  const state = clone(snapshotValue.state);
  if (!state || state.schemaVersion !== UNLOCK_WEB_SCHEMA_VERSION) throw new UnlockWebValidationError("unsupported unlock-web schema version");
  let revision = 0;
  let previousHash = null;
  for (const event of state.events) {
    if (event.revision !== revision + 1) throw new UnlockWebValidationError("unlock-web revisions are not contiguous");
    if (event.previousHash !== previousHash) throw new UnlockWebValidationError("unlock-web event chain is broken");
    const { hash, ...unsignedEvent } = event;
    if (hash !== eventHash(unsignedEvent, event.previousHash)) throw new UnlockWebValidationError("unlock-web event hash is invalid");
    revision = event.revision;
    previousHash = event.hash;
  }
  if (state.revision !== revision || state.lastEventHash !== previousHash) throw new UnlockWebValidationError("unlock-web snapshot does not match history");
  return state;
}
