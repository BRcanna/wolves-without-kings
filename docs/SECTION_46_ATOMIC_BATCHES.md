# Section 46 — Atomic authoritative mutation batches

This section adds the runtime-architecture batch boundary. Callers submit a bounded list of declarative event proposals; the engine validates each proposal through its normal event path on a private candidate world, and only the completed candidate is returned.

## Implemented contract

- Batches contain one to 32 typed event proposals and one deterministic batch identity.
- Stale batch revisions fail before proposal evaluation.
- Invalid proposals fail the whole batch and never mutate the caller's world.
- Committed events retain ordinary IDs, revisions, parent hashes, visibility, and save/restore compatibility.
- The batch wrapper does not grant callers direct mutation access or accept authoritative client results.

## Acceptance evidence

- `atomic-batch.test.mjs` proves contiguous batch commits, shared batch identity, all-or-nothing rejection, stale preflight rejection, and snapshot compatibility.

## Boundary

This is an in-process transaction contract. It does not provide database transactions, distributed two-phase commit, production sockets, or a guarantee that external side effects outside the world state can be rolled back.
