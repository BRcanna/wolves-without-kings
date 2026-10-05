# Section 11 — Bounded action outcomes

This episode adds two headless action contracts from the docuseries: layered traversal resolution and consequence-based melee.

## Implemented contract

- Traversal actions retain route IDs, layer/mode, familiarity, noise, risk, condition cost, and completed/interrupted/blocked outcome.
- Melee actions retain participants, style, stamina cost, injury consequence, environment contact, witness count, and disengagement/escape outcomes.
- Character condition updates atomically with melee resolution and remains bounded.
- Invalid outcomes fail closed without mutating the world.
- Action history is evented and replay-compatible.

## Acceptance evidence

`npm test` passes 28 tests, including layered traversal outcome tests and a multi-opponent melee trace with injury persistence, witnesses, disengagement, and invalid-outcome rejection.

## Boundary

This is an abstract fictional action contract. It does not encode real-world fighting instruction, weapon use, evasion, or criminal procedure. It is not a renderer, latency, animation, or hardware acceptance test.

## Next dependency

Keep renderer work bounded to projection consumption and audit the remaining vehicle/action edge cases without expanding into unsafe procedural content.
