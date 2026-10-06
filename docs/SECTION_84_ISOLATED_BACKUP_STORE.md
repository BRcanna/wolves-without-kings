# Section 84 — Isolated Backup Store and Retention Execution

The local backup envelope, catalog, and immutable repository now compose into an isolated remote-style target. A source root and repository root must be separate, catalog entries point only at validated immutable objects, verification covers both repository and catalog digests, and retention can delete only after an explicit authorization flag.

## Contract

- source and backup roots are required to be separate, with catalog state inside the repository root and source backups outside it;
- publication validates the backup envelope, writes an immutable object, and registers the same digest in the isolated catalog;
- verification checks repository objects and catalog-to-object digest/path parity before destructive work;
- retention remains reviewable without mutation until `approveDeletion: true` is supplied, and only eligible unpinned objects are deleted;
- pinned and future-dated entries remain retained, while catalog state is updated atomically after validated deletion;
- restore uses the existing validated backup path and continues to protect non-empty destinations.

## Acceptance evidence

`isolated-backup-store.test.mjs` proves separate-root validation, isolated publication, repository/catalog verification, non-authorized planning, authorized retention execution, and restore continuity.

## Boundary

This is an executable isolated local-store contract that simulates a separate backup target. It is not cloud/off-host custody, encryption at rest, object-lock compliance, access control, scheduled deletion, disaster recovery, restore-time objectives, or production backup/SLA acceptance. All stored authority data remains fictional simulation state.
