import test from "node:test";
import assert from "node:assert/strict";

import {
  advanceTime,
  claimWorkItem,
  completeWorkItem,
  createNpc,
  createInitialWorld,
  createOrganization,
  createRumor,
  createWorkGraph,
  hearRumor,
  startNpcLongAction,
  updateRelationship,
} from "../src/wolves-without-kings/engine.mjs";

test("NPC life advances routines, needs, and long actions through world time", () => {
  let world = createInitialWorld({ startDate: "1998-01-01" });
  world = createNpc(world, {
    expectedRevision: world.revision,
    npcId: "npc:collector",
    displayName: "Mila Petkova",
    home: "loc:market-street",
    occupation: "collector",
    routineBlocks: [
      { id: "home", label: "Home", locationId: "loc:market-street", need: "sleep" },
      { id: "shops", label: "Shops", locationId: "loc:night-market", need: "money" },
      { id: "family", label: "Family", locationId: "loc:market-street", need: "family" },
    ],
  });
  world = startNpcLongAction(world, {
    expectedRevision: world.revision,
    npcId: "npc:collector",
    actionId: "appointment:collector-01",
    label: "Keep an appointment",
    durationDays: 2,
  });
  world = advanceTime(world, { expectedRevision: world.revision, days: 2 });

  const npc = world.npcLife["npc:collector"];
  assert.equal(npc.lifeDays, 2);
  assert.equal(npc.activeLongAction, null);
  assert.deepEqual(npc.completedActions, [{ id: "appointment:collector-01", completedOnLifeDay: 2 }]);
  assert.ok(npc.needs.food > 0);
  assert.equal(npc.lastEventId, "evt-000003");
});

test("multi-axis relationships preserve contradiction, shared history, and age", () => {
  let world = createInitialWorld();
  world = updateRelationship(world, {
    expectedRevision: world.revision,
    actorId: "character:player",
    subjectId: "npc:broker-01",
    deltas: { trust: 4, respect: 8, fear: 2, resentment: 6 },
    sharedEventType: "kept-a-dangerous-promise",
  });
  world = advanceTime(world, { expectedRevision: world.revision, days: 5 });

  const relationship = world.relationships["character:player|npc:broker-01"];
  assert.equal(relationship.trust, 4);
  assert.equal(relationship.respect, 8);
  assert.equal(relationship.resentment, 6);
  assert.equal(relationship.relationshipAgeDays, 5);
  assert.deepEqual(relationship.sharedEvents, [{ type: "kept-a-dangerous-promise", date: "1998-01-01" }]);
});

test("rumors keep world truth separate from observer-specific retellings", () => {
  let world = createInitialWorld({ startDate: "1998-01-01" });
  world = createRumor(world, {
    expectedRevision: world.revision,
    rumorId: "rumor:warehouse-fire",
    sourceId: "npc:witness-01",
    subjectId: "npc:broker-01",
    topic: "warehouse-fire",
    retelling: "The lights went out before the fire.",
    truthStatus: "contested",
    locationId: "loc:warehouse",
  });
  world = advanceTime(world, { expectedRevision: world.revision, days: 3 });
  world = hearRumor(world, {
    expectedRevision: world.revision,
    observerId: "npc:listener-01",
    rumorId: "rumor:warehouse-fire",
    sourceId: "npc:witness-01",
    retelling: "Someone saw the broker leave before the fire.",
    confidence: 70,
  });
  world = hearRumor(world, {
    expectedRevision: world.revision,
    observerId: "npc:listener-02",
    rumorId: "rumor:warehouse-fire",
    sourceId: "npc:listener-01",
    retelling: "The broker started the fire.",
    confidence: 35,
  });

  assert.equal(world.rumors["rumor:warehouse-fire"].truthStatus, "contested");
  assert.equal(world.beliefs["npc:listener-01"]["rumor:warehouse-fire"].confidence, 70);
  assert.equal(world.beliefs["npc:listener-02"]["rumor:warehouse-fire"].retelling, "The broker started the fire.");
  assert.equal(world.beliefs["npc:listener-01"]["rumor:warehouse-fire"].heardOn, "1998-01-04");
  assert.equal(world.beliefs["npc:listener-01"]["rumor:warehouse-fire"].stalenessDays, 0);
});

test("organization work graphs enforce dependencies and recover expired leases", () => {
  let world = createInitialWorld({ startDate: "1998-01-01" });
  world = createOrganization(world, {
    expectedRevision: world.revision,
    organizationId: "org:night-market",
    displayName: "Night Market Circle",
    members: [
      { memberId: "character:player", role: "leader", capabilities: ["coordination", "driving"] },
      { memberId: "npc:driver", role: "driver", capabilities: ["driving"] },
    ],
  });
  world = createWorkGraph(world, {
    expectedRevision: world.revision,
    organizationId: "org:night-market",
    workItems: [
      { workItemId: "work:prepare", label: "Prepare the operation", requiredCapabilities: ["coordination"] },
      { workItemId: "work:transport", label: "Transport the package", dependencies: ["work:prepare"], requiredCapabilities: ["driving"] },
    ],
  });
  world = claimWorkItem(world, {
    expectedRevision: world.revision,
    organizationId: "org:night-market",
    workItemId: "work:prepare",
    memberId: "character:player",
    leaseDays: 2,
  });
  world = completeWorkItem(world, {
    expectedRevision: world.revision,
    organizationId: "org:night-market",
    workItemId: "work:prepare",
    memberId: "character:player",
  });
  assert.equal(world.organizations["org:night-market"].workItems["work:transport"].status, "available");
  world = claimWorkItem(world, {
    expectedRevision: world.revision,
    organizationId: "org:night-market",
    workItemId: "work:transport",
    memberId: "npc:driver",
    leaseDays: 1,
  });
  world = advanceTime(world, { expectedRevision: world.revision, days: 2 });

  const transport = world.organizations["org:night-market"].workItems["work:transport"];
  assert.equal(transport.status, "recovery");
  assert.equal(transport.claimOwner, null);
  assert.equal(transport.recoveryState, "required");
  assert.equal(transport.lastTransitionReason, "lease-expired");
  assert.equal(transport.attempts, 1);
});
