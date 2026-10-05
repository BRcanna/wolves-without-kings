# WOLVES WITHOUT KINGS

Wolves Without Kings is a new, GitHub-hosted build for a fictional, Bulgaria-centered crime-life RPG where time, relationships, organizations, objects, cases and places retain history.

The project starts from the supplied mechanics docuseries and follows its dependency order. Phase 0 is the deterministic authority kernel; Section 3 now adds a fictionalized authored district fixture, layered traversal, and a bounded social-contact projection.

## Current build slice

- Phase 0 foundation: canonical state, event ontology, world time, save/replay.
- Revision-bound mutation: stale proposals fail before any state changes.
- Event chain: every committed event carries actors, subjects, location, cause, visibility, provenance, and a SHA-256 parent hash.
- Fiction boundary: the runtime models consequences and relationships; it does not encode transferable real-world criminal procedure.
- Authored district: stable street, interior, roof, and service locations with deterministic traversal paths.
- Social projection: one local-observation contact outcome updates trust/respect through an event, not a hidden flag.

The full mechanics series lives in [`docs/docuseries/`](docs/docuseries/README.md). It is design input, not proof that the complete game exists.

## Run

Requires Node.js 22 or newer.

```text
npm test
npm run demo
```

## Evidence boundary

The passing tests verify this bounded headless foundation only. They do not prove a playable game, native renderer, authored world, NPC population, online service, performance target, cultural review, or production acceptance.

## Next episode

Build character condition, hidden skills, familiarity, and body-state transitions on the same authority path. Keep all state evented and replayable before adding economy or online breadth.
