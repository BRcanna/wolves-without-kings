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

## Episode 2 — Character condition and hidden competence

Implemented:

- stable character identity and canonical body condition;
- history-based hidden skill practice for driving, fighting, lock work, intimidation, and negotiation;
- bounded district/context familiarity with qualitative levels;
- snapshot/restore coverage and fail-closed validation.

Acceptance evidence:

- `npm test` covers character creation, skill thresholds, familiarity, body condition, invalid skills, and restore equality.

Still open:

- persistent NPC life, richer relationships, organization doctrine, economy, action, police cases, and online systems.

## Episode 3 — Persistent social and organization state

Implemented:

- persistent NPC routine blocks, needs, threat-adjusted schedules, long actions, and world-time settlement;
- multi-axis relationship state with shared-event history and relationship aging;
- separate rumor claims and observer-scoped beliefs with confidence, retelling, source, and staleness;
- dependency-ordered organization work graphs with capability checks, member availability, leases, review, and recovery;
- replay-compatible reducers for every new projection.

Acceptance evidence:

- `npm test` passes 17 tests covering all prior gates plus NPC life settlement, long-action completion, relationship contradiction/aging, rumor divergence, and expired-lease recovery.

Still open:

- economy, property lineage, action/case systems, renderer, online systems, and production acceptance.

## Episode 4 — Regional economy and item provenance

Implemented:

- promoted object identity with owner, custody, location, evidence, damage, repair, and event-link history;
- property storage, player transfer, institutional seizure, eventual return, damage, and repair transitions;
- regional market state with supply, demand, inventory, transport cost, legal pressure, faction control, information lag, and uncertain price bands;
- deterministic market shocks whose direction follows the changed state rather than event-specific scripted prices;
- replay-compatible time settlement for market information lag.

Acceptance evidence:

- `npm test` passes 19 tests covering all prior gates plus provenance continuity and independent market-shock direction.

Still open:

- evidence-bearing police cases, action systems, renderer, the single-player vertical trace, online systems, and production acceptance.

## Episode 5 — Evidence-bearing police cases

Implemented:

- persistent case files with matter type, jurisdiction, suspects, confidence, legal stage, age, evidence, witnesses, and agency views;
- separate agency knowledge and authority actions for one shared incident;
- belief-bearing witness retellings with divergent confidence and status;
- explicit stage authorization and invalid-jurisdiction rejection;
- deterministic cold-case aging through world-time settlement and snapshot replay.

Acceptance evidence:

- `npm test` passes 20 tests covering all prior gates plus a two-agency case trace with divergent knowledge, authorization boundaries, and cold-case transition.

Still open:

- the integrated single-player vertical trace, renderer, online systems, and production acceptance.

## Episode 6 — Single-player vertical slice

Implemented:

- a deterministic year-one fixture with one fictionalized district, 30 routine-bearing NPCs, 3 businesses, 2 organizations, 1 market, 1 provenance-bearing vehicle, and 1 police case;
- eight deep player relationships with shared history and one full-year age settlement;
- relationship-first, organization-first, and quiet-market history variants reaching the same endpoint without bespoke mission rails;
- business aging, NPC life settlement, case aging, market settlement, and snapshot replay in the integrated trace.

Acceptance evidence:

- `npm test` passes 22 tests, including three year-one histories and full-year restore equality.

Still open:

- bounded action/surveillance interactions, renderer-facing projections, online systems, and production acceptance.

## Episode 7 — Surveillance and durable information

Implemented:

- observer-scoped surveillance records with access, visibility, sound, time window, and entry-state provenance;
- durable routine knowledge, confidence, information gained, witness uncertainty, and counter-surveillance state;
- deterministic staleness and confidence decay after target routine changes and world-time advancement;
- noncombat withdrawal/uncertainty/noticed outcomes and fail-closed ownership validation.

Acceptance evidence:

- `npm test` passes 24 tests covering routine learning, threat-driven change, stale knowledge, noncombat outcomes, invalid observers, and invalid outcomes.

Still open:

- renderer-facing projections, online boundary audit, remaining action families, and production acceptance.

## Episode 8 — Renderer-facing and online-safe projections

Implemented:

- explicit public, observer, institutional, and local-debug projection scopes;
- qualitative self-skill projection without raw practice values;
- observer-scoped beliefs and surveillance records;
- agency-scoped case evidence, witness knowledge, jurisdiction, and authorized actions;
- privacy tests proving public transport omits hidden competence, private beliefs, global case confidence, full agency views, and server-only surveillance state;
- `docs/ONLINE_BOUNDARY.md` defining what is and is not an online claim.

Acceptance evidence:

- `npm test` passes 26 tests, including projection privacy and fail-closed scope validation.

Still open:

- remaining action families, renderer implementation, online service implementation, and production acceptance.

## Episode 9 — Bounded action outcomes

Implemented:

- evented traversal outcomes with layered route IDs, familiarity, noise, risk, and condition cost;
- evented melee outcomes with style, group participants, stamina, injury, environment contact, witness count, and disengagement;
- atomic bounded character-condition consequences;
- fail-closed invalid action outcomes with no partial mutation.

Acceptance evidence:

- `npm test` passes 28 tests, including traversal and melee action contracts.

Still open:

- vehicle/action edge cases, renderer implementation, online service implementation, and production acceptance.

## Episode 10 — Vehicle persistence and pursuit segments

Implemented:

- stable vehicle state with class, handling, mass, tires, owner, location, damage, condition, familiarity, pursuit history, and observer signals;
- urban, highway, mountain, and service-road action segments;
- driver-specific familiarity and persistent damage;
- catastrophic retirement with fail-closed later use.

Acceptance evidence:

- `npm test` passes 30 tests, including three vehicle segments and catastrophic retirement coverage.

Still open:

- renderer/runtime implementation, online service implementation, and production acceptance.

## Episode 11 — Local public-projection renderer preview

Implemented:

- a reproducible preview-data builder that runs the year-one history and writes only the public projection to `web/scenario.json`;
- an accessible local renderer with summary, business, and market panels;
- explicit loading and error states, semantic landmarks, live status text, responsive layout, and DOM text insertion through `textContent`;
- a renderer smoke test proving the preview is reproducible and excludes private beliefs, surveillance records, and police-case internals.

Acceptance evidence:

- `npm test` passes 32 tests, including the renderer projection/privacy smoke test;
- `npm run preview:build` regenerates the committed preview data deterministically;
- `git diff --check` passes for the episode files.

Still open:

- online transport/service implementation, production acceptance, and the explicitly deferred online underworld.

## Episode 12 — In-process authority and replication contract

Implemented:

- host and guest session admission with explicit region and role boundaries;
- ordered client intents whose outcomes are computed server-side;
- stale revision, duplicate sequence, unauthorized actor, and client-supplied authoritative-result rejection;
- canonical unique-entity ownership, contested lease rejection, disconnect claim release, and server-side transfer settlement;
- reconnect state with reconciliation metadata and interest-scoped, redacted event envelopes;
- hash-linked authority events, lease expiry, snapshot restore, and tamper detection.

Acceptance evidence:

- `npm test` passes 38 tests, including six authority/replication tests;
- `authority-network.test.mjs` covers stale/duplicate inputs, server-computed outcomes, ownership conflicts, disconnect/reconnect, redaction, lease expiry, and snapshot integrity.

Still open:

- real network transport/service deployment, encryption, moderation, availability, production performance, and the explicitly deferred online underworld.

## Episode 13 — Local service adapter

Implemented:

