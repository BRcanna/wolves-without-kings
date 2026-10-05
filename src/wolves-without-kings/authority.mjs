import { createHash } from "node:crypto";

import { canonicalJson } from "./engine.mjs";

export const AUTHORITY_SCHEMA_VERSION = 1;

const FORBIDDEN_INTENT_KEYS = new Set([
  "authoritativeResult",
  "authoritativeState",
  "serverState",
  "worldRevision",
  "hash",
  "damage",
  "ownerId",
  "newOwnerId",
  "outcome",
  "price",
  "confidence",
]);

export class AuthorityValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthorityValidationError";
  }
}

export class StaleInputError extends AuthorityValidationError {
  constructor(expectedRevision, actualRevision) {
    super(`stale input: expected revision ${expectedRevision}, actual revision ${actualRevision}`);
    this.name = "StaleInputError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

export class DuplicateInputError extends AuthorityValidationError {
  constructor(sessionId, inputSeq, lastInputSeq) {
    super(`duplicate or out-of-order input for ${sessionId}: ${inputSeq} <= ${lastInputSeq}`);
    this.name = "DuplicateInputError";
    this.sessionId = sessionId;
    this.inputSeq = inputSeq;
    this.lastInputSeq = lastInputSeq;
  }
}

export class LeaseConflictError extends AuthorityValidationError {
  constructor(entityId, ownerId) {
    super(`entity ${entityId} is leased by ${ownerId}`);
    this.name = "LeaseConflictError";
    this.entityId = entityId;
    this.ownerId = ownerId;
  }
}

function clone(value) {
  return structuredClone(value);
}

function assertObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AuthorityValidationError(`${field} must be an object`);
  }
}

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AuthorityValidationError(`${field} must be a non-empty string`);
  }
}

function assertInteger(value, field, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) {
    throw new AuthorityValidationError(`${field} must be an integer >= ${minimum}`);
  }
}

function assertArrayOfStrings(value, field) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new AuthorityValidationError(`${field} must be an array of non-empty strings`);
  }
}

function assertRevision(state, expectedRevision) {
  assertInteger(expectedRevision, "expectedRevision");
  if (expectedRevision !== state.worldRevision) {
    throw new StaleInputError(expectedRevision, state.worldRevision);
  }
}

function inspectIntentKeys(value, path = "intent") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectIntentKeys(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_INTENT_KEYS.has(key)) {
      throw new AuthorityValidationError(`${path}.${key} is server-authoritative and cannot be client input`);
    }
    inspectIntentKeys(child, `${path}.${key}`);
  }
}

function eventHash(event, previousHash) {
  const material = `${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`;
  return createHash("sha256").update(material).digest("hex");
}

function appendEvent(state, {
  eventType,
  actorId = null,
  sessionId = null,
  affectedEntityIds = [],
  visibility = "interest",
  summary = {},
  payload = {},
}) {
  const next = clone(state);
  const unsignedEvent = {
    eventId: `net-${String(next.nextEventId).padStart(6, "0")}`,
    eventType,
    worldRevision: next.worldRevision + 1,
    serverTick: next.serverTick,
    actorId,
    sessionId,
    affectedEntityIds: [...affectedEntityIds],
    visibility,
    summary: clone(summary),
    payload: clone(payload),
    previousHash: next.lastEventHash,
  };
  const event = {
    ...unsignedEvent,
    hash: eventHash(unsignedEvent, unsignedEvent.previousHash),
  };
  next.events.push(event);
  next.nextEventId += 1;
  next.worldRevision = event.worldRevision;
  next.lastEventHash = event.hash;
  return next;
}

function requireSession(state, sessionId) {
  assertNonEmpty(sessionId, "sessionId");
  const session = state.sessions[sessionId];
  if (!session) throw new AuthorityValidationError(`unknown session: ${sessionId}`);
  return session;
}

function requireConnectedSession(state, sessionId) {
  const session = requireSession(state, sessionId);
  if (session.status !== "connected") throw new AuthorityValidationError(`session is not connected: ${sessionId}`);
  return session;
}

