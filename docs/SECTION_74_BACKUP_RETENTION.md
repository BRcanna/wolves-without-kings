# Section 74 — Authority Backup Catalog and Retention Plan

Section 72 produced a validated local backup envelope. This section adds the operational record around those envelopes: a digest-backed catalog, idempotent registration, pinned history, and a reviewable retention plan.

## Contract

- a catalog entry records the backup ID, path, authority world, world revision, creation time, digest, and pinned status;
- registration validates the complete authority backup before it enters the catalog;
- repeating the same registration is idempotent, while changed metadata for an existing backup ID is rejected;
- retention planning keeps the newest configured number of eligible backups, always retains pinned and future-dated entries, and reports candidates without deleting them;
- the plan explicitly indicates when a destructive operator action would be required.

## Acceptance evidence

`authority-backup-catalog.test.mjs` proves digest-backed registration, idempotent replay, pinned retention, non-destructive expiry planning, changed-metadata rejection, and tampered-backup rejection.

## Boundary

This is a local catalog and retention-planning contract. It does not schedule jobs, delete backups, provide immutable/off-host object storage, encrypt backup contents, establish disaster-recovery objectives, or prove production restore time and availability. A production operator must review and authorize any deletion plan.
