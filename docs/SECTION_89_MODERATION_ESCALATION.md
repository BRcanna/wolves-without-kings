# Section 89 — Moderation Escalation Response Ledger

Explicit escalation decisions now have a bounded local routing and response record. This is separate from the original moderation queue and appeal queue so escalation response timing cannot rewrite the source decision or imply staffed production coverage.

## Contract

- only a moderation case whose recorded decision is `escalate` can open an escalation;
- an escalation stores a route and evidence digest, uses an explicit response target tick, and admits only active reviewers;
- response targets produce qualitative within-target and breached bands, while final outcomes are `resolve`, `refer`, or `dismiss`;
- claims expire and can be reclaimed, and the original moderation case remains unchanged after routing or response;
- escalation mutations are hash-chained, snapshots are replay-validated, and public projection omits case IDs, routes, digests, reviewer identities, reason codes, and exact ticks.

## Acceptance evidence

`moderation-escalation.test.mjs` proves composition with explicit escalation decisions, bounded response tracking, late closure bands, claim expiry, no-mutation rejection, audit restore, tamper rejection, and public redaction.

## Boundary

This is a local escalation ledger and response-objective mechanic. It is not staffed human moderation, a legal/regulatory escalation process, an external case-management system, an SLA/SLO guarantee, abuse-prevention operations, production staffing, or production moderation acceptance. The fiction/safety boundary remains unchanged.
