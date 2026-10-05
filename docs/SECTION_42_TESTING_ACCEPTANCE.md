# Section 42 — Executable testing and acceptance evidence

This section closes the repository-evidence loop described by the docuseries testing volume. The build now has an executable verifier that checks the claims that can be checked locally without pretending to prove claims that require hardware, production infrastructure, accessibility studies, security review, or live players.

## Implemented contract

- `scripts/verify-docuseries.mjs` reads the acceptance matrix, verifies PASS-row references resolve to repository evidence, checks the numbered build-log sequence, checks the README's declared scope, and validates the committed preview is a public projection.
- `test/verification.test.mjs` runs that verifier as part of the Node test suite.
- `npm run verify:all` is the promotion-shaped local command: test, rebuild the preview, then verify the evidence graph.
- Open external gates remain reported as open; they are not converted into PASS rows by structural checks.

## Acceptance evidence

- `npm test` executes the verifier test and the system tests.
- `npm run preview:build` regenerates `web/scenario.json` from the deterministic vertical slice.
- `npm run verify` reports the PASS-row count, OPEN-row count, contiguous episode range, public preview scope, and the recorded-open external-gate status.

## Boundary

This verifier proves repository evidence discipline and local reproducibility only. It does not prove fresh-player usability, localization, accessibility, controller navigation, renderer frame rate, security, encryption, moderation, production deployment, online availability, or hardware acceptance.
