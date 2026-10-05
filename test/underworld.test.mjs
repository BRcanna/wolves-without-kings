import test from "node:test";
import assert from "node:assert/strict";

import {
  UnderworldStaleRevisionError,
  UnderworldValidationError,
  applyPlayerMarketInfluence,
  claimProperty,
  createUnderworldState,
  joinPlayerSession,
  leavePlayerSession,
  projectUnderworld,
  queueOrganizationWork,
  registerNpcBaseline,
  registerMarket,
  registerOrganization,
  registerProperty,
  restoreUnderworld,
  settleUnderworldWeek,
  snapshotUnderworld,
} from "../src/wolves-without-kings/underworld.mjs";

function seededUnderworld() {
  let state = createUnderworldState();
  state = registerOrganization(state, {
    expectedRevision: state.revision,
    orgId: "organization:lanterns",
    headquartersRegionId: "region:sofia",
  });
  state = registerOrganization(state, {
    expectedRevision: state.revision,
    orgId: "organization:rivals",
    headquartersRegionId: "region:coast",
  });
  state = registerMarket(state, {
    expectedRevision: state.revision,
    marketId: "market:vehicle-demand",
    regionId: "region:coast",
    commodityClass: "vehicle-demand",
  });
  state = registerProperty(state, {
    expectedRevision: state.revision,
    propertyId: "property:warehouse",
    regionId: "region:coast",
    ownerOrgId: "organization:lanterns",
  });
  state = queueOrganizationWork(state, {
    expectedRevision: state.revision,
    orgId: "organization:lanterns",
    workId: "work:offline-transport",
    requiredRole: "logistics",
  });
  state = queueOrganizationWork(state, {
    expectedRevision: state.revision,
    orgId: "organization:rivals",
    workId: "work:offline-market",
    requiredRole: "market",
  });
  return state;
}

test("one shared week advances markets, offline organization work, and bounded physical sessions", () => {
  let state = seededUnderworld();
  state = settleUnderworldWeek(state, {
    expectedRevision: state.revision,
    marketShocks: { "market:vehicle-demand": 25 },
    organizationOutcomes: {
      "organization:lanterns": { completedWorkIds: ["work:offline-transport"] },
    },
    physicalSessions: [{
      sessionId: "session:one",
      regionId: "region:coast",
      participantCount: 3,
      outcome: "completed",
    }],
  });
  assert.equal(state.serverWeek, 1);
  assert.equal(state.serverTick, 7);
  assert.equal(state.markets["market:vehicle-demand"].pressure, 75);
  assert.equal(state.organizations["organization:lanterns"].workItems["work:offline-transport"].status, "completed");
  assert.equal(state.organizations["organization:rivals"].workItems["work:offline-market"].status, "active");
  assert.equal(state.physicalSessions["session:one"].participantCount, 3);
  assert.equal(state.seasonHistory[0].physicalSessionCount, 1);
});

test("property conflicts preserve one owner and create an explicit contested claim", () => {
  let state = seededUnderworld();
  state = claimProperty(state, {
    expectedRevision: state.revision,
    propertyId: "property:warehouse",
    orgId: "organization:rivals",
  });
  assert.equal(state.properties["property:warehouse"].ownerOrgId, "organization:lanterns");
  assert.equal(state.properties["property:warehouse"].status, "contested");
  assert.deepEqual(state.territoryClaims["property:warehouse"].claimants, ["organization:lanterns", "organization:rivals"]);
});

test("public Underworld projection exposes macro bands without private history or exact pressure", () => {
  const state = seededUnderworld();
  const publicView = projectUnderworld(state);
  assert.equal(publicView.markets[0].commodityClass, "vehicle-demand");
  assert.equal(Object.hasOwn(publicView.markets[0], "pressure"), false);
  assert.equal(Object.hasOwn(publicView.organizations[0], "workItems"), false);
  assert.equal(Object.hasOwn(publicView.properties[0], "ownerOrgId"), false);
  assert.equal(publicView.omittedFields.includes("playerCharacters"), true);
});

