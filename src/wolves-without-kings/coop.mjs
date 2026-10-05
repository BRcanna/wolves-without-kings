import { createHash } from "node:crypto";

import { canonicalJson } from "./engine.mjs";

export const COOP_SCHEMA_VERSION = 1;

export class CoopValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "CoopValidationError";
  }
}

export class CoopStaleRevisionError extends CoopValidationError {
  constructor(expectedRevision, actualRevision) {
    super(`stale co-op command: expected revision ${expectedRevision}, actual revision ${actualRevision}`);
    this.name = "CoopStaleRevisionError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

function clone(value) {
  return structuredClone(value);
}

function assertObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CoopValidationError(`${field} must be an object`);
  }
}

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new CoopValidationError(`${field} must be a non-empty string`);
  }
}

function assertInteger(value, field, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new CoopValidationError(`${field} must be an integer between ${minimum} and ${maximum}`);
  }
}

function assertArrayOfStrings(value, field) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new CoopValidationError(`${field} must be an array of non-empty strings`);
  }
}

function assertRevision(state, expectedRevision) {
  assertInteger(expectedRevision, "expectedRevision");
  if (expectedRevision !== state.worldRevision) {
    throw new CoopStaleRevisionError(expectedRevision, state.worldRevision);
  }
}

function eventHash(event, previousHash) {
  const material = `${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`;
  return createHash("sha256").update(material).digest("hex");
}

function appendEvent(state, { eventType, actorId, subjectIds = [], payload = {} }) {
  const next = clone(state);
  const unsignedEvent = {
    eventId: `coop-${String(next.nextEventId).padStart(6, "0")}`,
    eventType,
    sessionRevision: next.worldRevision + 1,
    hostWorldRevision: next.hostWorldRevision,
    actorId,
    subjectIds: [...subjectIds],
    payload: clone(payload),
    previousHash: next.lastEventHash,
  };
  const event = {
    ...unsignedEvent,
    hash: eventHash(unsignedEvent, unsignedEvent.previousHash),
  };
  next.events.push(event);
  next.nextEventId += 1;
  next.worldRevision = event.sessionRevision;
  next.lastEventHash = event.hash;
  return next;
}

function requirePlayer(state, playerId) {
  assertNonEmpty(playerId, "playerId");
  const player = state.players[playerId];
  if (!player) throw new CoopValidationError(`unknown co-op player: ${playerId}`);
  return player;
}

function requireGuest(state, playerId, { connected = false } = {}) {
  const player = requirePlayer(state, playerId);
  if (player.role === "host") throw new CoopValidationError("host cannot use the guest settlement path");
  if (connected && player.status !== "connected") throw new CoopValidationError(`guest is not connected: ${playerId}`);
  return player;
}

function requireOperation(state, operationId) {
  assertNonEmpty(operationId, "operationId");
  const operation = state.operations[operationId];
  if (!operation) throw new CoopValidationError(`unknown co-op operation: ${operationId}`);
  return operation;
}

function validateConsequenceList(value, field) {
  if (!Array.isArray(value)) throw new CoopValidationError(`${field} must be an array`);
  for (const consequence of value) {
    assertObject(consequence, `${field}[]`);
    assertNonEmpty(consequence.type, `${field}[].type`);
    assertNonEmpty(consequence.summary, `${field}[].summary`);
  }
}

export function createCoopSession({
  sessionId = "coop:demo",
  hostWorldId = "wwk-demo",
  hostCharacterId = "character:host",
  hostWorldRevision = 0,
  maxGuests = 3,
  lootPolicy = "host-world-only",
} = {}) {
  assertNonEmpty(sessionId, "sessionId");
  assertNonEmpty(hostWorldId, "hostWorldId");
  assertNonEmpty(hostCharacterId, "hostCharacterId");
  assertInteger(hostWorldRevision, "hostWorldRevision");
  assertInteger(maxGuests, "maxGuests", 1, 8);
  if (lootPolicy !== "host-world-only") throw new CoopValidationError(`unsupported co-op loot policy: ${lootPolicy}`);
  return {
    schemaVersion: COOP_SCHEMA_VERSION,
    sessionId,
    hostWorldId,
    hostWorldRevision,
    maxGuests,
    lootPolicy,
    worldRevision: 0,
    nextEventId: 1,
    lastEventHash: null,
    players: {
      host: {
        playerId: "host",
        characterId: hostCharacterId,
        role: "host",
        status: "connected",
        joinPoint: "host-world",
        injury: 0,
        participation: [],
      },
    },
    operations: {},
    events: [],
  };
}

