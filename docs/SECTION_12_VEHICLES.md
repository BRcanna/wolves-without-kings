# Section 12 — Vehicle persistence and pursuit segments

This episode implements the bounded vehicle contract from Volume 26.

## Implemented contract

- Vehicles retain stable identity, class, mass, handling, tires, owner, location, damage, condition, driver familiarity, pursuit history, and observer signals.
- Urban, highway, mountain, and service-road segments can produce distinct evented outcomes.
- Driver familiarity grows for a specific vehicle without becoming a raw top-speed bonus.
- Damage persists across segments; catastrophic damage retires that vehicle and blocks later use.
- Recognizable vehicle signals remain part of persistent observer memory state.

## Acceptance evidence

`npm test` passes 30 tests, including a three-segment vehicle trace and catastrophic retirement/rejection coverage.

## Boundary

The implementation is an abstract fictional vehicle-state contract. It does not provide real-world evasion, pursuit, driving, or criminal procedure instructions, and it does not claim renderer, physics, hardware, or production acceptance.
