import {
  advanceTime,
  changeDistrictCondition,
  createInitialWorld,
  inspect,
  recordEvent,
  snapshot,
  restore,
} from "./engine.mjs";

let world = createInitialWorld();
world = changeDistrictCondition(world, {
  expectedRevision: world.revision,
  condition: "watchful",
  actorId: "npc:district-steward",
});
world = recordEvent(world, {
  expectedRevision: world.revision,
  eventType: "social.first_contact",
  actors: ["character:player", "npc:broker-01"],
  subjects: ["business:night-market"],
  location: "sofia-south",
  payload: { outcome: "invitation", trust: "uncertain" },
});
world = advanceTime(world, { expectedRevision: world.revision, days: 30 });

const restored = restore(snapshot(world));
console.log(JSON.stringify({
  state: inspect(world),
  restoredMatches: JSON.stringify(restored) === JSON.stringify(world),
  events: world.events.map(({ eventId, eventType, worldRevision, hash }) => ({ eventId, eventType, worldRevision, hash })),
}, null, 2));