- transport-shaped `health`, `connect`, `input`, `disconnect`, `reconnect`, and `reconcile` request handling over the authority contract;
- bounded status/error responses for stale and duplicate inputs, malformed bodies, and unknown routes;
- redacted input acknowledgements and reconciliation envelopes that do not expose canonical event payloads or the persistent store;
- service tests that exercise the request boundary without opening a socket or claiming deployment.

Acceptance evidence:

- `npm test` passes 42 tests, including four local service-adapter tests;
- `service.test.mjs` proves successful connection/input flow, no-result leakage, stale/duplicate no-mutation behavior, disconnect/reconnect, reconciliation redaction, and bounded errors.

Still open:

- real network transport, encryption, authentication, moderation, persistence operations, availability, production performance, and the explicitly deferred online underworld.

## Episode 14 — Protection relationship economy

Implemented:

- persistent protection arrangements attached to real businesses with owner, provider, district, payment band, service expectations, vulnerability, trust, fear, resentment, competitor pressure, and police exposure;
- abstract treatment and service outcomes that distinguish respectful, pressured, humiliating, protective, absent, and partnership trajectories without encoding transferable real-world procedure;
- payment status, owner decisions, rival claims, arrangement termination, business reputation/condition impact, and six-month time aging;
- qualitative public projection bands that omit private relationship axes, provider identity, and history details;
- snapshot/replay coverage and fail-closed validation for ended arrangements, unauthorized collectors, impossible paid cycles, and stale claims.

Acceptance evidence:

- `npm test` passes 46 tests, including four protection-relationship tests;
- `protection.test.mjs` distinguishes coercive, protective, and partnership strategies across six months, verifies rival disputes and public redaction, and proves event-history restore.

Still open:

- vehicle-crime workflow beyond provenance/action persistence, aggregate-region simulation, co-op settlement, real network deployment, production acceptance, and the explicitly deferred online underworld.

## Episode 15 — Vehicle-crime provenance transitions

Implemented:

- persistent holder, owner history, appearance history, service history, storage history, police interest, market demand, recognition risk, trophy tags, and provenance history on every vehicle;
- abstract evented transitions for theft, storage, service, appearance change, processing, transfer, resale, return, and trophy display;
- unique identity continuity across ten transitions with no silent cloning or reset;
- qualitative public vehicle projection that omits owner/holder and detailed service/provenance history;
- fail-closed resale, trophy, retired-vehicle, and stale-revision validation.

Acceptance evidence:

- `npm test` passes 48 tests, including the ten-transition vehicle provenance trace and negative coverage;
- `vehicle.test.mjs` proves event-history restore, ownership continuity, service/storage/appearance histories, recognition-risk projection, and retirement boundaries.

Safety boundary:

- vehicle-crime transitions use abstract state labels and consequence history only; they do not encode bypass, theft, concealment, or evasion instructions.

Still open:

- aggregate-region simulation, co-op settlement, real network deployment, production acceptance, and the explicitly deferred online underworld.

## Episode 16 — Aggregate regional continuity

Implemented:

- fictionalized Sofia and Black Sea coastal region records with explicit `full` or `aggregate` simulation modes;
- a bounded Sofia/coastal corridor with travel time, transport friction, legal pressure, capacity, and restricted/open status;
- deterministic aggregate settlement with market, police, and logistics shocks, offscreen days, condition, scars, and history;
- world-time integration that settles aggregate regions while leaving full regions on the detailed path;
- mode transitions, public qualitative region/corridor projection, snapshot/replay, and stale/mode-boundary rejection.

Acceptance evidence:

- `npm test` passes 52 tests, including four aggregate-region tests;
- `region.test.mjs` proves two-region setup, corridor bounds, deterministic offscreen shocks, time settlement, public redaction, mode transitions, and restore equality.

Still open:

- co-op settlement, persistent online breadth, real network deployment, production acceptance, and the explicitly deferred online underworld.

## Episode 17 — Drop-in/drop-out co-op settlement

Implemented:

- explicit host-world session state with temporary associate, specialist, and crew-member guest roles;
- join-point admission, duplicate-character rejection, bounded guest capacity, shared operation participation, and host-world revision tracking;
- host-world consequences and guest consequences stored separately when an operation resolves;
- disconnect/reconnect handling that preserves an active host operation and marks transient guest state without deleting history;
- final guest leave settlement with injury/asset-return records, retained host consequences, foreign-world asset rejection, and host rewind prohibition;
- hash-linked co-op events, snapshot restore, tamper detection, stale revision rejection, and duplicate-guest protection.

Acceptance evidence:

- `npm test` passes 56 tests, including four co-op settlement tests;
- `coop.test.mjs` covers join, shared operation outcome, disconnect/reconnect, guest leave settlement, ownership boundary, stale rejection, host rewind restriction, and snapshot integrity.

Still open:

- persistent online underworld breadth, real network deployment, authentication/encryption, production acceptance, and the explicitly deferred online MMO layer.

## Episode 18 — Persistent Underworld macro proof

Implemented:

- fictionalized shard state with server era, weekly tick, organizations, shared market classes, properties, territory claims, season history, and bounded physical-session summaries;
- offline-eligible organization work that advances during a server-week settlement even when no physical session is active;
- shared market shocks with deterministic pressure/index changes and qualitative public bands;
- property conflict state that preserves one canonical owner while recording contested claimants;
- a maximum of 16 physical sessions per weekly settlement and a maximum of 8 participants per session;
- hash-linked weekly events, public macro projection, snapshot restore, and tamper/stale/bounds rejection.

Acceptance evidence:

- `npm test` passes 60 tests, including four persistent-Underworld tests;
- `underworld.test.mjs` proves one-week market/work/session settlement, property conflict, public redaction, bounded sessions, stale rejection, and snapshot integrity.

Safety and evidence boundary:

- shared commodity classes and organization outcomes are abstract fictional simulation labels; this episode does not provide real-world criminal logistics or operational guidance;
- this is an in-process one-week proof, not a production MMO, live service, or availability claim.

Still open:

- dynasty/successor state, full content scale, real network deployment, authentication/encryption, moderation, production acceptance, and the explicitly deferred online MMO layer.

## Episode 19 — Dynasty and successor continuity

Implemented:

- lineage state with founder registration, retirement/disappearance/death outcomes, eras, public titles, season participation, and legacy trophies;
- explicit inheritance manifests for properties, organization offices, documents, trophies, introductions, and burden bands;
- successor creation that increments era and transfers only manifest-approved durable channels;
- fail-closed rejection of private memory, familiarity, exact skill, and other non-transferable capability fields;
- public dynasty projection that exposes lineage/title/burdens while omitting private capability and event internals;
- hash-linked events, snapshot restore, stale rejection, manifest-use protection, and tamper detection.

Acceptance evidence:

- `npm test` passes 64 tests, including four dynasty/successor tests;
- `dynasty.test.mjs` proves explicit inheritance, non-transfer of private capability/memory, season/trophy recognition without competitive power, stale/missing-state rejection, and snapshot integrity.

Still open:

- full content scale, production network deployment, authentication/encryption, moderation, performance/hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 20 — Consequential abstract ranged action

Implemented:

- persistent coarse weapon state with class, handling profile, abstract ammunition, condition, owner, location, and shot history;
- evented ranged encounters with stance, cover state, range band, stress, qualitative familiarity, suppression, injury outcome, sound band, witness/camera counts, police-interest delta, and abstract evidence artifacts;
- weapon wear and ammunition settlement without a gunsmith simulator;
- public projection with qualitative weapon condition/ammo bands and no owner, exact ammo, shot history, or firearm-evidence internals;
- snapshot/replay and stale, invalid, retired-weapon, and over-ammo rejection.

Acceptance evidence:

- `npm test` passes 67 tests, including three ranged-action tests;
- `ranged.test.mjs` proves consequential encounter state, public redaction, replay equality, and fail-closed proposals.

