import test from "node:test";
import assert from "node:assert/strict";

import {
  ContentValidationError,
  admitContentPack,
  createContentRegistry,
  projectContent,
} from "../src/wolves-without-kings/content.mjs";

function packageWithTopology() {
  return {
    regions: [{ id: "region:south", label: "South district", mode: "full" }],
    locations: [
      { id: "loc:street", regionId: "region:south", layer: "street", accessModes: ["walk"] },
      { id: "loc:yard", regionId: "region:south", layer: "service", accessModes: ["walk", "service"] },
    ],
    routes: [{ id: "route:street-yard", fromLocationId: "loc:street", toLocationId: "loc:yard", movementModes: ["walk", "service"] }],
    npcs: [{ id: "npc:keeper", displayName: "Keeper", regionId: "region:south" }],
    businesses: [{ id: "business:yard", label: "South Yard", regionId: "region:south" }],
    organizations: [{ id: "organization:watch", displayName: "Watch House", memberIds: ["npc:keeper"] }],
    scheduleTemplates: [{ id: "schedule:keeper", actorId: "npc:keeper", locationId: "loc:street", startHour: 8, endHour: 18 }],
    eraVariants: {
      "late-1990s": [{ id: "variant:yard-sign", baseId: "loc:yard", label: "Late-1990s yard sign" }],
    },
  };
}

test("content admission persists functional locations, access routes, and schedules", () => {
  let state = createContentRegistry({ packId: "pack:pipeline" });
  state = admitContentPack(state, { expectedRevision: state.revision, ...packageWithTopology() });
  const projection = projectContent(state);

  assert.deepEqual(projection.counts, { regions: 1, npcs: 1, businesses: 1, organizations: 1, locations: 2, routes: 1, scheduleTemplates: 1 });
  assert.equal(state.routes["route:street-yard"].fromLocationId, "loc:street");
  assert.equal(state.scheduleTemplates["schedule:keeper"].endHour, 18);
});

test("content admission rejects broken access references and impossible schedule windows", () => {
  let state = createContentRegistry({ packId: "pack:invalid-pipeline" });
  assert.throws(
    () => admitContentPack(state, {
      expectedRevision: state.revision,
      ...packageWithTopology(),
      routes: [{ id: "route:broken", fromLocationId: "loc:street", toLocationId: "loc:missing", movementModes: ["walk"] }],
    }),
    /unknown location/,
  );
  assert.equal(Object.keys(state.locations).length, 0);

  assert.throws(
    () => admitContentPack(state, {
      expectedRevision: state.revision,
      ...packageWithTopology(),
      scheduleTemplates: [{ id: "schedule:impossible", actorId: "npc:keeper", locationId: "loc:street", startHour: 8, endHour: 8 }],
    }),
    ContentValidationError,
  );
  assert.equal(Object.keys(state.locations).length, 0);
});

test("content admission rejects missing access labels before any content is committed", () => {
  let state = createContentRegistry({ packId: "pack:access" });
  assert.throws(
    () => admitContentPack(state, {
      expectedRevision: state.revision,
      ...packageWithTopology(),
      locations: [{ id: "loc:bad", regionId: "region:south", layer: "street", accessModes: [] }],
    }),
    /accessModes/,
  );
  assert.equal(Object.keys(state.regions).length, 0);
});
