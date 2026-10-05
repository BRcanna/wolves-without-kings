# Section 5 — Persistent social and organization state

This episode composes the docuseries volumes for NPC life, relationships, rumor/belief, and crew organization into the existing revision-bound authority path.

## Implemented contract

- NPCs retain home, occupation, routine blocks, needs, threat-adjusted schedules, and long actions.
- World-time advancement settles NPC life, increments relationship age, ages beliefs, and expires work leases in one evented transaction.
- Relationships have independent trust, respect, fear, loyalty, debt, obligation, familiarity, suspicion, affection, resentment, and dependence axes.
- Rumors retain a separate world claim from each observer's retelling, confidence, source, and staleness.
- Organizations own dependency-ordered work graphs with member capabilities, availability, claims, leases, review state, and recovery after expiry.
- Snapshot restore continues to rebuild the new projections from the hash-linked event history.

## Acceptance evidence

`npm test` covers:

- NPC routine and need settlement across world time;
- long-action completion;
- contradictory multi-axis relationships and relationship age;
- delayed rumor hearing with divergent observer retellings;
- work dependency admission and bounded lease recovery.

## Boundary

This remains a deterministic headless slice. It does not prove authored dialogue, animation, a renderer, real-world criminal procedure, cultural/legal review, online replication, or production balance. Rumor truth is deliberately separated from observer belief; organization work describes fictional state transitions and does not encode transferable operational instructions.

## Next dependency

Add economy and property lineage on the same event path, then use those projections to drive a small single-player vertical slice.
