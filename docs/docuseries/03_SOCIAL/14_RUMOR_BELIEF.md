# Volume 14 — Rumor, Belief, Deception and Reputation Ecology

Status: design + engineering composition specification  
Project: Bulgaria Underworld Crime RPG / Black Lantern Studio concept  
Repo baseline date: 2026-10-05  

## 1. Purpose

Treat reputation as information moving through people, not as an omniscient global score.

This volume is deliberately written as a build document rather than a feature pitch. It defines the player-facing promise, the hidden state that must exist to make that promise real, the authoritative ownership boundary, the events that connect it to other systems, and the acceptance evidence needed before downstream content depends on it.

## 2. Donor-repository anchors

- **Condition @ `b47b898ff1fd`** — include/condition/person/skill_web.hpp; include/condition/character/skill_graph.hpp; include/condition/character/rust.hpp; include/condition/character/effective_skill.hpp; mechanisms/07-day-night-and-reputation-mechanisms.md; mechanisms/15-competency-growth-mechanisms.md
- **Open-World-Model-Harness @ `48d99a41629d`** — persistent NPC needs/routines/memory/relationships; knowledge claims with source, confidence, staleness and truth separation; historical familiarity and hidden competency; Full/Aggregate region simulation modes; world degradation/recovery and persistent scars; regional markets and information latency

These are **donors**, not proof that the complete game mechanic already exists. Reuse the state discipline and tested primitives where they fit; do not copy domain assumptions blindly.

## 3. Player-facing contract

The player should experience this mechanic through consequences, affordances, changing behavior, animation, dialogue, property/world state, and contextual options. Internal numerical state may exist for determinism and tuning, but the design should avoid turning the game into a spreadsheet unless the surface is something a real character or organization would reasonably track.

The mechanic must also survive the project’s core freedom rule: the player is allowed to do something unexpected. The system should answer with a new world state rather than a generic failure screen whenever a coherent consequence exists.

## 4. Canonical state

| Field / concept | Role | Persistence |
| --- | --- | --- |
| claim_id | bounded runtime state whose changes must be evented | persist |
| subject | history-bearing value used for progression and consequence | persist |
| predicate | projection/input owned by another subsystem and read here | persist + aggregate |
| source | canonical identity or long-lived state used by multiple systems | persist |
| origin_event | bounded runtime state whose changes must be evented | persist |
| confidence | history-bearing value used for progression and consequence | persist + aggregate |
| truth_status_private | projection/input owned by another subsystem and read here | persist |
| listener_belief | canonical identity or long-lived state used by multiple systems | persist |
| domain_trust | bounded runtime state whose changes must be evented | persist + aggregate |
| distortion_generation | history-bearing value used for progression and consequence | persist |
| staleness | projection/input owned by another subsystem and read here | persist |
| geographic_reach | canonical identity or long-lived state used by multiple systems | persist + aggregate |


The exact C++/storage representation can evolve, but the conceptual ownership must remain stable. Derived UI values should not become authoritative merely because they are convenient to display.

## 5. Core rules

### 1. Events create witness claims; witnesses do not automatically know full authoritative truth.

This rule should be enforced in authoritative simulation rather than only described in UI. The implementation should prefer explicit state transitions over hidden side effects. If the state is player-visible, presentation may be qualitative even when the server/runtime keeps precise internal values.

### 2. Claims propagate through social ties, organizations, media and institutions with distortion and delay.

When the rule cannot be evaluated with current knowledge, preserve uncertainty instead of inventing a value. The implementation should prefer explicit state transitions over hidden side effects. If the state is player-visible, presentation may be qualitative even when the server/runtime keeps precise internal values.

### 3. Listener belief depends on source trust, corroboration, prior belief and domain expertise.

The rule should leave event/provenance evidence sufficient to explain later downstream state. The implementation should prefer explicit state transitions over hidden side effects. If the state is player-visible, presentation may be qualitative even when the server/runtime keeps precise internal values.

### 4. Reputation emerges from accumulated believed claims and direct experience.

The rule must operate under both local full simulation and an aggregate approximation where applicable. The implementation should prefer explicit state transitions over hidden side effects. If the state is player-visible, presentation may be qualitative even when the server/runtime keeps precise internal values.

