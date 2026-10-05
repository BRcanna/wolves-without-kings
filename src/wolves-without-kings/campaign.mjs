import { createHash } from "node:crypto";

import { canonicalJson } from "./engine.mjs";

export const CAMPAIGN_SCHEMA_VERSION = 1;

export class CampaignValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "CampaignValidationError";
  }
}

export class CampaignStaleRevisionError extends CampaignValidationError {
  constructor(expectedRevision, actualRevision) {
    super(`stale campaign command: expected revision ${expectedRevision}, actual revision ${actualRevision}`);
    this.name = "CampaignStaleRevisionError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

function clone(value) { return structuredClone(value); }

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new CampaignValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new CampaignValidationError(`${field} must be an integer between ${minimum} and ${maximum}`);
  }
}

function assertDate(value, field) {
  assertNonEmpty(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())) {
    throw new CampaignValidationError(`${field} must be an ISO date`);
  }
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function eraFor(dateString) {
  const year = Number(dateString.slice(0, 4));
  if (year < 2000) return "late-1990s";
  if (year < 2005) return "early-2000s";
  if (year < 2010) return "late-2000s";
  return "later-era";
}

function eventHash(event, previousHash) {
  return createHash("sha256")
    .update(`${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`)
    .digest("hex");
}

function assertRevision(state, expectedRevision) {
  assertInteger(expectedRevision, "expectedRevision");
  if (expectedRevision !== state.revision) throw new CampaignStaleRevisionError(expectedRevision, state.revision);
}

function assertLifecycle(state, allowed, action) {
  if (!allowed.includes(state.status)) throw new CampaignValidationError(`${action} is not valid while campaign is ${state.status}`);
}

