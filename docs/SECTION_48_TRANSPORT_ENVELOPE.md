# Section 48 — Bounded transport envelope and admission guard

This section adds a local transport boundary around untrusted intents. Envelopes are signed with a caller-held key, ordered by session sequence, replay-safe through receipts, rate-limited, and capable of an explicit moderation hold before authoritative gameplay admission.

## Implemented contract

- Session registration stores only a key identifier, never the signing secret.
- Intent envelopes carry schema, session, sequence, nonce, tick, abstract intent, and an HMAC signature.
- Authoritative results, world state, ownership, and server outcomes are rejected from client intent payloads.
- Duplicate retries are idempotent; conflicting duplicates, gaps, wrong keys, and clock-skewed envelopes fail closed.
- Rate limits and moderation holds are committed transport outcomes, not hidden drops.
- Public transport projection omits signatures, nonces, receipts, intent payloads, and event hashes.

## Acceptance evidence

- `transport-envelope.test.mjs` proves signing, tamper rejection, ordered replay handling, rate limiting, moderation holds, clock-skew/key rejection, snapshot integrity, and public redaction.

## Boundary

This is a local integrity/admission contract, not production encryption, key management, TLS termination, anti-cheat, moderation operations, availability, deployment, or legal/compliance acceptance.
