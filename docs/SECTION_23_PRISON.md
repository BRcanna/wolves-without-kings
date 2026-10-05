# Section 23 — Time-bearing prison and re-entry state

## Purpose

Section 23 treats incarceration as an alternate social world rather than a fail screen. Sentence time advances the simulation, prison relationships and status can change, outside relationships/businesses/markets/organization control drift, and release produces an explicit re-entry state.

## Canonical state

The prison state retains sentence/facility/cell block, time served, simulation date, prison reputation, prison relationships, outside relationships, visitation, prison work, status marks, injury, outside drift bands, and release state. Time profiles are abstract routine, education, connection, isolation, or conflict labels.

The outside world is represented as qualitative drift bands rather than a second hidden full simulation. After enough elapsed time, relationships become stale, businesses drift, markets change, and outside organization control reconsolidates. The release event records those differences.

## Projection boundary and safety

Public projection exposes facility/status/sentence band, time served, prison reputation band, visitation count, status marks, outside drift, and re-entry state. It omits relationship internals, contacts, injury, work history, and event-chain internals.

This is a fictional time/social simulation contract. It does not encode real-world prison procedure, evasion, violence, or institutional operations.

## Verification

```text
npm test
```

`test/prison.test.mjs` covers a multi-year sentence, time compression modes, prison/street separation, outside drift, release/re-entry, bounds, stale/overrun rejection, restore equality, and tamper rejection.
