# Section 51 — Content/runtime alignment guard

This episode closes the seam between the authored district package and the authoritative vertical-slice world.

## Implemented contract

- every authored location and route must exist in the canonical topology stored in authoritative engine state;
- every authored resident, business, and organization must exist in the authoritative world;
- preview generation fails closed when package identities drift from runtime identities;
- alignment returns explicit counts for the admitted vertical slice and preserves stable IDs;
- topology remains internal to the authoritative snapshot and is not copied into the public projection.

## Acceptance evidence

- `content-pack.test.mjs` proves alignment for 8 locations, 7 routes, 30 residents, 3 businesses, and 2 organizations;
- the same test proves a missing runtime business fails before preview admission;
- `npm run preview:build` and `npm run verify` pass with the guard active.

## Boundary

This is a local identity/topology consistency guard. It does not prove imported production assets, visual reachability, animation, authored dialogue/audio, or cultural review.