test("Underworld rejects unbounded sessions, stale writes, and tampered snapshots", () => {
  let state = seededUnderworld();
  const before = state;
  assert.throws(
    () => settleUnderworldWeek(state, {
      expectedRevision: state.revision,
      physicalSessions: Array.from({ length: 17 }, (_, index) => ({
        sessionId: `session:${index}`,
        regionId: "region:sofia",
        participantCount: 1,
        outcome: "completed",
      })),
    }),
    /at most 16/,
  );
  assert.deepEqual(state, before);
  assert.throws(
    () => claimProperty(state, {
      expectedRevision: state.revision - 1,
      propertyId: "property:warehouse",
      orgId: "organization:rivals",
    }),
    UnderworldStaleRevisionError,
  );
  state = settleUnderworldWeek(state, { expectedRevision: state.revision });
  assert.deepEqual(restoreUnderworld(snapshotUnderworld(state)), state);
  assert.throws(
    () => restoreUnderworld({ snapshotVersion: 1, state: { ...state, lastEventHash: "tampered" } }),
    UnderworldValidationError,
  );
});

test("online shard sessions join and leave without changing persistent property ownership", () => {
  let state = createUnderworldState();
  state = registerOrganization(state, { expectedRevision: state.revision, orgId: "organization:lanterns", headquartersRegionId: "region:coast" });
  state = registerProperty(state, { expectedRevision: state.revision, propertyId: "property:club", regionId: "region:coast", ownerOrgId: "organization:lanterns" });
  state = joinPlayerSession(state, { expectedRevision: state.revision, sessionId: "session:one", characterId: "character:one", regionId: "region:coast" });
  state = leavePlayerSession(state, { expectedRevision: state.revision, sessionId: "session:one", reason: "offline" });
  assert.equal(state.properties["property:club"].ownerOrgId, "organization:lanterns");
  assert.equal(state.playerSessions["session:one"].status, "offline");
});

test("NPC baseline liquidity limits player market influence to a capped weekly contribution", () => {
  let state = createUnderworldState();
  state = registerNpcBaseline(state, { expectedRevision: state.revision, regionId: "region:coast", populationBand: "high", liquidity: 80 });
  state = registerMarket(state, { expectedRevision: state.revision, marketId: "market:coast", regionId: "region:coast", commodityClass: "vehicle-demand", pressure: 50, npcBaselineLiquidity: 80 });
  state = joinPlayerSession(state, { expectedRevision: state.revision, sessionId: "session:one", characterId: "character:one", regionId: "region:coast" });
  state = applyPlayerMarketInfluence(state, { expectedRevision: state.revision, sessionId: "session:one", marketId: "market:coast", pressureDelta: 50 });
  assert.equal(state.markets["market:coast"].pressure, 60);
  assert.throws(() => applyPlayerMarketInfluence(state, { expectedRevision: state.revision, sessionId: "session:one", marketId: "market:coast", pressureDelta: 1 }), /cap reached/);
  assert.equal(projectUnderworld(state).npcBaselines[0].liquidityBand, "high");
});

test("weekly settlement resets player influence budget while preserving offline NPC and session boundaries", () => {
  let state = createUnderworldState();
  state = registerNpcBaseline(state, { expectedRevision: state.revision, regionId: "region:sofia", populationBand: "moderate" });
  state = registerMarket(state, { expectedRevision: state.revision, marketId: "market:sofia", regionId: "region:sofia", commodityClass: "legitimate-goods" });
  state = joinPlayerSession(state, { expectedRevision: state.revision, sessionId: "session:one", characterId: "character:one", regionId: "region:sofia" });
  state = applyPlayerMarketInfluence(state, { expectedRevision: state.revision, sessionId: "session:one", marketId: "market:sofia", pressureDelta: 8 });
  state = settleUnderworldWeek(state, { expectedRevision: state.revision });
  assert.equal(state.serverWeek, 1);
  assert.deepEqual(state.marketInfluenceLedger, {});
  assert.equal(state.playerSessions["session:one"].status, "active");
});
