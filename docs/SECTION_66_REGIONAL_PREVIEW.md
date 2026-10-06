# Section 66 — Regional public browser projection

Status: built as a public preview slice.

## Implemented

- the committed preview payload now includes the four-region public projection from the regional runtime;
- the browser renders region role, simulation-fidelity band, seasonal band, age band, and public link counts;
- geography, market, logistics, Underworld, and authored-content projections remain separate from the existing vertical-slice scenario payload;
- exact travel time, friction, contacts, cargo labels, private sessions, organization work, and event hashes remain outside the browser projection.

## Acceptance evidence

- `preview-ui.test.mjs` verifies four regional cards, authored regional content counts, public link redaction, and browser wiring;
- `renderer.test.mjs` verifies the generated public payload and logistics omission boundary;
- `npm run preview:build` regenerates `web/scenario.json` from deterministic runtime state.

## Boundary

This is a local public projection and browser rendering slice, not a native client, live regional streaming service, accessibility/localization certification, production synchronization, or factual geographic/cultural representation. The displayed world remains fictionalized and qualitative.
