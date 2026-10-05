# Section 43 — Versioned save, replay, and counterfactual branches

This section makes the save/replay requirements executable around the authoritative engine. A save is a versioned envelope over the engine snapshot, with a deterministic digest and metadata that must agree with restored history.

## Implemented contract

- Save envelopes carry a schema version, checkpoint identity, simulation date, world revision, event count, deterministic digest, and engine snapshot.
- Legacy version-zero envelopes migrate through the engine's existing hash-chain restore path before a current envelope is emitted.
- Checkpoint replay restores the bundle and advances controlled time through the same authority path as direct play.
- Counterfactual branches clone a restored checkpoint and return a separate bundle; they cannot mutate the canonical checkpoint.
- Digest, metadata, event-chain, schema, and tamper failures reject before a caller receives a restored world.

## Acceptance evidence

- `save-replay.test.mjs` proves current-envelope round trips, legacy migration, five-year accelerated checkpoint replay, isolated counterfactual branching, and tamper rejection.
- The underlying engine snapshot still verifies contiguous event IDs, revisions, parent hashes, and reduced state equality.

## Boundary

This is a deterministic local save/replay contract. It does not claim player-facing rewind policy, crash-safe filesystem transactions, cloud backup durability, online rollback, or a production migration service.
