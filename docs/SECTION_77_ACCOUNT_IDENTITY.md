# Section 77 — Account Identity and Session Claims

The existing session boundary prevents clients from choosing an actor, but it did not yet define a local account-to-character identity contract. This section adds signed, time-bounded identity claims without placing signing secrets in canonical state or public projections.

## Contract

- accounts have stable IDs, active/suspended/revoked status, and explicit character bindings;
- a claim binds issuer, account, session, client, character, issue tick, and expiry tick;
- claims are HMAC-signed by runtime-injected material and are checked against the registered claim and account state;
- client/character mismatch, unknown issuer, altered claims, expired claims, revoked claims, and suspended accounts fail closed;
- identity mutations are hash-chained and snapshot/replay validated;
- public identity projection reports only bounded status/count information and omits signatures, client identifiers, character bindings, and signing keys.

## Acceptance evidence

`account-identity.test.mjs` proves claim binding, signature validation, client/character mismatch rejection, account suspension, claim revocation/expiry, event-chain restore, tamper rejection, and public redaction.

## Boundary

This is a local identity and session-claim contract. It is not an external account provider, password/MFA system, hardware-backed key store, consent/age verification service, privacy/legal compliance implementation, or production identity acceptance. The fiction/safety boundary remains unchanged.
