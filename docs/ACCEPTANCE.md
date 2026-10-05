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
| Aggregate region continuity, simulation modes, and Sofia/coastal corridor | `region.test.mjs`, `SECTION_18_AGGREGATE_REGIONS.md` | PASS |
| Drop-in/drop-out co-op join, disconnect, ownership settlement, and host continuity | `coop.test.mjs`, `SECTION_19_COOP.md` | PASS |
| One-week persistent Underworld macro state with shared markets, offline work, property conflict, and bounded physical sessions | `underworld.test.mjs`, `SECTION_20_UNDERWORLD.md` | PASS |
| Dynasty/successor manifests, seasons, trophies, and non-transfer of private capability | `dynasty.test.mjs`, `SECTION_21_DYNASTY.md` | PASS |
| Consequential abstract ranged action with suppression, cover, evidence, and projection boundary | `ranged.test.mjs`, `SECTION_22_RANGED_ACTION.md` | PASS |
| Time-bearing prison life, outside-world drift, release, and re-entry boundary | `prison.test.mjs`, `SECTION_23_PRISON.md` | PASS |
| Observer-scoped tattoos, visible status, prison context, aging, and misuse boundary | `tattoos.test.mjs`, `SECTION_24_TATTOOS_RANK.md` | PASS |
| Organization doctrine, value-mediated compliance, coalition succession, and public governance projection | `doctrine.test.mjs`, `SECTION_25_DOCTRINE_SUCCESSION.md` | PASS |
| Abstract commodity supply shock, doctrine policy, health externality, and redacted drug-market projection | `drug-economy.test.mjs`, `SECTION_26_DRUG_ECONOMY.md` | PASS |
| Abstract route planning, changing route conditions, stale-plan rejection, and qualitative logistics projection | `logistics.test.mjs`, `SECTION_27_LOGISTICS.md` | PASS |
| Five-year legitimate-front divergence, manager turnover, separate money state, and public business projection | `fronts.test.mjs`, `SECTION_28_FRONTS_MONEY.md` | PASS |
| Persistent place scars, era aging, private-memory redaction, and qualitative environmental projection | `world-aging.test.mjs`, `SECTION_29_WORLD_AGING.md` | PASS |
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
