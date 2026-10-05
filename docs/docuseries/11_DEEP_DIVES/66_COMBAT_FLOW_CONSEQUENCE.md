# Deep Dive — High-Paced Combat With Persistent Consequences

The game cannot become slow merely because it is systemic. Combat should be one of the strongest pleasures in the product.

The design target is **fast decision, fast movement, dangerous weapons, persistent aftermath**.

## Combat-time layer

During active combat the player needs:

- immediate input response;
- readable enemy intent;
- fast vault/mantle transitions;
- decisive melee contacts;
- low animation lock-in;
- clear weapon handling;
- quick contextual interaction with doors, railings, tables, vehicles and improvised objects;
- enough stamina to sustain exciting sequences;
- short-term flow/adrenaline that prevents injury bookkeeping from killing momentum.

## Aftermath layer

After combat, the world settles:

- structural injuries;
- bleeding/medical needs;
- damaged equipment;
- weapon/ammunition state;
- property damage;
- witnesses;
- noise/camera exposure;
- police evidence;
- relationship consequences;
- organization retaliation;
- scars and trophy/history promotion if the event was major.

The player gets the action fantasy and then has to live with what happened.

## Melee

Melee should support striking, clinch, shove, grab, takedown, improvised weapon, wall/rail/table contact and escape.

The game should not over-focus on canned cinematic finishers. The environment needs to stay interactive and interruptible, especially online.

### Style differentiation

A boxer prioritizes distance and hands. A wrestler controls clinch and balance. A prison fighter uses close, ugly tactics. A football-hooligan background may be comfortable in chaotic group brawls. These are histories and competencies, not locked classes.

## Firearms

Firearms are dangerous but responsive. A gun should not need RPG rarity tiers to feel stronger. Differentiation comes from handling, familiarity, concealment, capacity, condition, recoil, context and legal/social consequence.

Suppression is important because a shot that misses can still change movement and courage.

## Injury model

Use two layers:

```text
combat readiness (fast-changing)
structural condition (slow-changing)
```

Adrenaline can hold combat readiness above what the underlying structural injury would suggest. After the encounter, readiness drops and the injury becomes harder to ignore.

This prevents the absurdity of instantly losing half of all mobility from the first punch while preserving long-term consequence.

## Group fights

Against several opponents, the correct fantasy is not superhero mowing. The player uses position, doorways, furniture, movement, intimidation, allies and escape.

High skill makes the player more efficient and composed, not invulnerable.

## Chase-to-fight continuity

The best action sequences should cross system boundaries without resetting:

nightclub argument
→ fistfight
→ kitchen escape
→ alley chase
→ rooftop traversal
→ pistol appears
→ tram platform
→ vehicle pursuit
→ damaged car abandoned
→ foot escape
→ medical aftermath and police case.

The event system should record that as one causal chain with many committed subevents, not seven disconnected mission stages.

## Flow

A temporary `flow` state can improve animation blending, decision confidence and stamina efficiency when the player executes cleanly. It must not become a magic meter that grants impossible bullet resistance.

Flow is the sensation of competence, not a superpower.

## Difficulty

Difficulty should come from opponent competence, numbers, positioning, equipment, surprise, social constraints and the player’s current condition—not global enemy health multipliers.

## Online

Networking priorities:

1. movement feel;
2. hit authority;
3. grab/takedown fairness;
4. persistent injury/evidence settlement;
5. reconnection safety.

Long synchronized melee animations should be rare because latency and third-party interruption make them brittle.