Safety boundary:

- this is an abstract fictional action model. It encodes no real-world weapon operation, aiming, modification, acquisition, or evasion procedure.

Still open:

- prison/re-entry state, remaining content volumes, production network deployment, authentication/encryption, moderation, performance/hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 21 — Time-bearing prison and re-entry state

Implemented:

- sentence, facility, cell block, time served, prison reputation, prison relationships, outside relationships, visitation, prison work, status marks, injury, and re-entry state;
- compressed or playable time settlement that advances the simulation date and evolves prison life;
- outside-world drift bands for relationships, businesses, markets, and organization control during multi-year absence;
- release transition with explicit re-entry differences rather than a fail-screen reset;
- public projection that omits relationship internals, outside contacts, injury, work history, and event-chain details;
- snapshot/replay, stale/overrun/released-state rejection, and tamper detection.

Acceptance evidence:

- `npm test` passes 71 tests, including four prison/re-entry tests;
- `prison.test.mjs` proves a three-year sentence, outside-world drift, prison/street separation, release state, bounds, restore equality, and tamper rejection.

Safety boundary:

- prison outcomes use abstract social/time labels only; they do not encode real-world institutional, evasion, or violence procedures.

Still open:

- remaining content volumes, production network deployment, authentication/encryption, moderation, performance/hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 22 — Tattoos, rank, and visible history

Implemented:

- marker state for body location, category, origin, organization relation, prison context, earned history, visibility, age, and historical band;
- observer profiles with scoped organization and era knowledge so the same marker can be recognized, misunderstood, or ignored by different people;
- qualitative consequences for unauthorized claims and unearned status without a universal authority token;
- covered/concealed visibility, decade aging into old-guard history, and public projection that omits issuer, organization, recognition, misuse, and event internals;
- hash-linked snapshots plus stale, invalid, and tamper rejection.

Acceptance evidence:

- `npm test` passes 75 tests, including four tattoo/status tests;
- `tattoos.test.mjs` proves three observer-specific interpretations, prison-context history, aging, private visibility, fail-closed writes, and snapshot integrity.

Safety boundary:

- this is a fictional social-history model. It does not encode tattoo symbolism, impersonation, evasion, violence, or real-world criminal procedure.

Still open:

- organization doctrine and succession, remaining content volumes, production network deployment, authentication/encryption, moderation, performance/hardware acceptance, and the explicitly deferred online MMO layer.
## Episode 23 — Organization doctrine and succession

Implemented:

- doctrine rules for permitted, forbidden, tolerated, civilian, family, foreign, and police-policy bands;
- member decisions that use personal values and knowledge scope, producing compliance, pause, or deviation with an evented consequence;
- leadership succession scoring seniority, relationship, capability, coalition support, and discipline history;
- consolidated, fragmented, and caretaker outcomes after retirement, death, arrest, or disappearance;
- authorized doctrine changes, generational-tension aging, public/private governance projection, hash-linked snapshots, and fail-closed stale/tampered writes.

Acceptance evidence:

- `npm test` passes 79 tests, including four doctrine/succession tests;
- `doctrine.test.mjs` proves three succession graphs, non-automatic compliance, authorization/time behavior, redaction, and snapshot integrity.

Safety boundary:

- this is a fictional organization-governance model. It does not encode real-world criminal logistics, recruitment, coercion, evasion, or operational procedure.

Still open:

- remaining content volumes, production network deployment, authentication/encryption, moderation, performance/hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 24 — Abstract drug economy and health externality

Implemented:

- fictional product classes with regional supply/demand, quality, police pressure, organization policy, and health externality;
- batch creation that consumes simulated supply and never silently replaces a supply shock;
- 30% seizure/loss shocks with scarcity pressure, institutional attention, and community-health consequences;
- organization prohibition, long-horizon time settlement, public redaction, hash-linked snapshots, and fail-closed stale/tampered writes.

Acceptance evidence:

- `npm test` passes 83 tests, including four drug-economy tests;
- `drug-economy.test.mjs` proves downstream shock effects without replacement spawns, policy rejection, time-borne externality, redaction, and snapshot integrity.

Safety boundary:

- all products and routes are fictionalized abstractions. This episode does not encode production, dosage, trafficking, concealment, evasion, or other real-world criminal procedure.

Still open:

- smuggling/logistics, legitimate fronts/money, remaining world/content volumes, production network deployment, authentication/encryption, moderation, performance/hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 25 — Abstract route logistics

Implemented:

- fictional route state with coarse segments, access requirements, travel-time, weather/hazard costs, border state, contacts, fallback count, and versioned conditions;
- planned transit risk bands using familiarity, vehicle fit, contact reliability, and institutional pressure;
- explicit proceed, delay, reroute, and cancel outcomes;
- stale-plan rejection after route changes, replan-required behavior, route aging to obsolete, qualitative public projection, hash-linked snapshots, and fail-closed invalid writes.

Acceptance evidence:

- `npm test` passes 87 tests, including four logistics tests;
- `logistics.test.mjs` proves causal transit outcomes, changed-route invalidation, time aging, redaction, and snapshot integrity.

Safety boundary:

- routes and cargo are fictionalized labels. This episode does not encode real-world geography, concealment, border evasion, trafficking, contact handling, or operational procedure.

Still open:

- legitimate fronts/money, remaining world/content volumes, production network deployment, authentication/encryption, moderation, performance/hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 26 — Legitimate fronts and separate money state

Implemented:

- business identity, sector, capital, property, staff, manager competence/loyalty/incentive, maturity, legitimate cashflow, expenses, debt, reputation, tax attention, political connections, and criminal dependency;
- three identical businesses that diverge over five years from different management quality;
- manager turnover with persistent business identity and future-outcome change;
- public projection separating qualitative maturity/reputation/debt/attention from private finance, manager internals, political connections, and event history;
- hash-linked snapshots and fail-closed stale/invalid/tampered writes.

Acceptance evidence:

- `npm test` passes 91 tests, including four fronts/money tests;
- `fronts.test.mjs` proves five-year divergence, manager turnover, financial/public separation, and snapshot integrity.

Safety boundary:

- this is a fictional business-simulation model. It does not provide accounting, laundering, tax evasion, political influence, or real-world financial-crime instructions.

Still open:

- remaining world/content volumes, production network deployment, authentication/encryption, moderation, performance/hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 27 — World aging and environmental memory

Implemented:

- place state for region, type, condition, institutional attention, status, age, public/local/private memories, scars, and changing social meaning;
- public, local, and private memory visibility with canonical condition/attention consequences;
- seven-year era transition, persistent scars, era-layered place meaning, and time-driven renovation eligibility;
- qualitative public projection, hash-linked snapshots, and fail-closed stale/invalid/tampered writes.

Acceptance evidence:

- `npm test` passes 95 tests, including four world-aging tests;
- `world-aging.test.mjs` proves divergent place aging, scar persistence, private-memory redaction, era transition, and snapshot integrity.

Safety boundary:

- this is a fictionalized world-history model. It does not claim a factual reconstruction of Bulgaria, specific real places, or real institutional events.

Still open:

- remaining world/content volumes, production network deployment, authentication/encryption, moderation, performance/hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 28 — Content-pack admission and era variants

Implemented:

- transactional authored-pack admission for regions, NPCs, businesses, and organizations;
- stable IDs with cross-reference validation before mutation;
- era variants attached to stable base content and activated without replacing canonical identity;
- public pack projection with counts and active era while authoring metadata, event history, source revisions, and unactivated variants remain private;
- hash-linked snapshots and fail-closed stale, duplicate, missing-reference, and tampered writes.

Acceptance evidence:

