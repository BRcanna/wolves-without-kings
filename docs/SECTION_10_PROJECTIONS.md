# Section 10 — Renderer-facing and online-safe projections

This episode makes projection scope explicit at the boundary between canonical state and presentation/transport.

## Implemented contract

- `projectWorld(..., { scope: "public" })` exposes bounded district, business, market, and object summaries.
- `scope: "observer"` exposes only that observer's beliefs, surveillance records, relationship summaries, and qualitative self-skill tiers.
- `scope: "institutional"` exposes only an attached agency's jurisdiction, known evidence, known witnesses, legal stage, and authorized actions.
- `scope: "debug"` is explicit and local-only for inspection and test tooling.
- Public and private projections omit raw hidden practice, private beliefs, global case confidence, full agency views, and server-only surveillance state.
- Missing actor scope fails closed instead of falling back to omniscient state.

## Acceptance evidence

`npm test` passes 26 tests, including projection tests that compare public, observer, institutional, and debug scopes and verify privacy omissions.

## Online boundary

The repository now has a tested projection boundary, not an online service. Online persistence, authority transport, anti-cheat, reconnect/reconciliation, moderation, and production security remain external implementation and operational gates.

## Next dependency

Audit the remaining docuseries action families and add only bounded, testable headless contracts where they advance the single-player authority path.
