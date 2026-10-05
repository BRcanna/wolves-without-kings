import { createHash } from "node:crypto";

import { canonicalJson } from "./engine.mjs";

export const DYNASTY_SCHEMA_VERSION = 1;
export const SUCCESSOR_SKILLS = ["driving", "fighting", "lock_work", "intimidation", "negotiation"];

export class DynastyValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "DynastyValidationError";
  }
}

export class DynastyStaleRevisionError extends DynastyValidationError {
  constructor(expectedRevision, actualRevision) {
    super(`stale dynasty command: expected revision ${expectedRevision}, actual revision ${actualRevision}`);
    this.name = "DynastyStaleRevisionError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

function clone(value) {
  return structuredClone(value);
}

function assertObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new DynastyValidationError(`${field} must be an object`);
}

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new DynastyValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new DynastyValidationError(`${field} must be an integer between ${minimum} and ${maximum}`);
}

function assertArrayOfStrings(value, field) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) throw new DynastyValidationError(`${field} must be an array of non-empty strings`);
}

function assertRevision(state, expectedRevision) {
  assertInteger(expectedRevision, "expectedRevision");
  if (expectedRevision !== state.revision) throw new DynastyStaleRevisionError(expectedRevision, state.revision);
}

function eventHash(event, previousHash) {
  const material = `${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`;
  return createHash("sha256").update(material).digest("hex");
}

