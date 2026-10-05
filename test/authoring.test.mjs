import test from "node:test";
import assert from "node:assert/strict";

import {
  AuthoringStaleRevisionError,
  AuthoringValidationError,
  admitAuthoringCandidate,
  createAuthoringState,
  projectAuthoring,
  proposeAuthoringCandidate,
  recordAuthoringEvidence,
  restoreAuthoring,
  revertAuthoringAdmission,
  snapshotAuthoring,
} from "../src/wolves-without-kings/authoring.mjs";

function candidateInput() {
  return {
    candidateId: "candidate:industrial-block",
    regionId: "region:capital",
    publicLabel: "Reserved Industrial Block",
    requiredEvidence: ["evidence:logistics-history"],
    topology: {
      entryNodeId: "node:street",
      exitNodeId: "node:yard",
      nodes: [{ id: "node:street", kind: "street" }, { id: "node:yard", kind: "yard" }, { id: "node:warehouse", kind: "warehouse" }],
      edges: [{ id: "edge:street-warehouse", from: "node:street", to: "node:warehouse" }, { id: "edge:warehouse-yard", from: "node:warehouse", to: "node:yard" }],
    },
    layers: {
      structure: ["street", "warehouse", "yard"],
      function: ["storage"],
      history: ["industrial-past"],
      economy: ["logistics"],
      social: ["worker-neighborhood"],
      crime: ["access-sensitive"],
    },
    authoringNotes: "fictionalized reserved area",
  };
}

function proposedState() {
  let state = createAuthoringState();
  state = recordAuthoringEvidence(state, { expectedRevision: state.revision, evidenceId: "evidence:logistics-history" });
  return proposeAuthoringCandidate(state, { expectedRevision: state.revision, ...candidateInput() });
}

test("identical seed and history produce the same stable proposal digest", () => {
  const first = proposedState();
  const second = proposedState();
  assert.equal(first.candidates["candidate:industrial-block"].proposalDigest, second.candidates["candidate:industrial-block"].proposalDigest);
});

test("authoring admits only evidence-backed, connected layer-ordered candidates", () => {
  const state = admitAuthoringCandidate(proposedState(), { expectedRevision: 2, candidateId: "candidate:industrial-block" });
  const candidate = state.candidates["candidate:industrial-block"];
  assert.equal(candidate.status, "admitted");
  assert.equal(state.admissionReceipts[candidate.receiptId].reversible, true);
  assert.equal(projectAuthoring(state).candidates[0].routeConnected, true);
});

test("admission is reversible through its receipt without deleting the authored identity", () => {
  let state = admitAuthoringCandidate(proposedState(), { expectedRevision: 2, candidateId: "candidate:industrial-block" });
  const candidate = state.candidates["candidate:industrial-block"];
  state = revertAuthoringAdmission(state, { expectedRevision: state.revision, candidateId: candidate.id, receiptId: candidate.receiptId });
  assert.equal(state.candidates[candidate.id].status, "reverted");
  assert.equal(state.candidates[candidate.id].id, candidate.id);
  assert.equal(state.admissionReceipts[candidate.receiptId].reversible, false);
});

test("authoring rejects missing evidence, disconnected topology, and stale writes before mutation", () => {
  let state = createAuthoringState();
  const staleState = proposedState();
  assert.throws(() => proposeAuthoringCandidate(staleState, { expectedRevision: staleState.revision - 1, ...candidateInput(), candidateId: "candidate:stale" }), AuthoringStaleRevisionError);
  const noEvidence = proposeAuthoringCandidate(state, { expectedRevision: state.revision, ...candidateInput() });
  assert.throws(() => admitAuthoringCandidate(noEvidence, { expectedRevision: noEvidence.revision, candidateId: "candidate:industrial-block" }), /missing authoring evidence/);
  const broken = proposeAuthoringCandidate(createAuthoringState(), {
    expectedRevision: 0,
    ...candidateInput(),
    candidateId: "candidate:broken",
    requiredEvidence: [],
    topology: { ...candidateInput().topology, edges: [] },
  });
  assert.throws(() => admitAuthoringCandidate(broken, { expectedRevision: broken.revision, candidateId: "candidate:broken" }), /no entry-to-exit route/);
  assert.equal(Object.hasOwn(state.candidates, "candidate:industrial-block"), false);
});

test("authoring snapshots preserve receipts and public projection redacts authoring internals", () => {
  const state = admitAuthoringCandidate(proposedState(), { expectedRevision: 2, candidateId: "candidate:industrial-block" });
  assert.deepEqual(restoreAuthoring(snapshotAuthoring(state)), state);
  const publicView = projectAuthoring(state);
  assert.equal(Object.hasOwn(publicView.candidates[0], "proposalDigest"), false);
  assert.throws(() => restoreAuthoring({ snapshotVersion: 1, state: { ...state, lastEventHash: "tampered" } }), AuthoringValidationError);
});
