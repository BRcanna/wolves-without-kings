# Section 80 — Authority Coordination and Fencing

Quorum persistence protects durable state, but it does not by itself decide which node may accept mutations. This section adds a local coordination contract for expiring authority leases and fencing tokens.

## Contract

- named coordination nodes register with active/suspended status;
- a strict lease has a monotonically increasing term and unique fencing token;
- lease renewal requires the current leader, live lease, and exact fencing token;
- handoff increments the term and changes the fence before the new leader can proceed;
- expired leases can be acquired by another active node;
- stale tokens, suspended nodes, wrong leaders, and expired leases fail closed;
- coordination history is hash-chained, restorable, and publicly projected without lease expiry or fence material.

## Acceptance evidence

`authority-coordination.test.mjs` proves acquisition, renewal, handoff, stale-token rejection, expiry takeover, suspended-node rejection, snapshot restore, tamper rejection, and public redaction.

## Boundary

This is a deterministic local lease/fencing contract. It is not a distributed consensus implementation, network membership/election service, clock synchronization system, process supervisor, cross-host transport, failover timing proof, or production availability acceptance. The fiction/safety boundary remains unchanged.
