# Section 34 — Authority recovery and idempotent retry

This episode closes the executable recovery gap in the docuseries without claiming a production socket, database, TLS, or failover deployment.

## Built

- authority state snapshots can be restored before accepting new input;
- a client retry after simulated packet loss is recognized as a duplicate by session sequence, not applied twice;
- the next ordered input after restart is accepted against the restored authoritative revision;
- existing stale revision, unique-object lease, reconnect, redaction, and tamper tests remain part of the same contract.

## Acceptance evidence

`npm test` includes the authority-network recovery test, which restores a snapshot, retries the lost input, proves no duplicate mutation, and accepts the next sequence.

## Boundary

This is an in-process recovery/idempotency contract. Production transport, authentication, encryption, persistence durability, failover, moderation, and availability remain external gates.
