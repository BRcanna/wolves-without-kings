# Section 3 — Authored district fixture

This episode turns the Phase 0 authority kernel into a bounded world fixture. It is deliberately fictionalized and headless: it proves stable world identity, multi-layer traversal, named entities, and one event-backed social projection without claiming a renderer or a production map.

## Implemented contract

- `district:sofia-south` is a fictionalized Sofia-inspired district.
- Locations have stable IDs and one of four layers: street, interior, roof, or service.
- Routes are explicit edges with deterministic movement modes.
- Fixture validation rejects duplicate IDs and unknown route/entity references.
- A local-observation social contact updates trust and respect only through a committed event.

## Acceptance gate

Run `npm test` and verify the district tests pass alongside the Phase 0 authority tests. The evidence proves fixture integrity and deterministic headless behavior only; it does not prove authored art, animation, navigation mesh quality, or visual acceptance.

## Next dependency

Section 4 adds character condition, hidden skills, familiarity, and body-state changes while preserving the same revision-bound event and replay contracts.
