import test from "node:test";
import assert from "node:assert/strict";

import { admitContentPack, createContentRegistry, projectContent } from "../src/wolves-without-kings/content.mjs";
import { assertVerticalContentMatchesWorld, buildVerticalContentPack } from "../src/wolves-without-kings/content-pack.mjs";
import { runVerticalHistory } from "../src/wolves-without-kings/vertical-slice.mjs";

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

test("the authored package stays aligned with authoritative vertical-slice identities", () => {
  const pack = buildVerticalContentPack();
  const { world } = runVerticalHistory("relationship");
  assert.deepEqual(assertVerticalContentMatchesWorld(pack, world), {
    locations: 8,
    routes: 7,
    npcs: 30,
    businesses: 3,
    organizations: 2,
  });
  assert.equal(world.districtTopology.locations.length, 8);
  assert.equal(world.districtTopology.routes.length, 7);
  const broken = structuredClone(pack);
  broken.businesses[0].id = "business:missing";
  assert.throws(() => assertVerticalContentMatchesWorld(broken, world), /not in the runtime world/);
});
