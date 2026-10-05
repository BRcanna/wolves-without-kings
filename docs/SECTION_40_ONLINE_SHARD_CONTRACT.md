# Section 40 — Bounded persistent online shard contract

This episode extends the existing one-week Underworld macro proof with an explicit in-process shard/session boundary.

## Built

- bounded player session join/leave state that does not delete persistent property ownership;
- NPC baseline population/liquidity records so player activity cannot become the only economic actor;
- weekly player market influence caps with source attribution and reset at shard settlement;
- shared macro projection for markets, NPC baseline bands, organizations, properties, and active-session count;
- existing offline organization work, market settlement, bounded physical sessions, conflict, and snapshot contracts remain intact.

## Acceptance evidence

`npm test` includes the online shard tests, which prove session continuity, property survival, NPC baseline liquidity, capped player influence, weekly reset, and public redaction.

## Boundary

This is an in-process shard contract. Production sockets, authentication, encryption, persistence durability, moderation operations, anti-cheat, failover, service availability, and real deployment remain open gates.
