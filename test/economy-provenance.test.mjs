import test from "node:test";
import assert from "node:assert/strict";

import {
  advanceTime,
  createInitialWorld,
  createMarket,
  createProvenanceObject,
  moveObject,
  recordObjectDamage,
  recordObjectRepair,
  restore,
  returnSeizedObject,
  seizeObject,
  snapshot,
  transferObject,
  updateMarket,
} from "../src/wolves-without-kings/engine.mjs";

test("provenance keeps one object identity across storage, transfer, seizure, and return", () => {
  let world = createInitialWorld();
  world = createProvenanceObject(world, {
    expectedRevision: world.revision,
    objectId: "object:old-camera",
    objectType: "camera",
    origin: "family-archive",
    ownerId: "character:player",
    locationId: "loc:apartment",
    evidenceFlags: ["evidence:photograph-01"],
    trophyTags: ["sentimental"],
  });
  world = moveObject(world, {
    expectedRevision: world.revision,
    objectId: "object:old-camera",
    actorId: "character:player",
    locationId: "property:garage",
    containerId: "container:locked-box",
    reason: "property-storage",
  });
  world = transferObject(world, {
    expectedRevision: world.revision,
    objectId: "object:old-camera",
    fromId: "character:player",
    toId: "npc:broker-01",
    locationId: "loc:night-market",
    reason: "trusted-loan",
  });
  world = seizeObject(world, {
    expectedRevision: world.revision,
    objectId: "object:old-camera",
    agencyId: "agency:district-police",
    locationId: "property:evidence-room",
    evidenceFlag: "evidence:seized",
  });
  world = returnSeizedObject(world, {
    expectedRevision: world.revision,
    objectId: "object:old-camera",
    agencyId: "agency:district-police",
    locationId: "loc:night-market",
  });
  world = recordObjectDamage(world, {
    expectedRevision: world.revision,
    objectId: "object:old-camera",
    actorId: "npc:broker-01",
    severity: 40,
    cause: "rough-handling",
  });
  world = recordObjectRepair(world, {
    expectedRevision: world.revision,
    objectId: "object:old-camera",
    actorId: "npc:broker-01",
  });

  const object = world.objects["object:old-camera"];
  assert.equal(object.id, "object:old-camera");
  assert.equal(object.currentOwnerId, "npc:broker-01");
  assert.equal(object.status, "held");
  assert.equal(object.currentLocationId, "loc:night-market");
  assert.equal(object.ownerChain.length, 2);
  assert.equal(object.custodyChain.some((record) => record.state === "seized"), true);
  assert.deepEqual(object.locationHistory[1], {
    locationId: "property:garage",
    containerId: "container:locked-box",
    date: "1998-01-01",
    reason: "property-storage",
  });
  assert.ok(object.eventLinks.includes("evt-000004"));
  assert.deepEqual(object.damageHistory[0].severity, 40);
  assert.equal(object.condition, "intact");
  assert.deepEqual(restore(snapshot(world)), world);
});

test("regional markets expose deterministic price bands and respond to independent shocks", () => {
  let world = createInitialWorld({ startDate: "1998-06-01" });
  world = createMarket(world, {
    expectedRevision: world.revision,
    marketId: "market:sofia-nightlife",
    regionId: "district:sofia-south",
    commodity: "nightlife-demand",
    basePrice: 100,
    supply: 80,
    demand: 20,
    inventory: 50,
    volatility: 15,
    informationLagDays: 4,
  });
  const startingBand = world.markets["market:sofia-nightlife"].priceBand;
  world = updateMarket(world, {
    expectedRevision: world.revision,
    marketId: "market:sofia-nightlife",
    demandDelta: 100,
    shockType: "tourism-surge",
    informationLagDays: 4,
  });
  const demandShockBand = world.markets["market:sofia-nightlife"].priceBand;
  assert.ok(demandShockBand.midpoint > startingBand.midpoint);
  world = updateMarket(world, {
    expectedRevision: world.revision,
    marketId: "market:sofia-nightlife",
    supplyDelta: 240,
    shockType: "regional-supply-arrival",
  });
  const supplyShockBand = world.markets["market:sofia-nightlife"].priceBand;
  assert.ok(supplyShockBand.midpoint < demandShockBand.midpoint);
  assert.equal(world.markets["market:sofia-nightlife"].shockHistory.length, 2);
  assert.ok(supplyShockBand.low >= 1);
  world = advanceTime(world, { expectedRevision: world.revision, days: 5 });
  assert.equal(world.markets["market:sofia-nightlife"].lastSettledDate, "1998-06-06");
  assert.equal(world.markets["market:sofia-nightlife"].informationLagDays, 0);
});
