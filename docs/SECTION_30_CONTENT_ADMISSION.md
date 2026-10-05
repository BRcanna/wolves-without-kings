# Section 30 — Content-pack admission and era variants

This episode composes docuseries Volumes 35 and 52 into an executable authoring boundary.

## Built

- content packs admit stable region, NPC, business, and organization IDs as one validated transaction;
- cross-references are checked before mutation, including NPC/business region references and organization member/region references;
- era variants attach to stable base IDs and can activate without replacing canonical content identity;
- public projection exposes counts, active era, stable region labels, and active-variant count while omitting private authoring metadata, source revisions, event history, and unactivated variants;
- hash-linked snapshots reject stale, duplicate, missing-reference, and tampered content writes.

## Acceptance evidence

`npm test` includes `content.test.mjs`, which proves cross-reference admission, stable era variants, fail-closed invalid/duplicate/stale packs, and snapshot integrity.

## Boundary

This is a fictional content-authoring registry. It does not claim factual geography, real-person likeness, or production-ready asset validation; visual/audio/native build acceptance remains separate.
