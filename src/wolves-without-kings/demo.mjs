import {
  advanceTime,
  changeDistrictCondition,
  createInitialWorld,
  inspect,
  resolveSocialContact,
  snapshot,
  restore,
} from "./engine.mjs";
import { createDistrictFixture, findTraversalPath } from "./district.mjs";

let world = createInitialWorld();
const district = createDistrictFixture();
world = changeDistrictCondition(world, {
  expectedRevision: world.revision,
  condition: "watchful",
  actorId: "npc:district-steward",
});
world = resolveSocialContact(world, {
  expectedRevision: world.revision,
  actorId: "character:player",
  subjectId: "npc:broker-01",
  locationId: "loc:night-market",
  outcome: "welcomed",
});
world = advanceTime(world, { expectedRevision: world.revision, days: 30 });

const restored = restore(snapshot(world));
console.log(JSON.stringify({
  state: inspect(world),
  district: {
    districtId: district.districtId,
    locations: district.locations.length,
    pathToRooftop: findTraversalPath(district, { from: "loc:market-street", to: "loc:lantern-rooftop", mode: "climb" }),
  },
  restoredMatches: JSON.stringify(restored) === JSON.stringify(world),
  events: world.events.map(({ eventId, eventType, worldRevision, hash }) => ({ eventId, eventType, worldRevision, hash })),
}, null, 2));
