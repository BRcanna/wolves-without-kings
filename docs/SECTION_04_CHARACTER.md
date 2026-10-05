# Section 4 — Character condition and hidden competence

This episode adds the player/character state that makes time and consequence personal. Progress is derived from recorded practice and exposure, not a universal XP wallet.

## Implemented contract

- Character identity has a stable ID, birth year, display name, and background.
- Hidden skills cover driving, fighting, lock work, intimidation, and negotiation.
- Skill tiers advance at deterministic practice thresholds.
- Familiarity records exposure to a district or context and derives qualitative levels.
- Body condition tracks bounded fatigue, injury, and health state.
- Every change is a revision-bound event and survives snapshot restore.

## Acceptance boundary

The tests prove deterministic headless state transitions and fail-closed validation. They do not prove animation, input, UI presentation, medical realism, or production balance.
