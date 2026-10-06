# Section 99 — Online Underworld Backup Catalog and Retention Plan

The online Underworld backup repository now has a digest-backed catalog and reviewable retention planning. Registration validates a complete backup before recording its identity, repeated registration is idempotent, pinned and future-dated backups are retained, and deletion candidates are reported without destructive action.

## Contract

- catalog entries record backup ID, path, shard, server week, revision, creation time, digest, and pinned status;
- registration validates the complete backup envelope before admission;
- repeated metadata-identical registration is idempotent, while changed metadata is rejected;
- retention planning keeps the newest configured number of eligible backups and always retains pinned/future entries;
- planning reports whether an operator-authorized destructive action would be required but does not delete files.

## Acceptance evidence

`underworld-backup-catalog.test.mjs` proves digest-backed registration, idempotent replay, pinned retention, non-destructive planning, changed-metadata rejection, and tampered-backup rejection.

## Boundary

This is a local catalog and retention-planning contract for fictional online-Underworld backups. It does not schedule jobs, delete backups, provide immutable/off-host object storage, encrypt contents, establish disaster-recovery objectives, or prove production restore time and availability. A production operator must review and authorize any deletion plan.