### 5. False rumors can produce real consequences without changing authoritative event truth.

This rule should be enforced in authoritative simulation rather than only described in UI. The implementation should prefer explicit state transitions over hidden side effects. If the state is player-visible, presentation may be qualitative even when the server/runtime keeps precise internal values.

### 6. The player can seed, deny, exploit or accidentally amplify rumors, but cannot directly set reputation.

When the rule cannot be evaluated with current knowledge, preserve uncertainty instead of inventing a value. The implementation should prefer explicit state transitions over hidden side effects. If the state is player-visible, presentation may be qualitative even when the server/runtime keeps precise internal values.

### 7. Regional information latency means distant areas can hold older versions of the player’s reputation.

The rule should leave event/provenance evidence sufficient to explain later downstream state. The implementation should prefer explicit state transitions over hidden side effects. If the state is player-visible, presentation may be qualitative even when the server/runtime keeps precise internal values.


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
| Single-player | Solo can use newspapers, gossip, calls and changing greetings to expose reputation ecology. |
| Online | Online allows player-generated histories but must protect against chat text becoming authoritative world claims without in-game evidence channels. |


## 9. Event surface

Recommended event-family vocabulary for this volume:

- `14_rumor_belief_started`
- `14_rumor_belief_updated`
- `14_rumor_belief_interrupted`
- `14_rumor_belief_completed`
- `14_rumor_belief_failed`
- `14_rumor_belief_expired`

Each event should carry stable actor/subject IDs, simulation time, authoritative world revision, location or region when relevant, causal parent references when derived from another event, and enough payload to rebuild downstream projections without granting those projections mutation authority.

## 10. Authoritative execution pattern

```text
request/context
  -> read authoritative revision
  -> gather scoped state (claim_id, subject, predicate, source)
  -> validate prerequisites / permissions / uncertainty
  -> compute proposal (no mutation yet)
  -> admit against current revision
  -> commit atomic state changes
  -> emit 14_rumor_belief_* event(s)
  -> update projections: social / economy / evidence / UI
```


A stale request must fail or reconcile explicitly. Silent partial application is worse than a visible refusal because the game’s long-term history depends on being able to answer why state changed.

## 11. Worked gameplay trace

A rival is killed by someone else, but a frightened witness reports the player’s car nearby. Street rumor may credit the player with the killing even as detectives remain uncertain and close associates know the player was elsewhere.

The trace is intentionally phrased as an outcome chain instead of a mission script. Designers can wrap dialogue, cinematics, objectives or tutorials around it, but the underlying state transition must still make sense if the player approaches from a different route, uses another character, delegates work, arrives late, or creates collateral consequences.

## 12. Single-player contract

Solo can use newspapers, gossip, calls and changing greetings to expose reputation ecology.

Single-player remains complete with the network disabled. Where online uses server authority, solo uses the same authority model in-process so the mechanic does not fork into two incompatible games.

## 13. Persistent-online contract

Online allows player-generated histories but must protect against chat text becoming authoritative world claims without in-game evidence channels.

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

Acceptance seeds one event with four witnesses and verifies divergent retellings, delayed propagation and observer-specific belief.

Minimum evidence should include deterministic unit/contract tests, one end-to-end gameplay trace, save/restore coverage, time-advance coverage if the mechanic ages, and a negative test proving an invalid/stale/unauthorized transition does not partially mutate the world.

## 17. Open tuning questions

- Which values should remain completely hidden, which should be qualitative, and which are legitimately knowable to the character?
- Which histories deserve full fidelity and which can be compacted safely?
- What is the minimum simulation needed offscreen to preserve believable continuity?
- How quickly should this mechanic respond to one dramatic event versus years of accumulated behavior?
- Which parts should be authored for major named characters and which should remain purely systemic?

## 18. Completion definition

This volume is complete only when the mechanic is executable, persistent, explainable from its history, compatible with time advancement, compatible with the single-player authority path, and has a defined online projection/authority boundary. A document, enum, UI panel or isolated unit test alone does not satisfy that bar.