function activeClaim(state, entityId) {
  const claim = state.claims[entityId];
  if (!claim) return null;
  return claim.expiresAtTick > state.serverTick ? claim : null;
}

function validateTransfer(state, transfer, session) {
  assertObject(transfer, "entityTransfers[]");
  assertNonEmpty(transfer.entityId, "entityTransfers[].entityId");
  assertNonEmpty(transfer.fromOwnerId, "entityTransfers[].fromOwnerId");
  assertNonEmpty(transfer.toOwnerId, "entityTransfers[].toOwnerId");
  const owner = state.entityOwners[transfer.entityId];
  if (!owner) throw new AuthorityValidationError(`unknown owned entity: ${transfer.entityId}`);
  if (owner.ownerId !== transfer.fromOwnerId) {
    throw new AuthorityValidationError(`owner conflict for ${transfer.entityId}`);
  }
  if (transfer.toOwnerId !== session.characterId && session.role !== "host") {
    throw new AuthorityValidationError("guest sessions may only receive an entity for their character");
  }
  const claim = activeClaim(state, transfer.entityId);
  if (claim && claim.ownerId !== session.characterId) {
    throw new LeaseConflictError(transfer.entityId, claim.ownerId);
  }
}

export function createAuthorityState({
  worldId = "wwk-authority-dev",
  regionAuthority = "region:sofia-south",
  serverEra = "1999",
  initialRevision = 0,
  disconnectPolicy = "release-claims",
} = {}) {
  assertNonEmpty(worldId, "worldId");
  assertNonEmpty(regionAuthority, "regionAuthority");
  assertNonEmpty(serverEra, "serverEra");
  assertInteger(initialRevision, "initialRevision");
  if (disconnectPolicy !== "release-claims") {
    throw new AuthorityValidationError(`unsupported disconnect policy: ${disconnectPolicy}`);
  }
  return {
    schemaVersion: AUTHORITY_SCHEMA_VERSION,
    worldId,
    regionAuthority,
    serverEra,
    initialRevision,
    serverTick: 0,
    worldRevision: initialRevision,
    nextEventId: 1,
    lastEventHash: null,
    disconnectPolicy,
    sessions: {},
    interestSets: {},
    entityOwners: {},
    claims: {},
    persistentStore: {
      inputReceipts: {},
    },
    events: [],
  };
}

export function connectSession(
  state,
  { sessionId, clientId, characterId, regionId = state.regionAuthority, role = "guest" },
) {
  assertNonEmpty(sessionId, "sessionId");
  assertNonEmpty(clientId, "clientId");
  assertNonEmpty(characterId, "characterId");
  assertNonEmpty(regionId, "regionId");
  if (![
    "host",
    "guest",
  ].includes(role)) throw new AuthorityValidationError(`unsupported session role: ${role}`);
  if (state.sessions[sessionId]) throw new AuthorityValidationError(`session already exists: ${sessionId}`);
  if (Object.values(state.sessions).some((session) => session.clientId === clientId && session.status === "connected")) {
    throw new AuthorityValidationError(`client already connected: ${clientId}`);
  }
  const next = clone(state);
  next.sessions[sessionId] = {
    sessionId,
    clientId,
    characterId,
    regionId,
    role,
    status: "connected",
    lastInputSeq: 0,
    lastKnownRevision: state.worldRevision,
    predictionState: "authoritative",
    reconciliation: null,
  };
  next.interestSets[sessionId] = { regionIds: [regionId], entityIds: [characterId] };
  const committed = appendEvent(next, {
    eventType: "net.session.connected",
    actorId: characterId,
    sessionId,
    visibility: "public",
    summary: { regionId, role },
    payload: { clientId, characterId, regionId, role },
  });
  committed.sessions[sessionId].lastKnownRevision = committed.worldRevision;
  return committed;
}

