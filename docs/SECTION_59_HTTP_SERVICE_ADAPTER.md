# Section 59 — Loopback HTTP authority adapter

This episode advances the transport-shaped authority contract to an executable local socket boundary.

## Built

- a Node HTTP adapter delegates requests to the existing revision-bound authority service;
- health, session connection, ordered input, and the existing error/reconciliation semantics are reachable over loopback HTTP;
- malformed JSON and oversized request bodies fail with bounded JSON errors;
- response payloads remain the same redacted authority acknowledgements produced by the in-process service;
- `npm run serve:authority` starts the local adapter on `127.0.0.1` using `WWK_PORT` or port `8787`.

## Acceptance evidence

`http-service.test.mjs` opens an actual ephemeral loopback socket and proves health, connection, ordered input, duplicate/stale rejection, malformed JSON handling, and clean shutdown. Existing `service.test.mjs` remains the in-process contract test.

## Boundary and later verification

This is a local loopback adapter, not production deployment. TLS, authentication, key management, anti-cheat, operational moderation, durable storage, failover, load/availability, browser compatibility, and legal/compliance acceptance remain open gates. The adapter does not expose private authority payloads to clients.
