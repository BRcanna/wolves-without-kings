import { createHash } from "node:crypto";

import { createAuthorityHttpServer } from "./http-service.mjs";
import { canonicalJson } from "./engine.mjs";

export const AUTHORITY_CLUSTER_SCHEMA_VERSION = 1;

export class AuthorityClusterValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthorityClusterValidationError";
  }
}

export class ClusterQuorumUnavailableError extends AuthorityClusterValidationError {
  constructor(availableNodes, quorum) {
    super(`cluster membership quorum unavailable: ${availableNodes} active node(s), ${quorum} required`);
    this.name = "ClusterQuorumUnavailableError";
    this.availableNodes = availableNodes;
    this.quorum = quorum;
  }
}

function clone(value) { return structuredClone(value); }

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new AuthorityClusterValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) throw new AuthorityClusterValidationError(`${field} must be an integer >= ${minimum}`);
}

function assertNodeStatus(status) {
  if (!["active", "suspect", "offline"].includes(status)) throw new AuthorityClusterValidationError("node status must be active, suspect, or offline");
}

function eventHash(event, previousHash) {
  return createHash("sha256").update(`${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`, "utf8").digest("hex");
}

function appendEvent(state, eventType, payload) {
  const next = clone(state);
  const unsigned = {
    eventId: `membership-${String(next.nextEventId).padStart(6, "0")}`,
    eventType,
    membershipTick: next.currentTick,
    term: next.term,
    leaderId: next.leaderId,
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
  if (!state || state.schemaVersion !== AUTHORITY_CLUSTER_SCHEMA_VERSION || !state.nodes || !Array.isArray(state.events)) {
    throw new AuthorityClusterValidationError("invalid authority cluster membership state");
  }
  assertNonEmpty(state.clusterId, "clusterId");
  assertInteger(state.currentTick, "currentTick");
  assertInteger(state.term, "term", 1);
  assertInteger(state.quorum, "quorum", 1);
  assertInteger(state.nextEventId, "nextEventId", 1);
  if (!state.leaderId || !state.nodes[state.leaderId]) throw new AuthorityClusterValidationError("membership leader must be a registered node");
  const nodeIds = Object.keys(state.nodes);
  if (nodeIds.length < 3 || state.quorum > nodeIds.length || state.quorum <= Math.floor(nodeIds.length / 2)) {
    throw new AuthorityClusterValidationError("membership quorum must be a strict majority of at least three nodes");
  }
  for (const node of Object.values(state.nodes)) {
    assertNonEmpty(node.nodeId, "nodeId");
    assertNodeStatus(node.status);
    assertInteger(node.lastHeartbeatTick, `${node.nodeId}.lastHeartbeatTick`);
    if (node.endpoint !== null) assertNonEmpty(node.endpoint, `${node.nodeId}.endpoint`);
  }
}

function requireNode(state, nodeId) {
  assertNonEmpty(nodeId, "nodeId");
  const node = state.nodes[nodeId];
  if (!node) throw new AuthorityClusterValidationError(`unknown cluster node: ${nodeId}`);
  return node;
}

function activeNodes(state) {
  return Object.values(state.nodes).filter((node) => node.status === "active");
}

export function createAuthorityClusterMembership({
  clusterId = "wwk-authority-cluster",
  nodes,
  quorum,
  initialLeaderId,
  currentTick = 0,
} = {}) {
  assertNonEmpty(clusterId, "clusterId");
  assertInteger(currentTick, "currentTick");
  if (!Array.isArray(nodes) || nodes.length < 3) throw new AuthorityClusterValidationError("nodes must contain at least three members");
  const normalizedNodes = nodes.map((entry, index) => {
    const nodeId = typeof entry === "string" ? entry : entry?.nodeId;
    assertNonEmpty(nodeId, `nodes[${index}].nodeId`);
    return { nodeId, endpoint: typeof entry === "object" && entry?.endpoint ? entry.endpoint : null };
  });
  const seen = new Set();
  for (const node of normalizedNodes) {
    if (seen.has(node.nodeId)) throw new AuthorityClusterValidationError(`duplicate cluster node ${node.nodeId}`);
    seen.add(node.nodeId);
  }
  assertInteger(quorum, "quorum", 1);
  if (quorum > normalizedNodes.length || quorum <= Math.floor(normalizedNodes.length / 2)) {
    throw new AuthorityClusterValidationError("quorum must be a strict majority and cannot exceed node count");
  }
  assertNonEmpty(initialLeaderId, "initialLeaderId");
  if (!seen.has(initialLeaderId)) throw new AuthorityClusterValidationError(`unknown initial leader ${initialLeaderId}`);
  const state = {
    schemaVersion: AUTHORITY_CLUSTER_SCHEMA_VERSION,
    clusterId,
    currentTick,
    term: 1,
    leaderId: initialLeaderId,
    quorum,
    nodes: Object.fromEntries(normalizedNodes.map(({ nodeId, endpoint }) => [nodeId, {
      nodeId,
      endpoint,
      status: "active",
      lastHeartbeatTick: currentTick,
    }])),
    events: [],
    nextEventId: 1,
    lastEventHash: null,
  };
  return appendEvent(state, "cluster.membership.initialized", { leaderId: initialLeaderId, quorum });
}

export function setClusterNodeEndpoint(state, { nodeId, endpoint } = {}) {
  assertState(state);
  const node = requireNode(state, nodeId);
  if (endpoint !== null) {
    assertNonEmpty(endpoint, "endpoint");
    try { new URL(endpoint); } catch { throw new AuthorityClusterValidationError("endpoint must be a valid URL"); }
  }
  const next = clone(state);
  next.nodes[node.nodeId].endpoint = endpoint;
  return appendEvent(next, "cluster.node.endpoint.updated", { nodeId, configured: endpoint !== null });
}

export function setClusterNodeStatus(state, { nodeId, status, currentTick = state.currentTick } = {}) {
  assertState(state);
  const node = requireNode(state, nodeId);
  assertNodeStatus(status);
  assertInteger(currentTick, "currentTick");
  const next = clone(state);
  next.currentTick = currentTick;
  next.nodes[node.nodeId].status = status;
  return appendEvent(next, `cluster.node.${status}`, { nodeId });
}

export function recordClusterHeartbeat(state, { nodeId, currentTick = state.currentTick } = {}) {
  assertState(state);
  const node = requireNode(state, nodeId);
  assertInteger(currentTick, "currentTick");
  if (node.status === "offline") throw new AuthorityClusterValidationError(`offline cluster node cannot heartbeat: ${nodeId}`);
  const next = clone(state);
  next.currentTick = currentTick;
  next.nodes[node.nodeId].status = "active";
  next.nodes[node.nodeId].lastHeartbeatTick = currentTick;
  return appendEvent(next, "cluster.node.heartbeat", { nodeId });
}

export function electClusterLeader(state, { candidateId, currentTick = state.currentTick } = {}) {
  assertState(state);
  const candidate = requireNode(state, candidateId);
  assertInteger(currentTick, "currentTick");
  const available = activeNodes(state).length;
  if (available < state.quorum) throw new ClusterQuorumUnavailableError(available, state.quorum);
  if (candidate.status !== "active") throw new AuthorityClusterValidationError(`election candidate is not active: ${candidateId}`);
  const next = clone(state);
  next.currentTick = currentTick;
  if (next.leaderId === candidateId) return next;
  next.term += 1;
  next.leaderId = candidateId;
  return appendEvent(next, "cluster.leader.elected", { candidateId, activeNodes: available });
}

export function projectAuthorityClusterMembership(state) {
  assertState(state);
  return {
    schemaVersion: AUTHORITY_CLUSTER_SCHEMA_VERSION,
    clusterId: state.clusterId,
    currentTick: state.currentTick,
    term: state.term,
    leaderId: state.leaderId,
    quorum: state.quorum,
    activeNodes: activeNodes(state).length,
    nodes: Object.values(state.nodes).map((node) => ({
      nodeId: node.nodeId,
      status: node.status,
      heartbeatBand: node.status === "active" ? "current" : "unavailable",
    })),
    omittedFields: ["endpoint", "event hashes"],
  };
}

export function snapshotAuthorityClusterMembership(state) {
  assertState(state);
  return { snapshotVersion: 1, state: clone(state) };
}

export function restoreAuthorityClusterMembership(snapshot) {
  if (!snapshot || snapshot.snapshotVersion !== 1) throw new AuthorityClusterValidationError("unsupported cluster membership snapshot version");
  const state = clone(snapshot.state);
  assertState(state);
  let previousHash = null;
  let nextEventId = 1;
  for (const event of state.events) {
    if (event.eventId !== `membership-${String(nextEventId).padStart(6, "0")}`) throw new AuthorityClusterValidationError("membership event IDs are not contiguous");
    if (event.previousHash !== previousHash) throw new AuthorityClusterValidationError("membership event chain is broken");
    const { hash, ...unsigned } = event;
    if (hash !== eventHash(unsigned, event.previousHash)) throw new AuthorityClusterValidationError("membership event hash is invalid");
    previousHash = hash;
    nextEventId += 1;
  }
  if (state.nextEventId !== nextEventId || state.lastEventHash !== previousHash) throw new AuthorityClusterValidationError("membership snapshot does not match history");
  return state;
}

function response(status, body) { return { status, body: clone(body) }; }

function isMutation(method) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method ?? "GET");
}

