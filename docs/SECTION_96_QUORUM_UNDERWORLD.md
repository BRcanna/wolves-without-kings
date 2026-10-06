# Section 96 — Quorum Online Underworld Checkpoints

The mirrored online Underworld journals now have a strict-majority checkpoint contract. A modeled shard partition may commit through an available quorum, a partition below quorum fails closed, and a returning stale node can be repaired without selecting a divergent history.

## Contract

- the store requires a strict-majority quorum over at least three named Underworld nodes;
- every committed revision is appended to each currently available node after the state and shard identity pass validation;
- a partition with at least the configured quorum may commit the next revision;
- a partition below quorum rejects the checkpoint without advancing in-memory state;
- shorter returning journals are repaired from the canonical quorum history;
- nodes ahead of or divergent from the quorum history are rejected for manual recovery;
- health output reports quorum availability, authoritative revision/week, journal depth, and repair state.

## Local execution shape

`createQuorumUnderworldStore` accepts independent file-backed journals and toggles node availability to model a partition. The node identifiers represent placement boundaries in the deterministic harness; they do not claim that the current process has established TCP, cross-host membership, election, or production failover.

## Acceptance evidence

`quorum-underworld-store.test.mjs` proves:

1. a three-node store commits with two available nodes;
2. a one-node remainder fails closed without changing authoritative state;
3. a returning stale node is repaired at restart and explicitly on demand;
4. divergent shard history is rejected instead of silently discarded;
5. strict-majority configuration and shard-identity/revision checks fail closed.

## Boundary

This is a deterministic, file-backed online-Underworld quorum contract. It is not proof of TCP or cross-host transport, distributed membership/election, fencing, synchronized clocks, encrypted custody, orchestration, failover timing, SLA availability, anti-cheat, staffed moderation, matchmaking, or production online acceptance. The fiction/safety boundary remains unchanged: the runtime models fictional world consequences and does not encode transferable real-world criminal procedure.