- `npm test` passes 99 tests, including four content-admission tests;
- `content.test.mjs` proves cross-reference validation, stable era activation, no-partial-admission behavior, public projection, and snapshot integrity.

Safety boundary:

- this is a fictional content-authoring registry. It does not claim factual geography, real-person likeness, or production-ready asset validation.

Still open:

- remaining world/content volumes, production network deployment, authentication/encryption, moderation, performance/hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 29 — Needs and unlock web

Implemented:

- nodes that require meaningful practice, knowledge, familiarity, time, relationships, and context together;
- explainable evaluation with unmet reasons and distinct evidence sources;
- explicit claim/effect ownership without generic XP currency;
- hidden/discovered visibility, qualitative public projection, hash-linked snapshots, and fail-closed stale/invalid/ineligible writes.

Acceptance evidence:

- `npm test` passes 103 tests, including four unlock-web tests;
- `unlock-web.test.mjs` proves multi-dimensional gating, two eligibility histories, no-XP progression, explainable locks, and snapshot integrity.

Safety boundary:

- this is a fictional progression/evidence model. It does not grant real-world credentials, teach operational procedure, or expose private competence merely because a node is evaluated.

Still open:

- remaining world/content/technical volumes, production network deployment, authentication/encryption, moderation, performance/hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 30 — Conflict windows and anti-grief structure

Implemented:

- explicit conflict declarations with participants, causal claim, location, mode, bounded window, and optional property scope;
- offline-property protection and explicit contest settlement;
- nonlethal competition modes separate from a capped two-day abstract violent window;
- repeated-harassment rate limiting, cooldown expiry, evidence, recovery bands, qualitative public projection, hash-linked snapshots, and fail-closed writes.

Acceptance evidence:

- `npm test` passes 107 tests, including four conflict-policy tests;
- `conflict.test.mjs` proves offline-property safety, nonlethal/violent-window separation, harassment cooldowns, redaction, and snapshot integrity.

Safety boundary:

- anti-grief protections are explicit game/server rules. This episode does not encode real-world violence, intimidation, retaliation, or enforcement procedure.

Still open:

- performance budgets, production network deployment, authentication/encryption, moderation, remaining technical/content volumes, and the explicitly deferred online MMO layer.

## Episode 31 — Simulation fidelity and performance budgets

Implemented:

- deterministic entity fidelity state with importance, distance, simulation mode, update rate, AI/physics/history tiers, network interest, and promotion/demotion reasons;
- explicit full/promoted/aggregate caps and deterministic rebalancing;
- separate renderer, simulation, and network budget reporting under synthetic stress inputs;
- qualitative public projection, hash-linked snapshots, and fail-closed stale/invalid/tampered writes.

Acceptance evidence:

- `npm test` passes 111 tests, including four performance-budget tests;
- `performance.test.mjs` proves deterministic promotion, caps, separate budgets, invalid writes, and snapshot integrity.

Safety/evidence boundary:

- these are executable budget contracts and synthetic stress reports, not hardware/FPS proof. Real renderer, server, and platform acceptance remain external gates.

Still open:

- production network deployment, authentication/encryption, moderation, remaining technical/content volumes, hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 32 — Authority snapshot recovery

Implemented:

- authority snapshot restart before accepting new input;
- packet-loss retry idempotency through per-session input sequence;
- ordered next-input acceptance against the restored revision;
- corrected build-log order for Episodes 22–31 so acceptance evidence follows dependency order.

Acceptance evidence:

- `npm test` passes 112 tests, including the authority recovery test;
- `authority-network.test.mjs` proves restored duplicate rejection and next-sequence admission.

Boundary:

- this is an in-process recovery contract, not production transport, TLS, authentication, durable database, failover, moderation, or availability proof.

Still open:

- production network deployment, authentication/encryption, moderation, remaining technical/content volumes, hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 33 — Fictionalized national world structure

Implemented:

- capital, coastal, rural, and mountain geography roles with stable identities and distinct social/architectural cues;
- coarse road, rail, and sea links with bounded travel, capacity, friction, and seasonal status;
- six-month settlement that changes coastal and mountain continuity while preserving region identity;
- public topology projection with exact institutional, financial, private-memory, and transport detail redacted;
- hash-linked snapshots plus stale, invalid-topology, and tamper rejection.

Acceptance evidence:

- `npm test` passes 117 tests, including five geography tests;
- `geography.test.mjs` proves the representative four-role fixture, seasonal settlement, public redaction, fail-closed writes, and snapshot integrity.

Boundary:

- all labels and links are fictionalized abstractions, not factual national mapping or real-world criminal logistics.

Still open:

- production network deployment, authentication/encryption, moderation, remaining technical/content volumes, hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 34 — Pauseable systemic single-player campaign

Implemented:

- setup, active, paused, completed, and retired campaign lifecycle;
- controlled time settlement with missed opportunities adapting into explicit branches;
- systemic jobs and businesses settling between authored chapters;
- offline campaign completion with an explicit ending;
- successor continuation carrying public legacy bands without exact skills, private memories, or competitive power;
- snapshot, stale-write, and tamper rejection.

Acceptance evidence:

- `npm test` passes 122 tests, including five campaign tests;
- `campaign.test.mjs` proves pause/resume, opportunity drift, systemic settlement, offline completion, successor continuity, and snapshot integrity.

Boundary:

- this is a headless campaign contract, not authored mission dialogue, audio, animation, UI, or production executable proof.

## Episode 35 — Offscreen and aggregate simulation

Implemented:

- Full and Aggregate region modes with separate continuity counters;
- important named entities promoted across aggregate settlement;
- deterministic scheduled event materialization after elapsed time;
- aggregate-to-full reconciliation with explicit unknown witness detail;
- public continuity bands with materialization seeds and exact event payloads redacted;
- snapshot, stale-write, invalid-region, and tamper rejection.

Acceptance evidence:

- `npm test` passes 127 tests, including five offscreen-simulation tests;
- `offscreen.test.mjs` proves Full/Aggregate settlement, promoted entities, scheduled materialization, redaction, reconciliation, and snapshot integrity.

Boundary:

- this is a deterministic headless contract, not production streaming, crowd simulation, exact witness reconstruction, or online availability proof.

## Episode 36 — Regional market ecology

Implemented:

- regional supply, demand, inventory, price bands, resilience, and ecological pressure;
- coarse market links with capacity, friction, latency, and status;
- bounded cross-region flow that preserves local shortage;
- source/sink-accounted shocks and resilience-driven ecological recovery;
- public price and continuity bands with exact economic and shock history redacted;
- snapshot, stale-write, invalid-link, and tamper rejection.

Acceptance evidence:

- `npm test` passes 132 tests, including five market-ecology tests;
- `market-ecology.test.mjs` proves bounded flow, shock direction, ecological recovery, public redaction, and snapshot integrity.

Boundary:

- this is a fictionalized economic contract, not real-world procurement, trafficking, concealment, evasion, or financial-crime procedure.

## Episode 37 — Reversible procedural authoring and admission

Implemented:

- seed/history-stable procedural candidate proposals;
- structure-before-function-before-history/economy/social/crime layer ordering;
- entry-to-exit topology validation before admission;
- evidence-gated expansion with admission receipts;
- reversible admission without deleting stable authored identity;
- public authoring projection with exact topology, notes, evidence sources, and digests redacted;
- snapshot, stale-write, missing-evidence, invalid-topology, and tamper rejection.

Acceptance evidence:

- `npm test` passes 137 tests, including five procedural-authoring tests;
- `authoring.test.mjs` proves deterministic proposal identity, evidence-gated admission, reversible receipts, topology safety, public redaction, and snapshot integrity.

