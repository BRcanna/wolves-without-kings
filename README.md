# WOLVES WITHOUT KINGS

Wolves Without Kings is a new, GitHub-hosted build for a fictional, Bulgaria-centered crime-life RPG where time, relationships, organizations, objects, cases and places retain history.

The project starts from the supplied mechanics docuseries and follows its dependency order. Phase 0 is the deterministic authority kernel; Sections 3–13 now add an authored district, character state, persistent social state, the first organization work graph, regional markets, item provenance, evidence-bearing police cases, a year-one single-player trace, durable surveillance knowledge, scope-filtered projections, bounded action outcomes, vehicle persistence, and a local public-projection renderer preview.

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
- Economy: regional supply-demand price bands respond to transport, legal, faction, and independent market shocks.
- Provenance: promoted objects retain stable identity through storage, transfer, seizure, return, damage, and repair.
- Cases: agencies retain separate jurisdiction, evidence, witness, action, confidence, and aging state.
- Vertical slice: three different histories reach a replayable year-one endpoint with 30 NPCs, 3 businesses, 2 organizations, 1 market, and 1 case.
- Surveillance: learned routines carry confidence, staleness, witness uncertainty, access state, and counter-surveillance state.
- Projection boundary: public, observer, institutional, and debug views are explicit and privacy-tested.
- Action outcomes: traversal and melee preserve route knowledge, risk, witnesses, injury, and nonterminal outcomes.
- Vehicles: pursuit segments preserve handling, familiarity, damage, ownership, observer signals, and retirement.
- Renderer preview: a reproducible local browser surface consumes committed public projection data and fails visibly when that data cannot load.

The full mechanics series lives in [`docs/docuseries/`](docs/docuseries/README.md). It is design input, not proof that the complete game exists.

## Run

Requires Node.js 22 or newer.

```text
npm test
npm run demo
npm run preview:build
```

## Evidence boundary

The passing tests verify this bounded headless foundation only. They do not prove a playable game, native renderer, authored dialogue, online service, performance target, cultural review, or production acceptance.

## Next episode

Audit the online transport boundary and production/runtime edges; online underworld breadth remains explicitly deferred.
