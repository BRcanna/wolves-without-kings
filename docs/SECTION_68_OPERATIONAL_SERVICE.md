# Section 68 — Operational service lifecycle

Status: built as a bounded local operations slice.

## Implemented

- `operational-http-service.mjs` wraps the secure authority handler with `/health` liveness and `/ready` readiness responses;
- the wrapper caps active requests and returns a redacted overload response before invoking authority logic;
- draining rejects new application traffic while allowing active work to finish, then reports whether the active set reached zero;
- `npm run serve:operational-authority` provides an environment-configured local launch path with token, optional TLS, in-flight, and drain-timeout settings.

## Acceptance evidence

- `operational-http-service.test.mjs` proves readiness, authenticated normal traffic, overload rejection, graceful drain, active-request completion, and authority continuity;
- `npm run verify` checks the new acceptance evidence and contiguous build history.

## Boundary

This is a local lifecycle and back-pressure contract, not production load testing, autoscaling, process supervision, failover, durable queueing, multi-host coordination, SLA evidence, or availability acceptance. It preserves the fictional and safety boundary of the simulation.