export function joinGuest(
  state,
  {
    expectedRevision,
    playerId,
    characterId,
    guestWorldId,
    role = "associate",
    joinPoint,
  },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(playerId, "playerId");
  assertNonEmpty(characterId, "characterId");
  assertNonEmpty(guestWorldId, "guestWorldId");
  assertNonEmpty(joinPoint, "joinPoint");
  if (!["associate", "specialist", "crew-member"].includes(role)) {
    throw new CoopValidationError(`unsupported guest role: ${role}`);
  }
  if (state.players[playerId]) throw new CoopValidationError(`co-op player already exists: ${playerId}`);
  if (Object.values(state.players).some((player) => player.characterId === characterId)) {
    throw new CoopValidationError(`character already present in co-op session: ${characterId}`);
  }
  const guestCount = Object.values(state.players).filter((player) => player.role !== "host").length;
  if (guestCount >= state.maxGuests) throw new CoopValidationError("co-op guest capacity reached");
  const next = clone(state);
  next.players[playerId] = {
    playerId,
    characterId,
    guestWorldId,
    role,
    status: "connected",
    joinPoint,
    injury: 0,
    participation: [],
    settlement: null,
  };
  return appendEvent(next, {
    eventType: "coop.guest_joined",
    actorId: characterId,
    subjectIds: [playerId],
    payload: { playerId, characterId, role, joinPoint },
  });
}

export function createSharedOperation(
  state,
  {
    expectedRevision,
    operationId,
    participantIds,
    locationId,
    assetIds = [],
    guestAssetIds = [],
  },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(operationId, "operationId");
  assertArrayOfStrings(participantIds, "participantIds");
  assertArrayOfStrings(assetIds, "assetIds");
  assertArrayOfStrings(guestAssetIds, "guestAssetIds");
  assertNonEmpty(locationId, "locationId");
  if (participantIds.length < 2 || !participantIds.includes("host")) {
    throw new CoopValidationError("shared operation requires host and at least one guest");
  }
  if (guestAssetIds.length > 0) throw new CoopValidationError("guest-world assets cannot enter the host operation");
  if (state.operations[operationId]) throw new CoopValidationError(`operation already exists: ${operationId}`);
  const participants = [...new Set(participantIds)];
  participants.forEach((playerId) => {
    const player = requirePlayer(state, playerId);
    if (player.status !== "connected") throw new CoopValidationError(`participant is not connected: ${playerId}`);
  });
  const next = clone(state);
  next.operations[operationId] = {
    id: operationId,
    participants,
    locationId,
    assetIds: [...new Set(assetIds)],
    status: "active",
    startedAtSessionRevision: state.worldRevision + 1,
    hostWorldRevision: state.hostWorldRevision,
    disconnectedPlayers: [],
    worldConsequences: [],
    guestConsequences: {},
    leaveSettlements: {},
  };
  for (const playerId of participants) next.players[playerId].participation.push(operationId);
  return appendEvent(next, {
    eventType: "coop.operation_started",
    actorId: state.players.host.characterId,
    subjectIds: [operationId, ...participants],
    payload: { operationId, participants, locationId, assetIds: [...new Set(assetIds)] },
  });
}

export function recordSharedOperationOutcome(
  state,
  {
    expectedRevision,
    operationId,
    worldConsequences = [],
    guestConsequences = {},
  },
) {
  assertRevision(state, expectedRevision);
  const operation = requireOperation(state, operationId);
  if (operation.status !== "active") throw new CoopValidationError(`co-op operation is not active: ${operationId}`);
  validateConsequenceList(worldConsequences, "worldConsequences");
  assertObject(guestConsequences, "guestConsequences");
  for (const [playerId, consequenceList] of Object.entries(guestConsequences)) {
    requireGuest(state, playerId);
    if (!operation.participants.includes(playerId)) throw new CoopValidationError(`guest is not in operation: ${playerId}`);
    validateConsequenceList(consequenceList, `guestConsequences.${playerId}`);
  }
  const next = clone(state);
  next.hostWorldRevision += 1;
  next.operations[operationId] = {
    ...operation,
    status: "completed",
    hostWorldRevision: next.hostWorldRevision,
    worldConsequences: clone(worldConsequences),
    guestConsequences: clone(guestConsequences),
  };
  return appendEvent(next, {
    eventType: "coop.operation_completed",
    actorId: state.players.host.characterId,
    subjectIds: [operationId],
    payload: {
      operationId,
      worldConsequenceCount: worldConsequences.length,
      guestConsequencePlayers: Object.keys(guestConsequences),
      hostWorldRevision: next.hostWorldRevision,
    },
  });
}

