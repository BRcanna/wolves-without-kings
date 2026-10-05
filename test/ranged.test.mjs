import test from "node:test";
import assert from "node:assert/strict";

import {
  createInitialWorld,
  createWeapon,
  resolveRangedEncounter,
  restore,
  snapshot,
} from "../src/wolves-without-kings/engine.mjs";
import { projectWorld } from "../src/wolves-without-kings/projection.mjs";

test("ranged encounters preserve suppression, cover, sound, witnesses, evidence, and weapon condition", () => {
  let world = createInitialWorld({ startDate: "1999-01-01" });
  world = createWeapon(world, {
    expectedRevision: world.revision,
    weaponId: "weapon:garage-sidearm",
    weaponClass: "sidearm",
    handlingProfile: "steady",
    ammo: 6,
    condition: "worn",
    ownerId: "character:player",
    locationId: "loc:motel-service-yard",
  });
  world = resolveRangedEncounter(world, {
    expectedRevision: world.revision,
    actionId: "ranged:garage-suppression",
    actorId: "character:player",
    weaponId: "weapon:garage-sidearm",
    opponentIds: ["npc:rival-one", "npc:rival-two"],
    locationId: "loc:motel-service-yard",
    rangeBand: "near",
    stance: "covered",
    coverState: "solid",
    stress: 65,
    familiarity: "known",
    shots: 3,
    outcome: "suppressed",
    suppression: 70,
    witnessCount: 4,
    cameraCount: 2,
    noiseBand: "high",
    policeInterestDelta: 20,
    evidenceArtifacts: ["abstract-casing", "camera-record"],
  });
  world = resolveRangedEncounter(world, {
    expectedRevision: world.revision,
    actionId: "ranged:garage-injury",
    actorId: "character:player",
    weaponId: "weapon:garage-sidearm",
    opponentIds: ["npc:rival-one"],
    locationId: "loc:motel-service-yard",
    rangeBand: "near",
    stance: "stationary",
    coverState: "partial",
    stress: 40,
    familiarity: "known",
    shots: 3,
    outcome: "injured",
    suppression: 35,
    injuryDelta: 20,
    witnessCount: 2,
    noiseBand: "high",
    policeInterestDelta: 10,
    evidenceArtifacts: ["abstract-casing"],
  });

  const weapon = world.weapons["weapon:garage-sidearm"];
  assert.equal(weapon.ammo, 0);
  assert.equal(weapon.condition, "damaged");
  assert.equal(weapon.shotHistory.length, 2);
  assert.equal(world.actions.at(-1).outcome, "injured");
  assert.equal(world.actions[0].suppression, 70);
  assert.equal(world.firearmEvidence["firearm-evidence:ranged:garage-suppression"].witnessCount, 4);
  assert.deepEqual(restore(snapshot(world)), world);
});

test("public ranged projection exposes qualitative weapon state without owner, ammo, or evidence internals", () => {
  let world = createInitialWorld();
  world = createWeapon(world, {
    expectedRevision: world.revision,
    weaponId: "weapon:public",
    ammo: 2,
    ownerId: "character:private",
    locationId: "loc:night-market",
  });
  const publicWeapon = projectWorld(world, { scope: "public" }).weapons[0];
  assert.equal(publicWeapon.ammoBand, "limited");
  assert.equal(Object.hasOwn(publicWeapon, "ammo"), false);
  assert.equal(Object.hasOwn(publicWeapon, "ownerId"), false);
  assert.equal(Object.hasOwn(publicWeapon, "shotHistory"), false);
  assert.equal(Object.hasOwn(projectWorld(world, { scope: "public" }), "firearmEvidence"), false);
});

test("ranged outcomes reject stale, invalid, and over-ammo proposals before mutation", () => {
  let world = createInitialWorld();
  world = createWeapon(world, {
    expectedRevision: world.revision,
    weaponId: "weapon:bounded",
    ammo: 1,
    locationId: "loc:market-street",
  });
  assert.throws(
    () => resolveRangedEncounter(world, {
      expectedRevision: world.revision,
      actionId: "ranged:too-many",
      actorId: "character:player",
      weaponId: "weapon:bounded",
      opponentIds: ["npc:one"],
      locationId: "loc:market-street",
      shots: 2,
    }),
    /insufficient abstract ammunition/,
  );
  assert.throws(
    () => resolveRangedEncounter(world, {
      expectedRevision: world.revision,
      actionId: "ranged:invalid",
      actorId: "character:player",
      weaponId: "weapon:bounded",
      opponentIds: ["npc:one"],
      locationId: "loc:market-street",
      outcome: "instant-win",
    }),
    /unsupported ranged outcome/,
  );
  assert.throws(
    () => resolveRangedEncounter(world, {
      expectedRevision: world.revision - 1,
      actionId: "ranged:stale",
      actorId: "character:player",
      weaponId: "weapon:bounded",
      opponentIds: ["npc:one"],
      locationId: "loc:market-street",
    }),
    /stale command/,
  );
  assert.equal(world.revision, 1);
});
