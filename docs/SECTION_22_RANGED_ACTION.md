# Section 22 — Consequential abstract ranged action

## Purpose

Section 22 closes the remaining bounded action gap with a systemic ranged-encounter contract. The runtime records consequences that matter to the world—suppression, injury outcome, cover state, sound, witnesses, cameras, evidence, police interest, and weapon wear—without becoming a real-world firearms simulator.

## Canonical state

Weapons retain class, handling profile, abstract ammunition, condition, owner, location, and shot history. Encounters retain qualitative range/familiarity, stance, cover, stress, suppression, outcome, sound band, witness/camera counts, police-interest delta, and evidence-artifact labels.

Weapon state and encounter history are evented and replayable. Exhausted abstract ammunition and retired weapons fail closed before mutation.

## Projection boundary

The public projection exposes weapon class, location, condition, and a qualitative ammo band. It omits owner identity, exact ammunition, shot history, firearm evidence, and other internal action details.

## Verification and safety

```text
npm test
```

`test/ranged.test.mjs` covers a two-encounter consequence trace, public redaction, snapshot restore, stale/invalid/over-ammo rejection, and weapon condition changes.

This is an abstract fictional action model. It does not provide real-world weapon operation, aiming, modification, acquisition, or evasion instructions.
