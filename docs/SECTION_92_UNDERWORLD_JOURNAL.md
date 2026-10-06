# Section 92 — Durable Online Underworld Checkpoints

The bounded online shard now has a durable local checkpoint journal. This gives the shared market, organization, property, session, and season state a restartable persistence boundary without claiming a production database or cross-host service.

## Contract

- underworld snapshots append as newline-delimited records with checkpoint identity, shard metadata, sequence, and a SHA-256 parent chain;
- every checkpoint is restored and validated before append, and appends are fsynced;
- repeating a checkpoint with the same state is idempotent while reusing its identity for a different state fails closed;
- an incomplete final write is reported as a recoverable crash tail, while complete-record or nested-state tampering is rejected;
- latest-checkpoint restore returns the shard state and recovery evidence for the operational layer.

## Acceptance evidence

`underworld-journal.test.mjs` proves two-checkpoint restore, hash chaining, idempotent retry, conflicting reuse rejection, incomplete-tail recovery, and complete-record tamper rejection against the persistent online shard state.

## Boundary

This is a local append-only underworld persistence contract. It is not a production database, multi-process locking protocol, cross-host replication, encrypted storage, failover service, matchmaking system, anti-cheat system, moderation system, availability/load proof, or the full persistent online underworld breadth. The fiction/safety boundary remains unchanged.
