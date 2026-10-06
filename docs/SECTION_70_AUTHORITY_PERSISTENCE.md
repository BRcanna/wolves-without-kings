# Section 70 — Checkpoint-backed authority service

Status: built as a bounded local persistence integration slice.

## Implemented

- `authority-journal.mjs` stores validated authority snapshots as fsynced newline-delimited records with sequence and SHA-256 parent chaining;
- `createCheckpointedAuthorityService` restores the latest checkpoint before accepting requests and checkpoints each committed authority revision before advancing its durable state;
- duplicate/stale input semantics continue across a service restart because sessions, revisions, receipts, and event history are restored together;
- the operational launcher accepts `WWK_JOURNAL_PATH`, and the container contract mounts `/data/authority.jsonl` without embedding secrets.

## Acceptance evidence

- `authority-journal.test.mjs` proves restart equality, post-restart duplicate rejection, incomplete-tail recovery, and complete-record tamper rejection;
- `deployment-contract.test.mjs` verifies the container journal path and writable volume declaration;
- `npm run verify` checks the new acceptance evidence and contiguous build history.

## Boundary

This is a local single-process checkpoint integration, not a replicated database, transactional multi-host store, backup/restore policy, encryption-at-rest system, volume durability guarantee, failover proof, or production migration service. Persisted state remains fictional simulation state and is not an operational guide.
