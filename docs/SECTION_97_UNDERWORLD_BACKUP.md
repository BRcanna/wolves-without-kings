# Section 97 — Online Underworld Backup Envelope

The quorum-backed online Underworld now has a parity-checked local backup envelope. A backup captures the complete validated journal set, binds its shard/revision metadata to a digest, and restores only to explicitly named destinations without overwriting existing files by default.

## Contract

- backups require at least three distinct, complete, parity-matched Underworld journals;
- the envelope contains the full hash-chained records, shard/week/revision metadata, and a SHA-256 digest over the unsigned manifest;
- reading or restoring a backup revalidates every journal, its latest snapshot, and cross-node parity;
- destination node IDs must match the backup and existing files are protected unless `overwrite: true` is explicit;
- writes use fsynced temporary files and atomic rename where the local filesystem permits it.

## Acceptance evidence

`underworld-backup.test.mjs` proves quorum journal round-trip, restored-state equality, destination protection, digest tamper rejection, divergent-source rejection, and minimum/parity configuration checks.

## Boundary

This is a local backup envelope for fictional online-shard state. It is not encrypted custody, off-host/cloud storage, object lock, scheduled retention, disaster recovery, restore-time objectives, access control, or production backup acceptance. The fiction/safety boundary remains unchanged.
