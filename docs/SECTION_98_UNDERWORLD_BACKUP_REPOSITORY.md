# Section 98 — Portable Online Underworld Backup Repository

The validated online-Underworld backup envelope now has an immutable local repository boundary. Backup objects use safe identifiers, publish idempotently only when their digest matches, report tampering without claiming repository health, and restore through the same envelope validation path.

## Contract

- publication validates the complete parity-checked Underworld backup before writing an object;
- object IDs are safe portable identifiers and cannot escape the repository object root;
- an existing object with the same digest is idempotent, while a different digest is rejected;
- repository verification validates every object and reports invalid objects without treating the repository as healthy;
- restore reads through the validated backup path and keeps destination overwrite protection.

## Acceptance evidence

`underworld-backup-repository.test.mjs` proves idempotent publication, immutable conflict rejection, safe object IDs, validated read/restore, repository verification, and tamper detection.

## Boundary

This is a local portable repository for fictional online-Underworld backups. It is not cloud/off-host custody, object lock, encryption at rest, access control, replication transport, retention deletion, disaster recovery, or production restore/SLA acceptance.
