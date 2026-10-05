# Section 6 — Regional economy and item provenance

This episode composes the docuseries contracts for regional markets and evidence-bearing objects.

## Implemented contract

- Promoted objects keep stable identity through storage, transfer, evidence seizure, return, damage, and repair.
- Owner, custody, location, evidence, damage, repair, and event-link histories are append-only projections rebuilt from events.
- Regional markets retain supply, demand, inventory, transport friction, legal pressure, faction control, information lag, shock history, and an uncertain price band.
- Demand, supply, transport, and institutional shocks recompute price bands deterministically without hard-coded event outcomes.
- World-time advancement settles market information lag and settlement date through the same transaction as other persistent systems.
- Snapshot restore preserves both provenance and market history.

## Acceptance evidence

`npm test` covers:

- one object moving into property storage, changing owner, entering evidence custody, returning, taking damage, and being repaired without identity loss;
- one regional market responding in sensible directions to independent demand and supply shocks;
- price-band bounds, shock history, information lag, and snapshot/restore behavior.

## Boundary

This remains a deterministic headless economy/provenance slice. It does not claim a real-world market model, financial simulation, police procedure, cultural/legal review, renderer, or online exchange. The market describes fictional scarcity and uncertainty; object history records facts without granting any observer omniscient interpretation.

## Next dependency

Add the evidence-bearing police-case slice, then compose economy, provenance, social state, and cases into the single-player vertical trace.
