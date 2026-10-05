# Section 36 — Pauseable systemic single-player campaign

This episode composes the docuseries’ solo campaign contract into an offline-completable state machine.

## Built

- explicit setup, active, paused, completed, and retired campaign lifecycle;
- controlled time settlement with authored opportunities that adapt when ignored instead of resetting;
- systemic job/business/case settlement counters that continue between chapters;
- chapter deviation and ending state without an online service dependency;
- successor creation that preserves public legacy while refusing exact skill, private-memory, or competitive-power transfer;
- hash-linked snapshots and fail-closed stale and tampered writes.

## Acceptance evidence

`npm test` includes `campaign.test.mjs`, which pauses/resumes the campaign, advances controlled time, proves missed-opportunity adaptation, completes offline, preserves systemic settlement, and creates a bounded successor continuation.

## Boundary

This is a headless campaign contract, not authored mission dialogue, animation, audio, UI, or a shipping executable. The runtime does not require network services for the tested campaign path.
