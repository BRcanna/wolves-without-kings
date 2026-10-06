# Section 102 — Identity-Bound Online Underworld Access

The online Underworld mutation boundary now composes signed account/session/character claims with adult-consent and current-MFA admission. Public projections remain available without identity material, valid mutations strip the claim before entering Underworld state, and missing/mismatched/expired/revoked access fails closed without mutation.

## Contract

- mutation admission validates the signed identity claim against the registered account, session, client, and character;
- account status, adult consent, and current MFA verification are required before Underworld mutation;
- access-denial responses are bounded and omit claim, factor, challenge, and account-private details;
- public health/projection reads remain scoped and redacted;
- the Underworld command path receives no identity claim field after admission.

## Acceptance evidence

`underworld-access-boundary.test.mjs` proves valid admission, missing/mismatched/expired denial, no-mutation rejection, and public projection redaction.

## Boundary

This is a local identity/access composition over existing signed claims and access-policy state. It is not an external identity provider, real age/consent verification, factor delivery, secret custody, privacy/compliance review, account recovery, or production authentication acceptance.
