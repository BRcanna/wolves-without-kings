# Volume 16 — Organization Doctrine, Internal Politics and Succession

Status: design + engineering composition specification  
Project: Bulgaria Underworld Crime RPG / Black Lantern Studio concept  
Repo baseline date: 2026-10-05  

## 1. Purpose

Give organizations identity through enforceable norms, leadership history and member coalitions rather than a generic clan level.

This volume is deliberately written as a build document rather than a feature pitch. It defines the player-facing promise, the hidden state that must exist to make that promise real, the authoritative ownership boundary, the events that connect it to other systems, and the acceptance evidence needed before downstream content depends on it.

## 2. Donor-repository anchors

- **Hidden_Canopy-Crew @ `8a764cfc682f`** — agents, memberships, projects, plans, phases and lanes; work dependencies, atomic claims, leases, review and recovery; capability/exclusion/affinity checks; hash-linked event ledger and replay verification
- **Open-World-Model-Harness @ `48d99a41629d`** — persistent NPC needs/routines/memory/relationships; knowledge claims with source, confidence, staleness and truth separation; historical familiarity and hidden competency; Full/Aggregate region simulation modes; world degradation/recovery and persistent scars; regional markets and information latency
- **Condition @ `b47b898ff1fd`** — include/condition/person/skill_web.hpp; include/condition/character/skill_graph.hpp; include/condition/character/rust.hpp; include/condition/character/effective_skill.hpp; mechanisms/07-day-night-and-reputation-mechanisms.md; mechanisms/15-competency-growth-mechanisms.md

These are **donors**, not proof that the complete game mechanic already exists. Reuse the state discipline and tested primitives where they fit; do not copy domain assumptions blindly.

## 3. Player-facing contract

The player should experience this mechanic through consequences, affordances, changing behavior, animation, dialogue, property/world state, and contextual options. Internal numerical state may exist for determinism and tuning, but the design should avoid turning the game into a spreadsheet unless the surface is something a real character or organization would reasonably track.

The mechanic must also survive the project’s core freedom rule: the player is allowed to do something unexpected. The system should answer with a new world state rather than a generic failure screen whenever a coherent consequence exists.

## 4. Canonical state

| Field / concept | Role | Persistence |
| --- | --- | --- |
| doctrine_rules | bounded runtime state whose changes must be evented | persist |
| leadership_roles | history-bearing value used for progression and consequence | persist |
| succession_candidates | projection/input owned by another subsystem and read here | persist + aggregate |
| coalitions | canonical identity or long-lived state used by multiple systems | persist |
| discipline_history | bounded runtime state whose changes must be evented | persist |
| revenue_shares | history-bearing value used for progression and consequence | persist + aggregate |
| forbidden_activities | projection/input owned by another subsystem and read here | persist |
| civilian_policy | canonical identity or long-lived state used by multiple systems | persist |
| family_policy | bounded runtime state whose changes must be evented | persist + aggregate |
| foreign_policy | history-bearing value used for progression and consequence | persist |
| police_policy | projection/input owned by another subsystem and read here | persist |


The exact C++/storage representation can evolve, but the conceptual ownership must remain stable. Derived UI values should not become authoritative merely because they are convenient to display.

## 5. Core rules

### 1. Doctrine defines what the organization permits, forbids, tolerates or requires.

This rule should be enforced in authoritative simulation rather than only described in UI. The implementation should prefer explicit state transitions over hidden side effects. If the state is player-visible, presentation may be qualitative even when the server/runtime keeps precise internal values.

### 2. Members evaluate doctrine through their own values, incentives and relationships; compliance is not automatic mind control.

When the rule cannot be evaluated with current knowledge, preserve uncertainty instead of inventing a value. The implementation should prefer explicit state transitions over hidden side effects. If the state is player-visible, presentation may be qualitative even when the server/runtime keeps precise internal values.

### 3. Leadership succession uses role eligibility, seniority, relationships, capability and coalition support.

