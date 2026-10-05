# Section 33 — Simulation fidelity, LOD, and performance budgets

This episode composes docuseries Volume 47 into an executable budget and fidelity contract.

## Built

- entities retain importance, distance band, simulation mode, update rate, AI/physics tier, history tier, network interest, and promotion/demotion reason;
- deterministic rebalancing promotes important entities, fills local fidelity, and aggregates background state under explicit caps;
- interest changes can promote a distant named entity without changing its identity;
- stress reports measure renderer, simulation, and network budgets separately against configured limits;
- public projection exposes counts and budget pass/fail bands while omitting exact interest, reasons, timings, and event internals;
- hash-linked snapshots reject stale, invalid, and tampered performance state.

## Acceptance evidence

`npm test` includes `performance.test.mjs`, which proves deterministic LOD promotion/demotion, promotion caps, separate stress budgets, invalid writes, and snapshot integrity.

## Boundary

These are executable budget contracts and synthetic stress reports, not hardware/FPS proof. Real renderer, server, and platform acceptance remain external gates.
