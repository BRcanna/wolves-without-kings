# Section 19 — Drop-in/drop-out co-op settlement

## Purpose

Section 19 adds bounded cooperative sessions without making the story depend on another human player. The host world remains authoritative; a guest joins as a temporary associate, specialist, or crew member and receives an explicit settlement when leaving.

## Authority and ownership

The co-op session stores the host world ID and host-world revision separately from the guest’s source world. Shared operations require the host and at least one connected guest. Guest-world assets cannot enter the host operation under the `host-world-only` loot policy.

When an operation completes, host-world consequences and guest consequences are recorded in separate fields. A guest disconnect marks the active operation without deleting it. Reconnect clears the transient disconnect marker; final leave settlement retains host consequences and records guest injury/asset return state. Host rewind is rejected by contract.

## Persistence

Session events carry a session revision, host-world revision, stable actor/subject IDs, payload, and a SHA-256 parent hash. Snapshot restore verifies contiguous revisions and the event chain before accepting state.

This is a bounded in-process co-op settlement contract. It does not claim sockets, matchmaking, authentication, encryption, NAT traversal, moderation, anti-cheat, voice, production availability, or a persistent online underworld.

## Verification

```text
npm test
```

`test/coop.test.mjs` covers guest admission, shared operation outcomes, disconnect/reconnect, host consequence retention, foreign-world asset rejection, duplicate guests, stale transitions, rewind restrictions, and snapshot tamper rejection.
