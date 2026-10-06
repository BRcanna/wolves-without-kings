import {
  acquireAuthorityLease,
  assertAuthorityFencingToken,
  createAuthorityCoordinationState,
  handoffAuthorityLease,
  projectAuthorityCoordination,
  registerCoordinationNode,
  renewAuthorityLease,
} from "./authority-coordination.mjs";
import {
  createQuorumAuthorityService,
  QuorumUnavailableError,
} from "./quorum-authority-service.mjs";

export class CoordinatedAuthorityValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "CoordinatedAuthorityValidationError";
  }
}

function clone(value) { return structuredClone(value); }

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new CoordinatedAuthorityValidationError(`${field} must be a non-empty string`);
}

function response(status, body) {
  return { status, body: clone(body) };
}

function isMutation(request) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(request.method ?? "GET");
}

function fenceFailure(error, service) {
  return response(409, {
    error: "authority_fence_rejected",
    message: error.message,
    authoritativeRevision: service.state.worldRevision,
    retryable: true,
  });
}

export function createCoordinatedAuthorityService({
  nodes,
  quorum,
  initialState,
  resolveIntent,
  initialLeaderId,
  currentTick = 0,
  leaseTicks = 5,
} = {}) {
  if (!Array.isArray(nodes) || nodes.length < 3) throw new CoordinatedAuthorityValidationError("nodes must contain at least three authority nodes");
  assertNonEmpty(initialLeaderId, "initialLeaderId");
  if (!Number.isInteger(currentTick) || currentTick < 0) throw new CoordinatedAuthorityValidationError("currentTick must be an integer >= 0");
  if (!Number.isInteger(leaseTicks) || leaseTicks < 1) throw new CoordinatedAuthorityValidationError("leaseTicks must be an integer >= 1");
  const quorumService = createQuorumAuthorityService({ nodes, quorum, initialState, resolveIntent });
  let coordination = createAuthorityCoordinationState({ worldId: quorumService.state.worldId, currentTick });
  for (const node of nodes) coordination = registerCoordinationNode(coordination, { nodeId: node.nodeId, hostLabel: node.nodeId });
  if (!quorumService.health.nodes.some((node) => node.nodeId === initialLeaderId && node.available)) throw new CoordinatedAuthorityValidationError(`initial leader is unavailable: ${initialLeaderId}`);
  if (!quorumService.health.quorumAvailable) throw new QuorumUnavailableError(quorumService.health.availableNodes, quorumService.quorum);
  const acquired = acquireAuthorityLease(coordination, { nodeId: initialLeaderId, currentTick, leaseTicks });
  coordination = acquired.state;

  function nodeAvailable(nodeId) {
    return quorumService.health.nodes.some((node) => node.nodeId === nodeId && node.available);
  }

  function requireAvailable(nodeId) {
    if (!nodeAvailable(nodeId)) throw new CoordinatedAuthorityValidationError(`coordination node is unavailable: ${nodeId}`);
  }

  function health() {
    return { quorum: quorumService.health, coordination: projectAuthorityCoordination(coordination) };
  }

  return {
    get state() { return quorumService.state; },
    get fenceToken() { return coordination.fenceToken; },
    get leaderId() { return coordination.leaderId; },
    get health() { return clone(health()); },
    acquireLease({ nodeId, currentTick: tick = coordination.currentTick, leaseTicks: duration = leaseTicks } = {}) {
      requireAvailable(nodeId);
      if (!quorumService.health.quorumAvailable) throw new QuorumUnavailableError(quorumService.health.availableNodes, quorumService.quorum);
      const acquiredLease = acquireAuthorityLease(coordination, { nodeId, currentTick: tick, leaseTicks: duration });
      coordination = acquiredLease.state;
      return { fenceToken: acquiredLease.fenceToken, term: acquiredLease.term, leaderId: coordination.leaderId };
    },
    renewLease({ nodeId, fenceToken, currentTick: tick = coordination.currentTick, leaseTicks: duration = leaseTicks } = {}) {
      requireAvailable(nodeId);
      coordination = renewAuthorityLease(coordination, { nodeId, fenceToken, currentTick: tick, leaseTicks: duration });
      return { fenceToken: coordination.fenceToken, term: coordination.term, leaderId: coordination.leaderId, leaseExpiresAtTick: coordination.leaseExpiresAtTick };
    },
    handoff({ fromNodeId, toNodeId, fenceToken, currentTick: tick = coordination.currentTick, leaseTicks: duration = leaseTicks } = {}) {
      requireAvailable(fromNodeId);
      requireAvailable(toNodeId);
      const handedOff = handoffAuthorityLease(coordination, { fromNodeId, toNodeId, fenceToken, currentTick: tick, leaseTicks: duration });
      coordination = handedOff.state;
      return { fenceToken: handedOff.fenceToken, term: handedOff.term, leaderId: coordination.leaderId };
    },
    setNodeAvailability(nodeId, available) {
      try {
        const result = quorumService.setNodeAvailability(nodeId, available);
        return clone({ ...result, coordination: projectAuthorityCoordination(coordination) });
      } catch (error) {
        if (error instanceof QuorumUnavailableError) throw error;
        throw new CoordinatedAuthorityValidationError(error.message);
      }
    },
    request({ nodeId, fenceToken, ...request } = {}) {
      if (request.method === "GET" && request.path === "/health") return response(200, { service: "wolves-without-kings-authority", mode: "coordinated", ...health() });
      if (isMutation(request)) {
        try {
          requireAvailable(nodeId);
          assertAuthorityFencingToken(coordination, { nodeId, fenceToken, currentTick: request.currentTick ?? coordination.currentTick });
        } catch (error) {
          if (error instanceof CoordinatedAuthorityValidationError || error.name === "AuthorityCoordinationValidationError") return fenceFailure(error, quorumService);
          throw error;
        }
      }
      return quorumService.request(request);
    },
  };
}
