export const AVAILABILITY_PROBE_SCHEMA_VERSION = 1;

export class AvailabilityProbeValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AvailabilityProbeValidationError";
  }
}

function assertInteger(value, field, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) throw new AvailabilityProbeValidationError(`${field} must be an integer >= ${minimum}`);
}

function assertNumber(value, field, minimum = 0) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum) throw new AvailabilityProbeValidationError(`${field} must be a finite number >= ${minimum}`);
}

function percentile(values, fraction) {
  if (values.length === 0) return 0;
  const index = Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1);
  return values[index];
}

function summarizeDurations(outcomes) {
  const durations = outcomes.map((outcome) => outcome.durationMs).sort((left, right) => left - right);
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  return {
    min: durations[0] ?? 0,
    p50: percentile(durations, 0.5),
    p95: percentile(durations, 0.95),
    max: durations.at(-1) ?? 0,
    mean: durations.length > 0 ? Number((total / durations.length).toFixed(3)) : 0,
  };
}

export async function runAvailabilityProbe({ request, requestCount = 1, concurrency = 1, now = () => performance.now() } = {}) {
  if (typeof request !== "function") throw new AvailabilityProbeValidationError("request must be a function");
  assertInteger(requestCount, "requestCount", 1);
  assertInteger(concurrency, "concurrency", 1);
  if (typeof now !== "function") throw new AvailabilityProbeValidationError("now must be a function");
  const outcomes = new Array(requestCount);
  let nextIndex = 0;
  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= requestCount) return;
      const startedAt = now();
      try {
        const result = await request({ index });
        const measuredDuration = result?.durationMs ?? now() - startedAt;
        assertNumber(measuredDuration, `request ${index} durationMs`);
        const status = result?.status;
        assertInteger(status, `request ${index} status`, 100);
        outcomes[index] = { index, status, durationMs: measuredDuration, accepted: status < 500, overloaded: status === 503, error: null };
      } catch (error) {
        const measuredDuration = now() - startedAt;
        assertNumber(measuredDuration, `request ${index} durationMs`);
        outcomes[index] = { index, status: null, durationMs: measuredDuration, accepted: false, overloaded: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, requestCount) }, () => worker()));
  const acceptedCount = outcomes.filter((outcome) => outcome.accepted).length;
  const overloadedCount = outcomes.filter((outcome) => outcome.overloaded).length;
  const failedCount = outcomes.filter((outcome) => !outcome.accepted && !outcome.overloaded).length;
  return {
    schemaVersion: AVAILABILITY_PROBE_SCHEMA_VERSION,
    requestCount,
    concurrency: Math.min(concurrency, requestCount),
    acceptedCount,
    overloadedCount,
    failedCount,
    outcomes,
    latencyMs: summarizeDurations(outcomes),
  };
}

export function evaluateAvailabilityReport(report, { maxP95Ms, maxFailureRate = 0, maxOverloadRate = 1 } = {}) {
  if (!report || report.schemaVersion !== AVAILABILITY_PROBE_SCHEMA_VERSION) throw new AvailabilityProbeValidationError("invalid availability report");
  assertNumber(maxP95Ms, "maxP95Ms");
  assertNumber(maxFailureRate, "maxFailureRate");
  assertNumber(maxOverloadRate, "maxOverloadRate");
  if (maxFailureRate > 1 || maxOverloadRate > 1) throw new AvailabilityProbeValidationError("rate thresholds must be <= 1");
  const failureRate = report.requestCount === 0 ? 0 : report.failedCount / report.requestCount;
  const overloadRate = report.requestCount === 0 ? 0 : report.overloadedCount / report.requestCount;
  const failures = [];
  if (report.latencyMs.p95 > maxP95Ms) failures.push("p95 latency exceeds budget");
  if (failureRate > maxFailureRate) failures.push("failure rate exceeds budget");
  if (overloadRate > maxOverloadRate) failures.push("overload rate exceeds budget");
  return { accepted: failures.length === 0, failureRate, overloadRate, failures };
}