The rule should leave event/provenance evidence sufficient to explain later downstream state. The implementation should prefer explicit state transitions over hidden side effects. If the state is player-visible, presentation may be qualitative even when the server/runtime keeps precise internal values.

### 4. A death or arrest can fragment an organization instead of promoting a single scripted heir.

The rule must operate under both local full simulation and an aggregate approximation where applicable. The implementation should prefer explicit state transitions over hidden side effects. If the state is player-visible, presentation may be qualitative even when the server/runtime keeps precise internal values.

### 5. Doctrine can change slowly, causing generational conflict between founders and younger members.

This rule should be enforced in authoritative simulation rather than only described in UI. The implementation should prefer explicit state transitions over hidden side effects. If the state is player-visible, presentation may be qualitative even when the server/runtime keeps precise internal values.

### 6. Online organizations need explicit governance surfaces for treasury, roles, doctrine and succession to prevent admin-only meta from replacing game state.

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
| Single-player | Solo can author several major internal factions while still resolving leadership through system state. |
| Online | Online doctrine proposals and role changes require organization permissions and durable records; the game does not infer consent from voice/chat. |


## 9. Event surface

Recommended event-family vocabulary for this volume:

- `16_doctrine_succession_started`
- `16_doctrine_succession_updated`
- `16_doctrine_succession_interrupted`
- `16_doctrine_succession_completed`
- `16_doctrine_succession_failed`
- `16_doctrine_succession_expired`

Each event should carry stable actor/subject IDs, simulation time, authoritative world revision, location or region when relevant, causal parent references when derived from another event, and enough payload to rebuild downstream projections without granting those projections mutation authority.

## 10. Authoritative execution pattern

```text
request/context
  -> read authoritative revision
  -> gather scoped state (doctrine_rules, leadership_roles, succession_candidates, coalitions)
  -> validate prerequisites / permissions / uncertainty
  -> compute proposal (no mutation yet)
  -> admit against current revision
  -> commit atomic state changes
  -> emit 16_doctrine_succession_* event(s)
  -> update projections: social / economy / evidence / UI
```


A stale request must fail or reconcile explicitly. Silent partial application is worse than a visible refusal because the game’s long-term history depends on being able to answer why state changed.

## 11. Worked gameplay trace

An old-guard group forbids certain drugs and violence against families. Younger members push high-profit synthetics. The conflict is economic, cultural and personal, not a binary morality quest.

The trace is intentionally phrased as an outcome chain instead of a mission script. Designers can wrap dialogue, cinematics, objectives or tutorials around it, but the underlying state transition must still make sense if the player approaches from a different route, uses another character, delegates work, arrives late, or creates collateral consequences.

## 12. Single-player contract

Solo can author several major internal factions while still resolving leadership through system state.

Single-player remains complete with the network disabled. Where online uses server authority, solo uses the same authority model in-process so the mechanic does not fork into two incompatible games.

## 13. Persistent-online contract

Online doctrine proposals and role changes require organization permissions and durable records; the game does not infer consent from voice/chat.

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

Acceptance removes the leader under three different relationship graphs and verifies different plausible succession outcomes.

Minimum evidence should include deterministic unit/contract tests, one end-to-end gameplay trace, save/restore coverage, time-advance coverage if the mechanic ages, and a negative test proving an invalid/stale/unauthorized transition does not partially mutate the world.

## 17. Open tuning questions

- Which values should remain completely hidden, which should be qualitative, and which are legitimately knowable to the character?
- Which histories deserve full fidelity and which can be compacted safely?
- What is the minimum simulation needed offscreen to preserve believable continuity?
- How quickly should this mechanic respond to one dramatic event versus years of accumulated behavior?
- Which parts should be authored for major named characters and which should remain purely systemic?

## 18. Completion definition

This volume is complete only when the mechanic is executable, persistent, explainable from its history, compatible with time advancement, compatible with the single-player authority path, and has a defined online projection/authority boundary. A document, enum, UI panel or isolated unit test alone does not satisfy that bar.
