import { createHash } from "node:crypto";

import { canonicalJson } from "./engine.mjs";

export const AUTHORITY_COORDINATION_SCHEMA_VERSION = 1;

export class AuthorityCoordinationValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthorityCoordinationValidationError";
  }
}

function clone(value) { return structuredClone(value); }

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new AuthorityCoordinationValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) throw new AuthorityCoordinationValidationError(`${field} must be an integer >= ${minimum}`);
}

function eventHash(event, previousHash) {
  return createHash("sha256").update(`${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`, "utf8").digest("hex");
}

function appendEvent(state, eventType, payload) {
  const next = clone(state);
  const unsigned = {
    eventId: `coordination-${String(next.nextEventId).padStart(6, "0")}`,
    eventType,
    coordinationTick: next.currentTick,
    term: next.term,
    fenceToken: next.fenceToken,
    payload: clone(payload),
    previousHash: next.lastEventHash,
  };
  const event = { ...unsigned, hash: eventHash(unsigned, unsigned.previousHash) };
  next.events.push(event);
  next.nextEventId += 1;
  next.lastEventHash = event.hash;
  return next;
}

function assertState(state) {
  if (!state || state.schemaVersion !== AUTHORITY_COORDINATION_SCHEMA_VERSION || !state.nodes || !Array.isArray(state.events)) throw new AuthorityCoordinationValidationError("invalid authority coordination state");
  assertNonEmpty(state.worldId, "worldId");
  assertInteger(state.currentTick, "currentTick");
  assertInteger(state.term, "term");
  assertInteger(state.nextEventId, "nextEventId", 1);
}

function activeNode(state, nodeId) {
  assertNonEmpty(nodeId, "nodeId");
  const node = state.nodes[nodeId];
  if (!node) throw new AuthorityCoordinationValidationError(`unknown coordination node: ${nodeId}`);
  if (node.status !== "active") throw new AuthorityCoordinationValidationError(`coordination node ${nodeId} is ${node.status}`);
  return node;
}

function currentLeaseExpired(state, tick = state.currentTick) {
  return state.leaderId === null || state.leaseExpiresAtTick <= tick;
}

function requireCurrentLease(state, { nodeId, fenceToken, currentTick = state.currentTick } = {}) {
  assertState(state);
  assertInteger(currentTick, "currentTick");
  activeNode(state, nodeId);
  assertNonEmpty(fenceToken, "fenceToken");
  if (state.leaderId !== nodeId || state.fenceToken !== fenceToken || currentLeaseExpired(state, currentTick)) {
    throw new AuthorityCoordinationValidationError("authority lease or fencing token is stale");
  }
}

export function createAuthorityCoordinationState({ worldId = "wwk-coordination", currentTick = 0 } = {}) {
  assertNonEmpty(worldId, "worldId");
  assertInteger(currentTick, "currentTick");
  return { schemaVersion: AUTHORITY_COORDINATION_SCHEMA_VERSION, worldId, currentTick, term: 0, leaderId: null, leaseExpiresAtTick: 0, fenceToken: null, nodes: {}, events: [], nextEventId: 1, lastEventHash: null };
}

export function registerCoordinationNode(state, { nodeId, hostLabel = nodeId } = {}) {
  assertState(state);
  assertNonEmpty(nodeId, "nodeId");
  assertNonEmpty(hostLabel, "hostLabel");
  if (state.nodes[nodeId]) throw new AuthorityCoordinationValidationError(`coordination node already exists: ${nodeId}`);
  const next = clone(state);
  next.nodes[nodeId] = { nodeId, hostLabel, status: "active", registeredAtTick: state.currentTick };
  return appendEvent(next, "authority.node.registered", { nodeId, hostLabel });
}

export function setCoordinationNodeStatus(state, { nodeId, status } = {}) {
  assertState(state);
  if (!["active", "suspended"].includes(status)) throw new AuthorityCoordinationValidationError("node status must be active or suspended");
  activeNode(state, nodeId);
  if (status === "suspended" && state.leaderId === nodeId) throw new AuthorityCoordinationValidationError("current leader must hand off before suspension");
  const next = clone(state);
  next.nodes[nodeId].status = status;
  return appendEvent(next, `authority.node.${status}`, { nodeId });
}

