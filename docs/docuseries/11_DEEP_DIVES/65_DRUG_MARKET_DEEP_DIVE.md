# Deep Dive — Drug Market Simulation

This system should provide criminal-economy depth while remaining fictionalized and non-instructional. The game models roles, commodities, scarcity, quality, harm, price pressure and organizational decisions—not transferable real-world production or trafficking procedure.

## Commodity abstraction

Use product classes rather than real manufacturing detail. Each class has:

- demand profile by region/era/social group;
- supply sources represented abstractly;
- quality band;
- health-risk band;
- legal/police pressure;
- portability/visibility abstractions;
- substitution relationships;
- organization doctrine compatibility.

## Market roles

The player can participate as:

- financier;
- wholesaler;
- transport/logistics provider;
- protection provider;
- venue owner;
- distributor;
- street retailer;
- broker/fixer;
- abstaining organization that prohibits the trade.

These roles should not collapse into the same minigame. A nightclub owner experiences the drug economy differently from a street dealer.

## Regional markets

Every region has supply, demand, available inventory and uncertainty. The player rarely knows exact totals. They hear price bands, shortage rumors and supplier confidence.

Market changes come from:

- enforcement seizures;
- rival conflict;
- transport disruption;
- tourism/seasonality;
- organization expansion/collapse;
- health scare;
- product substitution;
- police focus;
- broader era transition.

## Quality and harm

Quality is abstract. Bad product can cause customer harm, reputation damage and institutional pressure. The game does not tell the player how to alter chemistry; it tells them that the batch is unreliable, contaminated, weak or strong according to fictionalized simulation state.

## Doctrine

An organization can prohibit certain product classes. This creates identity and strategic difference. A crew focused on vehicle crime, construction and nightlife can remain economically powerful without being forced into drugs.

This is essential to the user’s broader-freedom requirement: drugs are one underworld career, not “the real game.”

## Addiction and labor effects

NPC substance dependence can affect attendance, finances, health, family relationships and vulnerability. It should not be a cheap “junkie” stereotype generator. Named characters need individualized histories and multiple possible causes of decline or recovery.

## Supply-shock trace

A large seizure removes a meaningful portion of a regional product supply.

1. inventory tightens;
2. wholesale price band rises;
3. some street sellers dilute/exit/switch products in abstract simulation;
4. rivals seek new supply relationships;
5. violence risk may rise around remaining supply;
6. customers substitute or reduce consumption;
7. police attention remains elevated because the seizure is part of an active case;
8. the player can exploit, avoid or redirect business strategy.

No designer spawns replacement stock simply to keep the mission economy stable.

## Online anti-manipulation

Shared online markets need NPC baseline supply/demand so a few wealthy players cannot completely brick the economy. Player activity should matter, but macro-state needs dampening, bounded influence and recovery mechanisms.

## Telemetry

Debug reports should show source/sink accounting at the abstraction level:

```text
regional supply start
+ simulated incoming supply
- consumption
- seizures/loss
- spoilage/destruction if modeled
= ending inventory envelope
```

The player sees market symptoms, not the omniscient ledger.