export function setInterestSet(state, { expectedRevision, sessionId, regionIds = [], entityIds = [] }) {
  assertRevision(state, expectedRevision);
  const session = requireConnectedSession(state, sessionId);
  assertArrayOfStrings(regionIds, "regionIds");
  assertArrayOfStrings(entityIds, "entityIds");
  const next = clone(state);
  next.interestSets[session.sessionId] = {
    regionIds: [...new Set(regionIds)],
    entityIds: [...new Set([session.characterId, ...entityIds])],
  };
  return appendEvent(next, {
    eventType: "net.interest.updated",
    actorId: session.characterId,
    sessionId,
    affectedEntityIds: next.interestSets[session.sessionId].entityIds,
    summary: { regionCount: regionIds.length, entityCount: entityIds.length },
    payload: next.interestSets[session.sessionId],
  });
}

export function registerEntityOwner(
  state,
  { expectedRevision, entityId, ownerId, regionId = state.regionAuthority },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(entityId, "entityId");
  assertNonEmpty(ownerId, "ownerId");
  assertNonEmpty(regionId, "regionId");
  if (state.entityOwners[entityId]) throw new AuthorityValidationError(`entity already has an owner: ${entityId}`);
  const next = clone(state);
  next.entityOwners[entityId] = { entityId, ownerId, regionId, ownerRevision: state.worldRevision + 1 };
  return appendEvent(next, {
    eventType: "net.entity.owner_registered",
    actorId: ownerId,
    affectedEntityIds: [entityId],
    visibility: "public",
    summary: { entityId, regionId },
    payload: next.entityOwners[entityId],
  });
}

export function claimEntity(
  state,
  { expectedRevision, entityId, ownerId, leaseId, expiresAtTick },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(entityId, "entityId");
  assertNonEmpty(ownerId, "ownerId");
  assertNonEmpty(leaseId, "leaseId");
  assertInteger(expiresAtTick, "expiresAtTick", state.serverTick + 1);
  const owner = state.entityOwners[entityId];
  if (!owner) throw new AuthorityValidationError(`unknown owned entity: ${entityId}`);
  if (owner.ownerId !== ownerId) throw new AuthorityValidationError(`owner conflict for ${entityId}`);
  const existing = activeClaim(state, entityId);
  if (existing && existing.ownerId !== ownerId) throw new LeaseConflictError(entityId, existing.ownerId);
  const next = clone(state);
  next.claims[entityId] = { entityId, ownerId, leaseId, expiresAtTick };
  return appendEvent(next, {
    eventType: "net.entity.claimed",
    actorId: ownerId,
    affectedEntityIds: [entityId],
    summary: { entityId, expiresAtTick },
    payload: next.claims[entityId],
  });
}

export function advanceServerTicks(state, { expectedRevision, ticks = 1 }) {
  assertRevision(state, expectedRevision);
  assertInteger(ticks, "ticks", 1);
  const next = clone(state);
  next.serverTick += ticks;
  const expired = [];
  for (const [entityId, claim] of Object.entries(next.claims)) {
    if (claim.expiresAtTick <= next.serverTick) {
      expired.push(entityId);
      delete next.claims[entityId];
    }
  }
  return appendEvent(next, {
    eventType: "net.server.ticked",
    visibility: "public",
    summary: { ticks, expiredClaims: expired },
    payload: { ticks, expiredClaims: expired },
  });
}

