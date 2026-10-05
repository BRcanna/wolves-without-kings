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
