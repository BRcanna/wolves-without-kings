import test from "node:test";
import assert from "node:assert/strict";

import {
  advanceAggregateRegion,
  advanceTime,
  changeRegionSimulationMode,
  createCorridor,
  createInitialWorld,
  createRegion,
  restore,
  snapshot,
} from "../src/wolves-without-kings/engine.mjs";
import { projectWorld } from "../src/wolves-without-kings/projection.mjs";

function regionalWorld() {
  let world = createInitialWorld({ startDate: "1999-01-01" });
  world = createRegion(world, {
    expectedRevision: world.revision,
    regionId: "region:sofia",
    label: "Sofia Basin (fictionalized)",
    mode: "full",
    populationBand: "urban",
    businessCount: 12,
  });
  world = createRegion(world, {
    expectedRevision: world.revision,
    regionId: "region:coast",
    label: "Black Sea Coast (fictionalized)",
    mode: "aggregate",
    populationBand: "coastal",
    businessCount: 8,
    marketPressure: 60,
  });
  world = createCorridor(world, {
    expectedRevision: world.revision,
    corridorId: "corridor:sofia-coast",
    fromRegionId: "region:sofia",
    toRegionId: "region:coast",
    travelDays: 2,
    transportFriction: 85,
    legalPressure: 35,
    capacity: 60,
  });
  return world;
}

test("two-region map preserves full/aggregate modes and a bounded corridor", () => {
  const world = regionalWorld();
  assert.equal(world.regions["region:sofia"].mode, "full");
  assert.equal(world.regions["region:coast"].mode, "aggregate");
  assert.equal(world.corridors["corridor:sofia-coast"].status, "restricted");
  assert.equal(world.corridors["corridor:sofia-coast"].travelDays, 2);

  const publicView = projectWorld(world, { scope: "public" });
  assert.equal(publicView.regions[1].condition, "stable");
  assert.equal(publicView.corridors[0].transportFrictionBand, "high");
  assert.equal(Object.hasOwn(publicView.regions[1], "policePressure"), false);
  assert.equal(Object.hasOwn(publicView.regions[1], "history"), false);
  assert.equal(Object.hasOwn(publicView.corridors[0], "legalPressure"), false);
});

test("aggregate settlement records deterministic offscreen shocks and scars", () => {
  let world = regionalWorld();
  world = advanceAggregateRegion(world, {
    expectedRevision: world.revision,
    regionId: "region:coast",
    days: 90,
    marketShock: -55,
    policeShock: 70,
    logisticsShock: 20,
  });
  const region = world.regions["region:coast"];
  assert.equal(region.offscreenDays, 90);
  assert.equal(region.marketPressure, 5);
  assert.equal(region.policePressure, 90);
  assert.equal(region.logisticsPressure, 40);
  assert.equal(region.condition, "strained");
  assert.equal(region.scars.includes("condition:strained"), true);
  assert.equal(region.history.at(-1).type, "aggregate-settlement");
  assert.equal(region.lastSettledDate, "1999-04-01");
});

test("world time settles aggregate regions while full regions remain full-fidelity", () => {
  let world = regionalWorld();
  world = advanceTime(world, { expectedRevision: world.revision, days: 30 });
  assert.equal(world.date, "1999-01-31");
  assert.equal(world.regions["region:coast"].offscreenDays, 30);
  assert.equal(world.regions["region:coast"].lastSettledDate, "1999-01-31");
  assert.equal(world.regions["region:sofia"].offscreenDays, 0);
  assert.throws(
    () => advanceAggregateRegion(world, {
      expectedRevision: world.revision,
      regionId: "region:sofia",
      days: 1,
    }),
    /not in aggregate mode/,
  );
});

test("aggregate mode can return to full simulation and restore remains history-equivalent", () => {
  let world = regionalWorld();
  world = changeRegionSimulationMode(world, {
    expectedRevision: world.revision,
    regionId: "region:coast",
    mode: "full",
  });
  assert.equal(world.regions["region:coast"].mode, "full");
  assert.equal(world.regions["region:coast"].history.at(-1).type, "mode-change");
  assert.deepEqual(restore(snapshot(world)), world);
  assert.throws(
    () => changeRegionSimulationMode(world, {
      expectedRevision: world.revision - 1,
      regionId: "region:coast",
      mode: "aggregate",
    }),
    /stale command/,
  );
});
