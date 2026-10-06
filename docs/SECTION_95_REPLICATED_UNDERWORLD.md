# Section 95 — Mirrored Online Underworld Checkpoints

The local online shard now maintains two independently readable checkpoint journals. Startup repairs a missing or shorter copy from the surviving valid history and rejects divergent history before the shard is admitted.

## Contract

- initial and committed underworld checkpoints are written to primary and replica journals;
- startup validates shared hash-chain prefixes, repairs a missing or shorter copy, and restores from the longer valid history;
- a divergent replica, same-path configuration, or invalid checkpoint state fails closed;
- the store exposes mirrored journal evidence while leaving the canonical underworld state behind a cloned boundary;
- the implementation is intentionally same-process and same-host so cross-host transport and production failover are not implied.

## Acceptance evidence

`replicated-underworld-store.test.mjs` proves mirrored checkpoints, missing-primary recovery, stale-copy repair, divergent-history rejection, same-path rejection, and invalid-state rejection.

## Boundary

This is a same-process, same-host mirrored online-shard checkpoint contract. It is not cross-host replication, quorum consensus, network partition recovery, encrypted custody, orchestration, failover timing, matchmaking, anti-cheat, moderation, availability/load proof, or full persistent online Underworld breadth. The fiction/safety boundary remains unchanged.
