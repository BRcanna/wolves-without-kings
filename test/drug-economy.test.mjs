import test from "node:test";
import assert from "node:assert/strict";

import {
  DrugEconomyStaleRevisionError,
  DrugEconomyValidationError,
  applySupplyShock,
  createDrugEconomyState,
  createFictionalBatch,
  createProductMarket,
  projectDrugEconomy,
  restoreDrugEconomy,
  settleDrugTime,
  snapshotDrugEconomy,
} from "../src/wolves-without-kings/drug-economy.mjs";

function marketState() {
  let state = createDrugEconomyState({ regionId: "region:sofia" });
  state = createProductMarket(state, {
    expectedRevision: state.revision,
    productClass: "fictional-stimulant",
    sourceRegion: "region:mountain",
    destinationRegion: "region:sofia",
    basePrice: 100,
    supply: 100,
    demand: 90,
    qualityBand: "mixed",
    healthExternality: "high",
  });
  return state;
}

test("a 30 percent supply shock raises scarcity without invisible replacement stock", () => {
  let state = marketState();
  state = createFictionalBatch(state, {
    expectedRevision: state.revision,
    batchId: "batch:fictional-1",
    productClass: "fictional-stimulant",
    quantity: 20,
    distributionRole: "abstract-wholesale",
    organizationId: "organization:lanterns",
  });
  const before = state.markets["fictional-stimulant"].supply;
  state = applySupplyShock(state, {
    expectedRevision: state.revision,
    productClass: "fictional-stimulant",
    percent: 30,
    shockType: "seizure",
  });
  assert.equal(state.markets["fictional-stimulant"].supply, before - 24);
  assert.equal(state.batches["batch:fictional-1"].status, "available");
  assert.equal(state.reputationEffects.at(-1).effect, "institutional-pressure");
  assert.equal(state.healthExternalities.communityBand, "moderate");
  const projected = projectDrugEconomy(state);
  assert.ok(projected.markets[0].priceBand.midpoint > 100);
  assert.equal(projected.omittedFields.includes("exact quantities"), true);
});

test("organization policy can prohibit a product class without exposing operational procedure", () => {
  let state = createDrugEconomyState({ regionId: "region:sofia" });
  state = createProductMarket(state, {
    expectedRevision: state.revision,
    productClass: "fictional-sedative",
    sourceRegion: "region:coastal",
    basePrice: 120,
    organizationPolicy: "forbidden",
  });
  assert.throws(
    () => createFictionalBatch(state, {
      expectedRevision: state.revision,
      batchId: "batch:forbidden",
      productClass: "fictional-sedative",
      quantity: 1,
    }),
    /forbids/,
  );
  assert.equal(Object.keys(state.batches).length, 0);
});

test("time settlement carries high externality into long-horizon community stress", () => {
  let state = marketState();
  state = applySupplyShock(state, {
    expectedRevision: state.revision,
    productClass: "fictional-stimulant",
    percent: 30,
    shockType: "loss",
  });
  state = settleDrugTime(state, { expectedRevision: state.revision, days: 365 });
  assert.equal(state.healthExternalities.familyStressBand, "moderate");
  assert.equal(state.simulationDate, "1999-01-01");
});

test("stale mutations and tampered snapshots fail closed", () => {
  const state = marketState();
  assert.throws(
    () => settleDrugTime(state, { expectedRevision: state.revision - 1, days: 1 }),
    DrugEconomyStaleRevisionError,
  );
  assert.deepEqual(restoreDrugEconomy(snapshotDrugEconomy(state)), state);
  assert.throws(
    () => restoreDrugEconomy({ snapshotVersion: 1, state: { ...state, lastEventHash: "tampered" } }),
    DrugEconomyValidationError,
  );
});
