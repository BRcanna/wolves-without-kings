# Section 44 — Bounded NPC belief, planning, and adaptation

This section implements the NPC AI contract as a bounded, history-bearing subsystem. NPCs plan from their own belief records, not evaluator truth; needs and obligations can redirect a plan; repeated observations can raise capped adaptive pressure; and organization orders resolve through values rather than automatic compliance.

## Implemented contract

- Major agents produce multi-step plans; background agents use a cheaper bounded plan shape.
- Required beliefs are evaluated from the agent's own scoped record and produce grounded, partial, or uncertain knowledge bands.
- Needs and obligations compete with goals and produce inspectable plan postures.
- Adaptation requires repeated observations of the same abstract pattern and is capped by state policy.
- Organization orders resolve as comply, hesitate, or deviate from loyalty, fear, competence, and consequence band.
- Time settlement ages bounded needs and marks long-lived plans stale.
- Event hashes, snapshots, stale revisions, and public projections preserve the authority/privacy boundary.

## Acceptance evidence

- `npc-ai.test.mjs` proves belief-scoped planning, need/obligation competition, major/background bounds, repeated-only adaptation, capped pressure, order discretion, time settlement, snapshot integrity, and public redaction.

## Boundary

This is a fictional abstract NPC contract. Pattern keys, goals, order IDs, and outcomes are game-state labels; the system does not provide real-world criminal procedure, surveillance instructions, or transferable operational guidance.
