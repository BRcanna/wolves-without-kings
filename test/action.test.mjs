import test from "node:test";
import assert from "node:assert/strict";

import {
  createCharacter,
  createInitialWorld,
  resolveMeleeEncounter,
  resolveTraversalAction,
} from "../src/wolves-without-kings/engine.mjs";

test("layered traversal records route knowledge, noise, risk, and alternate outcomes", () => {
  let world = createInitialWorld();
  world = resolveTraversalAction(world, {
    expectedRevision: world.revision,
    actionId: "traversal:roof-escape",
    actorId: "character:player",
    fromLocationId: "loc:night-market",
    toLocationId: "loc:lantern-rooftop",
    routeIds: ["route:market-to-roof"],
    mode: "climb",
    noise: 15,
    risk: 35,
    conditionCost: 20,
    familiarity: "partial",
  });
  world = resolveTraversalAction(world, {
    expectedRevision: world.revision,
    actionId: "traversal:blocked-service",
    actorId: "character:player",
    fromLocationId: "loc:motel-service-yard",
    toLocationId: "loc:tram-underpass",
    routeIds: ["route:yard-to-underpass"],
    mode: "service",
    noise: 5,
    risk: 80,
    familiarity: "unknown",
    outcome: "blocked",
  });
  assert.equal(world.actions[0].routeIds[0], "route:market-to-roof");
  assert.equal(world.actions[0].mode, "climb");
  assert.equal(world.actions[1].outcome, "blocked");
});

test("melee resolves consequence outcomes without bullet-sponge health", () => {
  let world = createInitialWorld();
  world = createCharacter(world, {
    expectedRevision: world.revision,
    characterId: "character:player",
    displayName: "The Player",
  });
  world = resolveMeleeEncounter(world, {
    expectedRevision: world.revision,
    actionId: "melee:stairwell",
    actorId: "character:player",
    opponentIds: ["npc:resident-01", "npc:resident-02"],
    style: "improvised",
    outcome: "disengaged",
    locationId: "loc:motel-service-yard",
    staminaCost: 30,
    injuryDelta: 12,
    environmentContact: "railing",
    witnessCount: 3,
  });
  assert.equal(world.characters["character:player"].condition.fatigue, 30);
  assert.equal(world.characters["character:player"].condition.injury, 12);
  assert.equal(world.characters["character:player"].condition.healthState, "injured");
  assert.equal(world.actions[0].outcome, "disengaged");
  assert.equal(world.actions[0].witnessCount, 3);
  assert.throws(
    () => resolveMeleeEncounter(world, {
      expectedRevision: world.revision,
      actionId: "melee:invalid",
      actorId: "character:player",
      opponentIds: ["npc:resident-01"],
      outcome: "instant-win",
      locationId: "loc:motel-service-yard",
    }),
    /unsupported melee outcome/,
  );
  assert.equal(world.revision, 2);
});