function assertService(service) {
  if (!service || typeof service.request !== "function" || !service.health || typeof service.setNodeAvailability !== "function") {
    throw new AuthorityClusterValidationError("service must expose request, health, and setNodeAvailability");
  }
}

function serverListening(server) {
  return Boolean(server?.listening);
}

function closeServer(server) {
  if (!serverListening(server)) return Promise.resolve();
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function listenServer(server, host) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new AuthorityClusterValidationError("cluster node did not expose a TCP address");
  return `http://${host}:${address.port}`;
}

async function requestJson(endpoint, { method = "GET", path = "/health", body = null, headers = {}, timeoutMs = 2000 } = {}) {
  assertNonEmpty(endpoint, "endpoint");
  assertInteger(timeoutMs, "timeoutMs", 1);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${endpoint}${path}`, {
      method,
      headers: body === null ? { ...headers } : { "content-type": "application/json", ...headers },
      body: body === null ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") ?? "";
    const responseBody = contentType.includes("application/json") ? await response.json() : await response.text();
    return { status: response.status, body: responseBody };
  } catch (error) {
    return response(503, {
      error: "cluster_transport_unavailable",
      message: error.name === "AbortError" ? "cluster request timed out" : "cluster node transport failed",
      retryable: true,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function createAuthorityClusterRuntime({
  service,
  nodes,
  quorum,
  initialLeaderId,
  clusterId = "wwk-authority-cluster",
  currentTick = 0,
  leaseTicks = 5,
  host = "127.0.0.1",
  requestTimeoutMs = 2000,
} = {}) {
  assertService(service);
  assertNonEmpty(host, "host");
  assertInteger(currentTick, "currentTick");
  assertInteger(leaseTicks, "leaseTicks", 1);
  assertInteger(requestTimeoutMs, "requestTimeoutMs", 1);
  const serviceNodes = service.health.quorum.nodes.map((node) => node.nodeId);
  const configuredNodes = nodes ?? serviceNodes.map((nodeId) => ({ nodeId }));
  const configuredIds = configuredNodes.map((entry) => typeof entry === "string" ? entry : entry?.nodeId);
  if (configuredIds.length !== serviceNodes.length || configuredIds.some((nodeId) => !serviceNodes.includes(nodeId))) {
    throw new AuthorityClusterValidationError("cluster nodes must match coordinated authority nodes");
  }
  const leaderId = initialLeaderId ?? service.leaderId;
  if (!leaderId) throw new AuthorityClusterValidationError("initialLeaderId is required");
  const membershipQuorum = quorum ?? service.health.quorum.quorum;
  let membership = createAuthorityClusterMembership({ clusterId, nodes: configuredNodes, quorum: membershipQuorum, initialLeaderId: leaderId, currentTick });
  let leaseExpiresAtTick = currentTick + leaseTicks;
  const servers = new Map();

  function member(nodeId) { return requireNode(membership, nodeId); }

  function nodeService(nodeId) {
    return {
      request(request = {}) {
        const node = member(nodeId);
        if (request.method === "GET" && new URL(request.path ?? "/", "http://wolves-without-kings.local").pathname === "/health") {
          const result = service.request(request);
          return response(result.status, { ...result.body, nodeId, cluster: projectAuthorityClusterMembership(membership) });
        }
        if (node.status !== "active") return response(503, { error: "cluster_node_unavailable", nodeId, retryable: true });
        if (isMutation(request.method) && membership.leaderId !== nodeId) {
          return response(421, { error: "not_current_leader", nodeId, leaderId: membership.leaderId, term: membership.term, retryable: true });
        }
        if (isMutation(request.method)) return service.request({ ...request, nodeId, fenceToken: service.fenceToken });
        return service.request(request);
      },
    };
  }

  function requireServer(nodeId) {
    member(nodeId);
    const server = servers.get(nodeId);
    if (!serverListening(server)) throw new AuthorityClusterValidationError(`cluster node is not listening: ${nodeId}`);
    return server;
  }

  async function listenNode(nodeId) {
    member(nodeId);
    if (serverListening(servers.get(nodeId))) return membership.nodes[nodeId].endpoint;
    service.setNodeAvailability(nodeId, true);
    const server = createAuthorityHttpServer({ service: nodeService(nodeId) });
    const endpoint = await listenServer(server, host);
    servers.set(nodeId, server);
    membership = setClusterNodeEndpoint(membership, { nodeId, endpoint });
    membership = recordClusterHeartbeat(membership, { nodeId, currentTick: membership.currentTick });
    return endpoint;
  }

  async function stopNode(nodeId) {
    member(nodeId);
    const server = servers.get(nodeId);
    await closeServer(server);
    servers.delete(nodeId);
    service.setNodeAvailability(nodeId, false);
    membership = setClusterNodeStatus(membership, { nodeId, status: "offline", currentTick: membership.currentTick });
    return projectAuthorityClusterMembership(membership);
  }

  async function listenAll() {
    for (const nodeId of configuredIds) await listenNode(nodeId);
    return clone(membership);
  }

  async function electLeader({ candidateId, currentTick: tick = membership.currentTick } = {}) {
    member(candidateId);
    assertInteger(tick, "currentTick");
    const candidateServer = requireServer(candidateId);
    if (!candidateServer) throw new AuthorityClusterValidationError(`cluster candidate is unavailable: ${candidateId}`);
    const active = Object.values(membership.nodes).filter((node) => node.status === "active" && serverListening(servers.get(node.nodeId))).length;
    if (active < membership.quorum) throw new ClusterQuorumUnavailableError(active, membership.quorum);
    const previousLeader = membership.leaderId;
    if (previousLeader === candidateId) return { ...clone(projectAuthorityClusterMembership(membership)), leaderId: candidateId, fenceToken: service.fenceToken };
    const previousServerAvailable = serverListening(servers.get(previousLeader)) && membership.nodes[previousLeader]?.status === "active";
    let lease;
    if (previousServerAvailable) {
      lease = service.handoff({ fromNodeId: previousLeader, toNodeId: candidateId, fenceToken: service.fenceToken, currentTick: tick, leaseTicks });
    } else {
      if (tick < leaseExpiresAtTick) throw new AuthorityClusterValidationError("previous leader lease has not expired");
      lease = service.acquireLease({ nodeId: candidateId, currentTick: tick, leaseTicks });
    }
    leaseExpiresAtTick = tick + leaseTicks;
    membership = electClusterLeader(membership, { candidateId, currentTick: tick });
    return { ...clone(projectAuthorityClusterMembership(membership)), term: lease.term, leaderId: candidateId, fenceToken: lease.fenceToken };
  }

  async function requestNode(nodeId, request = {}) {
    const endpoint = membership.nodes[nodeId]?.endpoint;
    if (!endpoint || !serverListening(servers.get(nodeId))) return response(503, { error: "cluster_transport_unavailable", nodeId, retryable: true });
    return requestJson(endpoint, { ...request, timeoutMs: request.timeoutMs ?? requestTimeoutMs });
  }

  async function request(request = {}) {
    return requestNode(membership.leaderId, request);
  }

  return {
    get membership() { return clone(membership); },
    get health() { return { membership: projectAuthorityClusterMembership(membership), authority: clone(service.health) }; },
    get leaderId() { return membership.leaderId; },
    get state() { return clone(service.state); },
    get fenceToken() { return service.fenceToken; },
    get endpointMap() { return Object.fromEntries(Object.entries(membership.nodes).map(([nodeId, node]) => [nodeId, node.endpoint])); },
    listenNode,
    listenAll,
    stopNode,
    electLeader,
    requestNode,
    request,
    async close() {
      for (const nodeId of [...servers.keys()]) await stopNode(nodeId);
    },
  };
}
