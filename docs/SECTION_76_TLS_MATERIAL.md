# Section 76 — TLS Material Lifecycle

Section 67 established a secure local HTTP boundary and Section 75 established transport key lifecycle. This section adds an explicit local TLS-material lifecycle contract so certificate overlap, expiry, retirement, and runtime secret reinjection are modeled rather than hidden in process configuration.

## Contract

- certificate material has a stable ID, validity ticks, server-name coverage, certificate digest, and public-key digest;
- private keys are parsed at registration but remain runtime-only material;
- rotation activates a new material while the older material can remain valid during overlap;
- expired, not-yet-valid, retired, unknown, and server-name-mismatched material fails closed;
- snapshots and projections omit certificate and private-key PEM values;
- restore requires runtime-injected certificate/private-key material whose digests match the metadata snapshot.

## Acceptance evidence

`tls-material.test.mjs` proves overlap rotation, server-name resolution, expiry, retirement, PEM/private-key validation, secret redaction, and matching runtime reinjection.

## Boundary

This is a local TLS-material lifecycle contract. It is not a certificate authority, public-key infrastructure, ACME/CA issuance flow, hardware-backed key store, live TLS listener, certificate revocation protocol, account identity provider, or production security/compliance acceptance. The fiction/safety boundary remains unchanged.