export function disconnectGuest(state, { expectedRevision, playerId, reason = "disconnect" }) {
  assertRevision(state, expectedRevision);
  const player = requireGuest(state, playerId, { connected: true });
  assertNonEmpty(reason, "reason");
  const next = clone(state);
  next.players[playerId].status = "disconnected";
  for (const operation of Object.values(next.operations)) {
    if (operation.status === "active" && operation.participants.includes(playerId)) {
      operation.disconnectedPlayers = [...new Set([...operation.disconnectedPlayers, playerId])];
    }
  }
  return appendEvent(next, {
    eventType: "coop.guest_disconnected",
    actorId: player.characterId,
    subjectIds: [playerId],
    payload: { playerId, reason },
  });
}

export function reconnectGuest(state, { expectedRevision, playerId }) {
  assertRevision(state, expectedRevision);
  const player = requireGuest(state, playerId);
  if (player.status !== "disconnected") throw new CoopValidationError(`guest is not disconnected: ${playerId}`);
  const next = clone(state);
  next.players[playerId].status = "connected";
  for (const operation of Object.values(next.operations)) {
    operation.disconnectedPlayers = operation.disconnectedPlayers.filter((id) => id !== playerId);
  }
  return appendEvent(next, {
    eventType: "coop.guest_reconnected",
    actorId: player.characterId,
    subjectIds: [playerId],
    payload: { playerId },
  });
}

export function settleGuestLeave(
  state,
  {
    expectedRevision,
    playerId,
    settlementMode = "return",
    injuryDelta = 0,
    assetReturns = [],
  },
) {
  assertRevision(state, expectedRevision);
  const player = requireGuest(state, playerId);
  if (!["return", "retained-injury", "lost-connection"].includes(settlementMode)) {
    throw new CoopValidationError(`unsupported guest settlement mode: ${settlementMode}`);
  }
  assertInteger(injuryDelta, "injuryDelta", 0, 100);
  assertArrayOfStrings(assetReturns, "assetReturns");
  if (player.status === "settled") throw new CoopValidationError(`guest is already settled: ${playerId}`);
  const operationIds = player.participation;
  const activeAssetIds = operationIds.flatMap((operationId) => state.operations[operationId]?.assetIds ?? []);
  if (assetReturns.some((assetId) => !activeAssetIds.includes(assetId))) {
    throw new CoopValidationError("guest settlement contains an asset outside the host operation");
  }
  const next = clone(state);
  next.players[playerId].status = "settled";
  next.players[playerId].injury = Math.min(100, player.injury + injuryDelta);
  next.players[playerId].settlement = {
    mode: settlementMode,
    injuryDelta,
    assetReturns: [...new Set(assetReturns)],
    hostConsequencesRetained: true,
    hostWorldRevision: state.hostWorldRevision,
  };
  for (const operationId of operationIds) {
    if (next.operations[operationId]) {
      next.operations[operationId].leaveSettlements[playerId] = clone(next.players[playerId].settlement);
    }
  }
  return appendEvent(next, {
    eventType: "coop.guest_settled",
    actorId: player.characterId,
    subjectIds: [playerId, ...operationIds],
    payload: {
      playerId,
      settlementMode,
      injuryDelta,
      assetReturns: [...new Set(assetReturns)],
      hostConsequencesRetained: true,
    },
  });
}

export function rejectHostRewind() {
  throw new CoopValidationError("host world rewind is not available in co-op settlement");
}

export function snapshotCoopSession(state) {
  return { snapshotVersion: 1, state: clone(state) };
}

export function restoreCoopSession(snapshotValue) {
  if (!snapshotValue || snapshotValue.snapshotVersion !== 1) {
    throw new CoopValidationError("unsupported co-op snapshot version");
  }
  const state = clone(snapshotValue.state);
  if (!state || state.schemaVersion !== COOP_SCHEMA_VERSION) {
    throw new CoopValidationError("unsupported co-op schema version");
  }
  let revision = 0;
  let previousHash = null;
  for (const event of state.events) {
    if (event.sessionRevision !== revision + 1) throw new CoopValidationError("co-op revisions are not contiguous");
    if (event.previousHash !== previousHash) throw new CoopValidationError("co-op event chain is broken");
    const { hash, ...unsignedEvent } = event;
    if (hash !== eventHash(unsignedEvent, event.previousHash)) throw new CoopValidationError("co-op event hash is invalid");
    revision = event.sessionRevision;
    previousHash = event.hash;
  }
  if (state.worldRevision !== revision || state.lastEventHash !== previousHash) {
    throw new CoopValidationError("co-op snapshot does not match its event history");
  }
  return state;
}
