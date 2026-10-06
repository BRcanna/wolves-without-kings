# Section 71 — Mirrored authority checkpoint service

Status: built as a bounded local failover slice.

## Implemented

- `replicated-authority-service.mjs` maintains two independently readable authority checkpoint journals;
- startup validates their shared hash-chain prefix, repairs a stale or missing copy from the surviving valid journal, and rejects divergent histories;
- committed authority revisions are written to both journals before the service advances its in-memory state;
- the operational launcher accepts `WWK_JOURNAL_PATH` plus `WWK_REPLICA_JOURNAL_PATH`, and the container declares `/data` and `/replica` volumes.

## Acceptance evidence

- `replicated-authority-service.test.mjs` proves mirrored revisions, recovery after primary loss, stale-replica repair, and divergent-history rejection;
- `deployment-contract.test.mjs` checks the two runtime paths and volume declarations;
- `npm run verify` checks the new acceptance evidence and contiguous build history.

## Boundary

This is a same-process, same-host mirrored journal contract, not cross-host replication, quorum consensus, network partition handling, backup retention, encrypted storage, orchestration, failover timing, or production availability acceptance. All persisted domain values remain fictional and safety-bounded.
