import test from "node:test";
import assert from "node:assert/strict";

import {
  MarketEcologyStaleRevisionError,
  MarketEcologyValidationError,
  applyMarketEcologyShock,
  connectEcologyMarkets,
  createMarketEcologyState,
  projectMarketEcology,
  registerEcologyMarket,
  restoreMarketEcology,
  settleMarketEcology,
  snapshotMarketEcology,
} from "../src/wolves-without-kings/market-ecology.mjs";

function fixture() {
  let state = createMarketEcologyState();
  state = registerEcologyMarket(state, { expectedRevision: state.revision, marketId: "market:capital", regionId: "region:capital", commodity: "nightlife-demand", supply: 70, demand: 45, inventory: 180, resilience: 65 });
  state = registerEcologyMarket(state, { expectedRevision: state.revision, marketId: "market:coast", regionId: "region:coast", commodity: "nightlife-demand", supply: 35, demand: 70, inventory: 40, resilience: 35 });
  state = connectEcologyMarkets(state, { expectedRevision: state.revision, linkId: "link:capital-coast", fromMarketId: "market:capital", toMarketId: "market:coast", capacity: 30, friction: 35, latencyDays: 3 });
  return state;
}

test("regional markets remain distinct and bounded links do not erase a distant shortage instantly", () => {
  const state = settleMarketEcology(fixture(), { expectedRevision: 3, days: 30 });
  assert.ok(state.markets["market:capital"].inventory < 180);
  assert.ok(state.markets["market:coast"].inventory > 40);
  assert.ok(state.markets["market:coast"].demand > state.markets["market:coast"].supply);
  assert.equal(state.events.at(-1).eventType, "market.time_settled");
});

test("independent shocks move price ecology and retain source/sink accounting", () => {
  let state = fixture();
  const before = projectMarketEcology(state, { scope: "debug" }).markets.find((market) => market.id === "market:coast").exactPrice.midpoint;
  state = applyMarketEcologyShock(state, {
    expectedRevision: state.revision,
    marketId: "market:coast",
    source: "weather-shock",
    sink: "coastal-inventory",
    supplyDelta: -25,
    demandDelta: 20,
    inventoryDelta: -30,
    ecologicalDelta: 15,
  });
  const after = projectMarketEcology(state, { scope: "debug" }).markets.find((market) => market.id === "market:coast").exactPrice.midpoint;
  assert.ok(after > before);
  assert.equal(state.markets["market:coast"].shockHistory.at(-1).source, "weather-shock");
  assert.equal(state.markets["market:coast"].shockHistory.at(-1).sink, "coastal-inventory");
});

test("ecological pressure recovers through resilience while public views remain banded", () => {
  let state = fixture();
  state = applyMarketEcologyShock(state, { expectedRevision: state.revision, marketId: "market:coast", source: "seasonal-fire", ecologicalDelta: 30 });
  const pressured = state.markets["market:coast"].ecologicalPressure;
  state = settleMarketEcology(state, { expectedRevision: state.revision, days: 365 });
  assert.ok(state.markets["market:coast"].ecologicalPressure < pressured);
  const publicView = projectMarketEcology(state);
  assert.equal(Object.hasOwn(publicView.markets[1], "exactPrice"), false);
});

test("market ecology rejects stale and invalid writes before mutation", () => {
  const state = fixture();
  assert.throws(() => applyMarketEcologyShock(state, { expectedRevision: state.revision - 1, marketId: "market:coast", source: "stale" }), MarketEcologyStaleRevisionError);
  assert.throws(() => connectEcologyMarkets(state, { expectedRevision: state.revision, linkId: "link:bad", fromMarketId: "market:coast", toMarketId: "market:missing" }), MarketEcologyValidationError);
  assert.equal(Object.hasOwn(state.links, "link:bad"), false);
});

test("market ecology snapshots preserve event history and reject tampering", () => {
  const state = fixture();
  assert.deepEqual(restoreMarketEcology(snapshotMarketEcology(state)), state);
  assert.throws(() => restoreMarketEcology({ snapshotVersion: 1, state: { ...state, lastEventHash: "tampered" } }), MarketEcologyValidationError);
});
