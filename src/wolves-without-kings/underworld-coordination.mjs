import { createQuorumUnderworldStore, UnderworldQuorumUnavailableError } from "./quorum-underworld-store.mjs";

export const UNDERWORLD_COORDINATION_SCHEMA_VERSION = 1;

export class UnderworldCoordinationValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnderworldCoordinationValidationError";
  }
}

function clone(value) { return structuredClone(value); }

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new UnderworldCoordinationValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) throw new UnderworldCoordinationValidationError(`${field} must be an integer >= ${minimum}`);
}

function unavailable(message, availableNodes, quorum) {
  const error = new UnderworldQuorumUnavailableError(availableNodes, quorum);
  error.message = message;
  return error;
}

export function createCoordinatedUnderworldStore({ nodes, quorum, initialState, leaseTicks = 3 } = {}) {
  assertInteger(leaseTicks, "leaseTicks", 1);
  const store = createQuorumUnderworldStore({ nodes, quorum, initialState });
  const nodeIds = nodes.map((node) => node.nodeId);
  let currentTick = 0;
  let fencingTerm = 1;
  let leaderId = nodes.find((node) => node.available !== false)?.nodeId ?? null;
  let leaseExpiresAtTick = leaderId ? leaseTicks : null;

  function nodeHealth(nodeId) {
    return store.health.nodes.find((node) => node.nodeId === nodeId);
  }

  function requireQuorum() {
    if (!store.health.quorumAvailable) throw unavailable("Underworld coordination quorum unavailable", store.health.availableNodes, store.quorum);
  }

  function expireLeaseIfNeeded() {
    if (leaderId && leaseExpiresAtTick !== null && currentTick >= leaseExpiresAtTick) {
      leaderId = null;
      leaseExpiresAtTick = null;
    }
  }

  function requireLeader(nodeId, fenceTerm) {
    assertNonEmpty(nodeId, "nodeId");
    assertInteger(fenceTerm, "fenceTerm", 1);
    expireLeaseIfNeeded();
    if (!leaderId) throw new UnderworldCoordinationValidationError("Underworld leader lease is not active");
    if (nodeId !== leaderId || fenceTerm !== fencingTerm) throw new UnderworldCoordinationValidationError("stale Underworld leader fencing term");
    const current = nodeHealth(nodeId);
    if (!current?.available) throw new UnderworldCoordinationValidationError("Underworld leader node is unavailable");
    if (leaseExpiresAtTick === null || currentTick >= leaseExpiresAtTick) throw new UnderworldCoordinationValidationError("Underworld leader lease has expired");
  }

  function health() {
    expireLeaseIfNeeded();
    return {
      schemaVersion: UNDERWORLD_COORDINATION_SCHEMA_VERSION,
      currentTick,
      fencingTerm,
      leaderId,
      leaseExpiresAtTick,
      quorum: store.health,
    };
  }

  function setNodeAvailability(nodeId, available) {
    assertNonEmpty(nodeId, "nodeId");
    if (!nodeIds.includes(nodeId)) throw new UnderworldCoordinationValidationError(`unknown Underworld node ${nodeId}`);
    const result = store.setNodeAvailability(nodeId, available);
    if (!available && nodeId === leaderId) {
      leaderId = null;
      leaseExpiresAtTick = null;
    }
    return clone({ ...health(), quorum: result });
  }

  function advanceClock(ticks = 1) {
    assertInteger(ticks, "ticks", 1);
    currentTick += ticks;
    expireLeaseIfNeeded();
    return clone(health());
  }

  function renew({ nodeId, fenceTerm, requestedLeaseTicks = leaseTicks } = {}) {
    assertInteger(requestedLeaseTicks, "requestedLeaseTicks", 1);
    requireQuorum();
    requireLeader(nodeId, fenceTerm);
    leaseExpiresAtTick = currentTick + requestedLeaseTicks;
    return clone(health());
  }

  function handoff({ fromNodeId, fromFenceTerm, targetNodeId } = {}) {
    requireQuorum();
    requireLeader(fromNodeId, fromFenceTerm);
    assertNonEmpty(targetNodeId, "targetNodeId");
    if (!nodeIds.includes(targetNodeId)) throw new UnderworldCoordinationValidationError(`unknown Underworld node ${targetNodeId}`);
    if (targetNodeId === leaderId) throw new UnderworldCoordinationValidationError("handoff target is already leader");
    if (!nodeHealth(targetNodeId)?.available) throw new UnderworldCoordinationValidationError("handoff target node is unavailable");
    fencingTerm += 1;
    leaderId = targetNodeId;
    leaseExpiresAtTick = currentTick + leaseTicks;
    return clone(health());
  }

  function elect({ targetNodeId } = {}) {
    requireQuorum();
    expireLeaseIfNeeded();
    if (leaderId) throw new UnderworldCoordinationValidationError("an active Underworld leader already exists");
    assertNonEmpty(targetNodeId, "targetNodeId");
    if (!nodeIds.includes(targetNodeId)) throw new UnderworldCoordinationValidationError(`unknown Underworld node ${targetNodeId}`);
    if (!nodeHealth(targetNodeId)?.available) throw new UnderworldCoordinationValidationError("election target node is unavailable");
    fencingTerm += 1;
    leaderId = targetNodeId;
    leaseExpiresAtTick = currentTick + leaseTicks;
    return clone(health());
  }

  function checkpoint(nextState, { nodeId, fenceTerm, checkpointId } = {}) {
    requireQuorum();
    requireLeader(nodeId, fenceTerm);
    const result = store.checkpoint(nextState, { checkpointId });
    leaseExpiresAtTick = currentTick + leaseTicks;
    return { state: clone(result.state), health: clone(health()) };
  }

  return {
    get state() { return store.state; },
    get journal() { return store.journal; },
    get health() { return clone(health()); },
    setNodeAvailability,
    advanceClock,
    renew,
    handoff,
    elect,
    checkpoint,
    repairNode: store.repairNode,
  };
}
