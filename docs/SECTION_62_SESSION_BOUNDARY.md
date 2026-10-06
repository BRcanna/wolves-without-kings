# Section 62 — Local scenario session identity boundary

This episode removes client-supplied actor authority from the local scenario path.

## Built

- `POST /scenario/sessions/connect` creates a bounded local session bound to the authored player identity;
- scenario choices require a connected session and derive the actor server-side;
- mismatched actor claims and unknown sessions fail before world or scenario mutation;
- the browser preview connects its local session before submitting choices;
- session identity is separate from production authentication and is not presented as a security solution.

## Acceptance evidence

`scenario-service.test.mjs` and `preview-server.test.mjs` cover session connection, actor derivation, mismatched identity rejection, and choice dispatch over loopback. `preview-ui.test.mjs` checks the browser session handshake wiring.

## Boundary and later verification

This is a local identity-binding contract. It does not provide credentials, TLS, account authentication, authorization policy, session expiry, replay protection, moderation operations, durable session storage, or production security acceptance. Those remain explicitly open.
