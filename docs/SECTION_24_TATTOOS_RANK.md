# Section 24 — Tattoos, rank, and visible history

This episode composes docuseries Volume 10 into an executable, persistence-tested bounded slice.

## Built

- marker state records body location, category, origin, organization relation, prison context, earned history, visibility, age and historical band;
- observer profiles preserve scoped knowledge of organizations and eras instead of making a marker globally authoritative;
- the same marker can resolve as recognized affiliation, recognized-but-uncertain, unfamiliar, unearned status, or unauthorized claim depending on observer knowledge;
- misuse consequences are qualitative and evented (`ridicule`, `challenge`, `violence-risk`, `distrust`, or `investigation`), without real-world operational procedure;
- covered and concealed markers remain private in public encounters, while high-status characters can move without requiring a visible marker;
- accelerated time ages markers into current, aged, or old-guard bands;
- public projection exposes only qualitative marker status and omits issuer, organization, recognition, misuse, observer and event internals;
- snapshots retain a hash-linked history and reject tampering or stale mutation.

## Acceptance evidence

`npm test` includes `tattoos.test.mjs`, which proves three observer-specific interpretations, prison-context history and decade aging, unearned/stale fail-closed behavior, private visibility, and snapshot integrity.

## Boundary

This is a fictional social-history model. It does not teach tattoo symbolism, impersonation, evasion, violence, or real-world criminal procedure. Marker meaning remains contextual and uncertain rather than a universal authority token.