export function submitIntent(state, input, { resolve }) {
  assertObject(input, "input");
  assertNonEmpty(input.sessionId, "input.sessionId");
  assertInteger(input.clientInputSeq, "input.clientInputSeq", 1);
  assertInteger(input.baseRevision, "input.baseRevision");
  const session = requireConnectedSession(state, input.sessionId);
  if (input.baseRevision !== state.worldRevision) throw new StaleInputError(input.baseRevision, state.worldRevision);
  if (input.clientInputSeq <= session.lastInputSeq) {
    throw new DuplicateInputError(input.sessionId, input.clientInputSeq, session.lastInputSeq);
  }
  assertObject(input.intent, "input.intent");
  const intentKeys = Object.keys(input.intent).sort();
  const allowedKeys = ["actorId", "entityIds", "payload", "regionId", "type"];
  if (intentKeys.some((key) => !allowedKeys.includes(key))) {
    throw new AuthorityValidationError("input.intent contains an unsupported field");
  }
  assertNonEmpty(input.intent.type, "input.intent.type");
  assertNonEmpty(input.intent.actorId, "input.intent.actorId");
  if (input.intent.actorId !== session.characterId) throw new AuthorityValidationError("intent actor does not match session character");
  assertNonEmpty(input.intent.regionId, "input.intent.regionId");
  if (input.intent.regionId !== session.regionId) throw new AuthorityValidationError("intent region is outside session authority");
  assertArrayOfStrings(input.intent.entityIds ?? [], "input.intent.entityIds");
  assertObject(input.intent.payload ?? {}, "input.intent.payload");
  inspectIntentKeys(input.intent);
  if (typeof resolve !== "function") throw new AuthorityValidationError("resolve must be a server-side function");

  const resolution = resolve({
    state: clone(state),
    session: clone(session),
    intent: clone(input.intent),
    serverTick: state.serverTick,
    authoritativeRevision: state.worldRevision,
  });
  assertObject(resolution, "server resolution");
  assertNonEmpty(resolution.eventType, "server resolution.eventType");
  assertObject(resolution.payload ?? {}, "server resolution.payload");
  assertArrayOfStrings(resolution.affectedEntityIds ?? [], "server resolution.affectedEntityIds");
  if (resolution.entityTransfers !== undefined && !Array.isArray(resolution.entityTransfers)) {
    throw new AuthorityValidationError("server resolution.entityTransfers must be an array");
  }

  const next = clone(state);
  const entityTransfers = resolution.entityTransfers ?? [];
  for (const transfer of entityTransfers) validateTransfer(next, transfer, session);
  for (const transfer of entityTransfers) {
    next.entityOwners[transfer.entityId] = {
      ...next.entityOwners[transfer.entityId],
      ownerId: transfer.toOwnerId,
      ownerRevision: state.worldRevision + 1,
    };
    delete next.claims[transfer.entityId];
  }
  next.serverTick += 1;
  next.sessions[input.sessionId].lastInputSeq = input.clientInputSeq;
  next.sessions[input.sessionId].lastKnownRevision = state.worldRevision + 1;
  next.sessions[input.sessionId].predictionState = "confirmed";
  next.sessions[input.sessionId].reconciliation = {
    clientInputSeq: input.clientInputSeq,
    authoritativeRevision: state.worldRevision + 1,
    status: "confirmed",
  };
  next.persistentStore.inputReceipts[`${input.sessionId}:${input.clientInputSeq}`] = {
    sessionId: input.sessionId,
    clientInputSeq: input.clientInputSeq,
    acceptedAtRevision: state.worldRevision + 1,
  };
  return appendEvent(next, {
    eventType: "net.intent.resolved",
    actorId: session.characterId,
    sessionId: input.sessionId,
    affectedEntityIds: [...new Set([...input.intent.entityIds, ...(resolution.affectedEntityIds ?? [])])],
    summary: {
      resolvedEventType: resolution.eventType,
      clientInputSeq: input.clientInputSeq,
      entityTransferCount: entityTransfers.length,
    },
    payload: {
      intent: input.intent,
      resolution: {
        eventType: resolution.eventType,
        payload: resolution.payload ?? {},
        affectedEntityIds: resolution.affectedEntityIds ?? [],
        entityTransfers,
      },
    },
  });
}

export function disconnectSession(state, { expectedRevision, sessionId, reason = "disconnect" }) {
  assertRevision(state, expectedRevision);
  const session = requireConnectedSession(state, sessionId);
  assertNonEmpty(reason, "reason");
  const next = clone(state);
  next.sessions[sessionId].status = "disconnected";
  next.sessions[sessionId].predictionState = "settled";
  const releasedClaims = [];
  if (next.disconnectPolicy === "release-claims") {
    for (const [entityId, claim] of Object.entries(next.claims)) {
      if (claim.ownerId === session.characterId) {
        releasedClaims.push(entityId);
        delete next.claims[entityId];
      }
    }
  }
  return appendEvent(next, {
    eventType: "net.session.disconnected",
    actorId: session.characterId,
    sessionId,
    affectedEntityIds: releasedClaims,
    visibility: "public",
    summary: { reason, releasedClaims },
    payload: { reason, releasedClaims },
  });
}

