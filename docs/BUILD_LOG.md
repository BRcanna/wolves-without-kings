# Build log

## Episode 0 — Authority kernel

Source: the supplied Bulgaria Underworld Mechanics Docuseries, especially the Phase 0 roadmap, the event ontology, save/replay contract, testing gates, and Vertical Slice A.

Implemented:

- stable world and event identifiers;
- explicit world revision and stale-command rejection;
- event payloads with causal/provenance fields;
- deterministic SHA-256 event chaining;
- transactional world-time advancement;
- snapshot restore by replaying the authoritative event history;
- negative tests for stale proposals and tampered history.

Acceptance evidence:

- `npm test` passes five tests covering event continuity, stale rejection, save/restore, tamper detection, and time validation.

Not proven yet:

- authored district content;
- character, NPC, relationship, organization, economy, action, police-case, renderer, or online systems;
- real-world cultural/legal review;
- production performance or hardware acceptance.

## Episode 1 — Authored district fixture

Implemented:

- fictionalized South Sofia district fixture with stable location and entity IDs;
- street, interior, roof, and service traversal layers;
- deterministic traversal search with explicit movement modes;
- one local-observation social contact that projects trust and respect through the event ledger.

Acceptance evidence:

- `npm test` covers fixture integrity, deterministic traversal, invalid fixture rejection, relationship projection, and all Phase 0 gates.

Still open:

- character condition, hidden skills, familiarity, NPC life simulation, economy, action, police cases, and online systems.
