import {
  appendAuthorityCheckpoint,
  readAuthorityJournal,
  restoreLatestAuthorityCheckpoint,
  AuthorityJournalValidationError,
} from "./authority-journal.mjs";
import { createAuthorityState, restoreAuthorityState, snapshotAuthorityState } from "./authority.mjs";
import { createAuthorityService } from "./service.mjs";

export const AUTHORITY_QUORUM_SCHEMA_VERSION = 1;

export class QuorumAuthorityValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "QuorumAuthorityValidationError";
  }
}

export class QuorumUnavailableError extends QuorumAuthorityValidationError {
  constructor(availableNodes, quorum) {
    super(`authority quorum unavailable: ${availableNodes} available node(s), ${quorum} required`);
    this.name = "QuorumUnavailableError";
    this.availableNodes = availableNodes;
    this.quorum = quorum;
  }
}

function clone(value) {
  return structuredClone(value);
}

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new QuorumAuthorityValidationError(`${field} must be a non-empty string`);
  }
}

function assertInteger(value, field, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) {
    throw new QuorumAuthorityValidationError(`${field} must be an integer >= ${minimum}`);
  }
}

function nodeLabel(node) {
  return `node ${node.nodeId}`;
}

function readNodeJournal(node) {
  try {
    return readAuthorityJournal(node.journalPath);
  } catch (error) {
    if (error instanceof AuthorityJournalValidationError) {
      throw new QuorumAuthorityValidationError(`${nodeLabel(node)} journal is invalid: ${error.message}`);
    }
    throw new QuorumAuthorityValidationError(`${nodeLabel(node)} journal read failed: ${error.message}`);
  }
}

function sameRecord(left, right) {
  return left.hash === right.hash && left.checkpointId === right.checkpointId;
}

function assertPrefix(candidate, canonical, node) {
  if (candidate.entries.length > canonical.length) {
    throw new QuorumAuthorityValidationError(`${nodeLabel(node)} is ahead of quorum history and needs manual recovery`);
  }
  for (let index = 0; index < candidate.entries.length; index += 1) {
    if (!sameRecord(candidate.entries[index], canonical[index])) {
      throw new QuorumAuthorityValidationError(`${nodeLabel(node)} diverges from quorum history at checkpoint ${index + 1}`);
    }
  }
}

function appendMissingEntries(node, current, canonical) {
  let next = current;
  for (let index = next.entries.length; index < canonical.length; index += 1) {
    const entry = canonical[index];
    appendAuthorityCheckpoint(node.journalPath, restoreAuthorityState(entry.snapshot), { checkpointId: entry.checkpointId });
    next = readNodeJournal(node);
  }
  return next;
}

function nodeSnapshot(node, canonicalLength) {
  return {
    nodeId: node.nodeId,
    available: node.available,
    journalPath: node.journalPath,
    entries: node.journal?.entries.length ?? null,
    latestCheckpointId: node.journal?.entries.at(-1)?.checkpointId ?? null,
    latestHash: node.journal?.entries.at(-1)?.hash ?? null,
    needsRepair: !node.available || (node.journal?.entries.length ?? 0) < canonicalLength,
  };
}

function response(status, body) {
  return { status, body: clone(body) };
}

function quorumErrorResponse(error, state, nodes, quorum) {
  return response(503, {
    error: "authority_quorum_unavailable",
    message: error.message,
    availableNodes: nodes.filter((node) => node.available).length,
    quorum,
    authoritativeRevision: state.worldRevision,
    retryable: true,
  });
}

function validateNodeSpecs(nodes) {
  if (!Array.isArray(nodes) || nodes.length < 3) {
    throw new QuorumAuthorityValidationError("nodes must contain at least three authority nodes");
  }
  const seen = new Set();
  return nodes.map((spec, index) => {
    if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
      throw new QuorumAuthorityValidationError(`nodes[${index}] must be an object`);
    }
    assertNonEmpty(spec.nodeId, `nodes[${index}].nodeId`);
    assertNonEmpty(spec.journalPath, `nodes[${index}].journalPath`);
    if (seen.has(spec.nodeId)) throw new QuorumAuthorityValidationError(`duplicate authority node ${spec.nodeId}`);
    seen.add(spec.nodeId);
    return {
      nodeId: spec.nodeId,
      journalPath: spec.journalPath,
      available: spec.available !== false,
      journal: null,
    };
  });
}

function consensusGroup(nodes, quorum) {
  const groups = new Map();
  for (const node of nodes.filter((candidate) => candidate.available)) {
    const latest = node.journal.entries.at(-1);
    const key = latest ? `${node.journal.entries.length}:${latest.hash}` : "EMPTY";
    const group = groups.get(key) ?? [];
    group.push(node);
    groups.set(key, group);
  }
  return [...groups.values()].sort((left, right) => right.length - left.length)[0] ?? [];
}

function chooseCanonical(nodes, quorum) {
  const group = consensusGroup(nodes, quorum);
  if (group.length < quorum) {
    throw new QuorumAuthorityValidationError(`no journal history has the required ${quorum}-node quorum`);
  }
  return group[0].journal.entries;
}

