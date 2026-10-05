import test from "node:test";
import assert from "node:assert/strict";

import {
  attachCaseAgency,
  createCase,
  createCharacter,
  createInitialWorld,
  createNpc,
  createRumor,
  hearRumor,
  recordCaseEvidence,
  startSurveillance,
  updateRelationship,
} from "../src/wolves-without-kings/engine.mjs";
import { projectWorld } from "../src/wolves-without-kings/projection.mjs";

test("scope-filtered projections protect private beliefs, competence, and case confidence", () => {
  let world = createInitialWorld();
  world = createCharacter(world, {
    expectedRevision: world.revision,
    characterId: "character:player",
    displayName: "The Player",
  });
  world = createNpc(world, {
    expectedRevision: world.revision,
    npcId: "npc:broker-01",
    displayName: "Mila Petkova",
    home: "loc:night-market",
  });
  world = updateRelationship(world, {
    expectedRevision: world.revision,
    actorId: "character:player",
    subjectId: "npc:broker-01",
    deltas: { trust: 4 },
  });
  world = createRumor(world, {
    expectedRevision: world.revision,
    rumorId: "rumor:one",
    sourceId: "npc:broker-01",
    subjectId: "character:player",
    topic: "one",
    retelling: "A story.",
  });
  world = hearRumor(world, {
    expectedRevision: world.revision,
    observerId: "character:player",
    rumorId: "rumor:one",
    sourceId: "npc:broker-01",
  });
  world = startSurveillance(world, {
    expectedRevision: world.revision,
    surveillanceId: "surveillance:one",
    observerId: "character:player",
    targetId: "npc:broker-01",
    locationId: "loc:night-market",
  });
  world = createCase(world, {
    expectedRevision: world.revision,
    caseId: "case:one",
    matterType: "incident",
    leadAgency: "agency:district-police",
    jurisdiction: "south-sofia",
    authorityActions: ["interview"],
  });
  world = attachCaseAgency(world, {
    expectedRevision: world.revision,
    caseId: "case:one",
    agencyId: "agency:customs",
    jurisdiction: "border-goods",
    authorityActions: ["inspect-goods"],
  });
  world = recordCaseEvidence(world, {
    expectedRevision: world.revision,
    caseId: "case:one",
    agencyId: "agency:district-police",
    evidenceId: "evidence:local",
    source: "local-observation",
  });

  const publicView = projectWorld(world, { scope: "public" });
  assert.equal(Object.hasOwn(publicView, "beliefs"), false);
  assert.equal(Object.hasOwn(publicView, "surveillance"), false);
  assert.equal(Object.hasOwn(publicView, "cases"), false);
  assert.equal(JSON.stringify(publicView).includes("agencyViews"), false);
  assert.equal(JSON.stringify(publicView).includes("practice"), false);

  const observerView = projectWorld(world, { scope: "observer", actorId: "character:player" });
  assert.equal(observerView.beliefs["rumor:one"].confidence, 50);
  assert.equal(observerView.surveillance["surveillance:one"].observerId, "character:player");
  assert.equal(observerView.character.skills.driving, "latent");
  assert.equal(Object.hasOwn(observerView.character.skills, "practice"), false);

  const policeView = projectWorld(world, { scope: "institutional", actorId: "agency:district-police" });
  assert.deepEqual(policeView.cases["case:one"].knownEvidence, ["evidence:local"]);
  assert.equal(Object.hasOwn(policeView.cases["case:one"], "confidence"), false);
  assert.equal(Object.hasOwn(policeView.cases["case:one"], "evidenceLinks"), false);

  const debugView = projectWorld(world, { scope: "debug" });
  assert.equal(debugView.cases["case:one"].confidence, 1);
  assert.equal(debugView.cases["case:one"].agencyViews["agency:district-police"].knownEvidence[0], "evidence:local");
});

test("projection scope requires an explicit actor for private views", () => {
  const world = createInitialWorld();
  assert.throws(() => projectWorld(world, { scope: "observer" }), /requires actorId/);
  assert.throws(() => projectWorld(world, { scope: "institutional" }), /requires agencyId/);
  assert.throws(() => projectWorld(world, { scope: "unknown" }), /unsupported projection scope/);
});
