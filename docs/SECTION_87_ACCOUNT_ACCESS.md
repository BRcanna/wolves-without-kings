# Section 87 — Consent and MFA Access Admission

The local signed identity claim now has a separate access-policy gate. Consent/age-band state and MFA challenge verification must be satisfied before an identity claim is admitted for an account session; factor material, challenge codes, and exact verification expiry remain private.

## Contract

- access accounts keep status, policy-version consent, age eligibility band, and MFA enrollment as separate state from account identity claims;
- MFA challenges store only a digest, expire by simulation tick, count failed attempts, and fail closed at the configured limit;
- only an active account with adult consent and current MFA verification can pass the default access gate;
- the gate composes existing signed claim validation with client/character binding before admitting the session;
- snapshots and public projections omit factor material, factor/code digests, challenge codes, and exact verification expiry.

## Acceptance evidence

`account-access-policy.test.mjs` proves signed-claim composition, adult-consent and MFA admission, invalid/expired/exhausted challenge rejection, suspended-account rejection, snapshot restoration, tamper detection, and secret redaction.

## Boundary

This is a deterministic local access-policy contract. It is not an external account provider, password or factor-delivery service, real age verification, legal consent workflow, privacy/compliance system, hardware-backed secret custody, or production identity acceptance. All identifiers and access outcomes remain fictional game-state abstractions.
