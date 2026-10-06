# Section 78 — Moderation Operations Queue

The secure service boundary can hold or deny a request, but operational moderation needs a durable, explainable review path. This section adds a bounded local queue without storing raw user content in the canonical moderation state.

## Contract

- cases store a subject, session reference, content digest, labels, validity, claim state, and decision history rather than raw content;
- active reviewers claim cases through expiring leases so abandoned work returns to the queue;
- only the reviewer holding a live claim can decide allow, deny, or escalate;
- reviewer suspension prevents new claims;
- queue mutations and decisions are hash-chained and snapshot/replay validated;
- public projection reports only qualitative queue counts and active reviewer count, omitting content digests, labels, identities, reason codes, and event hashes.

## Acceptance evidence

`moderation-operations.test.mjs` proves explicit queue/claim/decision flow, claim expiry and reclamation, reviewer authorization/suspension, audit restore, tamper rejection, and public redaction.

## Boundary

This is a local moderation workflow contract. It is not staffed human review, policy authorship, escalation staffing, response-time/SLA evidence, appeal handling, legal compliance, abuse-prevention operations, or production moderation acceptance. The fiction/safety boundary remains unchanged.
