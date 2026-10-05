# Concrete Reference Shapes

These are not final ABI definitions. They are intentionally explicit enough to begin implementation discussions.

## Character lifecycle

```cpp
struct CharacterLifecycle {
    CharacterId id;
    CalendarDate birth_date;
    CalendarDate current_date;
    SimDuration active_criminal_time;
    SimDuration prison_time;
    EraId era;
    std::vector<LifeEventId> promoted_events;
    std::optional<CharacterId> mentor;
    std::optional<DynastyId> dynasty;
};
```

## Relationship edge

```cpp
struct RelationshipEdge {
    PersonId from;
    PersonId to;
    float trust;
    float respect;
    float fear;
    float loyalty;
    float affection;
    float resentment;
    MoneyDebt directional_debt;
    SimDuration known_for;
    std::vector<EventId> shared_promoted_events;
    Revision revision;
};
```

No field above should be exposed directly as a player meter by default.

## Claim / belief

```cpp
struct Claim {
    ClaimId id;
    PersonOrObjectId subject;
    PredicateId predicate;
    SourceRef source;
    std::optional<EventId> origin_event;
    SimTime created_at;
    SimTime last_refreshed;
    // Authoritative truth relation is evaluator/server-private.
    TruthRelation evaluator_truth;
};

struct Belief {
    PersonId holder;
    ClaimId claim;
    BeliefDisposition disposition; // accept / reject / uncertain
    float confidence;
    std::vector<ClaimId> corroboration;
    SimTime updated_at;
};
```

## Skill eligibility

```text
eligible(skill, character, context) =
    discovered(skill)
    AND all(prerequisite_nodes_owned)
    AND meaningful_practice >= skill.practice_floor
    AND relevant_knowledge >= skill.knowledge_floor
    AND subject_familiarity >= skill.familiarity_floor
    AND lived_time >= skill.time_floor
    AND relationship_requirements_satisfied
    AND context_requirements_satisfied
```

The result can still be temporarily inexpressible when readiness, injury, equipment or current context is poor.

## Organization work item

```cpp
struct OrgWorkItem {
    WorkId id;
    OrganizationId org;
    WorkKind kind;
    std::vector<WorkId> dependencies;
    CapabilityMask required;
    std::optional<MemberId> claimant;
    SimTime lease_until;
    WorkStatus status;
    RiskBand risk;
    std::vector<EntityId> reserved_assets;
    std::vector<EventId> evidence;
};
```

## Police case

```cpp
struct PoliceCase {
    CaseId id;
    AgencyId lead;
    Jurisdiction jurisdiction;
    CaseStage stage;
    std::vector<PersonId> suspects;
    std::vector<EvidenceRef> evidence;
    std::vector<WitnessRef> witnesses;
    std::vector<AuthorizedAction> current_authorities;
    SimTime opened;
    SimTime last_activity;
};
```

A police case is *not* authoritative truth about guilt. It is an institutional state constructed from evidence.

## Item provenance

```cpp
struct ProvenanceEntry {
    EventId event;
    SimTime time;
    EntityId actor;
    OwnershipOrCustody change;
    RegionId region;
};

struct ProvenanceRecord {
    ObjectId object;
    OriginRef origin;
    std::vector<ProvenanceEntry> promoted_history;
    HistoryDigest compact_history;
};
```

## Aggregate region state

```cpp
struct RegionAggregateState {
    RegionId region;
    SimTime last_materialized;
    PopulationSummary population;
    std::vector<OrganizationSummary> organizations;
    std::vector<MarketSummary> markets;
    std::vector<ScheduledEvent> promoted_events;
    std::vector<EntityId> promoted_entities;
    AggregateDigest digest;
};
```

## Time advance transaction

```text
advance_world(target_date):
  freeze player input
  settle current-frame authoritative transactions
  partition elapsed interval into bounded settlement windows
  for each window:
      run scheduled NPC/organization actions
      run business/market settlement
      run recovery/condition aging
      run police/case deadlines and legal stages
      run aggregate-region evolution
      emit committed events
  validate invariants
  checkpoint
  expose new date
```

## Rumor propagation

```text
for each eligible social edge from speaker -> listener:
    if claim is tellable in this context:
       child_claim = distort_with_bounded_noise(parent_claim, speaker, context)
       listener_belief = assess(child_claim,
                                source_trust[domain],
                                corroboration,
                                prior_belief,
                                direct_experience)
       record lineage parent_claim -> child_claim
```

Do not allow the propagation layer to query hidden evaluator truth to make the rumor “more correct.”

## Work lease recovery

```text
if now > work.lease_until and work.status == CLAIMED:
    emit work_claim_expired
    release reserved non-unique resources
    retain unique assets at their authoritative current location
    mark downstream dependencies blocked/recoverable
    scheduler may re-offer work based on capability + availability + doctrine
```

## Case evidence admission

```text
evidence candidate
 -> source identity / custody / freshness checks
 -> jurisdiction relevance
 -> case-specific admissibility projection
 -> confidence update
 -> optional new authorized investigative action
```

## Important privacy boundary for online

Clients may receive:
- their own condition feedback,
- world-visible actions,
- organization state they are authorized to see,
- claims their character has heard,
- public market observations,
- public case consequences.

Clients should not receive:
- exact NPC belief confidence,
- evaluator truth,
- hidden skill graph numbers,
- anti-cheat state,
- rival private organization work,
- police evidence they have not learned,
- offscreen exact positions outside their information scope.
