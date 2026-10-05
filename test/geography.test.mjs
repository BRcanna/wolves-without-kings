import test from "node:test";
import assert from "node:assert/strict";

import {
  GeographyStaleRevisionError,
  GeographyValidationError,
  connectGeographyRegions,
  createGeographyState,
  projectGeography,
  recordGeographyMemory,
  registerGeographyRegion,
  restoreGeography,
  settleGeographyTime,
  snapshotGeography,
} from "../src/wolves-without-kings/geography.mjs";

function fixture() {
  let state = createGeographyState({ simulationDate: "1999-01-01" });
  state = registerGeographyRegion(state, {
    expectedRevision: state.revision,
    regionId: "region:capital",
    cityOrArea: "Sofia Basin",
    publicLabel: "South Capital (fictionalized)",
    role: "capital",
    socialLayers: ["government", "estates", "nightlife", "industry"],
    architecture: ["estate", "industrial", "wealthy-district"],
    policeDomain: "capital-domain",
    economyProfile: "dense-services",
    simulationMode: "full",
  });
  state = registerGeographyRegion(state, {
    expectedRevision: state.revision,
    regionId: "region:coast",
    cityOrArea: "Black Sea Corridor",
    publicLabel: "Coastal Zone (fictionalized)",
    role: "coastal",
    socialLayers: ["tourism", "port-work", "construction", "seasonal-residents"],
    architecture: ["resort", "port-edge", "older-town"],
    policeDomain: "coastal-domain",
    economyProfile: "seasonal-international",
  });
  state = registerGeographyRegion(state, {
    expectedRevision: state.revision,
    regionId: "region:rural",
    cityOrArea: "North Valley Towns",
    publicLabel: "Rural Network (fictionalized)",
    role: "rural",
    socialLayers: ["small-town-memory", "family-business", "agriculture"],
    architecture: ["village", "warehouse", "town-center"],
    policeDomain: "rural-domain",
    economyProfile: "small-town-mixed",
  });
  state = registerGeographyRegion(state, {
    expectedRevision: state.revision,
    regionId: "region:mountain",
    cityOrArea: "Mountain Pass Country",
    publicLabel: "Mountain Route (fictionalized)",
    role: "mountain",
    socialLayers: ["isolated-settlements", "seasonal-work", "old-families"],
    architecture: ["stone", "forest-edge", "remote-property"],
    policeDomain: "mountain-domain",
    economyProfile: "seasonal-rural",
  });
  state = connectGeographyRegions(state, {
    expectedRevision: state.revision,
    linkId: "link:capital-coast",
    fromRegionId: "region:capital",
    toRegionId: "region:coast",
    linkType: "rail",
    travelDays: 2,
    baseFriction: 40,
  });
  state = connectGeographyRegions(state, {
    expectedRevision: state.revision,
    linkId: "link:rural-mountain",
    fromRegionId: "region:rural",
    toRegionId: "region:mountain",
    linkType: "road",
    travelDays: 3,
    baseFriction: 70,
  });
  return state;
}

test("national geography fixture preserves distinct capital, coastal, rural, and mountain roles", () => {
  const state = fixture();
  assert.equal(state.regions["region:capital"].role, "capital");
  assert.equal(state.regions["region:coast"].seasonBand, "seasonal-low");
  assert.equal(state.regions["region:rural"].socialLayers.includes("small-town-memory"), true);
  assert.equal(state.regions["region:mountain"].architecture.includes("forest-edge"), true);
  assert.equal(state.links["link:rural-mountain"].status, "restricted");
});

test("season settlement changes coastal and mountain continuity without replacing region identity", () => {
  let state = settleGeographyTime(fixture(), { expectedRevision: fixture().revision, days: 180 });
  assert.equal(state.simulationDate, "1999-06-30");
  assert.equal(state.season, "summer");
  assert.equal(state.regions["region:coast"].seasonBand, "seasonal-high");
  assert.equal(state.regions["region:mountain"].id, "region:mountain");
  assert.equal(state.links["link:rural-mountain"].history.at(-1).season, "summer");
});

test("public projection keeps geography useful while redacting exact institutional and transport detail", () => {
  let state = fixture();
  state = recordGeographyMemory(state, {
    expectedRevision: state.revision,
    regionId: "region:rural",
    memoryType: "old-market",
    meaning: "remembered-place",
    visibility: "private",
  });
  const publicView = projectGeography(state, { scope: "public" });
  const debugView = projectGeography(state, { scope: "debug" });
  assert.equal(publicView.regions.find((region) => region.id === "region:rural").memoryCount, 0);
  assert.equal(Object.hasOwn(publicView.regions[0], "policeDomain"), false);
  assert.equal(Object.hasOwn(publicView.links[0], "exactTravelDays"), false);
  assert.equal(Object.hasOwn(debugView.regions[0], "policeDomain"), true);
});

test("geography rejects stale or invalid topology before mutation", () => {
  const state = fixture();
  assert.throws(
    () => registerGeographyRegion(state, {
      expectedRevision: state.revision - 1,
      regionId: "region:invalid",
      cityOrArea: "Invalid",
      publicLabel: "Invalid",
      role: "rural",
      socialLayers: ["one"],
      architecture: ["one"],
      policeDomain: "domain",
      economyProfile: "profile",
    }),
    GeographyStaleRevisionError,
  );
  assert.throws(
    () => connectGeographyRegions(state, {
      expectedRevision: state.revision,
      linkId: "link:unknown",
      fromRegionId: "region:capital",
      toRegionId: "region:missing",
      linkType: "road",
      travelDays: 1,
      baseFriction: 20,
    }),
    GeographyValidationError,
  );
  assert.equal(Object.hasOwn(state.regions, "region:invalid"), false);
});

test("geography snapshot restore preserves history and rejects tampering", () => {
  const state = fixture();
  const restored = restoreGeography(snapshotGeography(state));
  assert.deepEqual(restored, state);
  assert.throws(
    () => restoreGeography({ snapshotVersion: 1, state: { ...state, lastEventHash: "tampered" } }),
    GeographyValidationError,
  );
});
