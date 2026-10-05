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
