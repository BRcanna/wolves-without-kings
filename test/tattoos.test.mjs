import test from "node:test";
import assert from "node:assert/strict";

import {
  TattooStaleRevisionError,
  TattooValidationError,
  advanceTattooTime,
  createMarker,
  createTattooState,
  earnMarker,
  projectTattoos,
  registerObserver,
  resolveMarkerEncounter,
  restoreTattoos,
  snapshotTattoos,
} from "../src/wolves-without-kings/tattoos.mjs";

function seededState() {
  let state = createTattooState({ characterId: "character:returned", era: 2 });
  state = createMarker(state, {
    expectedRevision: state.revision,
    markerId: "marker:old-lantern",
    bodyLocation: "left-forearm",
    category: "organizational",
    meaningDomains: ["affiliation", "prison-history"],
    issuerOrOrigin: "old-guard-prison-circle",
    organizationId: "organization:lanterns",
    prisonContext: { facilityId: "facility:fictional-east", sentenceEra: 1 },
    earnedEventId: "event:prison-standing",
    misuseConsequence: "challenge",
  });
  state = createMarker(state, {
    expectedRevision: state.revision,
    markerId: "marker:plain-star",
    bodyLocation: "right-shoulder",
    category: "cosmetic",
    meaningDomains: ["memory"],
    issuerOrOrigin: "self",
    publicVisibility: "concealed",
    misuseConsequence: "none",
  });
  return state;
}

test("the same marker resolves differently for older, younger, and uninformed observers", () => {
  let state = seededState();
  state = registerObserver(state, {
    expectedRevision: state.revision,
    observerId: "observer:old-guard",
    knownOrganizationIds: ["organization:lanterns"],
    knownEras: [1, 2],
  });
  state = registerObserver(state, {
    expectedRevision: state.revision,
    observerId: "observer:younger-crew",
    knownOrganizationIds: ["organization:lanterns"],
    knownEras: [2],
  });
  state = registerObserver(state, {
    expectedRevision: state.revision,
    observerId: "observer:outsider",
  });
  state = resolveMarkerEncounter(state, { expectedRevision: state.revision, markerId: "marker:old-lantern", observerId: "observer:old-guard" });
  state = resolveMarkerEncounter(state, { expectedRevision: state.revision, markerId: "marker:old-lantern", observerId: "observer:younger-crew" });
  state = resolveMarkerEncounter(state, { expectedRevision: state.revision, markerId: "marker:old-lantern", observerId: "observer:outsider" });
  const [oldGuard, younger, outsider] = state.recognitions.slice(-3);
  assert.equal(oldGuard.interpretation, "recognized-affiliation");
  assert.equal(younger.interpretation, "recognized-affiliation");
  assert.equal(outsider.interpretation, "unfamiliar-marker");
  assert.equal(outsider.confidence, "low");
});

test("earned history survives prison context and time changes the marker band without granting direct authority", () => {
  let state = seededState();
  state = advanceTattooTime(state, { expectedRevision: state.revision, days: 3650 });
  assert.equal(state.markers["marker:old-lantern"].historicalBand, "old-guard");
  state = registerObserver(state, {
    expectedRevision: state.revision,
    observerId: "observer:modern",
    knownOrganizationIds: ["organization:lanterns"],
    knownEras: [2],
    eraAwareness: "broad",
  });
  state = resolveMarkerEncounter(state, {
    expectedRevision: state.revision,
    markerId: "marker:old-lantern",
    observerId: "observer:modern",
    claimedOrganizationId: "organization:other",
  });
  const observation = state.recognitions.at(-1);
  assert.equal(observation.interpretation, "unauthorized-claim");
  assert.equal(observation.consequence, "challenge");
  const publicView = projectTattoos(state);
  assert.equal(publicView.markers[0].historicalBand, "old-guard");
  assert.equal(publicView.omittedFields.includes("organizationId"), true);
  assert.equal(publicView.omittedFields.includes("misuseConsequence"), true);
});

test("unearned organizational status, covered visibility, and stale writes fail closed", () => {
  let state = createTattooState({ characterId: "character:unknown" });
  state = createMarker(state, {
    expectedRevision: state.revision,
    markerId: "marker:unearned",
    bodyLocation: "neck",
    category: "organizational",
    organizationId: "organization:lanterns",
    issuerOrOrigin: "claimed",
    earnedEventId: null,
  });
  state = registerObserver(state, {
    expectedRevision: state.revision,
    observerId: "observer:knows",
    knownOrganizationIds: ["organization:lanterns"],
  });
  state = resolveMarkerEncounter(state, {
    expectedRevision: state.revision,
    markerId: "marker:unearned",
    observerId: "observer:knows",
  });
  assert.equal(state.recognitions.at(-1).interpretation, "unearned-status");
  assert.throws(
    () => earnMarker(state, { expectedRevision: state.revision - 1, markerId: "marker:unearned", earnedEventId: "event:late" }),
    TattooStaleRevisionError,
  );
  assert.equal(state.markers["marker:unearned"].earned, false);
  assert.throws(
    () => createMarker(state, {
      expectedRevision: state.revision,
      markerId: "marker:bad",
      bodyLocation: "hand",
      issuerOrOrigin: "x",
      category: "organizational",
      misuseConsequence: "real-world-procedure",
    }),
    TattooValidationError,
  );
});

test("covered and concealed markers stay private in public encounters and snapshots reject tampering", () => {
  let state = createTattooState({ characterId: "character:private" });
  state = createMarker(state, {
    expectedRevision: state.revision,
    markerId: "marker:covered",
    bodyLocation: "chest",
    category: "historical",
    issuerOrOrigin: "private-history",
    publicVisibility: "covered",
    misuseConsequence: "investigation",
  });
  state = registerObserver(state, { expectedRevision: state.revision, observerId: "observer:street" });
  state = resolveMarkerEncounter(state, {
    expectedRevision: state.revision,
    markerId: "marker:covered",
    observerId: "observer:street",
    visibility: "public",
  });
  assert.equal(state.recognitions.at(-1).interpretation, "not-observed");
  assert.deepEqual(restoreTattoos(snapshotTattoos(state)), state);
  assert.throws(
    () => restoreTattoos({ snapshotVersion: 1, state: { ...state, lastEventHash: "tampered" } }),
    TattooValidationError,
  );
});
