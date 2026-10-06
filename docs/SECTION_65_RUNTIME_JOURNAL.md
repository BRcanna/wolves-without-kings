# Section 65 — Durable regional runtime journal

Status: built as a bounded local persistence slice.

## Implemented

- `runtime-journal.mjs` appends regional-runtime snapshots as newline-delimited checkpoint records;
- every record carries a sequence, checkpoint identity, runtime metadata, a previous-record hash, and its own SHA-256 hash;
- appends create missing parent directories, flush the record through `fsync`, and are idempotent when the same checkpoint names the same snapshot;
- restore validates the complete journal chain and every nested regional snapshot before returning state;
- a non-newline-terminated final record is treated as an incomplete crash tail and reported as recovered, while corruption in a complete record fails closed.

## Acceptance evidence

- `runtime-journal.test.mjs` proves two checkpoint restores, hash chaining, idempotent retry, conflicting checkpoint rejection, incomplete-tail recovery, and complete-record tamper rejection;
- the journal is exercised against the integrated four-region runtime, including content, geography, market, logistics, and Underworld histories.

## Boundary

This is a local append-only persistence contract, not a production database, replication system, backup policy, failover guarantee, encryption-at-rest implementation, multi-process locking protocol, or availability/load proof. The fiction and safety boundary remains unchanged: persisted cargo and organization fields are fictional systemic labels and do not encode transferable real-world criminal procedure.
