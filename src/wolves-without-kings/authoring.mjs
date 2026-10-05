import { createHash } from "node:crypto";

import { canonicalJson } from "./engine.mjs";

export const AUTHORING_SCHEMA_VERSION = 1;

export class AuthoringValidationError extends Error {
  constructor(message) { super(message); this.name = "AuthoringValidationError"; }
}

export class AuthoringStaleRevisionError extends AuthoringValidationError {
  constructor(expectedRevision, actualRevision) {
    super(`stale authoring command: expected revision ${expectedRevision}, actual revision ${actualRevision}`);
    this.name = "AuthoringStaleRevisionError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

function clone(value) { return structuredClone(value); }
function assertNonEmpty(value, field) { if (typeof value !== "string" || value.trim() === "") throw new AuthoringValidationError(`${field} must be a non-empty string`); }
function assertInteger(value, field, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) { if (!Number.isInteger(value) || value < minimum || value > maximum) throw new AuthoringValidationError(`${field} must be an integer between ${minimum} and ${maximum}`); }
function assertArray(value, field) { if (!Array.isArray(value)) throw new AuthoringValidationError(`${field} must be an array`); }
function assertObject(value, field) { if (!value || typeof value !== "object" || Array.isArray(value)) throw new AuthoringValidationError(`${field} must be an object`); }
function hashValue(value) { return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex"); }
function eventHash(event, previousHash) { return createHash("sha256").update(`${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`, "utf8").digest("hex"); }

function assertRevision(state, expectedRevision) {
  assertInteger(expectedRevision, "expectedRevision");
  if (expectedRevision !== state.revision) throw new AuthoringStaleRevisionError(expectedRevision, state.revision);
}

function appendEvent(state, { eventType, actorId = "system:authoring", subjectIds = [], payload = {} }) {
  const next = clone(state);
  const unsignedEvent = { eventId: `authoring-${String(next.nextEventId).padStart(6, "0")}`, eventType, revision: next.revision + 1, simulationDate: next.simulationDate, actorId, subjectIds: [...subjectIds], payload: clone(payload), previousHash: next.lastEventHash };
  const event = { ...unsignedEvent, hash: eventHash(unsignedEvent, unsignedEvent.previousHash) };
  next.events.push(event);
  next.nextEventId += 1;
  next.revision = event.revision;
  next.lastEventHash = event.hash;
  return next;
}

function requireCandidate(state, candidateId) {
  assertNonEmpty(candidateId, "candidateId");
  const candidate = state.candidates[candidateId];
  if (!candidate) throw new AuthoringValidationError(`unknown authoring candidate: ${candidateId}`);
  return candidate;
}

const LAYERS = ["structure", "function", "history", "economy", "social", "crime"];

function validateTopology(candidate) {
  const nodeIds = new Set(candidate.topology.nodes.map((node) => node.id));
  for (const edge of candidate.topology.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) throw new AuthoringValidationError(`topology edge references unknown node: ${edge.id}`);
  }
  const reachable = new Set([candidate.topology.entryNodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of candidate.topology.edges) if (reachable.has(edge.from) && !reachable.has(edge.to)) { reachable.add(edge.to); changed = true; }
  }
  if (!reachable.has(candidate.topology.exitNodeId)) throw new AuthoringValidationError("authoring topology has no entry-to-exit route");
}

export function createAuthoringState({ authoringId = "authoring:wwk", simulationDate = "1998-01-01", worldSeed = "wwk-authoring" } = {}) {
  assertNonEmpty(authoringId, "authoringId");
  assertNonEmpty(simulationDate, "simulationDate");
  assertNonEmpty(worldSeed, "worldSeed");
  return { schemaVersion: AUTHORING_SCHEMA_VERSION, authoringId, simulationDate, worldSeed, revision: 0, nextEventId: 1, lastEventHash: null, evidence: {}, candidates: {}, admissionReceipts: {}, events: [] };
}

export function recordAuthoringEvidence(state, { expectedRevision, evidenceId, source = "player-history" }) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(evidenceId, "evidenceId");
  assertNonEmpty(source, "source");
  if (state.evidence[evidenceId]) throw new AuthoringValidationError(`authoring evidence already exists: ${evidenceId}`);
  const next = clone(state);
  next.evidence[evidenceId] = { id: evidenceId, source, recordedDate: state.simulationDate };
  return appendEvent(next, { eventType: "authoring.evidence_recorded", subjectIds: [evidenceId], payload: { evidenceId, source } });
}

export function proposeAuthoringCandidate(
  state,
  { expectedRevision, candidateId, regionId, publicLabel, requiredEvidence = [], topology, layers, authoringNotes = "" },
) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(candidateId, "candidateId");
  assertNonEmpty(regionId, "regionId");
  assertNonEmpty(publicLabel, "publicLabel");
  assertArray(requiredEvidence, "requiredEvidence");
  if (requiredEvidence.some((id) => typeof id !== "string" || id.trim() === "")) throw new AuthoringValidationError("requiredEvidence must contain only non-empty strings");
  assertObject(topology, "topology");
  assertArray(topology.nodes, "topology.nodes");
  assertArray(topology.edges, "topology.edges");
  assertNonEmpty(topology.entryNodeId, "topology.entryNodeId");
  assertNonEmpty(topology.exitNodeId, "topology.exitNodeId");
  const nodeIds = new Set();
  for (const node of topology.nodes) { assertObject(node, "topology node"); assertNonEmpty(node.id, "topology node.id"); if (nodeIds.has(node.id)) throw new AuthoringValidationError(`duplicate topology node: ${node.id}`); nodeIds.add(node.id); }
  assertObject(layers, "layers");
  for (const layer of LAYERS) { assertArray(layers[layer], `layers.${layer}`); if (layers[layer].length === 0) throw new AuthoringValidationError(`layers.${layer} must not be empty`); }
  if (state.candidates[candidateId]) throw new AuthoringValidationError(`authoring candidate already exists: ${candidateId}`);
  const candidate = { id: candidateId, regionId, publicLabel, status: "proposed", requiredEvidence: [...requiredEvidence], topology: clone(topology), layers: clone(layers), authoringNotes, proposalDigest: hashValue({ worldSeed: state.worldSeed, candidateId, regionId, topology, layers, requiredEvidence }), admissionDigest: null, receiptId: null, history: [{ type: "proposed", revision: state.revision + 1 }] };
  const next = clone(state);
  next.candidates[candidateId] = candidate;
  return appendEvent(next, { eventType: "authoring.candidate_proposed", subjectIds: [candidateId, regionId], payload: { candidateId, proposalDigest: candidate.proposalDigest } });
}

