# Section 86 — Live TLS Termination and Rotation

The TLS material registry now drives an actual HTTPS operational listener. Runtime-injected key/certificate material is resolved against validity and server-name policy, the listener serves encrypted health and authenticated authority traffic, and the live secure context rotates without exposing PEM values through the public projection.

## Contract

- the runtime resolves only active, server-name-covered material at the requested simulation tick;
- the operational listener is HTTPS-only and retains bearer authentication for non-public routes;
- a live secure context can rotate to an overlapping registered material without replacing the authoritative service;
- expiry, not-yet-valid material, and server-name mismatch fail before listener construction or rotation;
- projections expose material IDs, digests, validity bands, and lifecycle state but omit certificates, private keys, and runtime secrets.

## Acceptance evidence

`live-tls-runtime.test.mjs` starts a real local HTTPS listener using test-only localhost fixtures, verifies certificate fingerprint change after rotation, serves public health and authenticated mutation traffic, checks PEM redaction, and proves validity/name rejection.

## Boundary

This is local live TLS termination and overlap-rotation evidence using non-production test certificates. It is not CA/ACME issuance, mTLS client identity, revocation infrastructure, hardware-backed key custody, certificate distribution, public trust, or production security acceptance. The committed private keys are test fixtures only and must never be deployed.
