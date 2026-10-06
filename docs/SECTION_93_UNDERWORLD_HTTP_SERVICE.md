# Section 93 — Local Online Underworld HTTP Boundary

The persistent local underworld shard now has a shard-specific HTTP adapter. It composes the existing revision-bound state transitions with bearer admission and public projection redaction.

## Contract

- `GET /health` and `GET /projection` are public and expose only shard metadata and qualitative public state;
- mutations require bearer authentication and route to revision-bound session join/leave, market influence, property claim, and weekly settlement commands;
- accepted mutations return the next revision and public projection, never canonical private state;
- stale revisions, malformed JSON, invalid commands, and unknown routes fail with bounded redacted responses before partial state mutation;
- the adapter is a real loopback HTTP server and remains separate from production deployment or cross-host transport.

## Acceptance evidence

`underworld-http-service.test.mjs` proves public health/projection, bearer admission, session and market mutation, stale rejection, malformed JSON, unknown routes, and private-state redaction over real loopback HTTP.

## Boundary

This is a local HTTP shard boundary. It is not production networking, TLS/CA operations, cross-host deployment, matchmaking, anti-cheat, moderation, rate/availability acceptance, encrypted persistence, or full persistent online underworld breadth. The fiction/safety boundary remains unchanged.
