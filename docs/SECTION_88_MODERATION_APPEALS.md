# Section 88 — Moderation Appeals and Independent Review

The moderation queue can now preserve a bounded appeal path after an explicit allow or deny decision. The appeal state is separate from the original queue so an appeal outcome cannot silently rewrite the original moderation evidence.

## Contract

- an appeal references an already-decided moderation case and stores appellant/reason material as caller-supplied digests rather than raw content;
- one appeal may be opened per moderation case in the local state, and unresolved or escalated cases are not appealable;
- appeal claims use expiring leases and must be held by an active reviewer who did not make the original decision;
- an appeal decision is explicitly `uphold`, `overturn`, or `dismiss`, while the original allow/deny case remains unchanged;
- appeal mutations are hash-chained, snapshots are replay-validated, and public projection reports only qualitative queue bands.

## Acceptance evidence

`moderation-appeals.test.mjs` proves composition with the existing moderation case, independent reviewer admission, duplicate/unresolved rejection, claim expiry, no-mutation rejection, audit restore, tamper rejection, and public redaction.

## Boundary

This is a local appeal workflow contract. It is not staffed human moderation, policy authorship, legal or regulatory appeals, external case management, escalation staffing, response-time/SLA evidence, abuse-prevention operations, or production moderation acceptance. The fiction/safety boundary remains unchanged.
