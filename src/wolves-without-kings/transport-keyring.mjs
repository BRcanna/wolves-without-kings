import {
  admitTransportEnvelope,
  signTransportEnvelope,
} from "./transport-envelope.mjs";

export const TRANSPORT_KEYRING_SCHEMA_VERSION = 1;

export class TransportKeyringValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "TransportKeyringValidationError";
  }
}

function clone(value) { return structuredClone(value); }

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new TransportKeyringValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) throw new TransportKeyringValidationError(`${field} must be an integer >= ${minimum}`);
}

function assertOptionalTick(value, field) {
  if (value !== null && value !== undefined) assertInteger(value, field);
}

function keyStatus(key, tick) {
  if (key.revokedAtTick !== null) return "revoked";
  if (key.expiresAtTick !== null && tick >= key.expiresAtTick) return "expired";
  return "active";
}

function assertState(state) {
  if (!state || state.schemaVersion !== TRANSPORT_KEYRING_SCHEMA_VERSION || !state.keys || typeof state.keys !== "object" || Array.isArray(state.keys)) {
    throw new TransportKeyringValidationError("invalid transport keyring state");
  }
  assertInteger(state.currentTick, "currentTick");
}

function resolveKey(state, keyId, tick = state.currentTick) {
  assertState(state);
  assertNonEmpty(keyId, "keyId");
  assertInteger(tick, "tick");
  const key = state.keys[keyId];
  if (!key) throw new TransportKeyringValidationError(`unknown transport key ${keyId}`);
  const status = keyStatus(key, tick);
  if (status !== "active") throw new TransportKeyringValidationError(`transport key ${keyId} is ${status}`);
  return key;
}

export function createTransportKeyring({ currentTick = 0 } = {}) {
  assertInteger(currentTick, "currentTick");
  return { schemaVersion: TRANSPORT_KEYRING_SCHEMA_VERSION, currentTick, activeKeyId: null, keys: {} };
}

export function registerTransportKey(state, { keyId, secret, createdAtTick = state.currentTick, expiresAtTick = null } = {}) {
  assertState(state);
  assertNonEmpty(keyId, "keyId");
  assertNonEmpty(secret, "secret");
  assertInteger(createdAtTick, "createdAtTick");
  assertOptionalTick(expiresAtTick, "expiresAtTick");
  if (expiresAtTick !== null && expiresAtTick <= createdAtTick) throw new TransportKeyringValidationError("expiresAtTick must be after createdAtTick");
  if (state.keys[keyId]) throw new TransportKeyringValidationError(`transport key already exists: ${keyId}`);
  const next = clone(state);
  next.keys[keyId] = { keyId, secret, createdAtTick, expiresAtTick, revokedAtTick: null };
  if (!next.activeKeyId) next.activeKeyId = keyId;
  return next;
}

export function rotateTransportKey(state, { keyId, secret, createdAtTick = state.currentTick, expiresAtTick = null } = {}) {
  const next = registerTransportKey(state, { keyId, secret, createdAtTick, expiresAtTick });
  next.activeKeyId = keyId;
  return next;
}

export function revokeTransportKey(state, { keyId, revokedAtTick = state.currentTick } = {}) {
  assertState(state);
  assertNonEmpty(keyId, "keyId");
  assertInteger(revokedAtTick, "revokedAtTick");
  if (!state.keys[keyId]) throw new TransportKeyringValidationError(`unknown transport key ${keyId}`);
  const next = clone(state);
  next.keys[keyId].revokedAtTick = revokedAtTick;
  if (next.activeKeyId === keyId) next.activeKeyId = null;
  return next;
}

export function advanceTransportKeyring(state, { currentTick } = {}) {
  assertState(state);
  assertInteger(currentTick, "currentTick");
  if (currentTick < state.currentTick) throw new TransportKeyringValidationError("currentTick cannot move backward");
  return { ...clone(state), currentTick };
}

export function signKeyedTransportEnvelope(state, {
  keyId = state.activeKeyId,
  sessionId,
  inputSeq,
  nonce,
  issuedAtTick = state.currentTick,
  intent,
} = {}) {
  const key = resolveKey(state, keyId, issuedAtTick);
  return {
    ...signTransportEnvelope({ sessionId, inputSeq, nonce, issuedAtTick, intent, key: key.secret }),
    keyId,
  };
}

export function admitKeyedTransportEnvelope(state, keyring, {
  expectedRevision,
  envelope,
  serverTick = state.serverTick,
  moderationFlags = [],
} = {}) {
  if (!keyring || typeof keyring !== "object") throw new TransportKeyringValidationError("keyring must be an object");
  const session = state.sessions?.[envelope?.sessionId];
  if (!session) throw new TransportKeyringValidationError(`unknown transport session: ${envelope?.sessionId ?? ""}`);
  if (envelope.keyId !== undefined && envelope.keyId !== session.keyId) throw new TransportKeyringValidationError("transport envelope key does not match session binding");
  const key = resolveKey(keyring, session.keyId, serverTick);
  return admitTransportEnvelope(state, { expectedRevision, envelope, key: key.secret, serverTick, moderationFlags });
}

export function projectTransportKeyring(state, tick = state.currentTick) {
  assertState(state);
  assertInteger(tick, "tick");
  return {
    schemaVersion: TRANSPORT_KEYRING_SCHEMA_VERSION,
    currentTick: tick,
    active: state.activeKeyId ? keyStatus(state.keys[state.activeKeyId], tick) : "none",
    keys: Object.values(state.keys).map((key) => ({
      keyId: key.keyId,
      status: keyStatus(key, tick),
      createdAtTick: key.createdAtTick,
      expiresAtTick: key.expiresAtTick,
      revokedAtTick: key.revokedAtTick,
    })),
    omittedFields: ["secrets"],
  };
}

export function snapshotTransportKeyring(state) {
  assertState(state);
  return {
    snapshotVersion: 1,
    state: {
      schemaVersion: state.schemaVersion,
      currentTick: state.currentTick,
      activeKeyId: state.activeKeyId,
      keys: Object.fromEntries(Object.entries(state.keys).map(([keyId, key]) => [keyId, {
        keyId: key.keyId,
        createdAtTick: key.createdAtTick,
        expiresAtTick: key.expiresAtTick,
        revokedAtTick: key.revokedAtTick,
      }])),
    },
  };
}

export function restoreTransportKeyring(snapshot, { secrets = {} } = {}) {
  if (!snapshot || snapshot.snapshotVersion !== 1) throw new TransportKeyringValidationError("unsupported transport keyring snapshot version");
  const state = clone(snapshot.state);
  assertState(state);
  if (!secrets || typeof secrets !== "object" || Array.isArray(secrets)) throw new TransportKeyringValidationError("secrets must be an object");
  for (const key of Object.values(state.keys)) {
    const secret = secrets[key.keyId];
    assertNonEmpty(secret, `secrets.${key.keyId}`);
    key.secret = secret;
  }
  return state;
}
