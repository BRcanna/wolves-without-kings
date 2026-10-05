import test from "node:test";
import assert from "node:assert/strict";

import {
  advanceVehicleProvenance,
  createInitialWorld,
  createVehicle,
  resolveVehicleAction,
  restore,
  snapshot,
} from "../src/wolves-without-kings/engine.mjs";
import { projectWorld } from "../src/wolves-without-kings/projection.mjs";

test("vehicle pursuit segments preserve handling, driver familiarity, damage, and signals", () => {
  let world = createInitialWorld();
  world = createVehicle(world, {
    expectedRevision: world.revision,
    vehicleId: "vehicle:favorite-sedan",
    vehicleClass: "sedan",
    mass: 55,
    handling: 70,
    ownerId: "character:player",
    locationId: "loc:market-street",
  });
  world = resolveVehicleAction(world, {
    expectedRevision: world.revision,
    actionId: "vehicle:urban-segment",
    vehicleId: "vehicle:favorite-sedan",
    driverId: "character:player",
    locationId: "loc:market-street",
    surface: "urban",
    speedBand: "steady",
    damageDelta: 5,
    observerSignal: "recognizable-sedan",
  });
  world = resolveVehicleAction(world, {
    expectedRevision: world.revision,
    actionId: "vehicle:highway-segment",
    vehicleId: "vehicle:favorite-sedan",
    driverId: "character:player",
    locationId: "loc:river-walk",
    surface: "highway",
    speedBand: "fast",
    damageDelta: 10,
    outcome: "switched",
  });
  world = resolveVehicleAction(world, {
    expectedRevision: world.revision,
    actionId: "vehicle:mountain-segment",
    vehicleId: "vehicle:favorite-sedan",
    driverId: "character:player",
    locationId: "loc:tram-underpass",
    surface: "mountain",
    speedBand: "careful",
    damageDelta: 0,
  });
  const vehicle = world.vehicles["vehicle:favorite-sedan"];
  assert.equal(vehicle.ownerId, "character:player");
  assert.equal(vehicle.damage, 15);
  assert.equal(vehicle.condition, "damaged");
  assert.equal(vehicle.driverFamiliarity["character:player"], 3);
  assert.equal(vehicle.pursuitHistory.length, 3);
  assert.equal(vehicle.observerSignals[0].signal, "recognizable-sedan");
  assert.equal(world.actions.length, 3);
});

test("catastrophic vehicle damage retires the specific vehicle and blocks later use", () => {
  let world = createInitialWorld();
  world = createVehicle(world, {
    expectedRevision: world.revision,
    vehicleId: "vehicle:old-hatchback",
    mass: 30,
    handling: 35,
    locationId: "loc:motel-service-yard",
  });
  world = resolveVehicleAction(world, {
    expectedRevision: world.revision,
    actionId: "vehicle:catastrophe",
    vehicleId: "vehicle:old-hatchback",
    driverId: "character:player",
    locationId: "loc:motel-service-yard",
    surface: "service-road",
    damageDelta: 100,
    outcome: "retired",
  });
  assert.equal(world.vehicles["vehicle:old-hatchback"].condition, "retired");
  assert.throws(
    () => resolveVehicleAction(world, {
      expectedRevision: world.revision,
      actionId: "vehicle:after-retirement",
      vehicleId: "vehicle:old-hatchback",
      driverId: "character:player",
      locationId: "loc:market-street",
      surface: "urban",
    }),
    /vehicle is retired/,
  );
  assert.equal(world.revision, 2);
});

test("vehicle provenance survives theft, storage, service, appearance change, fencing, resale, return, and trophy status", () => {
  let world = createInitialWorld({ startDate: "1999-01-01" });
  world = createVehicle(world, {
    expectedRevision: world.revision,
    vehicleId: "vehicle:provenance-coupe",
    vehicleClass: "coupe",
    mass: 45,
    handling: 65,
    ownerId: "character:founder",
    damage: 20,
    locationId: "loc:market-street",
  });
  const transition = (options) => {
    world = advanceVehicleProvenance(world, {
      expectedRevision: world.revision,
      vehicleId: "vehicle:provenance-coupe",
      ...options,
    });
  };

  transition({ transition: "theft", actorId: "npc:thief", evidenceSignal: "observed-change", policeInterestDelta: 20, recognitionRiskDelta: 30 });
  transition({ transition: "storage", actorId: "npc:thief", locationId: "loc:service-yard", evidenceSignal: "location-change" });
  transition({ transition: "service", actorId: "business:garage", serviceLabel: "maintenance", repairDelta: 5, evidenceSignal: "service-record" });
  transition({ transition: "repaint", actorId: "business:garage", appearanceBand: "dark-band", evidenceSignal: "appearance-change" });
  transition({ transition: "fence", actorId: "organization:broker", recipientId: "npc:broker", evidenceSignal: "custody-change" });
  transition({ transition: "chop", actorId: "business:chop-shop", evidenceSignal: "processed-asset" });
  transition({ transition: "resale", actorId: "organization:broker", newOwnerId: "character:successor", evidenceSignal: "ownership-record" });
  transition({ transition: "theft", actorId: "npc:second-thief", evidenceSignal: "witnessed-change", policeInterestDelta: 10 });
  transition({ transition: "return", actorId: "npc:second-thief", locationId: "loc:private-garage", evidenceSignal: "returned-asset" });
  transition({ transition: "trophy", actorId: "character:successor", trophyTag: "old-coupe", evidenceSignal: "displayed-history" });

  const vehicle = world.vehicles["vehicle:provenance-coupe"];
  assert.equal(vehicle.ownerId, "character:successor");
  assert.equal(vehicle.holderId, "character:successor");
  assert.equal(vehicle.status, "trophy");
  assert.equal(vehicle.damage, 15);
  assert.equal(vehicle.ownerHistory.length, 2);
  assert.equal(vehicle.serviceHistory.length, 1);
  assert.equal(vehicle.storageHistory.length, 1);
  assert.equal(vehicle.plateHistory[0].appearanceBand, "dark-band");
  assert.equal(vehicle.provenanceHistory.length, 10);
  assert.equal(vehicle.policeInterest, 30);

  const publicVehicle = projectWorld(world, { scope: "public" }).vehicles[0];
  assert.equal(publicVehicle.status, "trophy");
  assert.equal(publicVehicle.recognitionRiskBand, "moderate");
  assert.equal(Object.hasOwn(publicVehicle, "ownerHistory"), false);
  assert.equal(Object.hasOwn(publicVehicle, "serviceHistory"), false);
  assert.equal(Object.hasOwn(publicVehicle, "holderId"), false);
  assert.deepEqual(restore(snapshot(world)), world);
});

test("vehicle provenance rejects incomplete resale and stale mutation", () => {
  let world = createInitialWorld();
  world = createVehicle(world, {
    expectedRevision: world.revision,
    vehicleId: "vehicle:bounded",
    mass: 30,
    handling: 40,
    locationId: "loc:market-street",
  });
  assert.throws(
    () => advanceVehicleProvenance(world, {
      expectedRevision: world.revision,
      vehicleId: "vehicle:bounded",
      actorId: "npc:broker",
      transition: "resale",
    }),
    /resale requires newOwnerId/,
  );
  assert.throws(
    () => advanceVehicleProvenance(world, {
      expectedRevision: world.revision - 1,
      vehicleId: "vehicle:bounded",
      actorId: "npc:broker",
      transition: "storage",
    }),
    /stale command/,
  );
  assert.equal(world.revision, 1);
});
