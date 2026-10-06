import test from "node:test";
import assert from "node:assert/strict";

import { admitContentPack, createContentRegistry, projectContent } from "../src/wolves-without-kings/content.mjs";
import { buildVerticalContentPack } from "../src/wolves-without-kings/content-pack.mjs";

test("the vertical slice admits one functional authored district package", () => {
  const pack = buildVerticalContentPack();
  let state = createContentRegistry({ packId: pack.packId });
  state = admitContentPack(state, { expectedRevision: state.revision, ...pack });
  const projection = projectContent(state);

  assert.deepEqual(projection.counts, {
    regions: 1,
    npcs: 30,
    businesses: 3,
    organizations: 2,
    locations: 8,
    routes: 7,
    scheduleTemplates: 30,
  });
  assert.equal(projection.activeEraVariantCount, 2);
  assert.match(pack.safetyBoundary, /fictionalized/);
  assert.doesNotMatch(pack.safetyBoundary, /step-by-step|recipe/i);
});
