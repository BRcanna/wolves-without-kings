import test from "node:test";
import assert from "node:assert/strict";

import {
  PerformanceStaleRevisionError,
  PerformanceValidationError,
  createPerformanceState,
  projectPerformance,
  rebalancePerformance,
  recordStressReport,
  registerPerformanceEntity,
  restorePerformance,
  snapshotPerformance,
  updatePerformanceInterest,
} from "../src/wolves-without-kings/performance.mjs";

function performanceState() {
  let state = createPerformanceState({ budgets: { maxFullEntities: 2, maxPromotedEntities: 1, simulationMs: 8, networkMs: 4, frameMs: 16.67 } });
  for (const entity of [
    { entityId: "npc:important", importance: 90, distanceBand: "distant", networkInterest: 10 },
    { entityId: "npc:local", importance: 20, distanceBand: "local", networkInterest: 10 },
    { entityId: "npc:near", importance: 40, distanceBand: "near", networkInterest: 20 },
    { entityId: "npc:background", importance: 10, distanceBand: "distant", networkInterest: 0 },
  ]) {
    state = registerPerformanceEntity(state, { expectedRevision: state.revision, ...entity });
  }
  return state;
}

test("deterministic rebalance promotes important entities, fills local fidelity, and aggregates background state", () => {
  let state = performanceState();
  state = rebalancePerformance(state, { expectedRevision: state.revision });
  assert.equal(state.entities["npc:important"].aiTier, "promoted");
  assert.equal(state.entities["npc:local"].simulationMode, "full");
  assert.equal(state.entities["npc:background"].simulationMode, "aggregate");
  const projected = projectPerformance(state);
  assert.equal(projected.counts.promoted, 1);
  assert.equal(projected.counts.full, 3);
});

test("interest changes are evented and can promote a distant entity without changing its identity", () => {
  let state = performanceState();
  state = updatePerformanceInterest(state, {
    expectedRevision: state.revision,
    entityId: "npc:important",
    importance: 20,
    reason: "active-case-closed",
  });
  state = updatePerformanceInterest(state, {
    expectedRevision: state.revision,
    entityId: "npc:background",
    importance: 85,
    reason: "active-case",
  });
  state = rebalancePerformance(state, { expectedRevision: state.revision, reason: "active-case" });
  assert.equal(state.entities["npc:background"].id, "npc:background");
  assert.equal(state.entities["npc:background"].aiTier, "promoted");
  assert.equal(state.entities["npc:background"].promotionReason, "importance");
});

test("stress reports keep renderer, simulation, and network budgets separate", () => {
  let state = performanceState();
  state = recordStressReport(state, {
    expectedRevision: state.revision,
    population: 3000,
    organizationCount: 120,
    marketEvents: 40,
    localCombatEvents: 2,
    rendererMs: 12,
    simulationMs: 7,
    networkMs: 5,
  });
  const report = state.stressReports.at(-1);
  assert.equal(report.rendererWithinBudget, true);
  assert.equal(report.simulationWithinBudget, true);
  assert.equal(report.networkWithinBudget, false);
  assert.equal(report.separateBudgets, true);
});

test("stale/invalid writes and tampered performance snapshots fail closed", () => {
  const state = performanceState();
  assert.throws(
    () => rebalancePerformance(state, { expectedRevision: state.revision - 1 }),
    PerformanceStaleRevisionError,
  );
  assert.throws(
    () => updatePerformanceInterest(state, { expectedRevision: state.revision, entityId: "npc:missing", importance: 20 }),
    PerformanceValidationError,
  );
  assert.deepEqual(restorePerformance(snapshotPerformance(state)), state);
  assert.throws(
    () => restorePerformance({ snapshotVersion: 1, state: { ...state, lastEventHash: "tampered" } }),
    PerformanceValidationError,
  );
});
