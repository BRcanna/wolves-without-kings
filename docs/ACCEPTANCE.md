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
| Validated content-pack admission, stable IDs, cross-references, and era variants | `content.test.mjs`, `SECTION_30_CONTENT_ADMISSION.md` | PASS |
| Multi-dimensional unlock web, distinct evidence histories, no-XP progression, and explainable lock reasons | `unlock-web.test.mjs`, `SECTION_31_UNLOCK_WEB.md` | PASS |
| Offline-property protection, bounded conflict windows, nonlethal modes, harassment cooldowns, and recovery | `conflict.test.mjs`, `SECTION_32_CONFLICT_WINDOWS.md` | PASS |
| Deterministic fidelity tiers, promotion caps, separate renderer/simulation/network budgets, and stress reports | `performance.test.mjs`, `SECTION_33_PERFORMANCE_BUDGETS.md` | PASS |
| Snapshot restart, packet-loss retry idempotency, and next-sequence recovery | `authority-network.test.mjs`, `SECTION_34_AUTHORITY_RECOVERY.md` | PASS |
| Fictionalized capital/coastal/rural/mountain roles, coarse links, seasonal settlement, and topology redaction | `geography.test.mjs`, `SECTION_35_BULGARIA_WORLD_STRUCTURE.md` | PASS |
| Pauseable offline campaign lifecycle, opportunity drift, systemic settlement, ending, and successor boundary | `campaign.test.mjs`, `SECTION_36_SINGLE_PLAYER_CAMPAIGN.md` | PASS |
| Full/Aggregate offscreen continuity, promoted entities, scheduled materialization, uncertainty, and reconciliation | `offscreen.test.mjs`, `SECTION_37_OFFSCREEN_SIMULATION.md` | PASS |
| Regional supply/demand ecology, bounded market flow, source/sink shocks, resilience, and public price bands | `market-ecology.test.mjs`, `SECTION_38_MARKET_ECOLOGY.md` | PASS |
| Seed-stable procedural proposals, layer ordering, evidence-gated admission, reversible receipts, and topology validation | `authoring.test.mjs`, `SECTION_39_PROCEDURAL_AUTHORING.md` | PASS |
| Bounded online shard sessions, NPC baseline liquidity, capped player influence, property survival, and public macro projection | `underworld.test.mjs`, `SECTION_40_ONLINE_SHARD_CONTRACT.md` | PASS |
| Qualitative contact/pressure language, calendar, map knowledge, organization assignments, private-scope rejection, and stable notifications | `ui-projection.test.mjs`, `SECTION_41_UI_UX_PROJECTION.md` | PASS |
| Executable acceptance verifier binds tests, matrix, build log, README scope, preview artifact, and recorded external gates | `verification.test.mjs`, `scripts/verify-docuseries.mjs`, `SECTION_42_TESTING_ACCEPTANCE.md` | PASS |
| Versioned save envelopes, legacy migration, five-year checkpoint replay, counterfactual isolation, and tamper rejection | `save-replay.test.mjs`, `SECTION_43_SAVE_REPLAY.md` | PASS |
| Belief-scoped NPC planning, need/obligation competition, repeated-only capped adaptation, order discretion, and privacy-safe projection | `npc-ai.test.mjs`, `SECTION_44_NPC_AI.md` | PASS |
| Order-independent event projection fan-out, idempotent retries, conflicting duplicate rejection, and qualitative public summaries | `event-projections.test.mjs`, `SECTION_45_EVENT_PROJECTIONS.md` | PASS |
| Atomic authoritative event batches, stale preflight rejection, all-or-nothing failure, and save/restore compatibility | `atomic-batch.test.mjs`, `SECTION_46_ATOMIC_BATCHES.md` | PASS |
| Functional content locations, access routes, schedules, era identity, and pre-commit reference validation | `content-pipeline.test.mjs`, `SECTION_47_CONTENT_PIPELINE.md` | PASS |
| Ten supplied scenario traces mapped to source documents, executable subsystem tests, and explicit fiction/safety boundaries | `scenario-coverage.test.mjs`, `SCENARIO_ACCEPTANCE.md` | PASS |
| Signed transport envelopes, ordered retries, rate limiting, moderation holds, clock-skew rejection, and public security redaction | `transport-envelope.test.mjs`, `SECTION_48_TRANSPORT_ENVELOPE.md` | PASS |
| Public qualitative UI projection is wired into the committed browser preview without private fields | `preview-ui.test.mjs`, `ui-projection.test.mjs`, `SECTION_41_UI_UX_PROJECTION.md` | PASS |
| Browser preview renders contacts, organization assignments, doctrine cues, and notices from public qualitative UI data | `preview-ui.test.mjs`, `SECTION_41_UI_UX_PROJECTION.md` | PASS |
| Vertical slice admits a functional authored district package with residents, businesses, organizations, routes, schedules, and era variants | `content-pack.test.mjs`, `SECTION_49_DISTRICT_CONTENT.md` | PASS |
| Branchable authored scenario graph references admitted locations, persists choices, restores history, and rejects instructional language | `scenario-pack.test.mjs`, `SECTION_50_SCENARIO_CONTENT.md` | PASS |
| Authored district IDs remain aligned with authoritative runtime locations, routes, residents, businesses, and organizations | `content-pack.test.mjs`, `SECTION_51_CONTENT_RUNTIME_ALIGNMENT.md` | PASS |
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
