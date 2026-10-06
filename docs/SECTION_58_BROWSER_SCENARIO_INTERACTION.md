# Section 58 — Browser scenario interaction

This episode closes the presentation loop for the authored opening without pretending that a static preview is an online client.

## Built

- public scenario cards now expose buttons only for the active authored scene;
- selecting a branch records a public in-memory resolution and advances to its declared follow-up scene;
- the transition is isolated in a small client module with direct tests for active-scene, choice, date, and endpoint behavior;
- the interface renders the branch's qualitative consequence cue and marks prior scenes as resolved;
- the preview announces when a branch has reached its local endpoint;
- the page states that no authoritative world state, server history, or online session was changed.

## Acceptance evidence

`preview-ui.test.mjs` and `web/scenario-preview.mjs` check the public transition, feedback surface, choice-button wiring, click handling, and explicit in-memory boundary. `npm run preview:build` regenerates the public payload consumed by the page.

## Boundary and later verification

This is a browser presentation interaction only. It does not provide a server route, authoritative scenario mutation, crash-safe persistence, multiplayer synchronization, moderation, accessibility certification, localization, controller navigation, or production deployment. Those gates remain recorded for a later runtime/client verification episode.
