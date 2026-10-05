# WOLVES WITHOUT KINGS

Wolves Without Kings is a new, GitHub-hosted build for a fictional, Bulgaria-centered crime-life RPG where time, relationships, organizations, objects, cases and places retain history.

The project starts from the supplied mechanics docuseries and follows its dependency order. The first implementation slice is intentionally small: a deterministic authority kernel with stable IDs, revision-bound commands, causal events, world time, snapshot/restore, and hash-verified replay.

## Current build slice

- Phase 0 foundation: canonical state, event ontology, world time, save/replay.
- Revision-bound mutation: stale proposals fail before any state changes.
- Event chain: every committed event carries actors, subjects, location, cause, visibility, provenance, and a SHA-256 parent hash.
- Fiction boundary: the runtime models consequences and relationships; it does not encode transferable real-world criminal procedure.

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

Build the smallest authored district fixture on top of the kernel: named entities, one safe social interaction, and a deterministic relationship projection. Keep the single-player authority path in-process and preserve the same event/save/replay contracts before adding action or online breadth.
