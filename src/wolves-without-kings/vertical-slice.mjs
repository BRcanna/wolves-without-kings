import {
  advanceCaseStage,
  advanceTime,
  authorizeCaseAction,
  changeDistrictCondition,
  claimWorkItem,
  completeWorkItem,
  createBusiness,
  createCase,
  createCharacter,
  createInitialWorld,
  createMarket,
  createNpc,
  createOrganization,
  createProvenanceObject,
  createRumor,
  createWorkGraph,
  hearRumor,
  moveObject,
  recordCaseEvidence,
  resolveSocialContact,
  transferObject,
  updateBusiness,
  updateRelationship,
  updateMarket,
} from "./engine.mjs";
import { createDistrictFixture } from "./district.mjs";

const ROUTINE_BLOCKS = [
  { id: "home", label: "Home", locationId: "loc:market-street", need: "sleep" },
  { id: "work", label: "Work", locationId: "loc:night-market", need: "money" },
  { id: "family", label: "Family", locationId: "loc:community-clinic", need: "family" },
  { id: "evening", label: "Evening", locationId: "loc:river-walk", need: "social" },
];

function buildNpc(world, index) {
  const number = String(index).padStart(2, "0");
  return createNpc(world, {
    expectedRevision: world.revision,
    npcId: `npc:resident-${number}`,
    displayName: `Resident ${number}`,
    home: index % 2 === 0 ? "loc:market-street" : "loc:motel-lobby",
    occupation: index % 3 === 0 ? "shopkeeper" : index % 3 === 1 ? "driver" : "night-worker",
    routineBlocks: ROUTINE_BLOCKS,
  });
}

function createSharedWorld() {
  let world = createInitialWorld({ worldId: "wwk-vertical-slice", startDate: "1998-01-01" });
  createDistrictFixture();
  world = changeDistrictCondition(world, {
    expectedRevision: world.revision,
    condition: "watchful",
    actorId: "npc:steward-01",
  });
  world = createCharacter(world, {
    expectedRevision: world.revision,
    characterId: "character:player",
    displayName: "The Player",
    birthYear: 1980,
    background: "neighborhood resident",
  });
  for (let index = 1; index <= 30; index += 1) world = buildNpc(world, index);
  world = createBusiness(world, {
    expectedRevision: world.revision,
    businessId: "business:night-market",
    displayName: "Night Market Hall",
    locationId: "loc:night-market",
    venueType: "nightlife-venue",
    ownerId: "npc:resident-03",
    reputation: 10,
  });
  world = createBusiness(world, {
    expectedRevision: world.revision,
    businessId: "business:south-ring-motel",
    displayName: "South Ring Motel",
    locationId: "loc:motel-lobby",
    venueType: "motel",
    ownerId: "npc:resident-06",
    reputation: 4,
  });
  world = createBusiness(world, {
    expectedRevision: world.revision,
    businessId: "business:river-cafe",
    displayName: "River Cafe",
    locationId: "loc:river-walk",
    venueType: "cafe",
    ownerId: "npc:resident-09",
    reputation: 7,
  });
  for (let index = 1; index <= 8; index += 1) {
    world = updateRelationship(world, {
      expectedRevision: world.revision,
      actorId: "character:player",
      subjectId: `npc:resident-${String(index).padStart(2, "0")}`,
      deltas: { trust: index, respect: 2, familiarity: 3 },
      sharedEventType: "district-introduction",
    });
  }
  world = createRumor(world, {
    expectedRevision: world.revision,
    rumorId: "rumor:market-lights",
    sourceId: "npc:resident-01",
    subjectId: "business:night-market",
    topic: "market-lights",
    retelling: "The lights failed before the argument.",
    truthStatus: "unknown",
    locationId: "loc:night-market",
  });
  world = hearRumor(world, {
    expectedRevision: world.revision,
    observerId: "npc:resident-02",
    rumorId: "rumor:market-lights",
    sourceId: "npc:resident-01",
    retelling: "The market closed early after an argument.",
    confidence: 55,
  });
  world = createOrganization(world, {
    expectedRevision: world.revision,
    organizationId: "org:lantern-circle",
    displayName: "Lantern Circle",
    members: [
      { memberId: "character:player", role: "leader", capabilities: ["coordination", "driving"] },
      { memberId: "npc:resident-04", role: "driver", capabilities: ["driving"] },
    ],
  });
  world = createWorkGraph(world, {
    expectedRevision: world.revision,
    organizationId: "org:lantern-circle",
    workItems: [
      { workItemId: "work:lantern-check", label: "Check the venue condition", requiredCapabilities: ["coordination"] },
      { workItemId: "work:lantern-route", label: "Carry a sealed package", dependencies: ["work:lantern-check"], requiredCapabilities: ["driving"] },
    ],
  });
  world = createOrganization(world, {
    expectedRevision: world.revision,
    organizationId: "org:river-crew",
    displayName: "River Crew",
    members: [
      { memberId: "npc:resident-07", role: "leader", capabilities: ["coordination"] },
      { memberId: "npc:resident-08", role: "runner", capabilities: ["driving"] },
    ],
  });
  world = createWorkGraph(world, {
    expectedRevision: world.revision,
    organizationId: "org:river-crew",
    workItems: [
      { workItemId: "work:river-observe", label: "Observe a changing venue", requiredCapabilities: ["coordination"] },
    ],
  });
  world = createMarket(world, {
    expectedRevision: world.revision,
    marketId: "market:sofia-south",
    regionId: "district:sofia-south",
    commodity: "nightlife-demand",
    basePrice: 100,
    supply: 60,
    demand: 40,
    inventory: 80,
    volatility: 15,
  });
  world = createProvenanceObject(world, {
    expectedRevision: world.revision,
    objectId: "vehicle:favorite-sedan",
    objectType: "vehicle",
    origin: "family-purchase",
    ownerId: "character:player",
    locationId: "loc:market-street",
    trophyTags: ["favorite-vehicle"],
  });
  world = createCase(world, {
    expectedRevision: world.revision,
    caseId: "case:market-incident",
    matterType: "property-damage",
    leadAgency: "agency:district-police",
    jurisdiction: "south-sofia",
    suspects: ["character:player"],
    authorityActions: ["advance-stage", "interview"],
  });
  return world;
}