Boundary:

- this is an offline fictional authoring contract, not Cartographer/VANTA production integration or unrestricted procedural generation.

## Episode 38 — Bounded persistent online shard contract

Implemented:

- bounded player session join/leave state without property deletion;
- NPC baseline population and liquidity so player activity is not the only economic actor;
- capped weekly player market influence with source attribution and reset at shard settlement;
- public shard projection for markets, baselines, organizations, properties, and active sessions;
- preservation of the existing offline organization, market, property-conflict, bounded-session, and snapshot paths.

Acceptance evidence:

- `npm test` passes 140 tests, including three online-shard tests;
- `underworld.test.mjs` proves session continuity, property survival, NPC baseline liquidity, influence caps, weekly reset, and public projection.

Boundary:

- this is an in-process shard contract, not production sockets, auth/encryption, durable storage, moderation, anti-cheat, failover, availability, or deployment proof.

## Episode 39 — Qualitative UI/UX projection

Implemented:

- qualitative contact summaries for history, reliability, obligation, and availability;
- pressure cues for direction, cause, and uncertainty without hidden formulas;
- calendar/life-course, organization assignment, property, learned-map, and notification view models;
- public-scope enforcement and omission of exact trust, debt, competence, case confidence, and server-only pressure;
- stable fail-soft notification tones and invalid-scope/band rejection.

Acceptance evidence:

- `npm test` passes 145 tests, including five UI-projection tests;
- `ui-projection.test.mjs` proves qualitative language, map filtering, assignment clarity, private-scope rejection, and stable notifications.

Boundary:

- this is a headless UI view-model contract, not fresh-player usability, localization, controller navigation, accessibility, authored dialogue/audio, or shipping native-client proof.

Still open:

- production network deployment, authentication/encryption, moderation, remaining technical/content volumes, hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 40 — Executable docuseries acceptance verifier

Implemented:

- repository verifier for PASS-row evidence references and SECTION docs;
- contiguous build-log episode validation;
- README scope and package-script validation;
- public preview artifact validation;
- explicit reporting of external gates that remain open.

Acceptance evidence:

- `npm test` passes 146 tests, including the verifier test;
- `npm run preview:build` passes;
- `npm run verify` reports `docuseries-verify: PASS`.

Boundary:

- this gate checks repository evidence discipline; it does not prove hardware/FPS, fresh-player usability, accessibility, security, production network deployment, or online availability.

Still open:

- production network deployment, authentication/encryption, moderation, remaining technical/content volumes, hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 41 — Versioned save/replay and counterfactual branches

Implemented:

- versioned save envelopes with deterministic snapshot digests and metadata checks;
- explicit version-zero migration through the authoritative event-chain restore path;
- checkpoint replay for accelerated multi-year time settlement;
- isolated counterfactual branches that cannot overwrite canonical checkpoints;
- tamper, schema, digest, event-count, and metadata rejection before restore.

Acceptance evidence:

- `npm test` passes 150 tests, including four save/replay tests;
- `save-replay.test.mjs` proves current round trips, legacy migration, five-year replay, counterfactual isolation, and tamper rejection;
- `npm run verify` continues to report `docuseries-verify: PASS`.

Boundary:

- this is a deterministic local save/replay contract, not filesystem crash atomicity, cloud durability, online rollback, or a production migration service.

Still open:

- production network deployment, authentication/encryption, moderation, remaining technical/content volumes, hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 42 — Bounded NPC belief, planning, and adaptation

Implemented:

- belief-scoped planning that reads NPC knowledge rather than evaluator truth;
- competing needs, obligations, and goal postures;
- major/background plan bounds;
- repeated-observation adaptation with a hard pressure cap;
- organization-order outcomes through loyalty, fear, competence, and consequence band;
- time settlement, event hashing, snapshot integrity, and privacy-safe public projection.

Acceptance evidence:

- `npm test` passes 155 tests, including five NPC AI tests;
- `npc-ai.test.mjs` proves scoped planning, need/obligation competition, repeated-only adaptation, capped pressure, order discretion, time settlement, snapshot integrity, and redaction;
- `npm run verify` continues to report `docuseries-verify: PASS`.

Boundary:

- this is a fictional abstract NPC contract, not real-world surveillance, criminal procedure, or operational guidance.

Still open:

- production network deployment, authentication/encryption, moderation, remaining technical/content volumes, hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 43 — Order-independent event projection fan-out

Implemented:

- deterministic event-set fan-out for social, case, vehicle, and other event families;
- idempotent delivery for repeated committed events;
- conflicting duplicate-ID rejection before projection mutation;
- qualitative public activity bands with private payload/actor omission;
- snapshot validation for both source events and derived projection state.

Acceptance evidence:

- `npm test` passes 159 tests, including four event-projection tests;
- `event-projections.test.mjs` proves order independence, retry idempotency, duplicate rejection, public redaction, and snapshot integrity;
- `npm run verify` continues to report `docuseries-verify: PASS`.

Boundary:

- this is a local projection/fan-out contract, not a production message broker or network delivery guarantee.

Still open:

- production network deployment, authentication/encryption, moderation, remaining technical/content volumes, hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 44 — Atomic authoritative mutation batches

Implemented:

- bounded declarative event proposals through the existing authority path;
- deterministic batch identity and contiguous event lineage;
- stale preflight rejection before proposal evaluation;
- all-or-nothing validation with no partial caller mutation;
- save/restore compatibility for batched history.

Acceptance evidence:

- `npm test` passes 163 tests, including four atomic-batch tests;
- `atomic-batch.test.mjs` proves contiguous commits, shared batch identity, stale preflight, all-or-nothing failure, and snapshot compatibility;
- `npm run verify` continues to report `docuseries-verify: PASS`.

Boundary:

- this is an in-process transaction contract, not database transactions, distributed commit, production sockets, or external-side-effect rollback.

Still open:

- production network deployment, authentication/encryption, moderation, remaining technical/content volumes, hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 45 — Functional content admission

Implemented:

- functional location identities with region and access-mode references;
- directed route identities with endpoint and movement-mode validation;
- actor schedule templates with known actors, known locations, and non-zero hour windows;
- pre-commit rejection for broken references, missing access labels, and impossible schedules;
- stable era variants for functional content identities.

Acceptance evidence:

- `npm test` passes 166 tests, including three content-pipeline tests;
- `content-pipeline.test.mjs` proves functional admission, broken-reference rejection, schedule validation, and no partial commit;
- `npm run verify` continues to report `docuseries-verify: PASS`.

Boundary:

- this is a fictional local content-admission contract, not production asset import, visual reachability, dialogue/audio, or cultural-review proof.

Still open:

- production network deployment, authentication/encryption, moderation, remaining technical/content volumes, hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 46 — Scenario trace acceptance ledger

Implemented:

- source-document mapping for all ten supplied scenario traces;
- executable subsystem-test references for each trace;
- machine-checked source/test existence and test-body validation;
- explicit fiction, safety, and evidence boundaries for scenario claims.

Acceptance evidence:

- `npm test` passes 167 tests, including the scenario coverage test;
- `scenario-coverage.test.mjs` proves all ten trace rows resolve to source documents and executable tests;
- `npm run verify` reports `scenario-traces=10` and `docuseries-verify: PASS`.

Boundary:

- the ledger binds evidence but does not claim finished authored missions, dialogue, animation, cultural review, or production online sessions.

Still open:

- production network deployment, authentication/encryption, moderation, remaining technical/content volumes, hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 47 — Bounded transport envelope and admission guard

Implemented:

