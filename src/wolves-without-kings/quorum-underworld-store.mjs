import { existsSync, readFileSync, truncateSync } from "node:fs";

import {
  appendUnderworldCheckpoint,
  readUnderworldJournal,
  restoreLatestUnderworldCheckpoint,
  UnderworldJournalValidationError,
} from "./underworld-journal.mjs";
import { createUnderworldState, restoreUnderworld, snapshotUnderworld } from "./underworld.mjs";

export const UNDERWORLD_QUORUM_SCHEMA_VERSION = 1;

export class QuorumUnderworldValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "QuorumUnderworldValidationError";
  }
}

export class UnderworldQuorumUnavailableError extends QuorumUnderworldValidationError {
  constructor(availableNodes, quorum) {
    super(`Underworld quorum unavailable: ${availableNodes} available node(s), ${quorum} required`);
    this.name = "UnderworldQuorumUnavailableError";
    this.availableNodes = availableNodes;
    this.quorum = quorum;
  }
}

function clone(value) {
  return structuredClone(value);
}

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new QuorumUnderworldValidationError(`${field} must be a non-empty string`);
  }
}

function assertInteger(value, field, minimum = 1) {
  if (!Number.isInteger(value) || value < minimum) {
    throw new QuorumUnderworldValidationError(`${field} must be an integer >= ${minimum}`);
  }
}

function normalizeCrashTail(node, journal) {
  if (!journal.recoveredTail || !existsSync(node.journalPath)) return journal;
  const raw = readFileSync(node.journalPath, "utf8");
  const newline = raw.lastIndexOf("\n");
  truncateSync(node.journalPath, newline < 0 ? 0 : newline + 1);
  return readUnderworldJournal(node.journalPath);
}

function readNodeJournal(node) {
  try {
    return normalizeCrashTail(node, readUnderworldJournal(node.journalPath));
  } catch (error) {
    if (error instanceof UnderworldJournalValidationError) {
      throw new QuorumUnderworldValidationError(`node ${node.nodeId} journal is invalid: ${error.message}`);
    }
    throw new QuorumUnderworldValidationError(`node ${node.nodeId} journal read failed: ${error.message}`);
  }
}

function sameRecord(left, right) {
  return left.hash === right.hash && left.checkpointId === right.checkpointId;
}

function assertPrefix(candidate, canonical, node) {
  if (candidate.entries.length > canonical.length) {
    throw new QuorumUnderworldValidationError(`node ${node.nodeId} is ahead of quorum history and needs manual recovery`);
  }
  for (let index = 0; index < candidate.entries.length; index += 1) {
    if (!sameRecord(candidate.entries[index], canonical[index])) {
      throw new QuorumUnderworldValidationError(`node ${node.nodeId} diverges from quorum history at checkpoint ${index + 1}`);
    }
  }
}

function appendMissingEntries(node, current, canonical) {
  let next = current;
  for (let index = next.entries.length; index < canonical.length; index += 1) {
    const entry = canonical[index];
    appendUnderworldCheckpoint(node.journalPath, restoreUnderworld(entry.snapshot), { checkpointId: entry.checkpointId });
    next = readNodeJournal(node);
  }
  return next;
}

function validateNodeSpecs(nodes) {
  if (!Array.isArray(nodes) || nodes.length < 3) {
    throw new QuorumUnderworldValidationError("nodes must contain at least three Underworld nodes");
  }
  const seen = new Set();
  return nodes.map((spec, index) => {
    if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
      throw new QuorumUnderworldValidationError(`nodes[${index}] must be an object`);
    }
    assertNonEmpty(spec.nodeId, `nodes[${index}].nodeId`);
    assertNonEmpty(spec.journalPath, `nodes[${index}].journalPath`);
    if (seen.has(spec.nodeId)) throw new QuorumUnderworldValidationError(`duplicate Underworld node ${spec.nodeId}`);
    seen.add(spec.nodeId);
    return {
      nodeId: spec.nodeId,
      journalPath: spec.journalPath,
      available: spec.available !== false,
      journal: null,
    };
  });
}

function consensusGroup(nodes) {
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
  const group = consensusGroup(nodes);
  if (group.length < quorum) {
    throw new QuorumUnderworldValidationError(`no Underworld journal history has the required ${quorum}-node quorum`);
  }
  return { group, entries: group[0].journal.entries };
}

function loadConsensus(nodes, quorum, initialState) {
  const availableNodes = nodes.filter((node) => node.available);
  if (availableNodes.length < quorum) throw new UnderworldQuorumUnavailableError(availableNodes.length, quorum);
  for (const node of availableNodes) node.journal = readNodeJournal(node);

  let selected = chooseCanonical(nodes, quorum);
  if (selected.entries.length === 0) {
    const outlier = availableNodes.find((node) => node.journal.entries.length > 0);
    if (outlier) {
      throw new QuorumUnderworldValidationError(`node ${outlier.nodeId} is ahead of empty quorum history and needs manual recovery`);
    }
    const base = restoreUnderworld(snapshotUnderworld(initialState ?? createUnderworldState()));
    for (const node of availableNodes) {
      appendUnderworldCheckpoint(node.journalPath, base, { checkpointId: "checkpoint:underworld:initial" });
      node.journal = readNodeJournal(node);
    }
    selected = chooseCanonical(nodes, quorum);
  }

  for (const node of availableNodes) {
    assertPrefix(node.journal, selected.entries, node);
    if (node.journal.entries.length < selected.entries.length) {
      node.journal = appendMissingEntries(node, node.journal, selected.entries);
    }
  }
  const state = restoreLatestUnderworldCheckpoint(selected.group[0].journalPath).state;
  return { state, canonical: readNodeJournal(selected.group[0]).entries };
}

