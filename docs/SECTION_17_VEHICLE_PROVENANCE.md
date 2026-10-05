# Section 17 — Vehicle-crime provenance transitions

## Purpose

Section 17 makes vehicles identity-bearing objects beyond pursuit movement. A vehicle can move through disputed custody, storage, abstract service, appearance history, resale, return, and trophy status without losing the history that explains why it matters.

## Canonical state

Each vehicle now retains:

- owner and holder identity, owner history, location, status, and condition;
- plate/appearance history, service history, storage history, and abstract provenance history;
- bounded police interest, market demand, recognition risk, and trophy tags;
- existing pursuit history, driver familiarity, observer signals, damage, and retirement state.

Transitions are outcome labels only: theft, storage, service, repaint/appearance change, fence/processing, transfer, resale, trophy display, and return. The runtime records consequences and provenance; it does not model real-world vehicle-bypass, concealment, or evasion procedure.

## Identity and projection rules

The same vehicle ID persists across every transition. Resale appends one owner record; return restores the owner’s holder state; retirement blocks later action. Public projection exposes class, location, status, condition, demand, recognition-risk band, and trophy tags, while omitting owner/holder identity and detailed history.

## Verification

```text
npm test
```

`test/vehicle.test.mjs` follows one vehicle through ten transitions, checks its histories and bounded signals, verifies public redaction, restores from the event history, and proves incomplete resale/stale mutation fail closed.
