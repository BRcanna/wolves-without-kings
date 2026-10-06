import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateAvailabilityReport,
  runAvailabilityProbe,
} from "../src/wolves-without-kings/availability-probe.mjs";

test("availability probe reports bounded latency and successful synthetic work", async () => {
  const report = await runAvailabilityProbe({
    requestCount: 8,
    concurrency: 3,
    request: async ({ index }) => ({ status: 200, durationMs: index % 2 === 0 ? 2 : 4 }),
  });
  assert.equal(report.acceptedCount, 8);
  assert.equal(report.overloadedCount, 0);
  assert.equal(report.failedCount, 0);
  assert.equal(report.latencyMs.p95, 4);
  assert.deepEqual(evaluateAvailabilityReport(report, { maxP95Ms: 4, maxFailureRate: 0, maxOverloadRate: 0 }), { accepted: true, failureRate: 0, overloadRate: 0, failures: [] });
});

test("availability probe distinguishes expected overload from failures", async () => {
  const report = await runAvailabilityProbe({
    requestCount: 5,
    concurrency: 2,
    request: async ({ index }) => ({ status: index < 2 ? 503 : 200, durationMs: 1 }),
  });
  assert.equal(report.overloadedCount, 2);
  assert.equal(report.failedCount, 0);
  assert.equal(evaluateAvailabilityReport(report, { maxP95Ms: 1, maxFailureRate: 0, maxOverloadRate: 0.4 }).accepted, true);
  assert.equal(evaluateAvailabilityReport(report, { maxP95Ms: 1, maxFailureRate: 0, maxOverloadRate: 0.2 }).accepted, false);
});

test("availability probe captures thrown request failures and reports budget violations", async () => {
  const report = await runAvailabilityProbe({
    requestCount: 3,
    concurrency: 2,
    request: async ({ index }) => {
      if (index === 1) throw new Error("synthetic transport failure");
      return { status: 500, durationMs: 8 };
    },
  });
  assert.equal(report.failedCount, 3);
  assert.equal(report.outcomes[1].error, "synthetic transport failure");
  const evaluation = evaluateAvailabilityReport(report, { maxP95Ms: 4, maxFailureRate: 0, maxOverloadRate: 1 });
  assert.equal(evaluation.accepted, false);
  assert.deepEqual(evaluation.failures, ["p95 latency exceeds budget", "failure rate exceeds budget"]);
});
