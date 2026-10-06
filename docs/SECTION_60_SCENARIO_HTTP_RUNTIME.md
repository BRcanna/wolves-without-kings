# Section 60 — Authoritative scenario HTTP runtime

This episode bridges the authored opening to the local authority boundary.

## Built

- a deterministic vertical runtime factory assembles the settled world, admitted district content, and active scenario graph;
- `GET /scenario` returns the public world, content, and scenario projections with their authoritative revisions;
- `POST /scenario/choice` validates both revisions, resolves the authored branch, applies the bounded systemic consequence, and commits world plus scenario state together;
- failed dispatches leave both histories unchanged;
- public responses omit private beliefs, hidden competence, case confidence, and event hashes.

## Acceptance evidence

`scenario-service.test.mjs` opens an ephemeral loopback socket and proves public boot, observe-branch dispatch, world/scenario revision advancement, private-state redaction, and stale-command atomic rejection.

## Boundary and later verification

This is a deterministic local authority runtime. It is not production authentication, TLS, durable storage, moderation operations, multiplayer session management, failover, load testing, or an authored dialogue/native-client acceptance pass. Scenario choice endpoints remain local test infrastructure until those gates are specified and verified.
