# Section 50 — Branchable authored scenario content

This episode adds a persistent authored scenario graph on top of the admitted district package. It provides authored openings and branch labels without replacing systemic state with mission-only flags.

## Implemented contract

- scenario packs reference admitted functional locations and stable scene/choice IDs;
- scenes admit atomically with hash-linked event history and stale-write rejection;
- one vertical-slice opening offers observe, meet, or delegate branches and advances to a shared consequence scene;
- choice resolution persists the branch and active scene, then projects only public narrative cues;
- instructional/evasion language is rejected at admission and private authoring fields are omitted from public projection;
- the browser preview renders the authored opening from the public scenario projection.

## Acceptance evidence

- `scenario-pack.test.mjs` proves admission, branch resolution, snapshot restore, unknown-location rejection, and stale-write rejection;
- `preview-ui.test.mjs` proves the committed browser preview contains the two-scene branchable opening;
- `npm run preview:build` and `npm run verify` validate the generated public artifact.

## Boundary

This is a fictional authored scenario graph, not real-world criminal instruction, authored dialogue/audio, animation, cultural review, or a production mission runtime.
