# Section 47 — Functional content admission

This section extends content admission beyond labels and cross-references. A content pack must carry functional locations, access modes, directed routes, movement modes, and actor schedules before it can enter runtime state.

## Implemented contract

- Locations belong to known regions and declare at least one access mode.
- Routes reference known, distinct locations and declare movement modes.
- Schedule templates reference admitted NPCs or organizations and use valid non-zero hour windows.
- All new content is validated before any pack entity is committed.
- Era variants can preserve stable identity for functional location, route, or schedule content.
- Public content projection reports counts while omitting event history and authoring internals.

## Acceptance evidence

- `content-pipeline.test.mjs` proves functional topology/schedule persistence, broken-reference rejection, impossible-window rejection, and pre-commit access validation.
- Existing `content.test.mjs` continues to prove stable IDs, organization references, era activation, and snapshot integrity.

## Boundary

This is a fictional local content-admission contract. It does not import production Cartographer/VANTA assets, prove visual reachability, validate authored dialogue/audio, or claim cultural review.
