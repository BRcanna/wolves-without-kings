# Section 9 — Surveillance and durable information

This episode implements the bounded, knowledge-first slice of Volume 27.

## Implemented contract

- Surveillance records observer, target, location, visibility, sound, access state, entry method, and time window.
- Observations produce durable information, routine confidence, witness uncertainty, and counter-surveillance state.
- World time makes learned schedules stale when the target's routine changes and reduces confidence deterministically.
- Withdrawal, uncertainty, and being noticed remain noncombat outcomes.
- Observer ownership and unsupported outcomes fail closed before mutation.

## Acceptance evidence

`npm test` passes 24 tests, including surveillance tests for routine learning, threat-driven routine change, staleness, noncombat withdrawal, ownership, and invalid-outcome rejection.

## Boundary

This implementation models fictional information state and consequence. It intentionally omits real-world burglary, evasion, or surveillance procedure and does not provide instructions for wrongdoing. Online privacy, projection scope, and renderer presentation remain separate contracts.

## Next dependency

Expose a renderer-facing, scope-filtered projection of canonical state, then audit online boundaries and remaining action families.
