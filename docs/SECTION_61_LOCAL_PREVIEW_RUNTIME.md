# Section 61 — Local preview/runtime integration

This episode connects the public browser preview to the local authoritative scenario endpoint.

## Built

- `npm run serve:preview` serves the committed browser assets and the local scenario API from one loopback process;
- the browser detects the revision-bearing local endpoint and submits authored choices with both world and scenario revisions;
- successful local responses replace the in-memory scenario projection and retain public consequence cues;
- static-file viewing keeps the explicit presentation-only fallback when no local endpoint is available;
- the preview server uses an allowlisted asset map, bounded JSON API handling, and public projections only.

## Acceptance evidence

`preview-server.test.mjs` opens a real loopback server, fetches the committed page, reads the public scenario endpoint, commits a meet branch, and checks a missing asset response. `preview-ui.test.mjs` checks the browser's local-authority detection and revision submission wiring.

## Boundary and later verification

This is a local preview/runtime integration. It does not prove production TLS, authentication, session lifecycle, durable persistence, multiplayer synchronization, moderation operations, load/availability, accessibility, localization, authored dialogue/audio, or native-client acceptance. Static fallback is intentionally not authoritative.
