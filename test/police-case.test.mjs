import test from "node:test";
import assert from "node:assert/strict";

import {
  advanceCaseStage,
  advanceTime,
  attachCaseAgency,
  authorizeCaseAction,
  createCase,
  createInitialWorld,
  recordCaseEvidence,
  recordCaseWitness,
  restore,
  snapshot,
} from "../src/wolves-without-kings/engine.mjs";

test("police cases preserve agency-specific knowledge, jurisdiction, witnesses, and aging", () => {
  let world = createInitialWorld({ startDate: "1998-02-01" });
  world = createCase(world, {
    expectedRevision: world.revision,
    caseId: "case:warehouse-fire",
    matterType: "property-damage",
    leadAgency: "agency:district-police",
    jurisdiction: "south-sofia",
    suspects: ["npc:broker-01"],
    authorityActions: ["interview", "advance-stage"],
  });
  world = attachCaseAgency(world, {
    expectedRevision: world.revision,
    caseId: "case:warehouse-fire",
    agencyId: "agency:customs",
    jurisdiction: "border-goods",
    authorityActions: ["inspect-goods"],
  });
  world = recordCaseEvidence(world, {
    expectedRevision: world.revision,
    caseId: "case:warehouse-fire",
    agencyId: "agency:district-police",
    evidenceId: "evidence:ash-pattern",
    source: "scene-observation",
    strength: 10,
  });
  world = recordCaseEvidence(world, {
    expectedRevision: world.revision,
    caseId: "case:warehouse-fire",
    agencyId: "agency:customs",
    evidenceId: "evidence:invoice-gap",
    source: "customs-record",
    strength: 10,
  });
  world = recordCaseWitness(world, {
    expectedRevision: world.revision,
    caseId: "case:warehouse-fire",
    agencyId: "agency:district-police",
    witnessId: "witness:night-clerk",
    retelling: "The lights went out before the fire.",
    confidence: 40,
  });
  world = recordCaseWitness(world, {
    expectedRevision: world.revision,
    caseId: "case:warehouse-fire",
    agencyId: "agency:customs",
    witnessId: "witness:driver",
    retelling: "A vehicle left after the smoke started.",
    confidence: 25,
  });

  const beforeUnauthorizedAction = world;
  assert.throws(
    () => authorizeCaseAction(world, {
      expectedRevision: world.revision,
      caseId: "case:warehouse-fire",
      agencyId: "agency:customs",
      action: "advance-stage",
    }),
    /outside agency jurisdiction/,
  );
  assert.equal(world.revision, beforeUnauthorizedAction.revision);
  assert.deepEqual(world.cases["case:warehouse-fire"].agencyViews["agency:customs"].knownEvidence, ["evidence:invoice-gap"]);
  assert.deepEqual(world.cases["case:warehouse-fire"].agencyViews["agency:district-police"].knownEvidence, ["evidence:ash-pattern"]);
  assert.notEqual(
    world.cases["case:warehouse-fire"].witnesses[0].retelling,
    world.cases["case:warehouse-fire"].witnesses[1].retelling,
  );

  world = authorizeCaseAction(world, {
    expectedRevision: world.revision,
    caseId: "case:warehouse-fire",
    agencyId: "agency:district-police",
    action: "advance-stage",
  });
  world = advanceCaseStage(world, {
    expectedRevision: world.revision,
    caseId: "case:warehouse-fire",
    agencyId: "agency:district-police",
    nextStage: "open",
  });
  world = advanceTime(world, { expectedRevision: world.revision, days: 31 });

  const caseFile = world.cases["case:warehouse-fire"];
  assert.equal(caseFile.legalStage, "cold");
  assert.equal(caseFile.caseAgeDays, 31);
  assert.equal(caseFile.confidence, 5);
  assert.deepEqual(restore(snapshot(world)), world);
});
