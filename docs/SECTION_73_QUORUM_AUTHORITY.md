# Section 73 — Quorum Authority and Partition Contract

The same-host mirror from Section 71 proves that two local journals can agree, but it does not define what happens when authority nodes cannot all see one another. This section adds a deterministic quorum contract around independently persisted authority journals.

## Contract

- the service requires a strict-majority quorum over at least three named authority nodes;
- every committed authority revision is checkpointed on every currently available node after the request passes the authority service;
- a partition with at least the configured quorum may continue committing revisions;
- a partition below quorum returns a retryable `503` response and does not advance in-memory authority state;
- a returning node is marked stale until its journal is explicitly repaired from the canonical quorum history;
- a node whose complete journal diverges from the quorum history is rejected instead of being silently discarded;
- health output reports quorum availability, authoritative revision, node journal depth, and repair state.

## Local execution shape

`createQuorumAuthorityService` accepts file-backed node journals and a quorum size. Tests toggle node availability to model a partition, submit ordered authority requests through the existing service boundary, and then rejoin and repair a stale node. The node identifiers represent independent authority placements in the harness; they do not claim that the current process has established a real network connection to another host.

## Acceptance evidence

`quorum-authority-service.test.mjs` proves:

1. a three-node service commits with two available nodes;
2. a one-node remainder fails closed without changing the authoritative revision;
3. a returning stale node repairs to the committed checkpoint history;
4. a split-brain journal is rejected even when another history has a majority;
5. a non-majority quorum configuration is rejected at startup.

## Boundary

This is a deterministic, file-backed authority protocol contract. It is not proof of TCP or cross-host transport, leader election, membership changes, fencing, clock failure handling, encrypted replication, orchestration, load behavior, failover timing, SLA availability, or production online acceptance. The fiction boundary remains unchanged: the runtime models fictional world consequences and does not encode transferable real-world criminal procedure.
