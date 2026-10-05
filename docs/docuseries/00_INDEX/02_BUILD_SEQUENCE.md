# Recommended Reading and Build Sequence

## Reading order

1. Foundation volumes establish the game identity and invariants.
2. Character volumes define life-course progression and visible status.
3. Social volumes define NPCs, beliefs, relationships and organizations.
4. Underworld volumes define the economy and criminal infrastructure.
5. Action volumes prove the game remains fast and physically fun.
6. World volumes define geography, aging and offscreen continuity.
7. Modes volumes split single-player, co-op and persistent online responsibilities.
8. Technical volumes define state ownership, events, saves, AI, networking and performance.
9. Build volumes define what to implement first and how to prevent scope collapse.

## Engineering dependency order

`World time + IDs + events + save/replay`
→ `movement/traversal/action shell`
→ `character condition + hidden skill/familiarity`
→ `NPC routines + relationships + belief`
→ `organization work graph`
→ `economy + extortion + vehicle crime`
→ `evidence/cases`
→ `one-year single-player vertical slice`
→ `aggregate region simulation`
→ `co-op`
→ `persistent online underworld`
→ `dynasty/seasonal scale`.

Do not reverse this order simply because the MMO layer is marketable. The persistent social layer depends on a strong life simulation, not the other way around.
