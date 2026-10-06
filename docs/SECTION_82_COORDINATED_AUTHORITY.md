# Section 82 — Coordinated Quorum Authority

Sections 73 and 80 separately define quorum persistence and authority fencing. This section composes them into one local service contract so a durable node quorum and a valid leader lease are both required before an authority mutation can proceed.

## Contract

- the service starts with named quorum nodes and an explicit fenced leader;
- mutation requests require the current leader’s exact fencing token and an available leader node;
- handoff increments the coordination term and invalidates the previous leader token;
- a leader partition below quorum returns the underlying retryable quorum failure without advancing authority state;
- a leader that is unavailable is rejected before authority logic runs;
- health projection reports quorum and qualitative coordination state without exposing fence tokens;
- reads of `/health` remain available without a mutation claim.

## Acceptance evidence

`coordinated-authority-service.test.mjs` proves fenced leader admission, handoff invalidation, unavailable-leader rejection, no-quorum preservation, and redacted combined health projection.

## Boundary

This is an in-process composition of local quorum and fencing contracts. It is not real cross-host transport, distributed election/membership, clock coordination, process supervision, network partition recovery, or production failover/availability acceptance. The fiction/safety boundary remains unchanged.
