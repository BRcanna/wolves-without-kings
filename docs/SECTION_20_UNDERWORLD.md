# Section 20 — Persistent Underworld macro proof

## Purpose

Section 20 adds a bounded persistent macro layer on top of the proven authority, region, market, organization, property, and co-op contracts. It proves one server week of shared state without opening a production network service.

## Canonical state

The fictionalized shard retains server era/week/tick, organizations and offline work, shared market classes, properties, contested claims, season history, and bounded physical-session summaries. Organization work can progress offline; a physical session is only a bounded summary and cannot import a guest world.

Market shocks are deterministic pressure changes. Public projection exposes only qualitative pressure/index bands. Property conflict retains one canonical owner and a separate contested claimant record rather than duplicating the asset.

## Acceptance boundary

The weekly settlement accepts no more than 16 physical sessions, with no more than 8 participants each. It records a maximum one-week step, updates shared markets and offline organization work, and appends a hash-linked settlement event. Snapshot restore checks the complete event chain.

Commodity classes and work outcomes are fictional, abstract labels. The implementation is a systemic simulation contract, not a guide to real-world criminal logistics.

## Verification

```text
npm test
```

`test/underworld.test.mjs` covers shared week settlement, offline organization progression, property conflicts, public redaction, session bounds, stale rejection, and snapshot tamper rejection.
