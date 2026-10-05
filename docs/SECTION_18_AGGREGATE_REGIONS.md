# Section 18 — Aggregate regional continuity

## Purpose

Section 18 extends the authored district into a two-region continuity model without simulating every person at full fidelity everywhere. The map uses a fictionalized Sofia region and a fictionalized Black Sea coastal region connected by one bounded logistics corridor.

## Region and corridor state

Regions retain identity, label, simulation mode, population band, business count, market pressure, police pressure, logistics pressure, condition, offscreen days, scars, and settlement history. A region can be `full` or `aggregate`; the explicit mode transition is evented.

The corridor retains endpoints, travel days, transport friction, legal pressure, capacity, status, and history. Numeric pressure is not exposed in the public projection; the public view receives qualitative bands and status.

## Aggregate settlement

Aggregate settlement is deterministic and history-bearing. It applies bounded market, police, and logistics shocks, advances offscreen days, derives stable/strained/degraded condition, records scars when condition changes, and stores the settlement date. World-time transactions automatically settle aggregate regions while full regions remain on the detailed path.

This is an authored simulation contract, not a claim of national geography accuracy, live data, or production-scale performance.

## Verification

```text
npm test
```

`test/region.test.mjs` covers the two-region map, corridor restrictions, deterministic shocks/scars, time integration, full/aggregate mode boundaries, public redaction, snapshot restore, and stale rejection.
