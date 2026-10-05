import test from "node:test";
import assert from "node:assert/strict";

import {
  CampaignStaleRevisionError,
  CampaignValidationError,
  advanceCampaignChapter,
  completeCampaign,
  createCampaignState,
  createCampaignSuccessor,
  offerCampaignOpportunity,
  pauseCampaign,
  projectCampaign,
  recordSystemicCampaignSettlement,
  restoreCampaign,
  resolveCampaignOpportunity,
  resumeCampaign,
  settleCampaignTime,
  snapshotCampaign,
  startCampaign,
} from "../src/wolves-without-kings/campaign.mjs";

function startedCampaign() {
  let state = createCampaignState({ campaignId: "campaign:offline", worldSeed: "fixture-seed" });
  return startCampaign(state, { expectedRevision: state.revision });
}

test("solo campaign starts, pauses, resumes, and settles controlled time without an online dependency", () => {
  let state = startedCampaign();
  state = pauseCampaign(state, { expectedRevision: state.revision });
  assert.equal(state.lifeClock, "paused");
  assert.throws(() => settleCampaignTime(state, { expectedRevision: state.revision, days: 1 }), CampaignValidationError);
  state = resumeCampaign(state, { expectedRevision: state.revision });
  state = settleCampaignTime(state, { expectedRevision: state.revision, days: 30 });
  assert.equal(state.simulationDate, "1998-01-31");
  assert.equal(state.systemicState.daysAdvanced, 30);
  assert.equal(state.onlineRequired, false);
});

test("an ignored authored opportunity adapts through time instead of resetting the world", () => {
  let state = startedCampaign();
  state = offerCampaignOpportunity(state, {
    expectedRevision: state.revision,
    opportunityId: "opportunity:meeting",
    contactId: "npc:contact",
    title: "The missed meeting",
    expiresAfterDays: 60,
  });
  state = settleCampaignTime(state, { expectedRevision: state.revision, days: 61 });
  assert.equal(state.opportunities["opportunity:meeting"].status, "adapted");
  assert.equal(state.opportunities["opportunity:meeting"].branch, "contact-adapted");
  assert.equal(state.storyFlags["opportunity:opportunity:meeting"], "missed-adapted");
});

test("systemic work and chapter deviation can complete the campaign offline", () => {
  let state = startedCampaign();
  state = recordSystemicCampaignSettlement(state, {
    expectedRevision: state.revision,
    kind: "job",
    entityId: "job:night-market",
    outcome: "delegated-success",
  });
  state = recordSystemicCampaignSettlement(state, {
    expectedRevision: state.revision,
    kind: "business",
    entityId: "business:cafe",
    outcome: "strained-but-open",
  });
  state = advanceCampaignChapter(state, { expectedRevision: state.revision, chapter: "after-the-light" });
  state = completeCampaign(state, { expectedRevision: state.revision, ending: "survived-with-debts" });
  assert.equal(state.status, "completed");
  assert.equal(state.systemicState.jobsSettled, 1);
  assert.equal(state.systemicState.businessesSettled, 1);
  assert.equal(state.ending.label, "survived-with-debts");
  assert.equal(projectCampaign(state).onlineRequired, false);
});

test("successor continuity preserves the completed protagonist history without transferring private capability", () => {
  let state = completeCampaign(startedCampaign(), { expectedRevision: 1, ending: "legacy" });
  state = createCampaignSuccessor(state, {
    expectedRevision: state.revision,
    successorId: "character:successor",
    displayName: "The Successor",
  });
  assert.equal(state.status, "retired");
  assert.equal(state.successorState.exactSkillsTransferred, false);
  assert.equal(state.successorState.privateMemoryTransferred, false);
  assert.equal(state.successorState.sourceEnding.label, "legacy");
  assert.equal(state.events.some((event) => event.eventType === "campaign.completed"), true);
});

test("campaign rejects stale writes and tampered snapshots before claiming acceptance", () => {
  const state = startedCampaign();
  assert.throws(
    () => offerCampaignOpportunity(state, {
      expectedRevision: state.revision - 1,
      opportunityId: "opportunity:stale",
      contactId: "npc:contact",
      title: "Stale",
    }),
    CampaignStaleRevisionError,
  );
  assert.throws(
    () => restoreCampaign({ snapshotVersion: 1, state: { ...state, lastEventHash: "tampered" } }),
    CampaignValidationError,
  );
  assert.equal(Object.hasOwn(state.opportunities, "opportunity:stale"), false);
  assert.deepEqual(restoreCampaign(snapshotCampaign(state)), state);
});
