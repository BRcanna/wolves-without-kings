import test from "node:test";
import assert from "node:assert/strict";

import {
  advanceTime,
  createBusiness,
  createInitialWorld,
  createProtectionArrangement,
  disputeProtectionClaim,
  resolveProtectionCycle,
  restore,
  snapshot,
} from "../src/wolves-without-kings/engine.mjs";
import { projectWorld } from "../src/wolves-without-kings/projection.mjs";

function createProtectionWorld(mode) {
  let world = createInitialWorld({ startDate: "1999-01-01" });
  world = createBusiness(world, {
    expectedRevision: world.revision,
    businessId: "business:river-cafe",
    displayName: "River Cafe",
    locationId: "loc:river-walk",
    venueType: "cafe",
    ownerId: "npc:cafe-owner",
  });
  world = createProtectionArrangement(world, {
    expectedRevision: world.revision,
    arrangementId: `protection:${mode}`,
    businessId: "business:river-cafe",
    ownerId: "npc:cafe-owner",
    providerId: "organization:lanterns",
    mode,
    serviceExpectations: ["presence", "information", "storage"],
    vulnerability: 45,
  });
  return world;
}

function resolveAndAdvance(world, arrangementId, cycle) {
  const afterCycle = resolveProtectionCycle(world, {
    expectedRevision: world.revision,
    arrangementId,
    collectorId: "organization:lanterns",
    ...cycle,
  });
  return advanceTime(afterCycle, {
    expectedRevision: afterCycle.revision,
    days: 30,
  });
}

test("six months distinguish coercive, protective, and partnership strategies", () => {
  let coercive = createProtectionWorld("coercive");
  for (let month = 0; month < 6; month += 1) {
    coercive = resolveAndAdvance(coercive, "protection:coercive", {
      treatment: "humiliating",
      paymentStatus: "paid",
      serviceDelivered: false,
      observedByPolice: month === 2,
    });
  }
  const coerciveArrangement = coercive.protectionArrangements["protection:coercive"];
  assert.equal(coerciveArrangement.daysActive, 180);
  assert.equal(coerciveArrangement.trust, 0);
  assert.equal(coerciveArrangement.resentment >= 80, true);
  assert.equal(coerciveArrangement.policeExposure, 15);
  assert.equal(coercive.businesses["business:river-cafe"].condition, "strained");

  let protective = createProtectionWorld("protective");
  for (let month = 0; month < 6; month += 1) {
    protective = resolveAndAdvance(protective, "protection:protective", {
      treatment: "protective",
      paymentStatus: "paid",
      serviceDelivered: true,
    });
  }
  const protectiveArrangement = protective.protectionArrangements["protection:protective"];
  assert.equal(protectiveArrangement.trust > 50, true);
  assert.equal(protectiveArrangement.resentment, 0);
  assert.equal(protective.businesses["business:river-cafe"].condition, "stable");

  let partnership = createProtectionWorld("partnership");
  partnership = resolveAndAdvance(partnership, "protection:partnership", {
    treatment: "protective",
    paymentStatus: "paid",
    serviceDelivered: true,
    ownerDecision: "partner",
  });
  for (let month = 1; month < 6; month += 1) {
    partnership = resolveAndAdvance(partnership, "protection:partnership", {
      treatment: "respectful",
      paymentStatus: "paid",
      serviceDelivered: true,
    });
  }
  const partnershipArrangement = partnership.protectionArrangements["protection:partnership"];
  assert.equal(partnershipArrangement.mode, "partnership");
  assert.equal(partnershipArrangement.trust >= 70, true);
  assert.equal(partnershipArrangement.status, "active");
});

test("rival protection claims become contested obligations without replacing history", () => {
  let world = createProtectionWorld("negotiated");
  world = disputeProtectionClaim(world, {
    expectedRevision: world.revision,
    arrangementId: "protection:negotiated",
    claimantId: "organization:rival",
    reason: "rival-claim",
  });
  const arrangement = world.protectionArrangements["protection:negotiated"];
  assert.equal(arrangement.status, "disputed");
  assert.equal(arrangement.competitorPressure, 20);
  assert.equal(arrangement.history.at(-1).claimantId, "organization:rival");

  const publicView = projectWorld(world, { scope: "public" });
  const publicArrangement = publicView.protectionArrangements[0];
  assert.equal(publicArrangement.status, "disputed");
  assert.equal(publicArrangement.relationshipBand, "contested");
  assert.equal(Object.hasOwn(publicArrangement, "trust"), false);
  assert.equal(Object.hasOwn(publicArrangement, "fear"), false);
  assert.equal(Object.hasOwn(publicArrangement, "history"), false);
  assert.equal(Object.hasOwn(publicArrangement, "providerId"), false);
});

test("owner outcomes and impossible collection fail closed", () => {
  let world = createProtectionWorld("negotiated");
  world = resolveProtectionCycle(world, {
    expectedRevision: world.revision,
    arrangementId: "protection:negotiated",
    collectorId: "organization:lanterns",
    treatment: "respectful",
    paymentStatus: "missed",
    serviceDelivered: false,
    ownerDecision: "report",
  });
  assert.equal(world.protectionArrangements["protection:negotiated"].status, "ended");
  assert.throws(
    () => resolveProtectionCycle(world, {
      expectedRevision: world.revision,
      arrangementId: "protection:negotiated",
      collectorId: "organization:lanterns",
    }),
    /arrangement is ended/,
  );

  const closed = createProtectionWorld("negotiated");
  const closedBusiness = {
    ...closed,
    businesses: {
      ...closed.businesses,
      "business:river-cafe": { ...closed.businesses["business:river-cafe"], condition: "closed" },
    },
  };
  assert.throws(
    () => resolveProtectionCycle(closedBusiness, {
      expectedRevision: closedBusiness.revision,
      arrangementId: "protection:negotiated",
      collectorId: "organization:lanterns",
      paymentStatus: "paid",
    }),
    /closed business cannot complete/,
  );
});

test("protection state ages and restores from the event history", () => {
  let world = createProtectionWorld("negotiated");
  world = resolveAndAdvance(world, "protection:negotiated", {
    treatment: "respectful",
    paymentStatus: "paid",
    serviceDelivered: true,
  });
  const restored = restore(snapshot(world));
  assert.deepEqual(restored, world);
  assert.equal(restored.protectionArrangements["protection:negotiated"].daysActive, 30);
});
