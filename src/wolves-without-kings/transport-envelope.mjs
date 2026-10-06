import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { canonicalJson } from "./engine.mjs";

export const TRANSPORT_ENVELOPE_SCHEMA_VERSION = 1;

const FORBIDDEN_INTENT_KEYS = ["authoritativeResult", "worldState", "ownership", "serverOutcome"];

export class TransportEnvelopeValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "TransportEnvelopeValidationError";
  }
}

export class TransportEnvelopeStaleRevisionError extends TransportEnvelopeValidationError {
  constructor(expectedRevision, actualRevision) {
    super(`stale transport command: expected revision ${expectedRevision}, actual revision ${actualRevision}`);
    this.name = "TransportEnvelopeStaleRevisionError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

function clone(value) { return structuredClone(value); }

function assertObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TransportEnvelopeValidationError(`${field} must be an object`);
}

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new TransportEnvelopeValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new TransportEnvelopeValidationError(`${field} must be an integer between ${minimum} and ${maximum}`);
}

function assertRevision(state, expectedRevision) {
  assertInteger(expectedRevision, "expectedRevision");
  if (expectedRevision !== state.revision) throw new TransportEnvelopeStaleRevisionError(expectedRevision, state.revision);
}

function assertIntent(intent) {
  assertObject(intent, "intent");
  for (const forbidden of FORBIDDEN_INTENT_KEYS) if (Object.hasOwn(intent, forbidden)) throw new TransportEnvelopeValidationError(`intent cannot provide ${forbidden}`);
}

function envelopeMaterial(envelope) {
  return {
    transportSchemaVersion: envelope.transportSchemaVersion,
    sessionId: envelope.sessionId,
    inputSeq: envelope.inputSeq,
    nonce: envelope.nonce,
    issuedAtTick: envelope.issuedAtTick,
    intent: envelope.intent,
  };
}

function signMaterial(material, key) {
  assertNonEmpty(key, "key");
  return createHmac("sha256", key).update(canonicalJson(material), "utf8").digest("hex");
}

function eventHash(event, previousHash) {
  const material = `${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`;
  return createHash("sha256").update(material, "utf8").digest("hex");
}

