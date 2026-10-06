# Section 53 — Integrated vertical-slice runtime bundle

This episode composes the authoritative world, admitted content registry, and authored scenario registry into one save/restore boundary.

## Implemented contract

- engine world snapshots, content snapshots, and scenario snapshots are saved as one versioned bundle;
- each subsystem restores through its own hash/revision validator;
- scenario-to-content pack identity and scenario location identity are checked on bundle restore;
- canonical district topology remains part of the restored authoritative world;
- tampered subsystem history fails closed before a restored runtime is returned.

## Acceptance evidence

- `runtime-bundle.test.mjs` proves full bundle equality and tampered scenario-history rejection;
- existing engine, content, and scenario tests continue to run in the full suite;
- `npm run verify` continues to report the public preview and external gates separately.

## Boundary

This is a deterministic local persistence boundary. It does not claim crash-safe filesystem writes, cloud backup durability, online rollback, or a production migration service.
