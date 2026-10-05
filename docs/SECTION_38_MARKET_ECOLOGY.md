# Section 38 — Regional market ecology

This episode composes the docuseries’ regional-market volume into a bounded cross-region resource contract.

## Built

- regional supply, demand, inventory, price bands, resilience, transport cost, institutional pressure, and ecological pressure;
- coarse market links with capacity, friction, latency, and restricted/open status;
- bounded cross-region flows that preserve local shortage instead of instantly equalizing distant markets;
- source/sink-accounted shocks and resilience-driven ecological recovery;
- public banded projection with exact price, inventory, legal/faction, and shock history redacted;
- hash-linked snapshots and fail-closed stale, invalid, and tampered writes.

## Acceptance evidence

`npm test` includes `market-ecology.test.mjs`, which proves bounded cross-region flow, independent price shocks, ecological recovery, public redaction, and snapshot integrity.

## Boundary

All commodities, shocks, and links are fictionalized abstractions. This episode does not encode real-world trafficking, procurement, concealment, evasion, or financial-crime procedure.
