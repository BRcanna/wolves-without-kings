# Section 15 — Local transport-shaped authority service adapter

## Purpose

Section 15 puts a small request boundary around the in-process authority contract. It makes the intended service surface executable without opening a network port or implying that authentication, encryption, deployment, or availability has been solved.

## Request surface

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | public process/authority status and revision |
| `POST` | `/sessions/connect` | admit a host or guest session |
| `POST` | `/sessions/:id/input` | submit an ordered client intent |
| `POST` | `/sessions/:id/disconnect` | settle a disconnect and release claims by policy |
| `POST` | `/sessions/:id/reconnect` | restore a session and mark reconciliation required |
| `GET` | `/sessions/:id/reconcile?fromRevision=N` | return interest-scoped event summaries |

The service adapter delegates all mutation to `authority.mjs`. It does not accept a client result, damage value, ownership result, price, confidence, or server state as authoritative input. Error responses report stale/duplicate/malformed conditions without mutating the authority state.

## Replication boundary

Input acknowledgements contain status, sequence, server tick, revision, and reconciliation metadata only. Reconciliation contains safe event summaries, owned entity IDs, active claims for the session, and an explicit omitted-fields list. Canonical payloads, the persistent store, and the authority hash chain remain server-side.

## Verification boundary

`test/service.test.mjs` calls the adapter directly with transport-shaped requests. It intentionally does not open a socket. This proves request routing and mutation/error semantics, not network reachability, TLS, authentication, rate limiting, packet loss, browser behavior, database durability, failover, moderation, or production acceptance.
