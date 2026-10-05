# Section 45 — Order-independent event projection fan-out

This section adds a projection-only event layer over committed engine events. It accepts events in any delivery order, deduplicates retries, rejects conflicting duplicate IDs, rebuilds deterministic family/subject summaries, and emits a qualitative public projection without event payloads or actor details.

## Implemented contract

- Events remain committed facts owned by the authoritative engine; the fan-out layer stores projections, not new world truth.
- Delivery order does not affect derived summaries because the event set is rebuilt in source-revision order.
- A repeated identical event is idempotent; a reused event ID with different content fails closed.
- Social, case, vehicle, and other event families produce separate activity summaries.
- Snapshot restoration verifies both the source event set and its derived projection.
- Public output exposes only qualitative family/subject activity and source revision.

## Acceptance evidence

- `event-projections.test.mjs` proves order independence, idempotent delivery, conflicting-duplicate rejection, qualitative public output, and snapshot integrity.

## Boundary

This is a local projection/fan-out contract. It does not replace authoritative mutation, provide a message broker, claim network delivery guarantees, or expose private evidence and actor payloads to clients.
