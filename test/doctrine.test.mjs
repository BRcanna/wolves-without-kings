import test from "node:test";
import assert from "node:assert/strict";

import {
  DoctrineStaleRevisionError,
  DoctrineValidationError,
  createDoctrineState,
  projectDoctrine,
  resolveMemberDecision,
  resolveSuccession,
  restoreDoctrine,
  settleDoctrineTime,
  snapshotDoctrine,
  updateDoctrine,
} from "../src/wolves-without-kings/doctrine.mjs";

function baseMembers() {
  return [
    {
      memberId: "member:leader",
      role: "leader",
      coalitionId: "coalition:old",
      seniorityDays: 5000,
      relationshipToLeader: 100,
      capabilityBand: "high",
      coalitionSupport: 90,
      values: { tradition: 90, familySafety: 90, profit: 40, autonomy: 40 },
    },
    {
      memberId: "member:old-heir",
      role: "captain",
      coalitionId: "coalition:old",
      seniorityDays: 1800,
      relationshipToLeader: 80,
      capabilityBand: "high",
      coalitionSupport: 95,
      values: { tradition: 85, familySafety: 80, profit: 45, autonomy: 45 },
    },
    {
      memberId: "member:young-heir",
      role: "captain",
      coalitionId: "coalition:young",
      seniorityDays: 1000,
      relationshipToLeader: 70,
      capabilityBand: "high",
      coalitionSupport: 50,
      values: { tradition: 35, familySafety: 40, profit: 90, autonomy: 90 },
    },
    {
      memberId: "member:council",
      role: "council",
      coalitionId: "coalition:old",
      seniorityDays: 2200,
      relationshipToLeader: 60,
      capabilityBand: "moderate",
      coalitionSupport: 40,
      values: { tradition: 70, familySafety: 70, profit: 55, autonomy: 50 },
    },
  ];
}

function stateWithSupport(oldSupport, youngSupport, overrides = {}) {
  const members = baseMembers().map((member) => ({ ...member, ...(overrides[member.memberId] ?? {}) }));
  members.find((member) => member.memberId === "member:old-heir").coalitionSupport = oldSupport;
  members.find((member) => member.memberId === "member:young-heir").coalitionSupport = youngSupport;
  return createDoctrineState({
    organizationId: "organization:lanterns",
    displayName: "Lantern House",
    leaderId: "member:leader",
    members,
    coalitions: [
      { coalitionId: "coalition:old", label: "Old guard" },
      { coalitionId: "coalition:young", label: "Younger circle" },
    ],
    doctrineRules: {
      permittedActivities: ["legitimate-front"],
      forbiddenActivities: ["harm-family"],
      toleratedActivities: ["risky-expansion"],
      familyPolicy: "protected",
    },
    ...overrides.state,
  });
}

test("three relationship and coalition graphs produce consolidated, fragmented, and caretaker succession", () => {
  let consolidated = stateWithSupport(95, 20);
  consolidated = resolveSuccession(consolidated, { expectedRevision: consolidated.revision, cause: "died" });
  assert.equal(consolidated.status, "consolidated");
  assert.equal(consolidated.leadershipRoles.leader, "member:old-heir");

  let fragmented = stateWithSupport(75, 75, {
    "member:young-heir": { seniorityDays: 1800, relationshipToLeader: 80 },
  });
  fragmented = resolveSuccession(fragmented, { expectedRevision: fragmented.revision, cause: "arrested" });
  assert.equal(fragmented.status, "fragmented");
  assert.deepEqual(fragmented.successionHistory.at(-1).outcome.factions, ["member:old-heir", "member:young-heir"]);

  let caretaker = stateWithSupport(0, 0, {
    "member:old-heir": { seniorityDays: 100, capabilityBand: "low" },
    "member:young-heir": { seniorityDays: 90, capabilityBand: "low" },
    "member:council": { seniorityDays: 100, capabilityBand: "low" },
  });
  caretaker = resolveSuccession(caretaker, { expectedRevision: caretaker.revision, cause: "disappeared" });
  assert.equal(caretaker.status, "caretaker");
  assert.equal(caretaker.leadershipRoles.leader, null);
});

test("members interpret doctrine through values and knowledge instead of automatic compliance", () => {
  let state = stateWithSupport(95, 20);
  state = resolveMemberDecision(state, {
    expectedRevision: state.revision,
    memberId: "member:old-heir",
    activity: "harm-family",
  });
  assert.equal(state.members["member:old-heir"].lastDecision.decision, "comply");
  state = resolveMemberDecision(state, {
    expectedRevision: state.revision,
    memberId: "member:young-heir",
    activity: "harm-family",
  });
  assert.equal(state.members["member:young-heir"].lastDecision.decision, "deviate");
  assert.equal(state.members["member:young-heir"].lastDecision.consequence, "discipline-review");
  state = resolveMemberDecision(state, {
    expectedRevision: state.revision,
    memberId: "member:young-heir",
    activity: "harm-family",
    contextKnowledge: "unknown",
  });
  assert.equal(state.members["member:young-heir"].lastDecision.decision, "pause");
});

test("doctrine changes require authority, age into generational tension, and public projection redacts private politics", () => {
  let state = stateWithSupport(95, 20);
  assert.throws(
    () => updateDoctrine(state, { expectedRevision: state.revision, actorId: "member:young-heir", doctrineRules: {} }),
    /not authorized/,
  );
  state = updateDoctrine(state, {
    expectedRevision: state.revision,
    actorId: "member:leader",
    doctrineRules: { forbiddenActivities: ["harm-family", "coerce-civilians"], familyPolicy: "protected" },
  });
  state = settleDoctrineTime(state, { expectedRevision: state.revision, days: 730 });
  assert.equal(state.status, "generational-tension");
  const publicView = projectDoctrine(state);
  assert.equal(publicView.doctrine.forbiddenCount, 2);
  assert.equal(publicView.omittedFields.includes("coalitionSupport"), true);
  assert.equal(publicView.omittedFields.includes("succession candidate scores"), true);
});

test("stale writes and tampered doctrine snapshots fail closed", () => {
  let state = stateWithSupport(95, 20);
  state = settleDoctrineTime(state, { expectedRevision: state.revision, days: 30 });
  assert.throws(
    () => settleDoctrineTime(state, { expectedRevision: state.revision - 1, days: 1 }),
    DoctrineStaleRevisionError,
  );
  assert.deepEqual(restoreDoctrine(snapshotDoctrine(state)), state);
  assert.throws(
    () => restoreDoctrine({ snapshotVersion: 1, state: { ...state, lastEventHash: "tampered" } }),
    DoctrineValidationError,
  );
});