function appendEvent(state, { eventType, sessionId, payload }) {
  const next = clone(state);
  const unsignedEvent = {
    eventId: `transport-${String(next.nextEventId).padStart(6, "0")}`,
    eventType,
    revision: next.revision + 1,
    serverTick: next.serverTick,
    sessionId,
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

function sessionOrThrow(state, sessionId) {
  assertNonEmpty(sessionId, "sessionId");
  const session = state.sessions[sessionId];
  if (!session) throw new TransportEnvelopeValidationError(`unknown transport session: ${sessionId}`);
  if (session.status !== "connected") throw new TransportEnvelopeValidationError(`transport session is not connected: ${sessionId}`);
  return session;
}

export function createTransportState({ serverId = "wwk-transport", maxInputsPerWindow = 8, windowTicks = 60, clockSkewTicks = 30 } = {}) {
  assertNonEmpty(serverId, "serverId");
  assertInteger(maxInputsPerWindow, "maxInputsPerWindow", 1, 1000);
  assertInteger(windowTicks, "windowTicks", 1, 3600);
  assertInteger(clockSkewTicks, "clockSkewTicks", 0, 3600);
  return {
    schemaVersion: TRANSPORT_ENVELOPE_SCHEMA_VERSION,
    serverId,
    maxInputsPerWindow,
    windowTicks,
    clockSkewTicks,
    serverTick: 0,
    revision: 0,
    nextEventId: 1,
    lastEventHash: null,
    sessions: {},
    events: [],
  };
}

export function registerTransportSession(state, { expectedRevision, sessionId, clientId, keyId }) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(sessionId, "sessionId");
  assertNonEmpty(clientId, "clientId");
  assertNonEmpty(keyId, "keyId");
  if (state.sessions[sessionId]) throw new TransportEnvelopeValidationError(`transport session already exists: ${sessionId}`);
  const next = clone(state);
  next.sessions[sessionId] = {
    sessionId,
    clientId,
    keyId,
    status: "connected",
    lastInputSeq: 0,
    windowStartTick: state.serverTick,
    windowCount: 0,
    receipts: {},
    moderationHolds: 0,
  };
  return appendEvent(next, { eventType: "transport.session_registered", sessionId, payload: { clientId, keyId } });
}

export function signTransportEnvelope({ sessionId, inputSeq, nonce, issuedAtTick = 0, intent, key }) {
  assertNonEmpty(sessionId, "sessionId");
  assertInteger(inputSeq, "inputSeq", 1);
  assertNonEmpty(nonce, "nonce");
  assertInteger(issuedAtTick, "issuedAtTick");
  assertIntent(intent);
  const material = { transportSchemaVersion: TRANSPORT_ENVELOPE_SCHEMA_VERSION, sessionId, inputSeq, nonce, issuedAtTick, intent: clone(intent) };
  return { ...material, signature: signMaterial(material, key) };
}

function verifySignature(envelope, key) {
  if (!envelope || envelope.transportSchemaVersion !== TRANSPORT_ENVELOPE_SCHEMA_VERSION) throw new TransportEnvelopeValidationError("unsupported transport envelope schema version");
  assertNonEmpty(envelope.signature, "signature");
  const expected = signMaterial(envelopeMaterial(envelope), key);
  const expectedBytes = Buffer.from(expected, "hex");
  const receivedBytes = Buffer.from(envelope.signature, "hex");
  if (expectedBytes.length !== receivedBytes.length || !timingSafeEqual(expectedBytes, receivedBytes)) throw new TransportEnvelopeValidationError("transport envelope signature is invalid");
}

export function admitTransportEnvelope(state, { expectedRevision, envelope, key, serverTick = state.serverTick, moderationFlags = [] }) {
  assertRevision(state, expectedRevision);
  assertInteger(serverTick, "serverTick", state.serverTick);
  if (!Array.isArray(moderationFlags) || moderationFlags.some((flag) => typeof flag !== "string" || flag.trim() === "")) throw new TransportEnvelopeValidationError("moderationFlags must contain labels");
  const session = sessionOrThrow(state, envelope?.sessionId);
  verifySignature(envelope, key);
  if (Math.abs(serverTick - envelope.issuedAtTick) > state.clockSkewTicks) throw new TransportEnvelopeValidationError("transport envelope is outside the clock-skew window");
  const next = clone(state);
  next.serverTick = serverTick;
  const nextSession = next.sessions[session.sessionId];
  const existing = nextSession.receipts[envelope.inputSeq];
  if (existing) {
    if (existing.signature !== envelope.signature || existing.nonce !== envelope.nonce) throw new TransportEnvelopeValidationError(`conflicting duplicate input: ${envelope.inputSeq}`);
    return { state, decision: "duplicate", receipt: clone(existing) };
  }
  if (envelope.inputSeq !== nextSession.lastInputSeq + 1) throw new TransportEnvelopeValidationError(`input sequence must be ${nextSession.lastInputSeq + 1}`);
  if (serverTick - nextSession.windowStartTick >= state.windowTicks) {
    nextSession.windowStartTick = serverTick;
    nextSession.windowCount = 0;
  }
  if (nextSession.windowCount >= state.maxInputsPerWindow) {
    const limited = appendEvent(next, { eventType: "transport.input_rate_limited", sessionId: session.sessionId, payload: { inputSeq: envelope.inputSeq, serverTick } });
    return { state: limited, decision: "rate-limited", receipt: null };
  }
  const blocked = moderationFlags.length > 0;
  nextSession.lastInputSeq = envelope.inputSeq;
  nextSession.windowCount += 1;
  if (blocked) nextSession.moderationHolds += 1;
  const receipt = { inputSeq: envelope.inputSeq, nonce: envelope.nonce, signature: envelope.signature, decision: blocked ? "moderation-hold" : "accepted", serverTick };
  nextSession.receipts[envelope.inputSeq] = receipt;
  const committed = appendEvent(next, {
    eventType: blocked ? "transport.input_moderation_hold" : "transport.input_accepted",
    sessionId: session.sessionId,
    payload: { inputSeq: envelope.inputSeq, serverTick, moderationFlags: blocked ? [...moderationFlags] : [] },
  });
  return { state: committed, decision: receipt.decision, receipt: clone(receipt) };
}

export function projectTransport(state) {
  return {
    schemaVersion: TRANSPORT_ENVELOPE_SCHEMA_VERSION,
    serverId: state.serverId,
    serverTick: state.serverTick,
    sessions: Object.values(state.sessions).map((session) => ({
      sessionId: session.sessionId,
      status: session.status,
      lastInputSeq: session.lastInputSeq,
      moderationHoldBand: session.moderationHolds > 2 ? "high" : session.moderationHolds > 0 ? "guarded" : "low",
    })),
    omittedFields: ["key IDs", "signatures", "nonces", "intent payloads", "receipts", "event hashes"],
  };
}

export function snapshotTransport(state) { return { snapshotVersion: 1, state: clone(state) }; }

export function restoreTransport(snapshotValue) {
  if (!snapshotValue || snapshotValue.snapshotVersion !== 1) throw new TransportEnvelopeValidationError("unsupported transport snapshot version");
  const state = clone(snapshotValue.state);
  if (!state || state.schemaVersion !== TRANSPORT_ENVELOPE_SCHEMA_VERSION) throw new TransportEnvelopeValidationError("unsupported transport schema version");
  let revision = 0;
  let previousHash = null;
  for (const event of state.events) {
    if (event.revision !== revision + 1) throw new TransportEnvelopeValidationError("transport revisions are not contiguous");
    if (event.previousHash !== previousHash) throw new TransportEnvelopeValidationError("transport event chain is broken");
    const { hash, ...unsignedEvent } = event;
    if (hash !== eventHash(unsignedEvent, event.previousHash)) throw new TransportEnvelopeValidationError("transport event hash is invalid");
    revision = event.revision;
    previousHash = event.hash;
  }
  if (state.revision !== revision || state.lastEventHash !== previousHash) throw new TransportEnvelopeValidationError("transport snapshot does not match history");
  return state;
}
