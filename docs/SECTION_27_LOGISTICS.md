# Section 27 — Abstract smuggling logistics and route networks

This episode composes docuseries Volume 20 into an executable, persistence-tested route-planning boundary.

## Built

- fictional routes retain coarse segments, access requirements, travel-time bands, weather cost, hazard cost, border state, contact slots, fallback count, and a version;
- planning derives a bounded risk band from route state, familiarity, vehicle fit, contact reliability, and institutional pressure;
- proceeding, delaying, rerouting, or cancelling produces explicit outcomes rather than hidden success/failure;
- a route condition change increments its version and rejects an old transit plan until the player explicitly replans;
- compromised routes can become obsolete through time settlement;
- public projection exposes only route status, travel-time band, risk band, border state, and fallback count while omitting segments, contacts, cover business, cargo, exact costs, scores, and event internals;
- hash-linked snapshots preserve the causal history and reject stale or tampered writes.

## Acceptance evidence

`npm test` includes `logistics.test.mjs`, which proves bounded transit outcomes, stale-plan rejection, route aging, public redaction, invalid input handling, and snapshot integrity.

## Boundary

Routes and cargo are fictionalized labels. This episode does not encode real-world geography, concealment, border evasion, trafficking, contact handling, or operational procedure.
