import test from "node:test";
import assert from "node:assert/strict";

import {
  FrontsStaleRevisionError,
  FrontsValidationError,
  changeFrontManager,
  createFront,
  createFrontsState,
  projectFronts,
  restoreFronts,
  settleFrontTime,
  snapshotFronts,
} from "../src/wolves-without-kings/fronts.mjs";

function threeBusinesses() {
  let state = createFrontsState({ regionId: "region:sofia" });
  const managers = [
    { managerId: "manager:competent", competence: 90, loyalty: 90, personalIncentive: 20 },
    { managerId: "manager:ordinary", competence: 55, loyalty: 55, personalIncentive: 50 },
    { managerId: "manager:self-serving", competence: 35, loyalty: 20, personalIncentive: 95 },
  ];
  for (let index = 0; index < managers.length; index += 1) {
    state = createFront(state, {
      expectedRevision: state.revision,
      businessId: `business:${index + 1}`,
      sector: "fictional-transport",
      capital: 1000,
      manager: managers[index],
      staffCount: 3,
      criminalDependency: 10,
      debt: 0,
    });
  }
  return state;
}

test("three identical-capital businesses diverge over five years by management quality", () => {
  let state = threeBusinesses();
  state = settleFrontTime(state, { expectedRevision: state.revision, days: 365 * 5 });
  const competent = state.businesses["business:1"];
  const ordinary = state.businesses["business:2"];
  const selfServing = state.businesses["business:3"];
  assert.equal(competent.businessMaturity, "mature");
  assert.ok(competent.legitimateCash > ordinary.legitimateCash);
  assert.ok(selfServing.legitimateCash < competent.legitimateCash);
  assert.ok(selfServing.taxAttention > ordinary.taxAttention);
  assert.equal(competent.criminalDependency, ordinary.criminalDependency);
  assert.equal(competent.capital, ordinary.capital);
});

test("manager turnover changes future business outcomes without changing the business identity", () => {
  let state = threeBusinesses();
  state = settleFrontTime(state, { expectedRevision: state.revision, days: 180 });
  const before = state.businesses["business:2"].legitimateCash;
  state = changeFrontManager(state, {
    expectedRevision: state.revision,
    businessId: "business:2",
    manager: { managerId: "manager:competent", competence: 90, loyalty: 90, personalIncentive: 20 },
  });
  state = settleFrontTime(state, { expectedRevision: state.revision, days: 180 });
  assert.equal(state.businesses["business:2"].id, "business:2");
  assert.ok(state.businesses["business:2"].legitimateCash > before);
  assert.equal(state.events.at(-2).eventType, "front.manager_changed");
});

test("public front projection separates legitimate maturity from private financial and political detail", () => {
  const state = threeBusinesses();
  const projected = projectFronts(state);
  assert.equal(projected.businesses.length, 3);
  assert.equal(projected.omittedFields.includes("legitimateCash"), true);
  assert.equal(projected.omittedFields.includes("politicalConnections"), true);
  assert.equal(projected.omittedFields.includes("manager competence"), true);
});

test("stale writes, invalid managers, and tampered snapshots fail closed", () => {
  const state = threeBusinesses();
  assert.throws(
    () => settleFrontTime(state, { expectedRevision: state.revision - 1, days: 1 }),
    FrontsStaleRevisionError,
  );
  assert.throws(
    () => changeFrontManager(state, { expectedRevision: state.revision, businessId: "business:1", manager: { managerId: "bad", competence: 101 } }),
    FrontsValidationError,
  );
  assert.deepEqual(restoreFronts(snapshotFronts(state)), state);
  assert.throws(
    () => restoreFronts({ snapshotVersion: 1, state: { ...state, lastEventHash: "tampered" } }),
    FrontsValidationError,
  );
});
