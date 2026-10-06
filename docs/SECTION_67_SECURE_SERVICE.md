# Section 67 — Secure local service boundary

Status: built as a bounded local hardening slice.

## Implemented

- `secure-http-service.mjs` wraps the existing authority HTTP adapter with bearer-token admission and constant-time token comparison;
- health remains a public liveness route, while session and mutation routes require authorization;
- optional TLS configuration uses Node HTTPS, and `requireTls` rejects insecure transport or missing key/certificate configuration;
- an explicit moderation hook can return a redacted hold or deny response before authority state is touched;
- `npm run serve:secure-authority` reads a token from `WWK_AUTH_TOKEN` and optional TLS material from environment-configured paths without storing secrets in the repository.

## Acceptance evidence

- `secure-http-service.test.mjs` proves public health, authentication rejection, authenticated session admission, redacted moderation hold/deny behavior, no-mutation guarantees, and TLS configuration failure;
- `npm run verify` checks the new acceptance evidence and contiguous build history.

## Boundary

This is a local service security contract, not account authentication, identity proofing, key custody, certificate issuance/rotation, TLS deployment, abuse-operations staffing, durable moderation queues, failover, load/availability, or production acceptance. It does not turn the fictional simulation into real-world criminal procedure.
