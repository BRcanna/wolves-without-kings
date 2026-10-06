# Section 94 — Identity-Bound Online Underworld Reconnect

The local shard now proves a disconnect/reconnect transition that preserves the existing character/session identity and persistent property ownership.

## Contract

- reconnect is valid only for an offline session and its previously bound offline character;
- the reconnect region must match the session history, preventing an implicit cross-region or foreign-world import;
- reconnect increments local evidence for the existing session, clears the disconnect reason, and leaves organization/property state unchanged;
- active sessions, mismatched characters, cross-region requests, and invalid histories fail closed without mutation;
- the HTTP adapter exposes reconnect through the same bearer and revision-bound boundary as join/leave.

## Acceptance evidence

`underworld-reconnect.test.mjs` proves identity-bound reconnect, property survival, event history, mismatch rejection, active-session rejection, and no-mutation failure. `underworld-http-service.test.mjs` proves the loopback route.

## Boundary

This is a local reconnect continuity contract. It is not matchmaking, cross-host session migration, anti-cheat, production failover, account recovery, or full persistent online underworld breadth. The fiction/safety boundary remains unchanged.
