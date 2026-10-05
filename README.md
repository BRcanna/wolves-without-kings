# WOLVES WITHOUT KINGS

Wolves Without Kings is a new, GitHub-hosted build for a fictional, Bulgaria-centered crime-life RPG where time, relationships, organizations, objects, cases and places retain history.

The project starts from the supplied mechanics docuseries and follows its dependency order. Phase 0 is the deterministic authority kernel; Sections 3–5 now add an authored district, character state, persistent social state, and the first organization work graph.

## Current build slice

- Phase 0 foundation: canonical state, event ontology, world time, save/replay.
- Revision-bound mutation: stale proposals fail before any state changes.
- Event chain: every committed event carries actors, subjects, location, cause, visibility, provenance, and a SHA-256 parent hash.
- Fiction boundary: the runtime models consequences and relationships; it does not encode transferable real-world criminal procedure.
- Authored district: stable street, interior, roof, and service locations with deterministic traversal paths.
- Social projection: one local-observation contact outcome updates trust/respect through an event, not a hidden flag.
- Character state: identity, body condition, history-based hidden skills, and district/context familiarity are canonical and replayable.
- NPC life: routine blocks, needs, threat-adjusted schedules, long actions, and time settlement are canonical and replayable.
- Social state: multi-axis relationships and observer-scoped rumor/belief projections preserve contradiction and uncertainty.
- Organization work: dependency-ordered work items use capability checks, leases, review, and explicit recovery.

The full mechanics series lives in [`docs/docuseries/`](docs/docuseries/README.md). It is design input, not proof that the complete game exists.

## Run

Requires Node.js 22 or newer.

```text
npm test
npm run demo
```

## Evidence boundary

The passing tests verify this bounded headless foundation only. They do not prove a playable game, native renderer, authored dialogue, online service, performance target, cultural review, or production acceptance.

## Next episode

Build economy and property lineage on the same authority path, then connect those projections to a small single-player vertical slice. Keep online breadth deferred until the local authority path has stronger acceptance evidence.
