# Deep Dive — Needs & Unlock Web

The unlock web is the game’s replacement for a conventional skill tree. It should answer a simple question: **what has this life made possible?**

It is not only a character-skill graph. It is a network connecting capability, knowledge, relationships, status, geography, property, organizations, legal/criminal exposure and time.

## Node families

### Capability nodes

Examples: advanced pursuit driving, evaluating a lock without opening it, managing a multi-vehicle convoy, reading sophisticated financial records, treating a serious wound, recognizing counter-surveillance.

### Social nodes

Examples: being invited to a senior table, receiving a trusted introduction, being permitted into a private club office, recruiting a respected veteran, gaining access to a prison contact network.

### Organizational nodes

Examples: founding a crew, appointing collectors, opening a second region, creating an internal security role, negotiating formal alliance doctrine, selecting a successor.

### Economic nodes

Examples: acquiring a nightclub, operating a repair shop, opening a transport company, qualifying for higher-value legitimate contracts, using specialized storage property.

### Geographic nodes

Examples: knowing a rooftop escape route, understanding a mountain corridor, receiving access to a port warehouse, being known in a small town, gaining permission to cross a faction-controlled courtyard.

### Identity/status nodes

Examples: an earned tattoo, old-guard recognition, prison status, a public business title, club ownership prestige, a historical organization ring.

## Eligibility expression

A node can use multiple requirement kinds:

```text
practice >= threshold
knowledge >= threshold
familiarity(subject) >= threshold
lived_time >= threshold
relationship(person, dimension) >= threshold
organization.role/status condition
property ownership/use condition
region access/familiarity condition
case/legal condition
world-era condition
specific historical event condition
```

A node does **not** need all requirement kinds. The point is that designers are no longer forced to fake diverse progression with one XP currency.

## Hidden, visible and rumored nodes

The web should support at least:

- `HIDDEN`: the player does not know this opportunity exists;
- `RUMORED`: dialogue or observation suggests a possibility;
- `DISCOVERED`: the player understands what kind of opportunity exists;
- `ELIGIBLE`: the current life history satisfies the real requirements;
- `OWNED`: a durable capability/status/property relationship is established;
- `DEEPENED`: the capability or access has become more sophisticated;
- `RUSTED`: underlying capability exists but current expression is degraded;
- `REVOKED`: access existed but a social/institutional dependency was lost.

`REVOKED` must not erase history. If an old port contact dies, the player should still remember having had access; the current access path is gone.

## Example: becoming a serious fixer

A generic RPG says: spend 5 points in Persuasion.

This game should require something like:

- practiced negotiation in varied contexts;
- demonstrated discretion;
- at least several active cross-faction contacts;
- reputation for resolving rather than escalating some disputes;
- enough time active for people to have history with the character;
- no current reputation that makes private meetings irrational;
- at least one person willing to introduce the character as a fixer.

Once eligible, the game does not display `FIXER CLASS UNLOCKED`. Instead, people begin bringing the character problems that previously went elsewhere.

## Example: senior tattoo

Requirements might include organization membership duration, a promoted historical event, sponsorship/recognition and no disqualifying betrayal record. The tattoo artist refusing an unearned symbol is itself the UI.

## Example: legitimate political/business access

Money is only one condition. The character may need a credible business, years of visible legitimate operation, the right introduction, appropriate presentation, and enough separation from recent public violence.

## Opportunity nodes versus capability nodes

Some unlocks are capabilities the character keeps. Others are opportunities that exist only because the world currently supports them.

A skill can remain after a mentor dies. A meeting with a specific politician cannot.

The engine therefore needs to distinguish:

```text
intrinsic capability
historical status
relationship-mediated access
world opportunity
```

Without that separation every unlock becomes permanently owned and the world stops feeling alive.

## Mutually costly identities

The web should permit conflicting reputations without arbitrary mutually-exclusive classes.

A character known for uncontrolled violence may gain intimidation opportunities while losing access to conservative business circles. A highly public legitimate figure can still maintain criminal relationships, but public exposure changes the risk and methods available.

The game does not say “you chose the Violence tree, Finance tree locked.” The world says “these people no longer want you in the room.”

## Discovery through observation

CONDITION’s teaching/observation model is important here. A player may see an NPC perform something they cannot yet do, hear a technique described, read a document, or work as an assistant before direct practice is possible.

Observation can reveal the node and seed knowledge without granting mastery.

## Web growth over years

The web should expand horizontally as the character’s social/geographic world expands. New cities, prisons, industries and classes of people reveal categories that did not matter earlier.

A 23-year-old car thief should not be looking at grayed-out “National Logistics Syndicate Management” nodes. That is videogame omniscience. The node does not exist in the player-facing web until the life has reached a context where the concept is legible.

## UI principle

The player-facing representation should resemble a history and opportunity map more than a skill tree.

Possible surfaces:

- people who can teach/introduction paths;
- discovered capabilities with qualitative readiness;
- current ambitions and missing contextual needs;
- journal entries like “Milen says nobody trusts you with the port until you have handled smaller shipments cleanly for a while.”

Debug mode may show the real graph.

## Data model

```cpp
struct UnlockRequirement {
    RequirementKind kind;
    SemanticRef subject;
    Comparison op;
    double numeric_threshold;
    SimDuration duration_threshold;
};

struct UnlockNode {
    UnlockNodeId id;
    UnlockDomain domain;
    UnlockVisibility visibility;
    std::vector<UnlockRequirement> requirements;
    std::vector<UnlockEffect> effects;
    RevocationPolicy revocation;
};
```

The evaluation result should include reason codes so designers can answer why something did or did not appear.

## Anti-checklist rule

The web cannot devolve into Ubisoft-style map completion with different terminology. Hidden requirements, social uncertainty, changing world opportunity and multiple paths to the same outcome are essential.