function loadConsensus(nodes, quorum, initialState) {
  const availableNodes = nodes.filter((node) => node.available);
  if (availableNodes.length < quorum) throw new QuorumUnavailableError(availableNodes.length, quorum);
  for (const node of availableNodes) node.journal = readNodeJournal(node);

  let canonical = chooseCanonical(nodes, quorum);
  if (canonical.length === 0) {
    const base = restoreAuthorityState(snapshotAuthorityState(initialState ?? createAuthorityState()));
    for (const node of availableNodes) {
      appendAuthorityCheckpoint(node.journalPath, base, { checkpointId: "checkpoint:authority:initial" });
      node.journal = readNodeJournal(node);
    }
    canonical = chooseCanonical(nodes, quorum);
  }

  for (const node of availableNodes) {
    assertPrefix(node.journal, canonical, node);
    if (node.journal.entries.length < canonical.length) {
      node.journal = appendMissingEntries(node, node.journal, canonical);
    }
  }
  const state = restoreLatestAuthorityCheckpoint(availableNodes[0].journalPath).state;
  return { state, canonical: readNodeJournal(availableNodes[0]).entries };
}

export function createQuorumAuthorityService({
  nodes,
  quorum,
  initialState,
  resolveIntent,
} = {}) {
  const authorityNodes = validateNodeSpecs(nodes);
  assertInteger(quorum, "quorum", 1);
  if (quorum > authorityNodes.length) throw new QuorumAuthorityValidationError("quorum cannot exceed node count");
  if (quorum <= Math.floor(authorityNodes.length / 2)) {
    throw new QuorumAuthorityValidationError("quorum must be a strict majority for authority safety");
  }

  let loaded;
  try {
    loaded = loadConsensus(authorityNodes, quorum, initialState);
  } catch (error) {
    if (error instanceof QuorumAuthorityValidationError) throw error;
    throw new QuorumAuthorityValidationError(`quorum startup failed: ${error.message}`);
  }

  let state = loaded.state;
  let canonicalEntries = loaded.canonical;

  function availableCount() {
    return authorityNodes.filter((node) => node.available).length;
  }

  function requireQuorum() {
    const count = availableCount();
    if (count < quorum) throw new QuorumUnavailableError(count, quorum);
  }

  function refreshAvailableNodes() {
    for (const node of authorityNodes.filter((candidate) => candidate.available)) {
      node.journal = readNodeJournal(node);
      assertPrefix(node.journal, canonicalEntries, node);
      if (node.journal.entries.length < canonicalEntries.length) {
        node.journal = appendMissingEntries(node, node.journal, canonicalEntries);
      }
    }
  }

  function health() {
    return {
      schemaVersion: AUTHORITY_QUORUM_SCHEMA_VERSION,
      quorum,
      nodeCount: authorityNodes.length,
      availableNodes: availableCount(),
      quorumAvailable: availableCount() >= quorum,
      authoritativeRevision: state.worldRevision,
      nodes: authorityNodes.map((node) => nodeSnapshot(node, canonicalEntries.length)),
    };
  }

  function setNodeAvailability(nodeId, available) {
    assertNonEmpty(nodeId, "nodeId");
    if (typeof available !== "boolean") throw new QuorumAuthorityValidationError("available must be boolean");
    const node = authorityNodes.find((candidate) => candidate.nodeId === nodeId);
    if (!node) throw new QuorumAuthorityValidationError(`unknown authority node ${nodeId}`);
    node.available = available;
    if (available) {
      node.journal = readNodeJournal(node);
      assertPrefix(node.journal, canonicalEntries, node);
    }
    return clone(health());
  }

  function repairNode(nodeId) {
    assertNonEmpty(nodeId, "nodeId");
    const node = authorityNodes.find((candidate) => candidate.nodeId === nodeId);
    if (!node) throw new QuorumAuthorityValidationError(`unknown authority node ${nodeId}`);
    if (!node.available) throw new QuorumUnavailableError(availableCount(), quorum);
    node.journal = readNodeJournal(node);
    assertPrefix(node.journal, canonicalEntries, node);
    node.journal = appendMissingEntries(node, node.journal, canonicalEntries);
    return clone(health());
  }

  function commit(candidateState) {
    requireQuorum();
    refreshAvailableNodes();
    const checkpointId = `checkpoint:authority:${candidateState.worldRevision}`;
    for (const node of authorityNodes.filter((candidate) => candidate.available)) {
      appendAuthorityCheckpoint(node.journalPath, candidateState, { checkpointId });
      node.journal = readNodeJournal(node);
    }
    canonicalEntries = readNodeJournal(authorityNodes.find((node) => node.available)).entries;
  }

  return {
    get state() { return clone(state); },
    get quorum() { return quorum; },
    get health() { return clone(health()); },
    get journal() {
      return Object.fromEntries(authorityNodes.map((node) => [node.nodeId, clone(node.journal?.entries ?? [])]));
    },
    setNodeAvailability,
    repairNode,
    request(request = {}) {
      if (request.method === "GET" && request.path === "/health") {
        return response(200, { service: "wolves-without-kings-authority", mode: "quorum", ...health() });
      }
      const candidate = createAuthorityService(state, { resolveIntent });
      const result = candidate.request(request);
      const candidateState = candidate.state;
      if (result.status < 400 && candidateState.worldRevision !== state.worldRevision) {
        try {
          commit(candidateState);
        } catch (error) {
          if (error instanceof QuorumAuthorityValidationError) return quorumErrorResponse(error, state, authorityNodes, quorum);
          throw error;
        }
        state = candidateState;
        result.body.authoritativeRevision = state.worldRevision;
      }
      return result;
    },
  };
}