- signed abstract intent envelopes with session identity, sequence, nonce, and tick;
- rejection of client-provided authoritative results and world-state payloads;
- ordered retry/idempotency, conflicting duplicate rejection, and clock-skew checks;
- explicit rate-limit and moderation-hold outcomes;
- public transport projection and hash-linked snapshot recovery.

Acceptance evidence:

- `npm test` passes 172 tests, including five transport-envelope tests;
- `transport-envelope.test.mjs` proves integrity, replay handling, rate limiting, moderation holds, snapshot recovery, and redaction;
- `npm run verify` continues to report `docuseries-verify: PASS`.

Boundary:

- this is a local integrity/admission contract, not production encryption, key management, TLS, anti-cheat, moderation operations, availability, deployment, or compliance acceptance.

Still open:

- production network deployment, authentication/encryption, moderation, remaining technical/content volumes, hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 48 — Public qualitative UI wired into browser preview

Implemented:

- preview generation now includes the tested qualitative UI projection;
- browser surface renders calendar/life-course cues, learned-map context, market pressure, and place/ownership cues;
- public projection remains the only data source and private fields stay omitted;
- preview tests bind the UI contract to committed HTML/JavaScript sections.

Acceptance evidence:

- `npm test` passes 174 tests, including two preview-UI tests;
- `preview-ui.test.mjs` proves the generated public UI payload and projection-only browser surface;
- `npm run preview:build` and `npm run verify` pass.

Boundary:

- this is a deterministic local browser preview, not fresh-player usability, localization, accessibility audit, native-client, or production deployment proof.

Still open:

- production network deployment, authentication/encryption, moderation, remaining technical/content volumes, hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 49 — Browser preview context surfaces

Implemented:

- public preview contacts now show qualitative history, reliability, obligation, and availability cues;
- organization doctrine and work assignments render without member identities or private capability state;
- stable notices communicate settled history and blocked work without leaking exact causes or server-only values;
- preview tests bind these context surfaces to committed HTML/JavaScript sections.

Acceptance evidence:

- `npm test` passes 174 tests, including the browser preview tests;
- `preview-ui.test.mjs` proves contacts, organization assignments, notices, and projection-only browser surface;
- `npm run preview:build` and `npm run verify` pass.

Boundary:

- this is a deterministic local browser preview, not fresh-player usability, localization, accessibility audit, native-client, or production deployment proof.

Still open:

- production network deployment, authentication/encryption, moderation, remaining technical/content volumes, hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 50 — Authored vertical-slice district package

Implemented:

- the vertical slice now builds one admitted fictionalized district content package;
- the package contains 30 residents, 3 businesses, 2 organizations, 8 locations, 7 routes, and 30 schedule templates;
- late-1990s variants preserve stable location and route identities;
- the public preview includes the admitted package projection and stable counts;
- package acceptance preserves the fiction/safety boundary.

Acceptance evidence:

- `npm test` passes 175 tests, including `content-pack.test.mjs`;
- `content-pack.test.mjs` proves one-transaction admission and expected topology/schedule counts;
- `npm run preview:build` and `npm run verify` pass.

Boundary:

- this is a deterministic local content package, not imported production assets, visual reachability, authored dialogue/audio, cultural review, or a shipping native client.

Still open:

- production network deployment, authentication/encryption, moderation, remaining technical/content volumes, hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 51 — Branchable authored scenario content

Implemented:

- the admitted district package now carries a persistent scenario registry;
- the vertical slice opens with observe, meet, and delegate branches that converge on a shared consequence scene;
- scene admission and choice resolution are revision-bound, hash-linked, snapshot-restorable, and publicly projected;
- instructional/evasion language is rejected at authoring time;
- the browser preview renders the authored opening from public scenario data.

Acceptance evidence:

- `npm test` passes 177 tests, including two scenario-pack tests;
- `scenario-pack.test.mjs` proves branch resolution, restore equality, topology rejection, stale rejection, and public omission fields;
- `npm run preview:build` and `npm run verify` pass.

Boundary:

- this is a fictional authored scenario graph, not real-world criminal instruction, authored dialogue/audio, animation, cultural review, or a production mission runtime.

Still open:

- production network deployment, authentication/encryption, moderation, remaining technical/content volumes, hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 52 — Content/runtime alignment guard

Implemented:

- authored locations and routes are checked against canonical topology stored in authoritative engine state;
- authored residents, businesses, and organizations are checked against authoritative world identity;
- preview generation fails closed on package/runtime drift;
- alignment evidence reports stable vertical-slice counts;
- the topology survives engine snapshot/replay while remaining outside the public projection.

Acceptance evidence:

- `npm test` passes 178 tests, including two content-pack tests;
- `content-pack.test.mjs` proves identity alignment and negative drift rejection;
- `npm run preview:build` and `npm run verify` pass with the guard active.

Boundary:

- this is a local identity/topology consistency guard, not imported production assets, visual reachability, animation, authored dialogue/audio, or cultural review.

Still open:

- production network deployment, authentication/encryption, moderation, remaining technical/content volumes, hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 53 — Authored scenario runtime bridge

Implemented:

- authored observe choices emit bounded information-history events;
- authored meet choices resolve through the relationship authority path;
- authored delegate choices claim organization work through the lease authority path;
- stale dispatch rejects before mutation and client outcomes are never trusted;
- the fiction/safety boundary remains explicit.

Acceptance evidence:

- `npm test` passes 180 tests, including two scenario-runtime tests;
- `scenario-runtime.test.mjs` proves observe, meet, and delegate outcomes plus stale rejection;
- `npm run preview:build` and `npm run verify` pass.

Boundary:

- this is a deterministic local runtime bridge for fictional consequences, not a production mission executor, authored dialogue/audio system, animation system, or real-world operational guide.

Still open:

- production network deployment, authentication/encryption, moderation, remaining technical/content volumes, hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 54 — Integrated vertical-slice runtime bundle

Implemented:

- engine world, content registry, and authored scenario registry save as one versioned bundle;
- each subsystem keeps its own hash/revision validation;
- content-pack and scenario location identity bindings are checked on restore;
- canonical district topology survives bundle round-trip;
- tampered subsystem history fails closed.

Acceptance evidence:

- `npm test` passes 182 tests, including two runtime-bundle tests;
- `runtime-bundle.test.mjs` proves full bundle equality and tampered scenario-history rejection;
- `npm run verify` passes with external gates still recorded separately.

Boundary:

- this is a deterministic local persistence boundary, not crash-safe filesystem writing, cloud backup durability, online rollback, or a production migration service.

Still open:

- production network deployment, authentication/encryption, moderation, remaining technical/content volumes, hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 55 — Machine-checked docuseries delivery matrix

Implemented:

- all 74 numbered docuseries volumes and 10 scenario traces are grouped by dependency directory;
- expected source-file counts are checked against the checkout;
- each group carries explicit SHIPPED, BOUNDED, COMPOSED, OPEN, or DEFERRED status;
- the matrix records external production, usability, cultural, hardware, and online gates without promoting them to local proof.

Acceptance evidence:

- `npm test` passes 182 tests;
- `npm run verify` reports `docuseries-source-files=84` and checks the matrix counts;
- acceptance evidence remains 68 PASS rows and 2 intentionally OPEN gates.

Boundary:

- the matrix is an evidence index, not a substitute for production deployment, live-player, hardware, cultural-review, or full online acceptance.

Still open:

- production network deployment, authentication/encryption, moderation, remaining technical/content volumes, hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 56 — End-to-end vertical-slice demo

Implemented:

- `npm run demo` now settles the year-one vertical slice;
- it admits authored content and scenario state, dispatches a delegate branch, and prints public qualitative output;
- the integrated runtime bundle is restored and compared for equality;
- the demo is executable in a clean local process and covered by a test.

Acceptance evidence:

