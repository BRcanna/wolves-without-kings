# Deep Dive — Single-Player, Co-op and Persistent Online Boundary

The game needs both single-player and an MMO element, but they should not fight over ownership of the design.

## Three surfaces

### Story

A complete solo criminal-life RPG.

Properties:
- works offline;
- pauseable simulation;
- authored relationships and narrative density;
- deliberate time advancement;
- full economy and organization systems;
- no multiplayer-required missions;
- no online-market requirement for progression.

### Crew

Small-session drop-in cooperative play inside a host world.

Properties:
- host world is authoritative;
- guests receive explicit temporary roles;
- operations can be completed solo or cooperatively;
- persistent consequences settle before/after guest departure;
- no arbitrary import of guest-world wealth/state.

### Underworld

Persistent online social/economic ecosystem.

Properties:
- server-authoritative world;
- persistent organizations;
- shared regional markets;
- player/NPC territory pressure;
- bounded physical sessions;
- seasonal/server history;
- dynasty/successor progression;
- no requirement that every activity be massively concurrent.

## Why characters should be separate

Do not force the exact same character save between Story and Underworld. That produces balance contamination, duping complexity, time-calendar contradictions and pressure to nerf single-player systems for online fairness.

Allow account-level cosmetic/history recognition across modes if desired, but mechanical state should be mode-owned.

## Shared code, separate world state

The engine, character system, combat, traversal, organization concepts and economy logic should be shared. The actual world databases are not.

```text
shared mechanics
  single-player authority: embedded local world
  co-op authority: host world
  online authority: persistent server world
```

## What can cross modes

Good candidates:
- cosmetic clothing variants;
- decorative trophy replicas;
- profile titles;
- concept-art/history unlocks;
- non-mechanical studio rewards.

Bad candidates:
- money;
- unique vehicles;
- criminal property;
- police status;
- exact skill levels;
- organization rank;
- market inventory.

## FOMO rule

Single-player must not show “come back during this online season” holes in its core progression. Online can have historical events and unique trophies, but they remain online history.

## Co-op consequence policy

Before shipping co-op, define ownership for:

- loot;
- unique objects;
- injuries;
- vehicle damage;
- police evidence;
- relationship changes;
- guest death/arrest;
- disconnect during claimed work.

If those rules are not explicit, co-op will corrupt the life-history model.

## Persistent online population model

The MMO layer should be “massive” through shared history/economy and organization interaction, not 500 avatars in one stairwell.

A server can support many thousands of characters while physical combat instances remain tens of players at most. That preserves B13-style movement and detailed NPC/world simulation.

## Business reason

This architecture also reduces product risk. Single-player can reach quality and ship value before the persistent Underworld reaches final scale. The online layer extends a successful game rather than being the only reason the game works.