export function createQuorumUnderworldStore({ nodes, quorum, initialState } = {}) {
  const underworldNodes = validateNodeSpecs(nodes);
  assertInteger(quorum, "quorum");
  if (quorum > underworldNodes.length) throw new QuorumUnderworldValidationError("quorum cannot exceed node count");
  if (quorum <= Math.floor(underworldNodes.length / 2)) {
    throw new QuorumUnderworldValidationError("quorum must be a strict majority for Underworld safety");
  }

  let loaded;
  try {
    loaded = loadConsensus(underworldNodes, quorum, initialState);
  } catch (error) {
    if (error instanceof QuorumUnderworldValidationError) throw error;
    throw new QuorumUnderworldValidationError(`Underworld quorum startup failed: ${error.message}`);
  }

  let state = loaded.state;
  let canonicalEntries = loaded.canonical;

  function availableCount() {
    return underworldNodes.filter((node) => node.available).length;
  }

  function requireQuorum() {
    const count = availableCount();
    if (count < quorum) throw new UnderworldQuorumUnavailableError(count, quorum);
  }

  function refreshAvailableNodes() {
    for (const node of underworldNodes.filter((candidate) => candidate.available)) {
      node.journal = readNodeJournal(node);
      assertPrefix(node.journal, canonicalEntries, node);
      if (node.journal.entries.length < canonicalEntries.length) {
        node.journal = appendMissingEntries(node, node.journal, canonicalEntries);
      }
    }
  }

  function health() {
    return {
      schemaVersion: UNDERWORLD_QUORUM_SCHEMA_VERSION,
      quorum,
      nodeCount: underworldNodes.length,
      availableNodes: availableCount(),
      quorumAvailable: availableCount() >= quorum,
      authoritativeRevision: state.revision,
      authoritativeWeek: state.serverWeek,
      nodes: underworldNodes.map((node) => ({
        nodeId: node.nodeId,
        available: node.available,
        journalPath: node.journalPath,
        entries: node.journal?.entries.length ?? null,
        latestCheckpointId: node.journal?.entries.at(-1)?.checkpointId ?? null,
        latestHash: node.journal?.entries.at(-1)?.hash ?? null,
        needsRepair: !node.available || (node.journal?.entries.length ?? 0) < canonicalEntries.length,
      })),
    };
  }

  function setNodeAvailability(nodeId, available) {
    assertNonEmpty(nodeId, "nodeId");
    if (typeof available !== "boolean") throw new QuorumUnderworldValidationError("available must be boolean");
    const node = underworldNodes.find((candidate) => candidate.nodeId === nodeId);
    if (!node) throw new QuorumUnderworldValidationError(`unknown Underworld node ${nodeId}`);
    if (available) {
      const journal = readNodeJournal(node);
      assertPrefix(journal, canonicalEntries, node);
      node.journal = journal;
    }
    node.available = available;
    return clone(health());
  }

  function repairNode(nodeId) {
    assertNonEmpty(nodeId, "nodeId");
    const node = underworldNodes.find((candidate) => candidate.nodeId === nodeId);
    if (!node) throw new QuorumUnderworldValidationError(`unknown Underworld node ${nodeId}`);
    if (!node.available) throw new UnderworldQuorumUnavailableError(availableCount(), quorum);
    node.journal = readNodeJournal(node);
    assertPrefix(node.journal, canonicalEntries, node);
    node.journal = appendMissingEntries(node, node.journal, canonicalEntries);
    return clone(health());
  }

  function checkpoint(nextState, { checkpointId = `checkpoint:underworld:${nextState?.revision}` } = {}) {
    let validated;
    try {
      validated = restoreUnderworld(snapshotUnderworld(nextState));
    } catch (error) {
      throw new QuorumUnderworldValidationError(`cannot checkpoint invalid Underworld state: ${error.message}`);
    }
    if (validated.shardId !== state.shardId) {
      throw new QuorumUnderworldValidationError("checkpoint shardId does not match quorum state");
    }
    if (validated.revision !== state.revision + 1) {
      throw new QuorumUnderworldValidationError(`checkpoint revision must advance from ${state.revision} to ${state.revision + 1}`);
    }
    requireQuorum();
    refreshAvailableNodes();
    for (const node of underworldNodes.filter((candidate) => candidate.available)) {
      appendUnderworldCheckpoint(node.journalPath, validated, { checkpointId });
      node.journal = readNodeJournal(node);
    }
    canonicalEntries = readNodeJournal(underworldNodes.find((node) => node.available)).entries;
    state = validated;
    return { state: clone(state), health: clone(health()) };
  }

  return {
    get state() { return clone(state); },
    get quorum() { return quorum; },
    get health() { return clone(health()); },
    get journal() { return Object.fromEntries(underworldNodes.map((node) => [node.nodeId, clone(node.journal?.entries ?? [])])); },
    setNodeAvailability,
    repairNode,
    checkpoint,
  };
}
