# Section 32 — Conflict windows and anti-grief structure

This episode composes docuseries Volume 40 into an executable, persistence-tested conflict policy layer.

## Built

- conflicts require participants, a causal claim, location, explicit mode, bounded window, and optional property scope;
- offline properties remain protected until an explicit contest is declared and settled;
- races, business rivalry, theft, surveillance, and abstract violent windows use separate bounded modes;
- violent windows are capped at two days, while nonlethal competition remains a first-class resolution;
- repeated harassment is rate-limited through actor cooldowns and time-based recovery;
- evidence and recovery bands are evented, while public projection omits participants, claims, locations, action counts, evidence tags, owners, cooldown keys, and event history;
- hash-linked snapshots reject stale, invalid, and tampered writes.

## Acceptance evidence

`npm test` includes `conflict.test.mjs`, which proves offline-property safety, distinct nonlethal/violent-window outcomes, harassment cooldowns, public redaction, and snapshot integrity.

## Boundary

This is a fictional multiplayer rule model. Anti-grief protections are explicit game/server rules; the episode does not encode real-world violence, intimidation, retaliation, or enforcement procedure.
