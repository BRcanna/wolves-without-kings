import test from "node:test";
import assert from "node:assert/strict";

import {
  DynastyStaleRevisionError,
  DynastyValidationError,
  addLegacyTrophy,
  createDynastyState,
  createInheritanceManifest,
  createSuccessor,
  projectDynasty,
  recordSeasonHistory,
  registerFounder,
  restoreDynasty,
  retireFounder,
  snapshotDynasty,
} from "../src/wolves-without-kings/dynasty.mjs";

function founderState() {
  let state = createDynastyState({ publicName: "Lantern House" });
  state = registerFounder(state, {
    expectedRevision: state.revision,
    characterId: "character:founder",
    displayName: "The Founder",
    birthYear: 1970,
  });
  state = addLegacyTrophy(state, {
    expectedRevision: state.revision,
    trophyId: "trophy:old-coupe",
    label: "The old coupe",
    sourceEventId: "evt:historic-chase",
  });
  return state;
}

test("successor inherits explicit durable channels but not private capability or memory", () => {
  let state = founderState();
  state = createInheritanceManifest(state, {
    expectedRevision: state.revision,
    manifestId: "manifest:founder-successor",
    predecessorId: "character:founder",
    properties: ["property:family-house"],
    organizations: ["organization:lanterns:office"],
    documents: ["document:transport-contract"],
    trophies: ["trophy:old-coupe"],
    introductions: ["npc:old-friend"],
    burdenBands: { enemies: "high", debts: "moderate", expectations: "high" },
  });
  state = retireFounder(state, {
    expectedRevision: state.revision,
    characterId: "character:founder",
    reason: "retired",
  });
  state = createSuccessor(state, {
    expectedRevision: state.revision,
    successorId: "character:successor",
    displayName: "The Successor",
    birthYear: 1990,
    predecessorId: "character:founder",
    manifestId: "manifest:founder-successor",
    relation: "protégé",
  });
  const successor = state.characters["character:successor"];
  assert.equal(state.era, 2);
  assert.deepEqual(successor.inheritedProperties, ["property:family-house"]);
  assert.deepEqual(successor.inheritedOrganizations, ["organization:lanterns:office"]);
  assert.deepEqual(successor.inheritedTrophies, ["trophy:old-coupe"]);
  assert.deepEqual(successor.introductions, ["npc:old-friend"]);
  assert.equal(successor.burdenBands.enemies, "high");
  assert.equal(successor.skills.driving.tier, "latent");
  assert.deepEqual(successor.familiarity, {});
  assert.deepEqual(successor.privateMemories, []);
  assert.equal(state.characters["character:founder"].status, "retired");
  assert.equal(state.inheritanceManifests["manifest:founder-successor"].used, true);
});

test("season history and trophies preserve recognition without granting competitive power", () => {
  let state = founderState();
  state = recordSeasonHistory(state, {
    expectedRevision: state.revision,
    seasonId: "season:founder-era",
    characterId: "character:founder",
    participationMarker: "district-history",
    title: "Keeper of the House",
  });
  const publicView = projectDynasty(state, "character:founder");
  assert.equal(publicView.seasonCount, 1);
  assert.equal(publicView.trophyCount, 1);
  assert.equal(state.trophies["trophy:old-coupe"].competitivePower, false);
  assert.equal(publicView.character.publicTitle, "Keeper of the House");
  assert.equal(publicView.omittedFields.includes("privateMemories"), true);
});

test("private inheritance fields, missing succession state, and stale writes fail closed", () => {
  let state = founderState();
  assert.throws(
    () => createInheritanceManifest(state, {
      expectedRevision: state.revision,
      manifestId: "manifest:invalid",
      predecessorId: "character:founder",
      properties: [],
      skills: ["driving"],
    }),
    /private inheritance field/,
  );
  assert.throws(
    () => createSuccessor(state, {
      expectedRevision: state.revision,
      successorId: "character:successor",
      displayName: "Successor",
      birthYear: 1990,
      predecessorId: "character:founder",
      manifestId: "manifest:missing",
    }),
    /unknown inheritance manifest/,
  );
  assert.throws(
    () => retireFounder(state, { expectedRevision: state.revision - 1, characterId: "character:founder" }),
    DynastyStaleRevisionError,
  );
  assert.equal(state.characters["character:founder"].status, "active");
});

test("dynasty state restores from its event chain and rejects tampering", () => {
  const state = founderState();
  assert.deepEqual(restoreDynasty(snapshotDynasty(state)), state);
  assert.throws(
    () => restoreDynasty({ snapshotVersion: 1, state: { ...state, lastEventHash: "tampered" } }),
    DynastyValidationError,
  );
});