function appendEvent(state, { eventType, actorId, subjectIds = [], payload = {} }) {
  const next = clone(state);
  const unsignedEvent = {
    eventId: `dyn-${String(next.nextEventId).padStart(6, "0")}`,
    eventType,
    revision: next.revision + 1,
    lineageId: next.lineageId,
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

function requireCharacter(state, characterId) {
  assertNonEmpty(characterId, "characterId");
  const character = state.characters[characterId];
  if (!character) throw new DynastyValidationError(`unknown dynasty character: ${characterId}`);
  return character;
}

function requireManifest(state, manifestId) {
  assertNonEmpty(manifestId, "manifestId");
  const manifest = state.inheritanceManifests[manifestId];
  if (!manifest) throw new DynastyValidationError(`unknown inheritance manifest: ${manifestId}`);
  return manifest;
}

export function createDynastyState({ lineageId = "lineage:lanterns", publicName = "The Lanterns" } = {}) {
  assertNonEmpty(lineageId, "lineageId");
  assertNonEmpty(publicName, "publicName");
  return {
    schemaVersion: DYNASTY_SCHEMA_VERSION,
    lineageId,
    publicName,
    era: 1,
    revision: 0,
    nextEventId: 1,
    lastEventHash: null,
    characters: {},
    inheritanceManifests: {},
    trophies: {},
    organizationHistory: [],
    seasonHistory: [],
    events: [],
  };
}

export function registerFounder(
  state,
  { expectedRevision, characterId, displayName, birthYear = 1970, publicTitle = "founder" },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(characterId, "characterId");
  assertNonEmpty(displayName, "displayName");
  assertInteger(birthYear, "birthYear", 1900, 2100);
  assertNonEmpty(publicTitle, "publicTitle");
  if (state.characters[characterId]) throw new DynastyValidationError(`character already exists: ${characterId}`);
  const next = clone(state);
  next.characters[characterId] = {
    id: characterId,
    displayName,
    birthYear,
    status: "active",
    role: "founder",
    publicTitle,
    skills: Object.fromEntries(SUCCESSOR_SKILLS.map((skill) => [skill, { tier: "latent" }])),
    familiarity: {},
    privateMemories: [],
    inheritedProperties: [],
    inheritedOrganizations: [],
    inheritedDocuments: [],
    inheritedTrophies: [],
    introductions: [],
    burdenBands: { enemies: "unknown", debts: "unknown", expectations: "unknown" },
  };
  return appendEvent(next, {
    eventType: "dynasty.founder_registered",
    actorId: characterId,
    subjectIds: [characterId],
    payload: { characterId, displayName, birthYear, publicTitle },
  });
}

export function addLegacyTrophy(
  state,
  { expectedRevision, trophyId, label, sourceEventId, displayType = "display-artifact" },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(trophyId, "trophyId");
  assertNonEmpty(label, "label");
  assertNonEmpty(sourceEventId, "sourceEventId");
  assertNonEmpty(displayType, "displayType");
  if (state.trophies[trophyId]) throw new DynastyValidationError(`trophy already exists: ${trophyId}`);
  const next = clone(state);
  next.trophies[trophyId] = {
    id: trophyId,
    label,
    sourceEventId,
    displayType,
    competitivePower: false,
    era: state.era,
  };
  return appendEvent(next, {
    eventType: "dynasty.trophy_recorded",
    actorId: "system:legacy",
    subjectIds: [trophyId],
    payload: next.trophies[trophyId],
  });
}

export function createInheritanceManifest(
  state,
  {
    expectedRevision,
    manifestId,
    predecessorId,
    properties = [],
    organizations = [],
    documents = [],
    trophies = [],
    introductions = [],
    burdenBands = { enemies: "moderate", debts: "moderate", expectations: "moderate" },
    ...extra
  },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(manifestId, "manifestId");
  const predecessor = requireCharacter(state, predecessorId);
  if (predecessor.status !== "active") throw new DynastyValidationError("manifest predecessor must be active");
  assertArrayOfStrings(properties, "properties");
  assertArrayOfStrings(organizations, "organizations");
  assertArrayOfStrings(documents, "documents");
  assertArrayOfStrings(trophies, "trophies");
  assertArrayOfStrings(introductions, "introductions");
  assertObject(burdenBands, "burdenBands");
  for (const privateField of ["skills", "familiarity", "privateMemories", "memories"]) {
    if (Object.hasOwn(extra, privateField)) throw new DynastyValidationError(`private inheritance field is not transferable: ${privateField}`);
  }
  for (const key of ["enemies", "debts", "expectations"]) assertNonEmpty(burdenBands[key], `burdenBands.${key}`);
  if (state.inheritanceManifests[manifestId]) throw new DynastyValidationError(`manifest already exists: ${manifestId}`);
  const next = clone(state);
  next.inheritanceManifests[manifestId] = {
    id: manifestId,
    predecessorId,
    properties: [...new Set(properties)],
    organizations: [...new Set(organizations)],
    documents: [...new Set(documents)],
    trophies: [...new Set(trophies)],
    introductions: [...new Set(introductions)],
    burdenBands: clone(burdenBands),
    used: false,
  };
  return appendEvent(next, {
    eventType: "dynasty.inheritance_manifest_created",
    actorId: predecessorId,
    subjectIds: [manifestId, predecessorId],
    payload: { manifestId, predecessorId },
  });
}

export function retireFounder(
  state,
  { expectedRevision, characterId, reason = "retired" },
) {
  assertRevision(state, expectedRevision);
  const character = requireCharacter(state, characterId);
  if (character.role !== "founder") throw new DynastyValidationError("only the founder can use the founder retirement path");
  if (!["retired", "disappeared", "died"].includes(reason)) throw new DynastyValidationError(`unsupported predecessor outcome: ${reason}`);
  if (character.status !== "active") throw new DynastyValidationError(`character is not active: ${characterId}`);
  const next = clone(state);
  next.characters[characterId].status = reason;
  next.characters[characterId].retiredAtEra = state.era;
  return appendEvent(next, {
    eventType: "dynasty.predecessor_retired",
    actorId: characterId,
    subjectIds: [characterId],
    payload: { characterId, reason, era: state.era },
  });
}

export function createSuccessor(
  state,
  {
    expectedRevision,
    successorId,
    displayName,
    birthYear,
    predecessorId,
    manifestId,
    relation = "protégé",
  },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(successorId, "successorId");
  assertNonEmpty(displayName, "displayName");
  assertInteger(birthYear, "birthYear", 1900, 2100);
  const predecessor = requireCharacter(state, predecessorId);
  const manifest = requireManifest(state, manifestId);
  assertNonEmpty(relation, "relation");
  if (predecessor.status === "active") throw new DynastyValidationError("predecessor must retire before succession");
  if (manifest.predecessorId !== predecessorId) throw new DynastyValidationError("manifest predecessor mismatch");
  if (manifest.used) throw new DynastyValidationError(`inheritance manifest already used: ${manifestId}`);
  if (state.characters[successorId]) throw new DynastyValidationError(`successor already exists: ${successorId}`);
  const next = clone(state);
  next.era += 1;
  next.characters[successorId] = {
    id: successorId,
    displayName,
    birthYear,
    status: "active",
    role: "successor",
    predecessorId,
    relation,
    publicName: state.publicName,
    era: next.era,
    skills: Object.fromEntries(SUCCESSOR_SKILLS.map((skill) => [skill, { tier: "latent" }])),
    familiarity: {},
    privateMemories: [],
    inheritedProperties: clone(manifest.properties),
    inheritedOrganizations: clone(manifest.organizations),
    inheritedDocuments: clone(manifest.documents),
    inheritedTrophies: clone(manifest.trophies),
    introductions: clone(manifest.introductions),
    burdenBands: clone(manifest.burdenBands),
  };
  next.inheritanceManifests[manifestId].used = true;
  next.organizationHistory.push({
    era: next.era,
    predecessorId,
    successorId,
    organizations: clone(manifest.organizations),
  });
  return appendEvent(next, {
    eventType: "dynasty.successor_created",
    actorId: successorId,
    subjectIds: [predecessorId, successorId, manifestId],
    payload: {
      predecessorId,
      successorId,
      manifestId,
      era: next.era,
      inheritedChannels: ["properties", "organizations", "documents", "trophies", "introductions", "burdenBands"],
    },
  });
}

export function recordSeasonHistory(
  state,
  { expectedRevision, seasonId, characterId, participationMarker, title = null },
) {
  assertRevision(state, expectedRevision);
  const character = requireCharacter(state, characterId);
  assertNonEmpty(seasonId, "seasonId");
  assertNonEmpty(participationMarker, "participationMarker");
  if (title !== null) assertNonEmpty(title, "title");
  const record = { seasonId, characterId, participationMarker, title, era: state.era };
  const next = clone(state);
  next.seasonHistory.push(record);
  if (title !== null) next.characters[characterId].publicTitle = title;
  return appendEvent(next, {
    eventType: "dynasty.season_recorded",
    actorId: characterId,
    subjectIds: [characterId, seasonId],
    payload: record,
  });
}

export function projectDynasty(state, characterId) {
  const character = requireCharacter(state, characterId);
  return {
    schemaVersion: DYNASTY_SCHEMA_VERSION,
    lineageId: state.lineageId,
    publicName: state.publicName,
    era: state.era,
    character: {
      id: character.id,
      displayName: character.displayName,
      status: character.status,
      role: character.role,
      publicTitle: character.publicTitle ?? null,
      predecessorId: character.predecessorId ?? null,
      inheritedProperties: clone(character.inheritedProperties),
      inheritedOrganizations: clone(character.inheritedOrganizations),
      inheritedTrophies: clone(character.inheritedTrophies),
      burdenBands: clone(character.burdenBands),
    },
    seasonCount: state.seasonHistory.length,
    trophyCount: Object.keys(state.trophies).length,
    omittedFields: ["skills", "familiarity", "privateMemories", "events", "lastEventHash"],
  };
}

export function snapshotDynasty(state) {
  return { snapshotVersion: 1, state: clone(state) };
}

export function restoreDynasty(snapshotValue) {
  if (!snapshotValue || snapshotValue.snapshotVersion !== 1) throw new DynastyValidationError("unsupported dynasty snapshot version");
  const state = clone(snapshotValue.state);
  if (!state || state.schemaVersion !== DYNASTY_SCHEMA_VERSION) throw new DynastyValidationError("unsupported dynasty schema version");
  let revision = 0;
  let previousHash = null;
  for (const event of state.events) {
    if (event.revision !== revision + 1) throw new DynastyValidationError("dynasty revisions are not contiguous");
    if (event.previousHash !== previousHash) throw new DynastyValidationError("dynasty event chain is broken");
    const { hash, ...unsignedEvent } = event;
    if (hash !== eventHash(unsignedEvent, event.previousHash)) throw new DynastyValidationError("dynasty event hash is invalid");
    revision = event.revision;
    previousHash = event.hash;
  }
  if (state.revision !== revision || state.lastEventHash !== previousHash) throw new DynastyValidationError("dynasty snapshot does not match history");
  return state;
}
