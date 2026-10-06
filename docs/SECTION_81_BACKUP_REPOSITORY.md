# Section 81 — Portable Authority Backup Repository

The backup envelope and retention planner now validate local backup history. This section adds an immutable object-style repository contract for publishing and verifying validated envelopes before restore.

## Contract

- publishing validates the complete backup envelope before writing it;
- object IDs are safe portable identifiers and cannot escape the repository object root;
- an existing object with the same digest is an idempotent publication;
- an existing object with a different digest is rejected rather than overwritten;
- repository verification reports each object’s digest/revision and marks invalid objects without treating the repository as healthy;
- restore reads through the same validation path and remains subject to explicit destination overwrite protection.

## Acceptance evidence

`authority-backup-repository.test.mjs` proves idempotent publication, immutable conflict rejection, safe object IDs, validated read/restore, repository verification, and tamper detection.

## Boundary

This is a local portable-repository contract. It is not cloud/object storage, off-host isolation, object lock, encryption at rest, access control, replication transport, retention deletion, disaster recovery, or production restore/SLA acceptance.
