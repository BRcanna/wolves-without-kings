import test from "node:test";
import assert from "node:assert/strict";

import {
  LogisticsStalePlanError,
  LogisticsStaleRevisionError,
  LogisticsValidationError,
  changeRouteCondition,
  createLogisticsState,
  createRoute,
  executeTransit,
  planTransit,
  projectLogistics,
  restoreLogistics,
  settleLogisticsTime,
  snapshotLogistics,
} from "../src/wolves-without-kings/logistics.mjs";

function routeState() {
  let state = createLogisticsState({ regionId: "region:sofia" });
  state = createRoute(state, {
    expectedRevision: state.revision,
    routeId: "route:sofia-coast-fictional",
    segments: ["urban", "mountain", "coastal"],
    accessRequirements: ["trusted-contact"],
    travelTimeHours: 18,
    weatherCost: 10,
    hazardCost: 15,
    borderState: "open",
    contacts: ["contact:one"],
    coverBusiness: "business:transport-fictional",
    fallbacks: ["route:river-alternate"],
  });
  return state;
}

test("route planning resolves through bounded outcomes and preserves a causal transit record", () => {
  let state = routeState();
  state = planTransit(state, {
    expectedRevision: state.revision,
    routeId: "route:sofia-coast-fictional",
    cargoClass: "fictional-commodity",
    familiarity: 70,
    vehicleFit: 60,
    contactReliability: 80,
    policePressure: 20,
  });
  state = executeTransit(state, { expectedRevision: state.revision, planId: "plan-000001", choice: "proceed" });
  assert.equal(state.transitHistory.at(-1).outcome, "completed");
  assert.equal(state.plans["plan-000001"].status, "completed");
  assert.equal(state.events.at(-1).eventType, "logistics.transit_resolved");
});

test("a changed route invalidates an old plan and requires explicit replanning", () => {
  let state = routeState();
  state = planTransit(state, {
    expectedRevision: state.revision,
    routeId: "route:sofia-coast-fictional",
    cargoClass: "fictional-commodity",
  });
  state = changeRouteCondition(state, {
    expectedRevision: state.revision,
    routeId: "route:sofia-coast-fictional",
    status: "compromised",
    weatherCost: 40,
    hazardCost: 40,
    borderState: "strained",
    reason: "fictional-weather-and-institutional-change",
  });
  assert.throws(
    () => executeTransit(state, { expectedRevision: state.revision, planId: "plan-000001", choice: "proceed" }),
    LogisticsStalePlanError,
  );
  assert.equal(state.plans["plan-000001"].status, "planned");
});

test("time can make a compromised route obsolete, while the public view stays qualitative", () => {
  let state = routeState();
  state = changeRouteCondition(state, {
    expectedRevision: state.revision,
    routeId: "route:sofia-coast-fictional",
    status: "compromised",
    weatherCost: 40,
    hazardCost: 40,
    borderState: "strained",
  });
  state = settleLogisticsTime(state, { expectedRevision: state.revision, days: 30 });
  assert.equal(state.routes["route:sofia-coast-fictional"].status, "obsolete");
  const publicView = projectLogistics(state);
  assert.equal(publicView.routes[0].status, "obsolete");
  assert.equal(publicView.omittedFields.includes("segments"), true);
  assert.equal(publicView.omittedFields.includes("contacts"), true);
});

test("invalid choices, stale writes, and tampered snapshots fail closed", () => {
  const state = routeState();
  assert.throws(
    () => settleLogisticsTime(state, { expectedRevision: state.revision - 1, days: 1 }),
    LogisticsStaleRevisionError,
  );
  assert.throws(
    () => planTransit(state, { expectedRevision: state.revision, routeId: "route:sofia-coast-fictional", cargoClass: "x", familiarity: 101 }),
    LogisticsValidationError,
  );
  assert.deepEqual(restoreLogistics(snapshotLogistics(state)), state);
  assert.throws(
    () => restoreLogistics({ snapshotVersion: 1, state: { ...state, lastEventHash: "tampered" } }),
    LogisticsValidationError,
  );
});
