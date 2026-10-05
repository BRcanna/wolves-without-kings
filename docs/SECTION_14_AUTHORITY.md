# Section 14 — In-process authority and replication contract

## Purpose

Section 14 makes the docuseries authority rules executable without pretending that a production network service already exists. The contract is pure, deterministic state transition code that can run in-process beside the single-player authority path and later sit behind a transport adapter.

## Authority rules

- A session is admitted with a stable client, character, role, and region.
- A client sends an intent with a base revision and monotonically increasing input sequence. It does not send an outcome, damage value, ownership result, price, confidence, or server state.
- The resolver is server-side. It returns a typed canonical event payload; the authority layer applies ownership transfers and records the input receipt only after validation.
- A stale base revision and a duplicate/out-of-order sequence fail before mutation.
- Unique entities have one canonical owner. Active claims are leases; contested leases fail closed. Disconnect releases claims under the explicit `release-claims` policy while leaving ownership history intact.
- Reconnect records the client’s last known revision. Reconciliation exposes safe event summaries and owned entities, never private event payloads, the persistent store, or the authority hash chain.

## Persistence and replay

Authority events include server tick, authoritative revision, affected entity IDs, visibility, public summary, private server payload, and a SHA-256 parent hash. Snapshots verify contiguous revisions, parent hashes, final revision, and final hash before they are accepted.

This is an in-process contract and test fixture. It does not claim a socket protocol, encryption, authentication, anti-cheat, moderation, database durability, failover, packet-loss behavior, browser compatibility, or production availability.

## Verification

```text
npm test
```

`test/authority-network.test.mjs` covers ordered intent admission, server-computed outcomes, stale/duplicate rejection, client-result rejection, unique-object transfer conflicts, disconnect settlement, reconnect reconciliation, redaction, lease expiry, snapshot restart after a lost packet retry, and tamper rejection.
