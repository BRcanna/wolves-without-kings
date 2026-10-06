# Section 72 — Authority backup and restore envelope

Status: built as a bounded local backup slice.

## Implemented

- `authority-backup.mjs` exports parity-checked primary and replica journal records into a versioned, SHA-256-digested backup envelope;
- restore validates the manifest digest, both journal chains, mirrored checkpoint parity, and the latest authority snapshot before writing destinations;
- existing restore destinations are protected unless `overwrite: true` is explicit;
- writes use a temporary file and rename where the filesystem permits it, with a fsynced direct-write fallback for restricted Windows sandbox filesystems.

## Acceptance evidence

- `authority-backup.test.mjs` proves mirrored backup round-trip, restored service equality, overwrite protection, and tampered-manifest rejection;
- `npm run verify` checks the new acceptance evidence and contiguous build history.

## Boundary

This is a local backup envelope, not scheduled retention, off-host replication, encrypted backup storage, cloud/object-lock policy, disaster recovery, restore-time objective, or production backup acceptance. The persisted content remains fictional authority state and does not provide real-world criminal instruction.