- `npm test` passes 183 tests, including `demo.test.mjs`;
- `npm run demo` produces the expected public JSON result;
- `npm run verify` continues to pass with all external gates recorded separately.

Boundary:

- this is a deterministic local demonstration, not a native game executable, production server, authored dialogue/audio experience, accessibility study, or online session.

Still open:

- production network deployment, authentication/encryption, moderation, remaining technical/content volumes, hardware acceptance, and the explicitly deferred online MMO layer.

## Episode 57 — Browser scenario interaction

Implemented:

- the public browser preview now offers buttons for the active authored scene;
- selecting observe, meet, delegate, or defer advances the public scenario projection and shows a qualitative consequence cue;
- previous scenes render as resolved and the follow-up scene becomes available in dependency order;
- the UI states that the branch is held in memory only and does not mutate authoritative world state.

Acceptance evidence:

- `npm test` passes the browser preview contract;
- `npm run preview:build` regenerates the public payload consumed by the interactive page;
- `npm run verify` checks the new acceptance row and existing external-gate ledger.

Boundary:

- this is a local presentation interaction, not an authoritative server route, crash-safe save, multiplayer session, moderation system, accessibility certification, localization pass, controller implementation, or production client.

Later verification:

- test authoritative browser-to-runtime transport, persistence, synchronization, moderation, availability, and fresh-player usability in a separately deployed environment.

## Episode 58 — Loopback HTTP authority adapter

Implemented:

- the in-process authority service is now reachable through a real local Node HTTP socket;
- health, session connection, ordered input, duplicate/stale errors, malformed JSON, and redacted response behavior are exercised over loopback;
- `npm run serve:authority` provides a bounded local process entry point on `127.0.0.1`;
- the adapter enforces a request-body limit and does not expose server-private authority payloads.

Acceptance evidence:

- `npm test` includes two ephemeral-socket HTTP tests;
- `npm run verify` checks the new acceptance row and evidence files;
- the existing in-process service tests remain green.

Boundary:

- this is a local socket adapter, not TLS/authentication, durable storage, moderation operations, failover, load/availability, browser compatibility, or production deployment proof.

Later verification:

- connect the browser scenario surface to an authoritative runtime endpoint only after session/authentication, persistence, synchronization, and moderation policy are specified and tested.

## Episode 59 — Authoritative scenario HTTP runtime

Implemented:

- a reusable vertical runtime factory assembles the settled world, admitted content, and active authored scenario graph;
- `GET /scenario` exposes public revisions and projections;
- `POST /scenario/choice` performs revision-checked authored choice resolution and systemic consequence application as one local commit;
- stale or invalid dispatches leave both the world event history and scenario event history unchanged;
- private beliefs, hidden competence, case confidence, and event hashes remain outside the response boundary.

Acceptance evidence:

- `npm test` includes two authoritative scenario service tests over an ephemeral loopback socket;
- `npm run verify` checks the acceptance evidence and contiguous build history;
- the existing runtime-bundle and scenario-runtime tests remain green.

Boundary:

- this is a deterministic local authority endpoint, not production authentication, TLS, durable storage, moderation operations, multiplayer session management, failover, load testing, or native-client acceptance.

Later verification:

- connect the browser client through an authenticated session contract after persistence, synchronization, moderation, and availability requirements are separately specified and tested.

## Episode 60 — Local preview/runtime integration

Implemented:

- the preview server serves the committed page/assets and the authoritative local scenario endpoint together;
- the browser detects revision-bearing local authority and submits choices with world and scenario revisions;
- successful local responses advance the rendered public scenario, while static-file viewing retains its explicit in-memory fallback;
- the server uses an allowlisted asset surface and preserves public-only response projection.

Acceptance evidence:

- `npm test` includes an ephemeral preview-server test plus browser wiring assertions;
- `npm run verify` checks the new acceptance row and contiguous episode history;
- `npm run serve:preview` is the documented local launch path.

Boundary:

- this is local preview/runtime integration, not production TLS/authentication, session lifecycle, durable persistence, multiplayer synchronization, moderation operations, load/availability, accessibility, localization, authored dialogue/audio, or native-client acceptance.

## Episode 61 — Local scenario session identity boundary

Implemented:

- local scenario sessions connect before accepting choices;
- the service derives `character:player` from the connected session instead of trusting a client actor field;
- unknown sessions and mismatched actor claims fail before either history mutates;
- the browser preview performs the local session handshake automatically when the local authority endpoint is available.

Acceptance evidence:

- `npm test` covers session connection, actor derivation, mismatch rejection, and preview-server dispatch;
- `npm run verify` checks the new acceptance evidence and contiguous episode sequence.

Boundary:

- this is a local identity-binding contract, not credentials, TLS, account authentication, authorization policy, expiry, replay protection, moderation operations, durable sessions, or production security acceptance.

## Episode 62 — Integrated regional runtime trace

Implemented:

- a four-region fictional regional runtime composes geography, market ecology, logistics, and Underworld state;
- a 180-day trace carries a seasonal coastal shock, bounded transit, offline organization work, a contested property, a physical session, and player disconnect;
- public projection and nested save/restore preserve regional continuity without exposing private transport, work, session, or event internals;
- stale coordinator commands and tampered nested histories fail closed.

Acceptance evidence:

- `npm test` includes two regional-runtime tests for the seasonal trace, public redaction, restart equality, stale rejection, and tamper failure;
- `npm run verify` checks the new evidence and contiguous build history.

Boundary:

- this is an in-process regional composition, not production content/assets, factual geography, MMO population load, authentication, matchmaking, anti-cheat, moderation, failover, availability, or the deferred full online underworld breadth.

## Episode 63 — Regional authored content package

Implemented:

- the four-region runtime now carries a validated authored content registry;
- ordinary residents, repair/health/market/hospitality businesses, functional locations, routes, schedules, and late-1990s variants admit together;
- organization identities bind to the regional Underworld fixture while public projections continue to omit private work and session detail;
- regional content admission retains an explicit anti-stereotype and fiction/safety boundary.

Acceptance evidence:

- `npm test` includes regional content admission and runtime projection assertions;
- `npm run verify` checks the new acceptance row and contiguous build history.

Boundary:

- this is fictional local content admission, not factual geography, imported production assets, visual/audio reachability, dialogue/native review, cultural acceptance, or a full online content service.

## Episode 64 — Durable regional runtime journal

Implemented:

- regional runtime snapshots now append to a local newline-delimited journal with sequence numbers, checkpoint identities, runtime metadata, and a SHA-256 hash chain;
- checkpoint writes flush through `fsync` and retry idempotently when the same checkpoint identity names the same snapshot;
- restore validates the journal chain and every nested geography, market, logistics, Underworld, and content snapshot before returning state;
- incomplete final writes are reported as recoverable crash tails, while complete-record tampering and conflicting checkpoint reuse fail closed.

Acceptance evidence:

- `runtime-journal.test.mjs` passes hash chaining, latest-state restore, idempotent retry, conflicting reuse rejection, incomplete-tail recovery, and tamper rejection;
- `npm run verify` checks the acceptance evidence and contiguous build history.

Boundary:

- this is a local append-only persistence contract, not a production database, replication/failover system, encryption-at-rest implementation, multi-process locking protocol, availability/load proof, or online service.

## Episode 65 — Regional public browser projection

Implemented:

- the deterministic preview payload now carries the four-region regional-runtime public projection alongside the vertical-slice scenario;
- the browser renders qualitative region roles, fidelity bands, seasonal bands, age bands, and public link counts;
- exact travel, friction, institutional, cargo, session, organization-work, and event-hash fields remain outside the browser surface.

Acceptance evidence:

