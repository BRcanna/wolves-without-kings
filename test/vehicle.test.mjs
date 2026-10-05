import test from "node:test";
import assert from "node:assert/strict";

import {
  createInitialWorld,
  createVehicle,
  resolveVehicleAction,
} from "../src/wolves-without-kings/engine.mjs";

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
