# Online boundary

The current repository is single-player with a tested in-process authority contract. Its online boundary is explicit:

- canonical mutations remain revision-bound and evented;
- ordered client intents, unique-object ownership, leases, disconnect settlement, reconnect metadata, and redacted reconciliation are implemented in-process only;
- public, observer, and institutional projections are scope-filtered;
- public transport does not include hidden practice, private beliefs, global case confidence, full agency views, or server-only surveillance records;
- `debug` projection is for local inspection only and is not a network payload;
- online authority, transport encryption, reconnect/reconciliation, anti-cheat, moderation, persistence operations, and availability are not claimed as implemented.

This boundary is a safety and evidence statement, not a promise of multiplayer support.
