# Scenario Trace 06 — 06 Coastal Market Shock

## Purpose

Seasonal coastal demand plus enforcement seizure and road disruption; market, nightclub, logistics and faction effects.

## Required initial state

- World date and region are explicit.
- All named characters and organizations have stable IDs.
- Relevant relationships, skills/familiarity, properties, items and active cases are loaded from authoritative state.
- No outcome is preselected; only constraints and motivations are seeded.

## Trace method

For every step record:

```text
player/NPC intent
observations available to the actor
validation / capability checks
committed authoritative event
relationship/belief updates
organization work updates
economic effects
police/evidence effects
world/property changes
time elapsed
new opportunities created
```

## Design requirement

The scenario is a **test fixture**, not a mission script. At least three alternate player choices should remain valid at major decision points. If the trace only works when the player follows one route, the underlying mechanics are not yet doing enough work.

## Failure handling

A failed action changes state. Targets can escape, money can be lost, relationships can deteriorate, evidence can be left, members can refuse, businesses can close, and police can arrive. The fixture should continue until the new state reaches a stable next decision rather than emitting a generic mission failure.

## Acceptance questions

1. Can the complete outcome be reconstructed from event history?
2. Did any subsystem gain knowledge it could not have observed or been told?
3. Did time-dependent consequences settle consistently?
4. Did a unique item or ownership claim duplicate?
5. Could the same starting state support a materially different resolution?
6. Would the scenario remain coherent in single-player and, where relevant, under server authority?
