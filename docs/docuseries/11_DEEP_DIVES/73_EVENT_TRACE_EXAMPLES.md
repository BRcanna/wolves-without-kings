# Deep Dive — End-to-End Event Trace Examples

These traces show how one action crosses systems. They are intentionally written as causal chains for engineering and design review.

## Trace A — Collection turns violent

### Initial state

- Player organization protects `Business_041`.
- Owner trust is moderate; fear low.
- Assigned collector has high intimidation competence, low self-control history.
- Local police have no active case involving the business.
- Rival organization has a weak social link to owner’s nephew.

### Event chain

1. `collection_visit_started`
2. Owner says revenue is down and requests reduced payment.
3. Collector interprets resistance as disrespect.
4. `assault_started`
5. Employee injured.
6. Two witnesses observe different portions.
7. `business_property_damaged`
8. Payment is made anyway.
9. `collection_completed` with money success.
10. Relationship projection: owner fear rises, trust collapses, resentment rises.
11. Business projection: expected next-month revenue drops due to injury/closure time.
12. Rumor projection: witnesses generate separate claims.
13. Rival projection: nephew hears one claim and organization learns the business may be recruitable.
14. Police projection: injured employee seeks treatment and incident becomes reportable/observable according to game abstraction.
15. Organization projection: collector appears financially successful but generates a negative conduct record.

### Why this matters

A naive system sees “collection succeeded.” The real game sees short-term success plus several future liabilities.

## Trace B — Favorite car becomes evidence and trophy

1. `vehicle_stolen` establishes provenance.
2. Player uses the car repeatedly and builds vehicle familiarity.
3. Car appears in two witnessed incidents.
4. Police case stores partial vehicle association.
5. Player repairs and repaints the car; identity persists.
6. Player keeps it for eight in-game years.
7. Organization members recognize it as a founder-era object.
8. Trophy system promotes the vehicle because of age + event history.
9. A cold police case receives new evidence linking the same identity.
10. The trophy is now also risky to display publicly.

## Trace C — Repeated escape habit becomes countered

1. Player uses Service Road A after four separate incidents.
2. Police observation records exist for only three of them; the engine does not let police learn the unseen event.
3. Adaptive-history window reaches its threshold.
4. Investigator hypothesis: “subject favors Road A when exiting District 3.”
5. Future patrol plan allocates observation coverage near Road A.
6. Player uses Road B instead; no magical interception occurs.
7. After several varied escapes, pattern confidence decays.

## Trace D — Leader dies

1. `organization_leader_died`
2. Current work items continue where claimants remain capable.
3. Treasury access follows role permissions, not “killer gets money.”
4. Succession evaluator identifies three candidates.
5. Members form support coalitions based on relationships, doctrine and recent work history.
6. One business pauses payments because protection response is uncertain.
7. Rival organization increases pressure.
8. Police case changes because known hierarchy is disrupted.
9. Player may support, oppose or become one of the candidates.

## Trace E — Large time jump

Player elects to advance six months while recovering and keeping a low profile.

Settlement windows process:
- healing;
- skill rust;
- partner relationship maintenance;
- organization work;
- two business failures/successes;
- police case cooling;
- regional market shifts;
- a rival member’s prison release;
- building renovation progress;
- rumor staleness.

The date changes only after the settlement transaction passes validation.
