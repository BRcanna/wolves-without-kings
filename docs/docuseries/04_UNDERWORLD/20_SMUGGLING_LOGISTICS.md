# Volume 20 — Smuggling, Logistics and Route Networks

Status: design + engineering composition specification  
Project: Bulgaria Underworld Crime RPG / Black Lantern Studio concept  
Repo baseline date: 2026-10-05  

## 1. Purpose

Treat smuggling as logistics under uncertainty: route access, people, timing, cargo risk, information and regional state rather than a single driving minigame.

This volume is deliberately written as a build document rather than a feature pitch. It defines the player-facing promise, the hidden state that must exist to make that promise real, the authoritative ownership boundary, the events that connect it to other systems, and the acceptance evidence needed before downstream content depends on it.

## 2. Donor-repository anchors

- **VANTA_Engine @ `2b930d7e0ac5`** — authoritative World / revision-bound mutation path; H11 bounded long-range navigation; gameplay interaction and inventory receipt paths; NPC runtime receipt boundary; branch/reconciliation and counterfactual contracts; offscreen viewport / capture / sensor foundations
- **Hidden_Canopy-Crew @ `8a764cfc682f`** — agents, memberships, projects, plans, phases and lanes; work dependencies, atomic claims, leases, review and recovery; capability/exclusion/affinity checks; hash-linked event ledger and replay verification
- **Open-World-Model-Harness @ `48d99a41629d`** — persistent NPC needs/routines/memory/relationships; knowledge claims with source, confidence, staleness and truth separation; historical familiarity and hidden competency; Full/Aggregate region simulation modes; world degradation/recovery and persistent scars; regional markets and information latency

These are **donors**, not proof that the complete game mechanic already exists. Reuse the state discipline and tested primitives where they fit; do not copy domain assumptions blindly.

## 3. Player-facing contract

The player should experience this mechanic through consequences, affordances, changing behavior, animation, dialogue, property/world state, and contextual options. Internal numerical state may exist for determinism and tuning, but the design should avoid turning the game into a spreadsheet unless the surface is something a real character or organization would reasonably track.

The mechanic must also survive the project’s core freedom rule: the player is allowed to do something unexpected. The system should answer with a new world state rather than a generic failure screen whenever a coherent consequence exists.

## 4. Canonical state

| Field / concept | Role | Persistence |
| --- | --- | --- |
| route_id | bounded runtime state whose changes must be evented | persist |
| segments | history-bearing value used for progression and consequence | persist |
| access_requirements | projection/input owned by another subsystem and read here | persist + aggregate |
| travel_time | canonical identity or long-lived state used by multiple systems | persist |
| risk_band | bounded runtime state whose changes must be evented | persist |
| weather_cost | history-bearing value used for progression and consequence | persist + aggregate |
| hazard_cost | projection/input owned by another subsystem and read here | persist |
| border_state | canonical identity or long-lived state used by multiple systems | persist |
| contacts | bounded runtime state whose changes must be evented | persist + aggregate |
| cargo_class | history-bearing value used for progression and consequence | persist |
| cover_business | projection/input owned by another subsystem and read here | persist |
| scheduled_departure | canonical identity or long-lived state used by multiple systems | persist + aggregate |
| fallbacks | bounded runtime state whose changes must be evented | persist |


The exact C++/storage representation can evolve, but the conceptual ownership must remain stable. Derived UI values should not become authoritative merely because they are convenient to display.

## 5. Core rules

### 1. Long-range routes can cross unloaded regions while preserving coarse cost and access constraints.

This rule should be enforced in authoritative simulation rather than only described in UI. The implementation should prefer explicit state transitions over hidden side effects. If the state is player-visible, presentation may be qualitative even when the server/runtime keeps precise internal values.

### 2. Route familiarity, vehicle type, weather, police pressure and contact reliability alter risk.

When the rule cannot be evaluated with current knowledge, preserve uncertainty instead of inventing a value. The implementation should prefer explicit state transitions over hidden side effects. If the state is player-visible, presentation may be qualitative even when the server/runtime keeps precise internal values.

### 3. A route is a network asset that can become compromised, obsolete, expensive or politically easier over time.

The rule should leave event/provenance evidence sufficient to explain later downstream state. The implementation should prefer explicit state transitions over hidden side effects. If the state is player-visible, presentation may be qualitative even when the server/runtime keeps precise internal values.

### 4. Organizations can maintain parallel routes with different cost/risk profiles.

The rule must operate under both local full simulation and an aggregate approximation where applicable. The implementation should prefer explicit state transitions over hidden side effects. If the state is player-visible, presentation may be qualitative even when the server/runtime keeps precise internal values.

### 5. Operations schedule people and vehicles, so delays propagate into downstream work.

This rule should be enforced in authoritative simulation rather than only described in UI. The implementation should prefer explicit state transitions over hidden side effects. If the state is player-visible, presentation may be qualitative even when the server/runtime keeps precise internal values.

### 6. The game abstracts real-world evasion procedure; challenge is strategic composition and fictionalized execution.

When the rule cannot be evaluated with current knowledge, preserve uncertainty instead of inventing a value. The implementation should prefer explicit state transitions over hidden side effects. If the state is player-visible, presentation may be qualitative even when the server/runtime keeps precise internal values.


## 6. Time and life-course interaction

Every implementation of this mechanic must answer four time questions: what changes in minutes, what changes in days, what consolidates over months, and what only becomes socially or physically meaningful after years. A short-term state should not be promoted into permanent identity without historical evidence, and a years-long relationship or reputation should not evaporate because one recent event changed a local value.

