# Online boundary

The current repository is single-player with a tested in-process authority contract. Its online boundary is explicit:

- canonical mutations remain revision-bound and evented;
- ordered client intents, unique-object ownership, leases, disconnect settlement, reconnect metadata, and redacted reconciliation are implemented in-process only;
- public, observer, and institutional projections are scope-filtered;
- public transport does not include hidden practice, private beliefs, global case confidence, full agency views, or server-only surveillance records;
- `debug` projection is for local inspection only and is not a network payload;
- a local secure-service adapter now provides bearer-token admission, an optional TLS-required configuration, and pre-mutation moderation hold/deny hooks; token custody, certificate issuance/rotation, account identity, deployment, and operations remain external gates.
- a local operational wrapper now exposes liveness/readiness state, bounded in-flight admission, and graceful drain behavior; this is lifecycle evidence, not a load, failover, or availability guarantee.
- online authority, anti-cheat, durable moderation operations, persistence operations, and availability are not claimed as implemented.

This boundary is a safety and evidence statement, not a promise of multiplayer support.