export function runVerticalHistory(variant = "relationship") {
  let world = createSharedWorld();
  if (variant === "relationship") {
    world = resolveSocialContact(world, {
      expectedRevision: world.revision,
      actorId: "character:player",
      subjectId: "npc:resident-01",
      locationId: "loc:night-market",
      outcome: "welcomed",
    });
    world = updateBusiness(world, {
      expectedRevision: world.revision,
      businessId: "business:night-market",
      actorId: "character:player",
      reputationDelta: 8,
    });
    world = updateMarket(world, {
      expectedRevision: world.revision,
      marketId: "market:sofia-south",
      demandDelta: 30,
      shockType: "tourism-surge",
    });
  } else if (variant === "organization") {
    world = claimWorkItem(world, {
      expectedRevision: world.revision,
      organizationId: "org:lantern-circle",
      workItemId: "work:lantern-check",
      memberId: "character:player",
      leaseDays: 4,
    });
    world = completeWorkItem(world, {
      expectedRevision: world.revision,
      organizationId: "org:lantern-circle",
      workItemId: "work:lantern-check",
      memberId: "character:player",
    });
    world = moveObject(world, {
      expectedRevision: world.revision,
      objectId: "vehicle:favorite-sedan",
      actorId: "character:player",
      locationId: "loc:motel-service-yard",
      reason: "maintenance-stop",
    });
    world = transferObject(world, {
      expectedRevision: world.revision,
      objectId: "vehicle:favorite-sedan",
      fromId: "character:player",
      toId: "npc:resident-04",
      locationId: "loc:motel-service-yard",
      reason: "delegated-transport",
    });
  } else if (variant === "quiet") {
    world = updateBusiness(world, {
      expectedRevision: world.revision,
      businessId: "business:river-cafe",
      actorId: "npc:resident-09",
      reputationDelta: -6,
      condition: "strained",
    });
    world = updateMarket(world, {
      expectedRevision: world.revision,
      marketId: "market:sofia-south",
      supplyDelta: 25,
      transportCostDelta: 8,
      shockType: "road-disruption",
    });
  } else {
    throw new Error(`unknown vertical history variant: ${variant}`);
  }
  world = authorizeCaseAction(world, {
    expectedRevision: world.revision,
    caseId: "case:market-incident",
    agencyId: "agency:district-police",
    action: "advance-stage",
  });
  world = advanceCaseStage(world, {
    expectedRevision: world.revision,
    caseId: "case:market-incident",
    agencyId: "agency:district-police",
    nextStage: "open",
  });
  world = advanceTime(world, { expectedRevision: world.revision, days: 365 });
  return {
    world,
    summary: {
      variant,
      date: world.date,
      npcCount: Object.keys(world.npcLife).length,
      businessCount: Object.keys(world.businesses).length,
      organizationCount: Object.keys(world.organizations).length,
      caseCount: Object.keys(world.cases).length,
      marketCount: Object.keys(world.markets).length,
      playerRelationships: Object.keys(world.relationships).filter((id) => id.startsWith("character:player|")).length,
      vehicleOwner: world.objects["vehicle:favorite-sedan"].currentOwnerId,
      caseStage: world.cases["case:market-incident"].legalStage,
      eventCount: world.events.length,
    },
  };
}