export function admitAuthoringCandidate(state, { expectedRevision, candidateId, actorId = "system:admission" }) {
  assertRevision(state, expectedRevision);
  const candidate = requireCandidate(state, candidateId);
  if (candidate.status !== "proposed") throw new AuthoringValidationError(`candidate is already ${candidate.status}`);
  for (const evidenceId of candidate.requiredEvidence) if (!state.evidence[evidenceId]) throw new AuthoringValidationError(`missing authoring evidence: ${evidenceId}`);
  validateTopology(candidate);
  const next = clone(state);
  const admissionDigest = hashValue({ proposalDigest: candidate.proposalDigest, evidence: candidate.requiredEvidence.map((id) => state.evidence[id]), topology: candidate.topology, layers: candidate.layers });
  const receiptId = `receipt:${candidateId}`;
  next.candidates[candidateId].status = "admitted";
  next.candidates[candidateId].admissionDigest = admissionDigest;
  next.candidates[candidateId].receiptId = receiptId;
  next.candidates[candidateId].history.push({ type: "admitted", revision: state.revision + 1, admissionDigest });
  next.admissionReceipts[receiptId] = { id: receiptId, candidateId, admissionDigest, admittedRevision: state.revision + 1, reversible: true };
  return appendEvent(next, { eventType: "authoring.candidate_admitted", actorId, subjectIds: [candidateId, receiptId], payload: { admissionDigest, receiptId, layerOrder: LAYERS } });
}

export function revertAuthoringAdmission(state, { expectedRevision, candidateId, receiptId, actorId = "system:authoring" }) {
  assertRevision(state, expectedRevision);
  const candidate = requireCandidate(state, candidateId);
  const receipt = state.admissionReceipts[receiptId];
  if (candidate.status !== "admitted" || !receipt || receipt.candidateId !== candidateId || receipt.admissionDigest !== candidate.admissionDigest) throw new AuthoringValidationError("admission receipt does not match candidate");
  const next = clone(state);
  next.candidates[candidateId].status = "reverted";
  next.candidates[candidateId].history.push({ type: "reverted", revision: state.revision + 1, receiptId });
  next.admissionReceipts[receiptId].reversible = false;
  return appendEvent(next, { eventType: "authoring.admission_reverted", actorId, subjectIds: [candidateId, receiptId], payload: { receiptId, admissionDigest: candidate.admissionDigest } });
}

export function projectAuthoring(state, { scope = "public" } = {}) {
  if (!["public", "debug"].includes(scope)) throw new AuthoringValidationError(`unsupported authoring projection scope: ${scope}`);
  return {
    schemaVersion: AUTHORING_SCHEMA_VERSION,
    authoringId: state.authoringId,
    candidates: Object.values(state.candidates).map((candidate) => ({ id: candidate.id, regionId: candidate.regionId, publicLabel: candidate.publicLabel, status: candidate.status, layerCount: LAYERS.reduce((count, layer) => count + candidate.layers[layer].length, 0), routeConnected: candidate.status === "admitted" || candidate.status === "reverted", ...(scope === "debug" ? { proposalDigest: candidate.proposalDigest, admissionDigest: candidate.admissionDigest, topology: clone(candidate.topology), history: clone(candidate.history) } : {}) })),
    evidenceCount: Object.keys(state.evidence).length,
    omittedFields: scope === "public" ? ["worldSeed", "authoring notes", "exact topology", "evidence sources", "digests", "event hashes"] : [],
  };
}

export function snapshotAuthoring(state) { return { snapshotVersion: 1, state: clone(state) }; }

export function restoreAuthoring(snapshotValue) {
  if (!snapshotValue || snapshotValue.snapshotVersion !== 1) throw new AuthoringValidationError("unsupported authoring snapshot version");
  const state = clone(snapshotValue.state);
  if (!state || state.schemaVersion !== AUTHORING_SCHEMA_VERSION) throw new AuthoringValidationError("unsupported authoring schema version");
  let revision = 0;
  let previousHash = null;
  for (const event of state.events) {
    if (event.revision !== revision + 1) throw new AuthoringValidationError("authoring revisions are not contiguous");
    if (event.previousHash !== previousHash) throw new AuthoringValidationError("authoring event chain is broken");
    const { hash, ...unsignedEvent } = event;
    if (hash !== eventHash(unsignedEvent, event.previousHash)) throw new AuthoringValidationError("authoring event hash is invalid");
    revision = event.revision;
    previousHash = event.hash;
  }
  if (state.revision !== revision || state.lastEventHash !== previousHash) throw new AuthoringValidationError("authoring snapshot does not match history");
  return state;
}