export function reconnectSession(
  state,
  { sessionId, clientId, lastKnownRevision = state.worldRevision },
) {
  const session = requireSession(state, sessionId);
  assertNonEmpty(clientId, "clientId");
  assertInteger(lastKnownRevision, "lastKnownRevision");
  if (session.clientId !== clientId) throw new AuthorityValidationError("client identity does not match session");
  if (lastKnownRevision > state.worldRevision) throw new AuthorityValidationError("client revision is ahead of authority");
  const next = clone(state);
  next.sessions[sessionId].status = "connected";
  next.sessions[sessionId].lastKnownRevision = lastKnownRevision;
  next.sessions[sessionId].predictionState = "reconciliation-required";
  next.sessions[sessionId].reconciliation = {
    fromRevision: lastKnownRevision,
    toRevision: state.worldRevision,
    status: lastKnownRevision === state.worldRevision ? "current" : "required",
  };
  return appendEvent(next, {
    eventType: "net.session.reconnected",
    actorId: session.characterId,
    sessionId,
    visibility: "public",
    summary: { lastKnownRevision },
    payload: { clientId, lastKnownRevision },
  });
}

function eventVisibleToSession(event, state, session) {
  if (event.visibility === "public") return true;
  if (event.sessionId === session.sessionId || event.actorId === session.characterId) return true;
  const interest = state.interestSets[session.sessionId] ?? { entityIds: [] };
  return event.affectedEntityIds.some((entityId) => interest.entityIds.includes(entityId));
}

export function reconcileSession(state, { sessionId, fromRevision = 0 }) {
  const session = requireSession(state, sessionId);
  assertInteger(fromRevision, "fromRevision");
  if (fromRevision > state.worldRevision) throw new AuthorityValidationError("fromRevision is ahead of authority");
  const events = state.events
    .filter((event) => event.worldRevision > fromRevision && eventVisibleToSession(event, state, session))
    .map((event) => ({
      eventId: event.eventId,
      eventType: event.eventType,
      worldRevision: event.worldRevision,
      serverTick: event.serverTick,
      actorId: event.actorId,
      affectedEntityIds: clone(event.affectedEntityIds),
      summary: clone(event.summary),
    }));
  const ownedEntityIds = Object.values(state.entityOwners)
    .filter((record) => record.ownerId === session.characterId)
    .map((record) => record.entityId);
  return {
    schemaVersion: AUTHORITY_SCHEMA_VERSION,
    worldId: state.worldId,
    serverEra: state.serverEra,
    serverTick: state.serverTick,
    authoritativeRevision: state.worldRevision,
    sessionId,
    ownedEntityIds,
    activeClaims: Object.values(state.claims)
      .filter((claim) => claim.ownerId === session.characterId)
      .map((claim) => clone(claim)),
    events,
    omittedFields: ["payload", "persistentStore", "lastEventHash"],
  };
}

export function snapshotAuthorityState(state) {
  return { snapshotVersion: 1, state: clone(state) };
}

export function restoreAuthorityState(snapshotValue) {
  if (!snapshotValue || snapshotValue.snapshotVersion !== 1) {
    throw new AuthorityValidationError("unsupported authority snapshot version");
  }
  const state = clone(snapshotValue.state);
  if (!state || state.schemaVersion !== AUTHORITY_SCHEMA_VERSION) {
    throw new AuthorityValidationError("unsupported authority schema version");
  }
  let revision = state.initialRevision;
  let previousHash = null;
  for (const event of state.events) {
    if (event.worldRevision !== revision + 1) throw new AuthorityValidationError("authority event revisions are not contiguous");
    if (event.previousHash !== previousHash) throw new AuthorityValidationError("authority event chain is broken");
    const { hash, ...unsignedEvent } = event;
    if (hash !== eventHash(unsignedEvent, event.previousHash)) throw new AuthorityValidationError("authority event hash is invalid");
    revision = event.worldRevision;
    previousHash = event.hash;
  }
  if (state.worldRevision !== revision || state.lastEventHash !== previousHash) {
    throw new AuthorityValidationError("authority snapshot does not match its event history");
  }
  return state;
}
