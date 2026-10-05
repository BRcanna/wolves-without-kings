import test from "node:test";
import assert from "node:assert/strict";

import {
  UnlockWebStaleRevisionError,
  UnlockWebValidationError,
  claimUnlockNode,
  createUnlockWebState,
  evaluateUnlockNode,
  projectUnlockWeb,
  recordUnlockEvidence,
  registerUnlockNode,
  restoreUnlockWeb,
  settleUnlockTime,
  snapshotUnlockWeb,
} from "../src/wolves-without-kings/unlock-web.mjs";

function nodeState() {
  let state = createUnlockWebState({ characterId: "character:runner" });
  return registerUnlockNode(state, {
    expectedRevision: state.revision,
    nodeId: "unlock:trusted-export",
    label: "Trusted export contact",
    requirements: {
      practice: [{ contextId: "route:coastal", amount: 6 }],
      knowledge: ["knowledge:port-customs-fictional"],
      familiarity: [{ contextId: "route:coastal", level: 60 }],
      timeFloorDays: 180,
      relationships: [{ relationshipId: "npc:mentor", axis: "trust", minimum: 60 }],
      context: [{ key: "front:transport", value: "active" }],
    },
    unlockEffects: ["contact-surface"],
  });
}

function satisfy(state, source = "mentor") {
  const evidence = [
    ["practice", "route:coastal", 6],
    ["knowledge", "knowledge:port-customs-fictional", 1],
    ["familiarity", "route:coastal", 60],
  ];
  for (const [domain, key, amount] of evidence) state = recordUnlockEvidence(state, { expectedRevision: state.revision, domain, key, amount, source });
  state = recordUnlockEvidence(state, { expectedRevision: state.revision, domain: "relationship", key: "npc:mentor", axis: "trust", value: 70, source });
  state = recordUnlockEvidence(state, { expectedRevision: state.revision, domain: "context", key: "front:transport", value: "active", source });
  return settleUnlockTime(state, { expectedRevision: state.revision, days: 180 });
}

test("a multi-dimensional node stays locked until every evidence dimension exists, with explainable unmet reasons", () => {
  let state = nodeState();
  let evaluated = evaluateUnlockNode(state, { expectedRevision: state.revision, nodeId: "unlock:trusted-export" });
  state = evaluated.state;
  assert.equal(evaluated.result.status, "locked");
  assert.ok(evaluated.result.unmet.includes("time-floor"));
  assert.ok(evaluated.result.unmet.includes("knowledge:knowledge:port-customs-fictional"));
  const projected = projectUnlockWeb(state);
  assert.equal(projected.nodes[0].unmetCount > 0, true);
  assert.equal(projected.omittedFields.includes("exact evidence"), true);
});

test("two distinct evidence histories make the same node eligible without an XP currency", () => {
  let mentorHistory = satisfy(nodeState(), "mentor");
  let observationHistory = satisfy(nodeState(), "direct-observation");
  let mentorEval = evaluateUnlockNode(mentorHistory, { expectedRevision: mentorHistory.revision, nodeId: "unlock:trusted-export" });
  mentorHistory = mentorEval.state;
  let observationEval = evaluateUnlockNode(observationHistory, { expectedRevision: observationHistory.revision, nodeId: "unlock:trusted-export" });
  observationHistory = observationEval.state;
  assert.equal(mentorEval.result.status, "eligible");
  assert.equal(observationEval.result.status, "eligible");
  mentorHistory = claimUnlockNode(mentorHistory, { expectedRevision: mentorHistory.revision, nodeId: "unlock:trusted-export" });
  assert.equal(mentorHistory.owned["unlock:trusted-export"].status, "owned");
  assert.equal(Object.hasOwn(mentorHistory, "xp"), false);
  assert.equal(observationHistory.owned["unlock:trusted-export"], undefined);
});

test("stale, invalid, and ineligible claims fail before mutation", () => {
  let state = nodeState();
  assert.throws(
    () => claimUnlockNode(state, { expectedRevision: state.revision, nodeId: "unlock:trusted-export" }),
    /not eligible/,
  );
  assert.throws(
    () => settleUnlockTime(state, { expectedRevision: state.revision - 1, days: 1 }),
    UnlockWebStaleRevisionError,
  );
  assert.throws(
    () => recordUnlockEvidence(state, { expectedRevision: state.revision, domain: "xp", key: "generic", amount: 1 }),
    UnlockWebValidationError,
  );
  assert.equal(state.owned["unlock:trusted-export"], undefined);
});

test("unlock-web snapshots preserve evidence and reject tampering", () => {
  const state = satisfy(nodeState());
  assert.deepEqual(restoreUnlockWeb(snapshotUnlockWeb(state)), state);
  assert.throws(
    () => restoreUnlockWeb({ snapshotVersion: 1, state: { ...state, lastEventHash: "tampered" } }),
    UnlockWebValidationError,
  );
});
