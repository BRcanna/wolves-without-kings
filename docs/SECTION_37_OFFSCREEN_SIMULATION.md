# Section 37 — Offscreen and aggregate simulation

This episode composes the docuseries’ offscreen-simulation volume into a deterministic Full/Aggregate contract.

## Built

- full regions advance individual-tick continuity while aggregate regions advance bounded summaries;
- important named entities remain promoted when their region is aggregated;
- scheduled regional events materialize deterministically after elapsed time;
- aggregate regions reconcile into full mode with explicit uncertainty where witness detail was never tracked;
- public projection exposes continuity bands while omitting materialization seeds, exact event payloads, and private history;
- hash-linked snapshots and fail-closed stale, invalid, and tampered writes.

## Acceptance evidence

`npm test` includes `offscreen.test.mjs`, which settles full and aggregate regions, resolves a scheduled event, materializes the aggregate region, proves public redaction, and restores the event history.

## Boundary

This is a deterministic headless aggregate contract. It is not proof of a production streaming scheduler, crowd simulation, server scale, exact witness reconstruction, or online availability.
