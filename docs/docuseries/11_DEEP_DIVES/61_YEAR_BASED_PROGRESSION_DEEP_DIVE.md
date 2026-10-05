# Deep Dive — Year-Based Character Development

## Design target

The character must feel like a person who has spent years in a criminal ecosystem, not an avatar that accumulated enough XP to purchase “Veteran Enforcer III.” The progression system therefore needs two parallel dimensions: **capability history** and **life history**. Capability history answers what the character has actually practiced and learned. Life history answers whether enough time, social exposure, institutional experience and consequence has accumulated for the surrounding world to treat the character differently.

A player can become technically good at driving in a few months. They cannot become a respected fifteen-year veteran in a few months. The game must be able to represent that distinction without artificially blocking the player from doing interesting things.

## Four time scales

### Hours and days

Hours and days govern immediate readiness: sleep debt, pain, hangover, intoxication, short recovery, temporary police attention, shift schedules, business opening hours, fuel/vehicle readiness, who is currently at home, who is at work, who is reachable, and whether a job window is still open.

This layer creates tactical timing. It should not create “come back in six real hours” mobile-game friction. In single-player, the player can sleep or deliberately advance time when appropriate. In online, simulated time compression is a server design decision, not a monetization gate.

### Weeks and months

Weeks and months govern consolidation. A new routine becomes recognizable. A business develops regular customers. A protection arrangement proves whether it actually works. A relationship moves beyond first impressions. A police case either receives corroboration or begins to cool. A new crew member develops a track record. A physical injury progresses through healing stages. Skill practice starts producing stable fluency rather than one-off lucky performance.

### Years

Years govern identity. This is where seniority, old friendships, family change, organizational legitimacy, criminal mythology, visible aging, old injuries, wealth normalization and political/business credibility become meaningful.

The player should be able to look at a contact and know: “I have known this person for nine years.” That fact should change the relationship model even if no visible numerical meter exists.

### Era transitions

Era is larger than age. Bulgaria itself changes. Technology, vehicles, police capability, communications, club culture, consumer brands, property development, international connections and the composition of the underworld change around the player. Era transitions give the game a reason to change its systemic assumptions, not only its art dressing.

## Capability maturity versus social maturity

Every high-level role needs two separate tests.

A character can possess the capability to perform senior work before the social world is willing to recognize them as senior. Conversely, an older well-connected figure can retain status after some physical skills have rusted.

Example:

```text
Candidate: organization lieutenant

Capability evidence:
- has successfully delegated multi-person operations
- understands organization doctrine
- can settle member disputes
- has financial/logistics competence

Social maturity evidence:
- 4+ in-game years active with organization
- 2+ senior sponsors or one founder relationship
- no unresolved major betrayal finding
- demonstrated responsibility for people/resources
- recognized by enough current members

Context:
- organization actually has a vacant leadership need
```

This is not a hard “Year 4 unlock.” It is an eligibility structure where time is necessary but not sufficient.

## Time consolidation

Some progression should require a period after the triggering experience. Surviving one violent night can create a life event immediately, but the social consequences and psychological adaptation may unfold over months.

A general model:

```text
experience -> immediate evidence -> consolidation window -> stable capability/status
```

The consolidation window prevents binge grinding. Twenty lock attempts in one night can teach something, but they do not substitute for months of using that knowledge across varied contexts.

## Aging and embodiment

Age must not be a linear debuff. It changes the balance of strengths and weaknesses.

A 22-year-old may recover quickly, accept more physical risk and climb aggressively. A 38-year-old who maintained fitness can still be dangerous, but may rely more on judgment, positioning, subordinates and social access. A 45-year-old who spent fifteen years drinking heavily, sleeping poorly and collecting injuries should not animate or recover like the same person at 22.

The relevant state includes:

- biological age;
- conditioning history;
- injury/scar history;
- sleep and substance history;
- body mass/composition trends;
- activity history;
- medical treatment quality;
- current readiness.

The player should notice age through recovery times, animation nuance, NPC treatment, voice/performance direction, appearance, responsibility and opportunity—not a `-5% agility after 35` tooltip.

## Relationships and time

Relationship age and relationship quality are separate.

A nine-year friendship with moderate trust is different from a two-week alliance with very high current trust. The first has shared history, family overlap, rituals, remembered crises and expectations. The second may be intense but fragile.

Shared history should preserve promoted events:

- first job together;
- prison visitation;
- wedding attendance;
- business founding;
- death of a mutual friend;
- betrayal survived;
- debt forgiven;
- time spent apart.

## Organizations age too

An organization founded in 1999 should change by 2009 even if the player never redesigns it manually.

Members age, recruit younger people, marry, have children, lose interest, become addicted, become wealthy, become legitimate, die, become imprisoned, or leave. Old informal rules become doctrine or get ignored. New members interpret the founder myth differently. A crew built around street presence may become a property/logistics organization and produce internal arguments about what it has become.

## Time skip settlement contract

A time skip must not be a cinematic cheat. Before committing the new date, the game should settle:

1. health/recovery and skill rust;
2. NPC routines and scheduled major events;
3. organization work items and lease expiry;
4. businesses and market changes;
5. police cases and legal deadlines;
6. relationship maintenance/neglect;
7. births, deaths, departures and arrivals that are due;
8. region aging and aggregate simulation;
9. property maintenance and damage progression;
10. communication and rumor propagation.

The transaction can be chunked into weeks/months for performance, but it must preserve causality.

## Single-player cadence

Single-player can support deliberate pacing controls:

- sleep until morning;
- wait several hours;
- take a week to recover/train/manage business;
- take a multi-month low-activity period;
- accept an authored chapter/era jump;
- serve a prison sentence with playable segments plus compressed intervals.

The game should explain important consequences before a large optional skip without exposing all hidden outcomes.

## Online cadence

Online cannot literally ask players to wait years. The server needs a defined simulated calendar. The solution should preserve **relative lived time** without making a twenty-year career require twenty real years.

Possible policy: one real week equals one in-game month for persistent Underworld shards, with special seasonal/era servers using different compression. The exact ratio needs playtesting. What matters is that character seniority derives from server-calendar history and activity, not a raw account age badge.

## Anti-grind invariant

No important character-development path should be reducible to:

```text
repeat low-risk action 5,000 times -> mastery
```

Meaningful growth should use novelty, difficulty, context diversity, consequences and time consolidation. Repetition still matters for fluency, but diminishing returns arrive quickly when nothing new is being learned.

## Debug representation

The player may see “experienced,” “rusty,” “known for years,” or contextual changes. Debug tooling should expose exact history:

```text
skill: pursuit_driving
latent competence: 0.71
peak: 0.78
last meaningful practice: 2006-04-12
recent rust factor: 0.08
contexts experienced: urban/wet/night/mountain/police
specific vehicle familiarity: BMW_E39_042 = high
consolidation events: 19
```

That difference between internal precision and player-facing uncertainty is central to the entire design.
