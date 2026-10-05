import { createHash } from "node:crypto";

import { canonicalJson } from "./engine.mjs";

export const DOCTRINE_SCHEMA_VERSION = 1;

export class DoctrineValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "DoctrineValidationError";
  }
}

export class DoctrineStaleRevisionError extends DoctrineValidationError {
  constructor(expectedRevision, actualRevision) {
    super(`stale doctrine command: expected revision ${expectedRevision}, actual revision ${actualRevision}`);
    this.name = "DoctrineStaleRevisionError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

function clone(value) {
  return structuredClone(value);
}

function assertObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new DoctrineValidationError(`${field} must be an object`);
}

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new DoctrineValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new DoctrineValidationError(`${field} must be an integer between ${minimum} and ${maximum}`);
}

function assertRange(value, field, minimum = 0, maximum = 100) {
  assertInteger(value, field, minimum, maximum);
}

function assertArrayOfStrings(value, field) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) throw new DoctrineValidationError(`${field} must be an array of non-empty strings`);
}

function assertRevision(state, expectedRevision) {
  assertInteger(expectedRevision, "expectedRevision");
  if (expectedRevision !== state.revision) throw new DoctrineStaleRevisionError(expectedRevision, state.revision);
}

function eventHash(event, previousHash) {
  const material = `${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`;
  return createHash("sha256").update(material).digest("hex");
}