function appendEvent(state, { eventType, actorId = "system:campaign", subjectIds = [], payload = {} }) {
  const next = clone(state);
  const unsignedEvent = {
    eventId: `campaign-${String(next.nextEventId).padStart(6, "0")}`,
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

function requireOpportunity(state, opportunityId) {
  assertNonEmpty(opportunityId, "opportunityId");
  const opportunity = state.opportunities[opportunityId];
  if (!opportunity) throw new CampaignValidationError(`unknown campaign opportunity: ${opportunityId}`);
  return opportunity;
}

export function createCampaignState({ campaignId = "campaign:wwk", worldSeed = "wwk-seed", startDate = "1998-01-01" } = {}) {
  assertNonEmpty(campaignId, "campaignId");
  assertNonEmpty(worldSeed, "worldSeed");
  assertDate(startDate, "startDate");
  return {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    campaignId,
    worldSeed,
    simulationDate: startDate,
    era: eraFor(startDate),
    status: "setup",
    chapter: "prologue",
    revision: 0,
    nextEventId: 1,
    lastEventHash: null,
    onlineRequired: false,
    lifeClock: "paused",
    storyFlags: {},
    systemicState: {
      daysAdvanced: 0,
      jobsSettled: 0,
      businessesSettled: 0,
      casesSettled: 0,
    },
    opportunities: {},
    relationships: {},
    businesses: {},
    cases: {},
    organization: { state: "unformed", history: [] },
    successorState: null,
    ending: null,
    events: [],
  };
}

export function startCampaign(state, { expectedRevision, actorId = "character:player" }) {
  assertRevision(state, expectedRevision);
  assertLifecycle(state, ["setup"], "start campaign");
  assertNonEmpty(actorId, "actorId");
  const next = clone(state);
  next.status = "active";
  next.lifeClock = "running";
  next.storyFlags["campaign-started"] = true;
  return appendEvent(next, { eventType: "campaign.started", actorId, subjectIds: [state.campaignId] });
}

export function pauseCampaign(state, { expectedRevision, actorId = "character:player" }) {
  assertRevision(state, expectedRevision);
  assertLifecycle(state, ["active"], "pause campaign");
  const next = clone(state);
  next.lifeClock = "paused";
  return appendEvent(next, { eventType: "campaign.paused", actorId, subjectIds: [state.campaignId] });
}

export function resumeCampaign(state, { expectedRevision, actorId = "character:player" }) {
  assertRevision(state, expectedRevision);
  assertLifecycle(state, ["active"], "resume campaign");
  const next = clone(state);
  next.lifeClock = "running";
  return appendEvent(next, { eventType: "campaign.resumed", actorId, subjectIds: [state.campaignId] });
}

export function offerCampaignOpportunity(
  state,
  { expectedRevision, opportunityId, contactId, title, chapter = state.chapter, expiresAfterDays = 60 },
) {
  assertRevision(state, expectedRevision);
  assertLifecycle(state, ["active"], "offer opportunity");
  assertNonEmpty(opportunityId, "opportunityId");
  assertNonEmpty(contactId, "contactId");
  assertNonEmpty(title, "title");
  assertNonEmpty(chapter, "chapter");
  assertInteger(expiresAfterDays, "expiresAfterDays", 1, 3650);
  if (state.opportunities[opportunityId]) throw new CampaignValidationError(`opportunity already exists: ${opportunityId}`);
  const opportunity = {
    id: opportunityId,
    contactId,
    title,
    chapter,
    status: "open",
    createdDate: state.simulationDate,
    deadline: addDays(state.simulationDate, expiresAfterDays),
    branch: null,
    resolutionDate: null,
  };
  const next = clone(state);
  next.opportunities[opportunityId] = opportunity;
  next.storyFlags[`opportunity:${opportunityId}`] = "open";
  return appendEvent(next, {
    eventType: "campaign.opportunity_offered",
    subjectIds: [opportunityId, contactId],
    payload: { opportunity: clone(opportunity) },
  });
}

export function resolveCampaignOpportunity(
  state,
  { expectedRevision, opportunityId, outcome, actorId = "character:player" },
) {
  assertRevision(state, expectedRevision);
  assertLifecycle(state, ["active"], "resolve opportunity");
  const opportunity = requireOpportunity(state, opportunityId);
  if (opportunity.status !== "open") throw new CampaignValidationError(`opportunity is already ${opportunity.status}`);
  if (!["accepted", "delegated", "ignored"].includes(outcome)) throw new CampaignValidationError(`unsupported opportunity outcome: ${outcome}`);
  const next = clone(state);
  const branch = outcome === "accepted" ? "direct" : outcome === "delegated" ? "delegated" : "deferred";
  next.opportunities[opportunityId] = {
    ...opportunity,
    status: outcome,
    branch,
    resolutionDate: state.simulationDate,
  };
  next.storyFlags[`opportunity:${opportunityId}`] = branch;
  return appendEvent(next, {
    eventType: "campaign.opportunity_resolved",
    actorId,
    subjectIds: [opportunityId, opportunity.contactId],
    payload: { outcome, branch },
  });
}

export function settleCampaignTime(state, { expectedRevision, days, actorId = "character:player", controlled = false }) {
  assertRevision(state, expectedRevision);
  assertLifecycle(state, ["active"], "settle campaign time");
  if (state.lifeClock === "paused" && controlled !== true) throw new CampaignValidationError("paused campaign requires controlled time advancement");
  assertInteger(days, "days", 1, 3650);
  const nextDate = addDays(state.simulationDate, days);
  const next = clone(state);
  next.simulationDate = nextDate;
  next.era = eraFor(nextDate);
  next.systemicState.daysAdvanced += days;
  const adapted = [];
  for (const opportunity of Object.values(next.opportunities)) {
    if (opportunity.status === "open" && nextDate > opportunity.deadline) {
      opportunity.status = "adapted";
      opportunity.branch = "contact-adapted";
      opportunity.resolutionDate = nextDate;
      next.storyFlags[`opportunity:${opportunity.id}`] = "missed-adapted";
      adapted.push(opportunity.id);
    }
  }
  return appendEvent(next, {
    eventType: "campaign.time_settled",
    actorId,
    subjectIds: [state.campaignId],
    payload: { fromDate: state.simulationDate, toDate: nextDate, days, adaptedOpportunities: adapted },
  });
}

export function recordSystemicCampaignSettlement(
  state,
  { expectedRevision, kind, entityId, outcome = "continued", actorId = "system:campaign" },
) {
  assertRevision(state, expectedRevision);
  assertLifecycle(state, ["active"], "record systemic settlement");
  if (!["job", "business", "case"].includes(kind)) throw new CampaignValidationError(`unsupported systemic kind: ${kind}`);
  assertNonEmpty(entityId, "entityId");
  assertNonEmpty(outcome, "outcome");
  const next = clone(state);
  const field = kind === "job" ? "jobsSettled" : kind === "business" ? "businessesSettled" : "casesSettled";
  next.systemicState[field] += 1;
  next.storyFlags[`systemic:${entityId}`] = outcome;
  return appendEvent(next, {
    eventType: "campaign.systemic_settled",
    actorId,
    subjectIds: [entityId],
    payload: { kind, outcome },
  });
}

export function advanceCampaignChapter(state, { expectedRevision, chapter, actorId = "character:player" }) {
  assertRevision(state, expectedRevision);
  assertLifecycle(state, ["active"], "advance campaign chapter");
  assertNonEmpty(chapter, "chapter");
  const next = clone(state);
  const previousChapter = next.chapter;
  next.chapter = chapter;
  next.storyFlags[`chapter:${chapter}`] = "reached";
  return appendEvent(next, {
    eventType: "campaign.chapter_advanced",
    actorId,
    subjectIds: [state.campaignId],
    payload: { previousChapter, chapter },
  });
}

export function completeCampaign(state, { expectedRevision, ending = "survival", actorId = "character:player" }) {
  assertRevision(state, expectedRevision);
  assertLifecycle(state, ["active"], "complete campaign");
  assertNonEmpty(ending, "ending");
  const next = clone(state);
  next.status = "completed";
  next.lifeClock = "stopped";
  next.ending = { label: ending, date: state.simulationDate, chapter: state.chapter };
  next.storyFlags["campaign-completed"] = ending;
  return appendEvent(next, {
    eventType: "campaign.completed",
    actorId,
    subjectIds: [state.campaignId],
    payload: { ending, chapter: state.chapter },
  });
}

export function createCampaignSuccessor(
  state,
  { expectedRevision, successorId, displayName, actorId = "system:legacy" },
) {
  assertRevision(state, expectedRevision);
  assertLifecycle(state, ["completed"], "create campaign successor");
  assertNonEmpty(successorId, "successorId");
  assertNonEmpty(displayName, "displayName");
  if (state.successorState) throw new CampaignValidationError("campaign successor already exists");
  const next = clone(state);
  next.status = "retired";
  next.lifeClock = "stopped";
  next.successorState = {
    successorId,
    displayName,
    inheritedLegacy: ["public-reputation-band", "durable-relationships", "place-memory"],
    exactSkillsTransferred: false,
    privateMemoryTransferred: false,
    competitivePowerTransferred: false,
    sourceEnding: clone(state.ending),
  };
  return appendEvent(next, {
    eventType: "campaign.successor_created",
    actorId,
    subjectIds: [state.campaignId, successorId],
    payload: { successor: clone(next.successorState) },
  });
}

export function projectCampaign(state, { scope = "public" } = {}) {
  if (!["public", "debug"].includes(scope)) throw new CampaignValidationError(`unsupported campaign projection scope: ${scope}`);
  return {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    campaignId: state.campaignId,
    status: state.status,
    simulationDate: state.simulationDate,
    era: state.era,
    chapter: state.chapter,
    lifeClock: state.lifeClock,
    onlineRequired: state.onlineRequired,
    storyFlags: { ...state.storyFlags },
    systemicState: { ...state.systemicState },
    opportunityBands: Object.values(state.opportunities).map((opportunity) => ({
      id: opportunity.id,
      chapter: opportunity.chapter,
      status: opportunity.status,
      branch: opportunity.branch,
    })),
    ending: clone(state.ending),
    successor: state.successorState ? {
      successorId: state.successorState.successorId,
      displayName: state.successorState.displayName,
      inheritedLegacy: [...state.successorState.inheritedLegacy],
    } : null,
    ...(scope === "debug" ? { worldSeed: state.worldSeed, events: clone(state.events) } : {}),
    omittedFields: scope === "public" ? ["worldSeed", "private relationships", "exact systemic payload", "event hashes"] : [],
  };
}

export function snapshotCampaign(state) { return { snapshotVersion: 1, state: clone(state) }; }

export function restoreCampaign(snapshotValue) {
  if (!snapshotValue || snapshotValue.snapshotVersion !== 1) throw new CampaignValidationError("unsupported campaign snapshot version");
  const state = clone(snapshotValue.state);
  if (!state || state.schemaVersion !== CAMPAIGN_SCHEMA_VERSION) throw new CampaignValidationError("unsupported campaign schema version");
  let revision = 0;
  let previousHash = null;
  for (const event of state.events) {
    if (event.revision !== revision + 1) throw new CampaignValidationError("campaign revisions are not contiguous");
    if (event.previousHash !== previousHash) throw new CampaignValidationError("campaign event chain is broken");
    const { hash, ...unsignedEvent } = event;
    if (hash !== eventHash(unsignedEvent, event.previousHash)) throw new CampaignValidationError("campaign event hash is invalid");
    revision = event.revision;
    previousHash = event.hash;
  }
  if (state.revision !== revision || state.lastEventHash !== previousHash) throw new CampaignValidationError("campaign snapshot does not match history");
  return state;
}
