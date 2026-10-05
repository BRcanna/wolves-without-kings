import test from "node:test";
import assert from "node:assert/strict";

import {
  InvalidCommandError,
  changeCharacterCondition,
  changeCharacterFamiliarity,
  createCharacter,
  createInitialWorld,
  practiceCharacterSkill,
  restore,
  snapshot,
} from "../src/wolves-without-kings/engine.mjs";

function createPlayer() {
  return createCharacter(createInitialWorld(), {
    expectedRevision: 0,
    characterId: "character:player",
    displayName: "The Player",
    birthYear: 1980,
    background: "neighborhood resident",
  });
}

test("character creation establishes canonical condition, skill, and familiarity state", () => {
  const world = createPlayer();
  const character = world.characters["character:player"];

  assert.equal(world.revision, 1);
  assert.equal(character.condition.healthState, "stable");
  assert.equal(character.skills.driving.tier, "latent");
  assert.deepEqual(character.familiarity, {});
});

test("skill practice advances hidden competence through deterministic history", () => {
  let world = createPlayer();
  world = practiceCharacterSkill(world, {
    expectedRevision: world.revision,
    characterId: "character:player",
    skill: "driving",
    units: 3,
    contextId: "loc:market-street",
  });
  world = practiceCharacterSkill(world, {
    expectedRevision: world.revision,
    characterId: "character:player",
    skill: "driving",
    units: 7,
  });

  assert.deepEqual(world.characters["character:player"].skills.driving, {
    practice: 10,
    tier: "practiced",
    lastPracticeEventId: "evt-000003",
  });
});

test("familiarity and body condition remain bounded and evented", () => {
  let world = createPlayer();
  world = changeCharacterFamiliarity(world, {
    expectedRevision: world.revision,
    characterId: "character:player",
    contextId: "district:sofia-south",
    exposure: 10,
  });
  world = changeCharacterCondition(world, {
    expectedRevision: world.revision,
    characterId: "character:player",
    fatigueDelta: 20,
    injuryDelta: 15,
  });

  assert.deepEqual(world.characters["character:player"].familiarity["district:sofia-south"], {
    exposure: 10,
    level: "familiar",
    lastEventId: "evt-000002",
  });
  assert.deepEqual(world.characters["character:player"].condition, {
    fatigue: 20,
    injury: 15,
    healthState: "injured",
    lastEventId: "evt-000003",
  });
});

test("character state survives snapshot restore and invalid skills fail closed", () => {
  const world = createPlayer();
  assert.throws(
    () => practiceCharacterSkill(world, {
      expectedRevision: world.revision,
      characterId: "character:player",
      skill: "crime_magic",
    }),
    (error) => error instanceof InvalidCommandError,
  );
  assert.deepEqual(restore(snapshot(world)), world);
});
