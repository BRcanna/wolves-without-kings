# Section 83 — Loopback Authority Cluster Transport and Membership

The coordinated authority service now has a real HTTP-shaped multi-node harness. Each member binds an independent loopback HTTP server, the client uses `fetch` to reach the elected leader, follower mutation requests are rejected, and leader loss can be followed by a quorum-checked lease election after expiry.

## Contract

- membership records node status, endpoint registration, heartbeats, monotonic terms, and the elected leader in a hash-chained local history;
- each cluster member is an independent HTTP listener, so transport failures are observable rather than represented only by an in-process availability flag;
- mutation traffic is routed to the current leader and carries that leader’s current fencing admission through the coordinated authority service;
- direct mutation requests to a follower return a bounded `not_current_leader` response instead of mutating state;
- a stopped leader produces a transport-unavailable response, and a replacement leader can be elected only with active-member quorum and an expired prior lease;
- membership snapshots restore their event chain and public health omits endpoints, event hashes, and fencing material.

## Acceptance evidence

`authority-cluster.test.mjs` starts three actual loopback HTTP servers, proves leader-only mutation routing, exercises transport loss and lease-expiry election, checks history continuity after recovery, and verifies membership snapshot restoration/redaction.

## Boundary

This is a real local HTTP transport and deterministic membership/election harness. It is not a production cross-host deployment, distributed consensus implementation, clock-synchronization proof, service discovery system, TLS/mTLS operation, process supervisor, load/failover/SLA acceptance, or cloud orchestration. Endpoints and election state exist in one local process for executable evidence; production network and infrastructure gates remain recorded separately. Fictional IDs, regions, and authority outcomes remain non-operational abstractions.