function appendEvent(state, { eventType, actorId, subjectIds = [], payload = {} }) {
  const next = clone(state);
  const unsignedEvent = {
    eventId: `doctrine-${String(next.nextEventId).padStart(6, "0")}`,
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

function normalizeRules(rules = {}) {
  assertObject(rules, "doctrineRules");
  const normalized = {
    permittedActivities: rules.permittedActivities ?? [],
    forbiddenActivities: rules.forbiddenActivities ?? [],
    toleratedActivities: rules.toleratedActivities ?? [],
    civilianPolicy: rules.civilianPolicy ?? "avoid-harm",
    familyPolicy: rules.familyPolicy ?? "protected",
    foreignPolicy: rules.foreignPolicy ?? "cautious",
    policePolicy: rules.policePolicy ?? "low-profile",
  };
  for (const key of ["permittedActivities", "forbiddenActivities", "toleratedActivities"]) assertArrayOfStrings(normalized[key], `doctrineRules.${key}`);
  for (const key of ["civilianPolicy", "familyPolicy", "foreignPolicy", "policePolicy"]) assertNonEmpty(normalized[key], `doctrineRules.${key}`);
  return {
    ...normalized,
    permittedActivities: [...new Set(normalized.permittedActivities)],
    forbiddenActivities: [...new Set(normalized.forbiddenActivities)],
    toleratedActivities: [...new Set(normalized.toleratedActivities)],
  };
}

function normalizeMember(member, index) {
  assertObject(member, `members[${index}]`);
  assertNonEmpty(member.memberId, `members[${index}].memberId`);
  assertNonEmpty(member.role, `members[${index}].role`);
  assertNonEmpty(member.coalitionId, `members[${index}].coalitionId`);
  assertInteger(member.seniorityDays ?? 0, `members[${index}].seniorityDays`, 0, 100000);
  assertRange(member.relationshipToLeader ?? 0, `members[${index}].relationshipToLeader`, -100, 100);
  if (!["low", "moderate", "high"].includes(member.capabilityBand ?? "moderate")) throw new DoctrineValidationError(`unsupported capability band: ${member.capabilityBand}`);
  assertRange(member.coalitionSupport ?? 0, `members[${index}].coalitionSupport`);
  const values = member.values ?? {};
  assertObject(values, `members[${index}].values`);
  for (const key of ["tradition", "familySafety", "profit", "autonomy"]) assertRange(values[key] ?? 50, `members[${index}].values.${key}`);
  return {
    id: member.memberId,
    role: member.role,
    coalitionId: member.coalitionId,
    status: member.status ?? "active",
    seniorityDays: member.seniorityDays ?? 0,
    relationshipToLeader: member.relationshipToLeader ?? 0,
    capabilityBand: member.capabilityBand ?? "moderate",
    coalitionSupport: member.coalitionSupport ?? 0,
    values: {
      tradition: values.tradition ?? 50,
      familySafety: values.familySafety ?? 50,
      profit: values.profit ?? 50,
      autonomy: values.autonomy ?? 50,
    },
    disciplineHistory: { compliance: 0, breaches: 0, disputed: 0 },
    lastDecision: null,
  };
}

function capabilityScore(band) {
  return { low: 10, moderate: 20, high: 30 }[band];
}

function successionScore(member) {
  return Math.max(0, Math.min(25, Math.floor(member.seniorityDays / 365) * 5))
    + Math.max(0, Math.min(25, Math.round((member.relationshipToLeader + 100) / 8)))
    + capabilityScore(member.capabilityBand)
    + Math.round(member.coalitionSupport * 0.3)
    + Math.min(10, member.disciplineHistory.compliance)
    - Math.min(10, member.disciplineHistory.breaches * 2);
}

function requireMember(state, memberId) {
  assertNonEmpty(memberId, "memberId");
  const member = state.members[memberId];
  if (!member) throw new DoctrineValidationError(`unknown organization member: ${memberId}`);
  return member;
}

export function createDoctrineState({
  organizationId,
  displayName,
  leaderId,
  members = [],
  coalitions = [],
  doctrineRules = {},
  simulationDate = "1998-01-01",
} = {}) {
  assertNonEmpty(organizationId, "organizationId");
  assertNonEmpty(displayName, "displayName");
  assertNonEmpty(leaderId, "leaderId");
  assertNonEmpty(simulationDate, "simulationDate");
  if (!Array.isArray(members) || members.length === 0) throw new DoctrineValidationError("members must contain at least one member");
  const normalizedMembers = {};
  for (let index = 0; index < members.length; index += 1) {
    const member = normalizeMember(members[index], index);
    if (normalizedMembers[member.id]) throw new DoctrineValidationError(`duplicate member: ${member.id}`);
    normalizedMembers[member.id] = member;
  }
  if (!normalizedMembers[leaderId]) throw new DoctrineValidationError(`leader is not a member: ${leaderId}`);
  if (!Array.isArray(coalitions)) throw new DoctrineValidationError("coalitions must be an array");
  const normalizedCoalitions = {};
  for (const coalition of coalitions) {
    assertObject(coalition, "coalition");
    assertNonEmpty(coalition.coalitionId, "coalition.coalitionId");
    assertNonEmpty(coalition.label, "coalition.label");
    if (normalizedCoalitions[coalition.coalitionId]) throw new DoctrineValidationError(`duplicate coalition: ${coalition.coalitionId}`);
    normalizedCoalitions[coalition.coalitionId] = {
      id: coalition.coalitionId,
      label: coalition.label,
      memberIds: Object.values(normalizedMembers).filter((member) => member.coalitionId === coalition.coalitionId).map((member) => member.id),
    };
  }
  for (const member of Object.values(normalizedMembers)) {
    if (!normalizedCoalitions[member.coalitionId]) throw new DoctrineValidationError(`unknown member coalition: ${member.coalitionId}`);
  }
  return {
    schemaVersion: DOCTRINE_SCHEMA_VERSION,
    organizationId,
    displayName,
    simulationDate,
    doctrineRules: normalizeRules(doctrineRules),
    leadershipRoles: { leader: leaderId },
    members: normalizedMembers,
    coalitions: normalizedCoalitions,
    disciplineHistory: [],
    doctrineHistory: [],
    successionHistory: [],
    doctrineAgeDays: 0,
    status: "consolidated",
    revision: 0,
    nextEventId: 1,
    lastEventHash: null,
    events: [],
  };
}

export function updateDoctrine(
  state,
  { expectedRevision, actorId, doctrineRules },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(actorId, "actorId");
  if (![state.leadershipRoles.leader, ...Object.values(state.members).filter((member) => member.role === "council").map((member) => member.id)].includes(actorId)) {
    throw new DoctrineValidationError("actor is not authorized to update doctrine");
  }
  const nextRules = normalizeRules(doctrineRules);
  const next = clone(state);
  next.doctrineRules = nextRules;
  next.doctrineHistory.push({ date: state.simulationDate, actorId, rules: clone(nextRules) });
  return appendEvent(next, {
    eventType: "doctrine.organization_updated",
    actorId,
    subjectIds: [state.organizationId],
    payload: { rules: clone(nextRules) },
  });
}

export function resolveMemberDecision(
  state,
  { expectedRevision, memberId, activity, contextKnowledge = "known" },
) {
  assertRevision(state, expectedRevision);
  const member = requireMember(state, memberId);
  assertNonEmpty(activity, "activity");
  if (!["known", "uncertain", "unknown"].includes(contextKnowledge)) throw new DoctrineValidationError(`unsupported context knowledge: ${contextKnowledge}`);
  const rules = state.doctrineRules;
  const forbidden = rules.forbiddenActivities.includes(activity);
  const tolerated = rules.toleratedActivities.includes(activity);
  let decision = "proceed";
  let rationale = "permitted-by-doctrine";
  if (contextKnowledge === "unknown") {
    decision = "pause";
    rationale = "insufficient-knowledge";
  } else if (forbidden && member.values.tradition + member.values.familySafety >= member.values.profit + member.values.autonomy) {
    decision = "comply";
    rationale = "values-align-with-forbidden-rule";
  } else if (forbidden) {
    decision = "deviate";
    rationale = "profit-or-autonomy-overrides-rule";
  } else if (tolerated) {
    decision = member.values.autonomy >= 60 ? "proceed" : "pause";
    rationale = "tolerated-with-member-discretion";
  }
  const consequence = decision === "deviate" ? "discipline-review" : decision === "pause" ? "delayed-work" : "none";
  const record = { memberId, activity, contextKnowledge, decision, rationale, consequence, date: state.simulationDate };
  const next = clone(state);
  next.members[memberId].lastDecision = clone(record);
  next.members[memberId].disciplineHistory[decision === "deviate" ? "breaches" : decision === "pause" ? "disputed" : "compliance"] += 1;
  next.disciplineHistory.push(record);
  return appendEvent(next, {
    eventType: "doctrine.member_decision",
    actorId: memberId,
    subjectIds: [state.organizationId, memberId],
    payload: { record },
  });
}

export function settleDoctrineTime(state, { expectedRevision, days }) {
  assertRevision(state, expectedRevision);
  assertInteger(days, "days", 1, 3650);
  const date = new Date(`${state.simulationDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  const next = clone(state);
  next.simulationDate = date.toISOString().slice(0, 10);
  next.doctrineAgeDays += days;
  if (next.doctrineAgeDays >= 730 && next.status === "consolidated") next.status = "generational-tension";
  return appendEvent(next, {
    eventType: "doctrine.time_settled",
    actorId: "system:time",
    subjectIds: [state.organizationId],
    payload: { days, fromDate: state.simulationDate, toDate: next.simulationDate, status: next.status },
  });
}

export function resolveSuccession(
  state,
  { expectedRevision, leaderId = state.leadershipRoles.leader, cause = "retired" },
) {
  assertRevision(state, expectedRevision);
  const leader = requireMember(state, leaderId);
  if (state.leadershipRoles.leader !== leaderId) throw new DoctrineValidationError("leader is not the current organization leader");
  if (!["retired", "died", "arrested", "disappeared"].includes(cause)) throw new DoctrineValidationError(`unsupported succession cause: ${cause}`);
  const candidates = Object.values(state.members)
    .filter((member) => member.id !== leaderId && member.status === "active" && member.seniorityDays >= 180 && member.capabilityBand !== "low")
    .map((member) => ({ memberId: member.id, coalitionId: member.coalitionId, score: successionScore(member) }))
    .sort((a, b) => b.score - a.score || a.memberId.localeCompare(b.memberId));
  const next = clone(state);
  next.members[leaderId].status = cause;
  const top = candidates[0] ?? null;
  const runnerUp = candidates[1] ?? null;
  let outcome;
  if (!top) {
    outcome = { type: "caretaker", leaderId: null, factions: [] };
    next.leadershipRoles.leader = null;
    next.status = "caretaker";
  } else if (runnerUp && top.score - runnerUp.score < 8 && top.coalitionId !== runnerUp.coalitionId) {
    outcome = { type: "fragmented", leaderId: null, factions: [top.memberId, runnerUp.memberId] };
    next.leadershipRoles.leader = null;
    next.status = "fragmented";
  } else {
    outcome = { type: "consolidated", leaderId: top.memberId, factions: [top.memberId] };
    next.leadershipRoles.leader = top.memberId;
    next.status = "consolidated";
    next.members[top.memberId].role = "leader";
  }
  const record = {
    date: state.simulationDate,
    predecessorId: leaderId,
    cause,
    candidates: clone(candidates),
    outcome: clone(outcome),
  };
  next.successionHistory.push(record);
  return appendEvent(next, {
    eventType: "doctrine.succession_resolved",
    actorId: leaderId,
    subjectIds: [state.organizationId, leaderId, ...candidates.map((candidate) => candidate.memberId)],
    payload: clone(record),
  });
}

export function projectDoctrine(state) {
  return {
    schemaVersion: DOCTRINE_SCHEMA_VERSION,
    organizationId: state.organizationId,
    displayName: state.displayName,
    status: state.status,
    simulationDate: state.simulationDate,
    doctrine: {
      permittedCount: state.doctrineRules.permittedActivities.length,
      forbiddenCount: state.doctrineRules.forbiddenActivities.length,
      toleratedCount: state.doctrineRules.toleratedActivities.length,
      civilianPolicy: state.doctrineRules.civilianPolicy,
      familyPolicy: state.doctrineRules.familyPolicy,
    },
    leadership: {
      leaderPresent: Boolean(state.leadershipRoles.leader),
      successionCount: state.successionHistory.length,
      coalitionCount: Object.keys(state.coalitions).length,
    },
    members: Object.values(state.members).map((member) => ({
      id: member.id,
      role: member.role,
      status: member.status,
      coalitionId: member.coalitionId,
      complianceBand: member.disciplineHistory.breaches > member.disciplineHistory.compliance ? "strained" : member.disciplineHistory.compliance > 0 ? "stable" : "unknown",
    })),
    omittedFields: ["values", "relationshipToLeader", "coalitionSupport", "disciplineHistory", "succession candidate scores", "events", "lastEventHash"],
  };
}

export function snapshotDoctrine(state) {
  return { snapshotVersion: 1, state: clone(state) };
}

export function restoreDoctrine(snapshotValue) {
  if (!snapshotValue || snapshotValue.snapshotVersion !== 1) throw new DoctrineValidationError("unsupported doctrine snapshot version");
  const state = clone(snapshotValue.state);
  if (!state || state.schemaVersion !== DOCTRINE_SCHEMA_VERSION) throw new DoctrineValidationError("unsupported doctrine schema version");
  let revision = 0;
  let previousHash = null;
  for (const event of state.events) {
    if (event.revision !== revision + 1) throw new DoctrineValidationError("doctrine revisions are not contiguous");
    if (event.previousHash !== previousHash) throw new DoctrineValidationError("doctrine event chain is broken");
    const { hash, ...unsignedEvent } = event;
    if (hash !== eventHash(unsignedEvent, event.previousHash)) throw new DoctrineValidationError("doctrine event hash is invalid");
    revision = event.revision;
    previousHash = event.hash;
  }
  if (state.revision !== revision || state.lastEventHash !== previousHash) throw new DoctrineValidationError("doctrine snapshot does not match history");
  return state;
}
