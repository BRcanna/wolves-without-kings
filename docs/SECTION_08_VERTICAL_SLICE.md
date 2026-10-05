# Section 8 — Single-player vertical slice

This episode composes the existing systems into the bounded Volume 49 proof: one fictionalized South Sofia district, persistent residents, businesses, organizations, a market, a provenance-bearing vehicle, and one evidence-bearing case.

## Implemented contract

- The fixture creates 30 persistent NPCs with routine blocks and needs.
- Eight player relationships carry shared history and age through a full year.
- Three businesses age through the same world-time transaction.
- Two competing organizations own dependency-ordered work graphs.
- One regional market and one provenance-bearing vehicle remain part of the same history.
- One police case opens with explicit agency authority and ages to a cold case when weak evidence remains weak.
- Relationship-first, organization-first, and quiet-market histories all reach the year-one endpoint without bespoke mission rails.
- Snapshot restore reproduces the year-one state exactly.

## Acceptance evidence

`npm test` passes 22 tests, including `vertical-slice.test.mjs`:

- three radically different histories reach `1999-01-01`;
- each history contains 30 NPCs, 3 businesses, 2 organizations, 1 market, and 1 case;
- business age, NPC life days, relationship age, case stage, and provenance ownership remain inspectable;
- the organization history survives full-year snapshot/restore.

## Boundary

This is a deterministic headless single-player proof. It does not claim a renderer, animation, authored dialogue, production performance, online persistence, or real-world criminal procedure. Scenario labels describe fictional state transitions rather than transferable operational instructions.

## Next dependency

Add a bounded action/surveillance interaction layer and a renderer-facing projection, then audit the online boundary without exposing private beliefs, hidden competence, case confidence, or anti-cheat state.
