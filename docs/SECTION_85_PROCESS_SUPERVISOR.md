# Section 85 — Bounded Local Process Supervision

The operational service now has a tested local process-lifecycle contract. A supervisor starts a child without a shell, waits for an HTTP health response, records failed exits, performs graceful termination with a bounded force-kill fallback, and permits only a finite number of explicit restarts.

## Contract

- child command, arguments, environment, and health endpoint are validated before spawning;
- startup is not considered ready until the configured health endpoint returns `200`;
- unexpected exit becomes `failed`, while intentional shutdown becomes `stopped`;
- shutdown sends `SIGTERM`, waits a bounded interval, and uses a bounded force-kill fallback;
- restarts are explicit and stop after the configured restart budget is exhausted;
- public lifecycle projection omits command, arguments, environment, and health endpoint details.

## Acceptance evidence

`process-supervisor.test.mjs` starts an actual child process, proves health-gated readiness, observes a failed child, restarts it within budget, verifies redaction, drains it, and rejects malformed configuration.

## Boundary

This is a local child-process supervision contract. It is not an OS init system, container orchestrator, cloud scheduler, multi-host watchdog, automatic production failover, service discovery, or SLA/availability acceptance. The child fixture only serves a fictional health endpoint and carries no operational criminal content.