When the player advances time, the runtime must settle scheduled actions, expiring claims, injuries/recovery, NPC routines, business/market state, investigations and aggregate-region transitions before presenting the new date. Time skips are transactions over many systems, not a visual fade followed by arbitrary flags.

## 7. Needs & Unlock Web integration

This mechanic can both consume and produce unlock-web evidence. Relevant nodes may require combinations of meaningful practice, knowledge, familiarity, relationship sponsorship, organizational standing, object/property ownership, elapsed time, regional access and legal/criminal context. Unlocks should state *why* an option exists in debug data even when the player only sees a qualitative affordance.

No generic XP payout should bypass those requirements. If designers need a pacing valve, use bounded opportunity availability, mentor access, time consolidation or content exposure rather than a universal spend currency.

## 8. Cross-system interfaces

| Neighbor system | Required interaction |
| --- | --- |
| World time | Affects age, staleness, routines, recovery, market settlement and long-horizon eligibility. |
| Relationships | Can open, close or reshape options without replacing the mechanic’s own state. |
| Organizations | Delegation and doctrine must consume this system through explicit requests/events. |
| Police/evidence | Observed illegal activity can create claims/cases without granting omniscient knowledge. |
| Economy | Costs, availability and opportunity respond to world state and regional context. |
| Provenance | Important objects and decisions retain lineage when they become historically meaningful. |
| Single-player | Solo can resolve long travel as active driving, partial time compression or delegated work. |
| Online | Online can turn high-value routes into contested strategic assets while keeping travel instances small enough for action quality. |


## 9. Event surface

Recommended event-family vocabulary for this volume:

- `20_smuggling_logistics_started`
- `20_smuggling_logistics_updated`
- `20_smuggling_logistics_interrupted`
- `20_smuggling_logistics_completed`
- `20_smuggling_logistics_failed`
- `20_smuggling_logistics_expired`

Each event should carry stable actor/subject IDs, simulation time, authoritative world revision, location or region when relevant, causal parent references when derived from another event, and enough payload to rebuild downstream projections without granting those projections mutation authority.

## 10. Authoritative execution pattern

```text
request/context
  -> read authoritative revision
  -> gather scoped state (route_id, segments, access_requirements, travel_time)
  -> validate prerequisites / permissions / uncertainty
  -> compute proposal (no mutation yet)
  -> admit against current revision
  -> commit atomic state changes
  -> emit 20_smuggling_logistics_* event(s)
  -> update projections: social / economy / evidence / UI
```


A stale request must fail or reconcile explicitly. Silent partial application is worse than a visible refusal because the game’s long-term history depends on being able to answer why state changed.

## 11. Worked gameplay trace

A mountain route becomes risky after severe weather and a recent arrest. The player can delay, reroute through a higher-cost contact, split cargo, or cancel. Each choice changes delivery timing and relationships.

The trace is intentionally phrased as an outcome chain instead of a mission script. Designers can wrap dialogue, cinematics, objectives or tutorials around it, but the underlying state transition must still make sense if the player approaches from a different route, uses another character, delegates work, arrives late, or creates collateral consequences.

## 12. Single-player contract

Solo can resolve long travel as active driving, partial time compression or delegated work.

Single-player remains complete with the network disabled. Where online uses server authority, solo uses the same authority model in-process so the mechanic does not fork into two incompatible games.

## 13. Persistent-online contract

Online can turn high-value routes into contested strategic assets while keeping travel instances small enough for action quality.

Online must not expose server-private beliefs, hidden competence, anti-cheat data, private case confidence or other information merely because replication is convenient. Projection scope is a first-class part of the data model.

## 14. Failure modes to prevent

- Replacing history with a one-dimensional meter because it is easier to tune.
- Letting UI state become the source of truth.
- Faking offscreen outcomes without an aggregate or scheduled causal path.
- Using random rolls where the game already has relevant history that should affect the outcome.
- Treating a missing value as zero instead of unknown when uncertainty matters.
- Allowing online latency/reconnect logic to duplicate ownership-bearing objects or actions.
- Writing one-off story flags that bypass canonical systems and later become impossible to reconcile.

## 15. Instrumentation and debug views

Developers should be able to inspect current canonical state, recent causal events, source revisions, relevant prerequisites, uncertainty, ownership, last transition, and the downstream projections affected by the last change. Debug views may expose numbers that the player never sees. The purpose is explainability and regression detection, not a promise that the release UI will show the same internals.

For long-horizon mechanics, add accelerated headless simulation fixtures and yearly/monthly summary output. A mechanic that looks correct for ten minutes can still collapse after five simulated years.

## 16. Acceptance gate

Acceptance changes one cost layer after planning and verifies stale plans are rejected or replanned rather than followed blindly.

Minimum evidence should include deterministic unit/contract tests, one end-to-end gameplay trace, save/restore coverage, time-advance coverage if the mechanic ages, and a negative test proving an invalid/stale/unauthorized transition does not partially mutate the world.

## 17. Open tuning questions

- Which values should remain completely hidden, which should be qualitative, and which are legitimately knowable to the character?
- Which histories deserve full fidelity and which can be compacted safely?
- What is the minimum simulation needed offscreen to preserve believable continuity?
- How quickly should this mechanic respond to one dramatic event versus years of accumulated behavior?
- Which parts should be authored for major named characters and which should remain purely systemic?

## 18. Completion definition

This volume is complete only when the mechanic is executable, persistent, explainable from its history, compatible with time advancement, compatible with the single-player authority path, and has a defined online projection/authority boundary. A document, enum, UI panel or isolated unit test alone does not satisfy that bar.
