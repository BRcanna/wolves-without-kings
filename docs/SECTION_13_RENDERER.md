# Section 13 — Local public-projection renderer preview

## Purpose

Section 13 turns the tested public projection into a small, inspectable local browser surface. It is a renderer preview, not a claim that the game is playable or production-ready.

## Data path

`npm run preview:build` runs the deterministic year-one history and writes `web/scenario.json`. The builder imports the same `projectWorld(world, "public")` path used by the privacy tests. The committed JSON is therefore a preview artifact, not a second authority state.

The renderer loads that file and displays only qualitative/public fields:

- summary date, district, businesses, organizations, markets, objects, and cases count;
- business names, districts, operating state, and stability;
- market region, commodity, price band, and uncertainty.

Private beliefs, raw skill values, surveillance records, agency case confidence, and debug state are not transported to the page.

## Accessibility and failure behavior

The page provides a document title, a main landmark, heading structure, responsive cards, and an `aria-live` status region. While loading, the status says that the projection is loading. A failed fetch changes the status to an actionable error instead of rendering an empty or misleading world.

The client uses DOM text nodes and `textContent` for projection values. It does not interpret scenario data as markup.

## Verification

```text
npm test
npm run preview:build
```

`test/renderer.test.mjs` checks deterministic preview generation, the public scope marker, absence of private fields, required page landmarks, projection loading, safe text insertion, and responsive CSS. This does not prove browser compatibility, performance, art direction, content completeness, online connectivity, or production acceptance.
