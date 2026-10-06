# Section 75 — Transport Key Lifecycle

The transport envelope already proved signatures, ordering, replay handling, rate limits, and moderation outcomes. This section adds the missing local credential lifecycle around that envelope without moving secrets into canonical state or public projections.

## Contract

- keys have stable IDs, creation ticks, optional expiry ticks, and explicit revocation ticks;
- registration and rotation are deterministic, and the active key can overlap an older key while sessions migrate;
- admission resolves the key bound to the authoritative transport session rather than trusting a client-selected key;
- expired and revoked keys fail before the envelope reaches transport admission;
- snapshots preserve lifecycle metadata but omit secrets; restore requires runtime-injected secret material;
- public keyring projection reports lifecycle status and omits secret values.

## Acceptance evidence

`transport-keyring.test.mjs` proves overlap rotation, session-key binding, expiry, revocation, snapshot secret omission, runtime secret injection, and mismatched-key rejection.

## Boundary

This is a local key lifecycle and admission contract. It is not an account identity provider, hardware-backed secret store, certificate authority, TLS termination/rotation service, key escrow system, anti-cheat system, or production security/compliance acceptance. The fiction/safety boundary remains unchanged.
