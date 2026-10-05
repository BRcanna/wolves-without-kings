import { createHash } from "node:crypto";

import { canonicalJson } from "./engine.mjs";

export const CONTENT_SCHEMA_VERSION = 1;

export class ContentValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ContentValidationError";
  }
}

export class ContentStaleRevisionError extends ContentValidationError {
  constructor(expectedRevision, actualRevision) {
    super(`stale content command: expected revision ${expectedRevision}, actual revision ${actualRevision}`);
    this.name = "ContentStaleRevisionError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

function clone(value) { return structuredClone(value); }

function assertObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ContentValidationError(`${field} must be an object`);
}

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new ContentValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new ContentValidationError(`${field} must be an integer between ${minimum} and ${maximum}`);
}

function assertRevision(state, expectedRevision) {
  assertInteger(expectedRevision, "expectedRevision");
  if (expectedRevision !== state.revision) throw new ContentStaleRevisionError(expectedRevision, state.revision);
}

function assertArray(value, field) {
  if (!Array.isArray(value)) throw new ContentValidationError(`${field} must be an array`);
}

function eventHash(event, previousHash) {
  const material = `${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`;
  return createHash("sha256").update(material).digest("hex");
}

function appendEvent(state, { eventType, actorId, subjectIds = [], payload = {} }) {
  const next = clone(state);
  const unsignedEvent = {
    eventId: `content-${String(next.nextEventId).padStart(6, "0")}`,
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

function normalizeEntity(entity, field, requiredFields = []) {
  assertObject(entity, field);
  assertNonEmpty(entity.id, `${field}.id`);
  for (const required of requiredFields) assertNonEmpty(entity[required], `${field}.${required}`);
  return clone(entity);
}

function assertUniqueIds(entities, field) {
  const seen = new Set();
  for (const entity of entities) {
    if (seen.has(entity.id)) throw new ContentValidationError(`duplicate ${field} id: ${entity.id}`);
    seen.add(entity.id);
  }
}

export function createContentRegistry({ packId, simulationDate = "1998-01-01", activeEra = "late-1990s" } = {}) {
  assertNonEmpty(packId, "packId");
  assertNonEmpty(simulationDate, "simulationDate");
  assertNonEmpty(activeEra, "activeEra");
  return {
    schemaVersion: CONTENT_SCHEMA_VERSION,
    packId,
    simulationDate,
    activeEra,
    revision: 0,
    nextEventId: 1,
    lastEventHash: null,
    regions: {},
    npcs: {},
    businesses: {},
    organizations: {},
    eraVariants: {},
    events: [],
  };
}

export function admitContentPack(
  state,
  { expectedRevision, actorId = "system:content", regions = [], npcs = [], businesses = [], organizations = [], eraVariants = {} },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(actorId, "actorId");
  for (const [field, value] of [["regions", regions], ["npcs", npcs], ["businesses", businesses], ["organizations", organizations]]) assertArray(value, field);
  assertObject(eraVariants, "eraVariants");
  const normalized = {
    regions: regions.map((entity, index) => normalizeEntity(entity, `regions[${index}]`, ["label"])),
    npcs: npcs.map((entity, index) => normalizeEntity(entity, `npcs[${index}]`, ["displayName", "regionId"])),
    businesses: businesses.map((entity, index) => normalizeEntity(entity, `businesses[${index}]`, ["label", "regionId"])),
    organizations: organizations.map((entity, index) => normalizeEntity(entity, `organizations[${index}]`, ["displayName"])),
  };
  for (const [field, entities] of Object.entries(normalized)) {
    assertUniqueIds(entities, field.slice(0, -1));
    for (const entity of entities) if (state[field][entity.id]) throw new ContentValidationError(`${field.slice(0, -1)} already admitted: ${entity.id}`);
  }
  const regionIds = new Set([...Object.keys(state.regions), ...normalized.regions.map((entity) => entity.id)]);
  const organizationIds = new Set([...Object.keys(state.organizations), ...normalized.organizations.map((entity) => entity.id)]);
  const businessIds = new Set([...Object.keys(state.businesses), ...normalized.businesses.map((entity) => entity.id)]);
  for (const npc of normalized.npcs) if (!regionIds.has(npc.regionId)) throw new ContentValidationError(`NPC references unknown region: ${npc.id}`);
  for (const business of normalized.businesses) if (!regionIds.has(business.regionId)) throw new ContentValidationError(`business references unknown region: ${business.id}`);
  for (const organization of normalized.organizations) {
    for (const regionId of organization.regionIds ?? []) if (!regionIds.has(regionId)) throw new ContentValidationError(`organization references unknown region: ${organization.id}`);
    for (const memberId of organization.memberIds ?? []) {
      if (!normalized.npcs.some((npc) => npc.id === memberId) && !state.npcs[memberId]) throw new ContentValidationError(`organization references unknown NPC: ${organization.id}`);
    }
  }
  for (const [era, variants] of Object.entries(eraVariants)) {
    assertArray(variants, `eraVariants.${era}`);
    for (const [index, variant] of variants.entries()) {
      const normalizedVariant = normalizeEntity(variant, `eraVariants.${era}[${index}]`, ["baseId"]);
      if (!regionIds.has(normalizedVariant.baseId) && !organizationIds.has(normalizedVariant.baseId) && !businessIds.has(normalizedVariant.baseId)) {
        throw new ContentValidationError(`era variant references unknown base content: ${normalizedVariant.baseId}`);
      }
    }
  }
  const next = clone(state);
  for (const [field, entities] of Object.entries(normalized)) for (const entity of entities) next[field][entity.id] = entity;
  for (const [era, variants] of Object.entries(eraVariants)) next.eraVariants[era] = variants.map((variant) => clone(variant));
  return appendEvent(next, {
    eventType: "content.pack_admitted",
    actorId,
    subjectIds: [state.packId],
    payload: {
      counts: Object.fromEntries(Object.entries(normalized).map(([field, entities]) => [field, entities.length])),
      eraVariantEras: Object.keys(eraVariants),
    },
  });
}

export function activateContentEra(state, { expectedRevision, era }) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(era, "era");
  if (!state.eraVariants[era]) throw new ContentValidationError(`unknown content era: ${era}`);
  const next = clone(state);
  next.activeEra = era;
  return appendEvent(next, {
    eventType: "content.era_activated",
    actorId: "system:content",
    subjectIds: [state.packId],
    payload: { era },
  });
}

export function projectContent(state) {
  const activeVariants = state.eraVariants[state.activeEra] ?? [];
  return {
    schemaVersion: CONTENT_SCHEMA_VERSION,
    packId: state.packId,
    activeEra: state.activeEra,
    counts: {
      regions: Object.keys(state.regions).length,
      npcs: Object.keys(state.npcs).length,
      businesses: Object.keys(state.businesses).length,
      organizations: Object.keys(state.organizations).length,
    },
    activeEraVariantCount: activeVariants.length,
    regionLabels: Object.values(state.regions).map((region) => ({ id: region.id, label: region.label })),
    omittedFields: ["private authoring metadata", "event history", "source revisions", "unactivated era variants"],
  };
}

export function snapshotContent(state) { return { snapshotVersion: 1, state: clone(state) }; }

export function restoreContent(snapshotValue) {
  if (!snapshotValue || snapshotValue.snapshotVersion !== 1) throw new ContentValidationError("unsupported content snapshot version");
  const state = clone(snapshotValue.state);
  if (!state || state.schemaVersion !== CONTENT_SCHEMA_VERSION) throw new ContentValidationError("unsupported content schema version");
  let revision = 0;
  let previousHash = null;
  for (const event of state.events) {
    if (event.revision !== revision + 1) throw new ContentValidationError("content revisions are not contiguous");
    if (event.previousHash !== previousHash) throw new ContentValidationError("content event chain is broken");
    const { hash, ...unsignedEvent } = event;
    if (hash !== eventHash(unsignedEvent, event.previousHash)) throw new ContentValidationError("content event hash is invalid");
    revision = event.revision;
    previousHash = event.hash;
  }
  if (state.revision !== revision || state.lastEventHash !== previousHash) throw new ContentValidationError("content snapshot does not match history");
  return state;
}