export function acquireAuthorityLease(state, { nodeId, currentTick = state.currentTick, leaseTicks = 5 } = {}) {
  assertState(state);
  assertInteger(currentTick, "currentTick");
  assertInteger(leaseTicks, "leaseTicks", 1);
  activeNode(state, nodeId);
  if (!currentLeaseExpired(state, currentTick)) throw new AuthorityCoordinationValidationError(`authority lease is held by ${state.leaderId}`);
  const next = clone(state);
  next.currentTick = currentTick;
  next.term += 1;
  next.leaderId = nodeId;
  next.leaseExpiresAtTick = currentTick + leaseTicks;
  next.fenceToken = `fence:${next.term}:${nodeId}`;
  return { state: appendEvent(next, "authority.lease.acquired", { nodeId, leaseExpiresAtTick: next.leaseExpiresAtTick }), fenceToken: next.fenceToken, term: next.term };
}

export function renewAuthorityLease(state, { nodeId, fenceToken, currentTick = state.currentTick, leaseTicks = 5 } = {}) {
  requireCurrentLease(state, { nodeId, fenceToken, currentTick });
  assertInteger(leaseTicks, "leaseTicks", 1);
  const next = clone(state);
  next.currentTick = currentTick;
  next.leaseExpiresAtTick = currentTick + leaseTicks;
  return appendEvent(next, "authority.lease.renewed", { nodeId, leaseExpiresAtTick: next.leaseExpiresAtTick });
}

export function handoffAuthorityLease(state, { fromNodeId, toNodeId, fenceToken, currentTick = state.currentTick, leaseTicks = 5 } = {}) {
  requireCurrentLease(state, { nodeId: fromNodeId, fenceToken, currentTick });
  assertInteger(leaseTicks, "leaseTicks", 1);
  activeNode(state, toNodeId);
  if (fromNodeId === toNodeId) throw new AuthorityCoordinationValidationError("handoff target must differ from current leader");
  const next = clone(state);
  next.currentTick = currentTick;
  next.term += 1;
  next.leaderId = toNodeId;
  next.leaseExpiresAtTick = currentTick + leaseTicks;
  next.fenceToken = `fence:${next.term}:${toNodeId}`;
  return { state: appendEvent(next, "authority.lease.handed_off", { fromNodeId, toNodeId, leaseExpiresAtTick: next.leaseExpiresAtTick }), fenceToken: next.fenceToken, term: next.term };
}

export function assertAuthorityFencingToken(state, { nodeId, fenceToken, currentTick = state.currentTick } = {}) {
  requireCurrentLease(state, { nodeId, fenceToken, currentTick });
  return { nodeId, term: state.term, fenceToken, leaseExpiresAtTick: state.leaseExpiresAtTick };
}

export function projectAuthorityCoordination(state) {
  assertState(state);
  return {
    schemaVersion: AUTHORITY_COORDINATION_SCHEMA_VERSION,
    worldId: state.worldId,
    currentTick: state.currentTick,
    term: state.term,
    leaderBand: state.leaderId ? "assigned" : "unassigned",
    nodeBands: Object.values(state.nodes).map((node) => ({ nodeId: node.nodeId, status: node.status })),
    omittedFields: ["fence token", "lease expiry", "host labels", "event hashes"],
  };
}

export function snapshotAuthorityCoordination(state) {
  assertState(state);
  return { snapshotVersion: 1, state: clone(state) };
}

export function restoreAuthorityCoordination(snapshot) {
  if (!snapshot || snapshot.snapshotVersion !== 1) throw new AuthorityCoordinationValidationError("unsupported coordination snapshot version");
  const state = clone(snapshot.state);
  assertState(state);
  let previousHash = null;
  let nextEventId = 1;
  for (const event of state.events) {
    if (event.eventId !== `coordination-${String(nextEventId).padStart(6, "0")}`) throw new AuthorityCoordinationValidationError("coordination event IDs are not contiguous");
    if (event.previousHash !== previousHash) throw new AuthorityCoordinationValidationError("coordination event chain is broken");
    const { hash, ...unsigned } = event;
    if (hash !== eventHash(unsigned, event.previousHash)) throw new AuthorityCoordinationValidationError("coordination event hash is invalid");
    previousHash = hash;
    nextEventId += 1;
  }
  if (state.nextEventId !== nextEventId || state.lastEventHash !== previousHash) throw new AuthorityCoordinationValidationError("coordination snapshot does not match history");
  return state;
}
