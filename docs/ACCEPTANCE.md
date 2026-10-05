# Acceptance matrix

| Gate | Evidence | Status |
| --- | --- | --- |
| Canonical state has stable IDs and revisions | `engine.mjs`, contiguous-revision test | PASS |
| Stale proposals fail closed | `StaleRevisionError`, no-mutation test | PASS |
| Events carry causal/provenance metadata | event construction and hash-chain test | PASS |
| World time is transactional | time-advance test | PASS |
| Save/restore preserves history | snapshot/restore equality test | PASS |
| Tampered history is rejected | restore tamper test | PASS |
| One authored district | `district.mjs`, fixture integrity tests | PASS |
| Layered deterministic traversal | traversal path tests for walk/climb/service boundaries | PASS |
| Bounded social relationship projection | `resolveSocialContact`, projection test | PASS |
| Character identity and canonical condition | character creation and condition tests | PASS |
| History-based hidden skill progression | skill threshold test | PASS |
| Familiarity and body-state persistence | bounded-state and restore tests | PASS |
| NPC routine, need, and long-action settlement | `social-organization.test.mjs` NPC test | PASS |
| Multi-axis relationship history and aging | `social-organization.test.mjs` relationship test | PASS |
| Observer-scoped rumor and belief divergence | `social-organization.test.mjs` rumor test | PASS |
| Dependency-ordered organization work and lease recovery | `social-organization.test.mjs` organization test | PASS |
| Regional market state and shock direction | `economy-provenance.test.mjs` market test | PASS |
| Promoted object provenance across storage, transfer, seizure, return, damage, and repair | `economy-provenance.test.mjs` provenance test | PASS |
| Protection/extortion relationship economy and rival-claim state | `protection.test.mjs`, `SECTION_16_PROTECTION.md` | PASS |
| Agency-specific police cases, witnesses, jurisdiction, and aging | `police-case.test.mjs` case trace | PASS |
| Integrated single-player year-one trace | `vertical-slice.test.mjs` three-history and replay tests | PASS |
| Bounded surveillance knowledge, staleness, and noncombat outcomes | `surveillance.test.mjs` | PASS |
| Scope-filtered renderer-facing projection and privacy boundary | `projection.test.mjs`, `ONLINE_BOUNDARY.md` | PASS |
| Bounded traversal and melee action outcomes | `action.test.mjs` | PASS |
| Vehicle persistence, pursuit segments, damage, retirement, and provenance history | `vehicle.test.mjs`, `SECTION_17_VEHICLE_PROVENANCE.md` | PASS |
| Local renderer preview consumes only public projection data | `renderer.test.mjs`, `npm run preview:build`, `SECTION_13_RENDERER.md` | PASS |
| In-process authority contract for ordered intents, ownership, leases, reconnect, and redaction | `authority-network.test.mjs`, `SECTION_14_AUTHORITY.md` | PASS |
| Local transport-shaped authority service adapter | `service.test.mjs`, `SECTION_15_SERVICE_ADAPTER.md` | PASS |
| Network deployment, encryption, moderation, availability, and production acceptance | no production implementation | OPEN |
| Online underworld | explicitly deferred | OPEN |

This matrix is evidence for the current foundation slice, not a claim that the overall docuseries goal is complete.