- `preview-ui.test.mjs` and `renderer.test.mjs` verify generated regional payloads, browser wiring, and public redaction;
- `npm run preview:build` and `npm run verify` pass with the updated public preview artifact.

Boundary:

- this is a local public projection, not a native client, live regional stream, accessibility/localization certification, production synchronization, or factual geographic/cultural representation.

## Episode 66 — Secure local service boundary

Implemented:

- the authority HTTP adapter now has a reusable secure wrapper with bearer-token admission, constant-time token comparison, and public-health-only unauthenticated access;
- optional Node HTTPS configuration and a `requireTls` guard reject missing or insecure transport configuration;
- moderation hooks can stop requests before authority mutation and return only redacted hold/deny results;
- `npm run serve:secure-authority` provides an environment-configured local launch path without committing secrets.

Acceptance evidence:

- `secure-http-service.test.mjs` passes authentication, no-mutation rejection, moderation hold/deny redaction, and TLS configuration tests;
- `npm run verify` checks the new acceptance evidence and contiguous build history.

Boundary:

- this is a local service security contract, not account identity proofing, secret/certificate custody, production TLS deployment, moderation operations, failover, availability/load testing, or online service acceptance.

## Episode 67 — Operational service lifecycle

Implemented:

- the secure authority handler now has an operational wrapper with public `/health` liveness and `/ready` readiness endpoints;
- active request admission is bounded and overloaded application traffic is rejected before authority logic runs;
- graceful drain rejects new application traffic while allowing active work to finish and reports whether the active set reached zero;
- `npm run serve:operational-authority` provides an environment-configured local launch path with token, optional TLS, in-flight, and drain-timeout settings.

Acceptance evidence:

- `operational-http-service.test.mjs` passes readiness, authentication, overload, graceful drain, active completion, and authority-continuity checks;
- `npm run verify` checks the new acceptance evidence and contiguous build history.

Boundary:

- this is a local lifecycle and back-pressure contract, not production load testing, autoscaling, process supervision, failover, durable queueing, multi-host coordination, SLA evidence, or availability acceptance.

## Episode 68 — Container deployment contract

Implemented:

- `Dockerfile` packages the operational authority on Node 22 Alpine, runs as the non-root `node` user, binds through `WWK_HOST=0.0.0.0`, and declares a `/health` healthcheck;
- `.dockerignore` excludes repository metadata, tests, docs, browser assets, logs, and environment files;
- runtime tokens and optional TLS material remain environment/path configured and are not copied into the image;
- `deployment-contract.test.mjs` checks the packaging and secret-boundary contract.

Acceptance evidence:

- `deployment-contract.test.mjs` and `node --check scripts/serve-operational-authority.mjs` pass;
- `npm run verify` checks the new acceptance evidence and contiguous build history.

Boundary:

- Docker image build/runtime execution is not locally verified because Docker is unavailable in the current environment; registry publication, orchestration, rollout, TLS operations, persistent volumes, failover, load, and production acceptance remain open.

## Episode 69 — Checkpoint-backed authority service

Implemented:

- `authority-journal.mjs` stores authority snapshots as fsynced newline-delimited records with sequence and SHA-256 parent chaining;
- `createCheckpointedAuthorityService` restores the latest checkpoint before accepting requests and checkpoints each committed authority revision before advancing durable state;
- sessions, revisions, receipts, and event history preserve duplicate/stale semantics across service restart;
- `WWK_JOURNAL_PATH` wires the persistence slice into the operational launcher, while the container mounts `/data/authority.jsonl` without embedding secrets.

Acceptance evidence:

- `authority-journal.test.mjs` passes restart equality, post-restart duplicate rejection, incomplete-tail recovery, and tamper rejection;
- `deployment-contract.test.mjs` checks the journal path and writable volume declaration;
- `npm run verify` checks the new acceptance evidence and contiguous build history.

Boundary:

- this is a local single-process checkpoint integration, not a replicated database, backup/restore policy, encrypted-at-rest store, volume durability guarantee, failover proof, or production migration service.

## Episode 70 — Mirrored authority checkpoint service

Implemented:

- `replicated-authority-service.mjs` maintains two independently readable authority checkpoint journals;
- startup validates their shared hash-chain prefix, repairs a stale or missing copy from the surviving valid journal, and rejects divergent histories;
- committed authority revisions are written to both journals before the service advances its in-memory state;
- the operational launcher accepts primary and replica journal paths, and the container declares `/data` and `/replica` volumes.

Acceptance evidence:

- `replicated-authority-service.test.mjs` passes mirrored revisions, primary-loss recovery, stale-replica repair, and divergent-history rejection;
- `deployment-contract.test.mjs` checks both runtime paths and volume declarations;
- `npm run verify` checks the new acceptance evidence and contiguous build history.

Boundary:

- this is a same-process, same-host mirrored journal contract, not cross-host replication, quorum consensus, network partition handling, backup retention, encrypted storage, orchestration, failover timing, or production availability acceptance.

## Episode 71 — Authority backup and restore envelope

Implemented:

- `authority-backup.mjs` exports parity-checked primary and replica journal records into a versioned, SHA-256-digested backup envelope;
- restore validates the manifest digest, both journal chains, mirrored checkpoint parity, and the latest authority snapshot before writing destinations;
- existing restore destinations are protected unless `overwrite: true` is explicit;
- temporary-file rename is used where permitted, with a fsynced direct-write fallback for restricted Windows sandbox filesystems.

Acceptance evidence:

- `authority-backup.test.mjs` passes mirrored backup round-trip, restored service equality, overwrite protection, and tampered-manifest rejection;
- `npm run verify` checks the new acceptance evidence and contiguous build history.

Boundary:

- this is a local backup envelope, not scheduled retention, off-host replication, encrypted backup storage, cloud/object-lock policy, disaster recovery, restore-time objective, or production backup acceptance.

## Episode 72 — Quorum authority and partition contract

Implemented:

- `quorum-authority-service.mjs` coordinates a strict-majority set of independently persisted authority journals;
- committed revisions continue when a modeled partition leaves at least quorum nodes available;
- requests fail closed with a retryable `503` and no authoritative revision advance when fewer than quorum nodes are available;
- returning stale nodes can be explicitly repaired from canonical quorum history, while split-brain journal histories are rejected;
- health output reports node availability, journal depth, authoritative revision, quorum status, and repair state.

Acceptance evidence:

- `quorum-authority-service.test.mjs` passes partitioned commit, no-quorum rejection, stale-node repair, split-brain rejection, and strict-majority configuration checks;
- `npm run verify` checks the new acceptance evidence and contiguous build history.

Boundary:

- this is a deterministic file-backed quorum harness, not TCP/cross-host transport, leader election, membership/fencing, encrypted replication, orchestration, failover timing, load testing, SLA evidence, or production availability acceptance.

## Episode 73 — Authority backup catalog and retention plan

Implemented:

- `authority-backup-catalog.mjs` validates backup envelopes before catalog registration and records their digest, revision, creation time, and pin state;
- repeated registration of the same backup metadata is idempotent while changed metadata is rejected;
- retention planning keeps the configured newest history, always retains pinned/future entries, and reports eligible deletion candidates without mutating files;
- the existing backup reader now exposes one shared validation path for restore and catalog registration.

Acceptance evidence:

- `authority-backup-catalog.test.mjs` passes digest-backed registration, idempotent replay, pinned retention, non-destructive planning, metadata rejection, and tamper rejection;
- `npm run verify` checks the new acceptance evidence and contiguous build history.

Boundary:

- this is a local catalog and retention-plan contract, not scheduled jobs, deletion authorization, immutable/off-host storage, encryption, disaster recovery, restore-time objectives, or production backup acceptance.
