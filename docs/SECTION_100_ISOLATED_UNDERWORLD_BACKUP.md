# Section 100 — Isolated Online Underworld Backup Store

The online Underworld backup path now separates source capture from repository custody and executes retention only after explicit authorization and a fresh validity check. Repository/catalog parity is verified before any selected object is removed, and public projection omits local custody paths and backup contents.

## Contract

- source and repository roots must be separate;
- source backups must be captured inside the source root and outside the repository root;
- publication registers the repository object in the digest-backed catalog;
- retention planning is non-destructive unless `approveDeletion: true` is explicitly supplied;
- authorized deletion first verifies repository/object/catalog parity, then removes only eligible objects and rewrites the catalog atomically;
- projection reports validity and counts without exposing local paths or backup contents.

## Acceptance evidence

`isolated-underworld-backup-store.test.mjs` proves root separation, publication, verification, restore, explicit-approval gating, reviewed retention execution, and post-deletion catalog validity.

## Boundary

This is an isolated local backup/retention contract for fictional online-Underworld state. It is not cloud/off-host custody, encryption, object lock, access control, scheduling, disaster recovery, restore-time objectives, or production backup acceptance. Deletion remains an explicit operator action in the testable contract.
