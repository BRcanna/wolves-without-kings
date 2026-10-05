import { createHash } from "node:crypto";

export const ENGINE_SCHEMA_VERSION = 1;
export const CHARACTER_SKILLS = ["driving", "fighting", "lock_work", "intimidation", "negotiation"];
export const NPC_NEEDS = ["sleep", "food", "family", "social", "medical", "money", "safety"];
export const RELATIONSHIP_AXES = [
  "trust",
  "respect",
  "fear",
  "loyalty",
  "debt",
  "obligation",
  "familiarity",
  "suspicion",
  "affection",
  "resentment",
  "dependence",
];

export class StaleRevisionError extends Error {
  constructor(expectedRevision, actualRevision) {
    super(`stale command: expected revision ${expectedRevision}, actual revision ${actualRevision}`);
    this.name = "StaleRevisionError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

export class InvalidCommandError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidCommandError";
  }
}

function clone(value) {
  return structuredClone(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function eventHash(event, previousHash) {
  const material = `${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`;
  return createHash("sha256").update(material).digest("hex");
}

function assertDate(value, field = "date") {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InvalidCommandError(`${field} must be an ISO calendar date (YYYY-MM-DD)`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new InvalidCommandError(`${field} is not a valid calendar date`);
  }
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function assertNonEmptyString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new InvalidCommandError(`${field} must be a non-empty string`);
  }
}

function assertInteger(value, field, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) {
    throw new InvalidCommandError(`${field} must be an integer >= ${minimum}`);
  }
}

function assertRange(value, field, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new InvalidCommandError(`${field} must be an integer between ${minimum} and ${maximum}`);
  }
}

function normalizeIds(value, field) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((id) => typeof id !== "string" || id.trim() === "")) {
    throw new InvalidCommandError(`${field} must be an array of non-empty strings`);
  }
  return [...value];
}

function normalizeStringArray(value, field) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new InvalidCommandError(`${field} must be an array of non-empty strings`);
  }
  return [...new Set(value)];
}

function normalizeRoutineBlocks(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new InvalidCommandError("routineBlocks must contain at least one block");
  }
  return value.map((block, index) => {
    if (!block || typeof block !== "object" || Array.isArray(block)) {
      throw new InvalidCommandError(`routineBlocks[${index}] must be an object`);
    }
    assertNonEmptyString(block.id, `routineBlocks[${index}].id`);
    assertNonEmptyString(block.label, `routineBlocks[${index}].label`);
    assertNonEmptyString(block.locationId, `routineBlocks[${index}].locationId`);
    if (block.need !== undefined && !NPC_NEEDS.includes(block.need)) {
      throw new InvalidCommandError(`unsupported routine need: ${block.need}`);
    }
    return {
      id: block.id,
      label: block.label,
      locationId: block.locationId,
      need: block.need ?? null,
      threatSafe: block.threatSafe !== false,
    };
  });
}

function defaultNpcNeeds() {
  return Object.fromEntries(NPC_NEEDS.map((need) => [need, 0]));
}

function defaultRelationship() {
  return {
    trust: 0,
    respect: 0,
    fear: 0,
    loyalty: 0,
    debt: 0,
    obligation: 0,
    familiarity: 0,
    suspicion: 0,
    affection: 0,
    resentment: 0,
    dependence: 0,
    relationshipAgeDays: 0,
    sharedEvents: [],
  };
}

function clampAxis(value, axis) {
  const maximum = ["debt", "obligation", "familiarity", "dependence"].includes(axis) ? 100 : 100;
  return Math.max(0, Math.min(maximum, value));
}

function settleNpcForDays(npc, days) {
  const next = clone(npc);
  const safeBlocks = next.routineBlocks.filter((block) => next.threatLevel === 0 || block.threatSafe);
  const blocks = safeBlocks.length > 0 ? safeBlocks : next.routineBlocks;
  for (let day = 0; day < days; day += 1) {
    next.lifeDays += 1;
    next.routineIndex = next.lifeDays % blocks.length;
    const block = blocks[next.routineIndex];
    next.currentRoutineId = block.id;
    next.currentLocationId = block.locationId;
    next.scheduleMode = next.threatLevel > 0 ? "threat-adjusted" : "normal";
    for (const need of NPC_NEEDS) next.needs[need] = Math.min(100, next.needs[need] + 1);
    if (block.need) next.needs[block.need] = Math.max(0, next.needs[block.need] - 5);
    if (next.activeLongAction) {
      next.activeLongAction.elapsedDays += 1;
      if (next.activeLongAction.elapsedDays >= next.activeLongAction.durationDays) {
        next.completedActions.push({
          id: next.activeLongAction.id,
          completedOnLifeDay: next.lifeDays,
        });
        next.activeLongAction = null;
      }
    }
  }
  return next;
}

function enrichRelationship(previous) {
  return { ...defaultRelationship(), ...clone(previous), sharedEvents: [...(previous.sharedEvents ?? [])] };
}

function refreshWorkAvailability(organization) {
  for (const item of Object.values(organization.workItems)) {
    if (item.status === "completed" || item.status === "active") continue;
    const dependenciesReady = item.dependencies.every(
      (dependencyId) => organization.workItems[dependencyId]?.status === "completed",
    );
    if (dependenciesReady && item.status === "blocked") item.status = "available";
  }
}

function priceBand({ basePrice, supply, demand, transportCost, legalPressure, factionControl, volatility }) {
  const pressure = demand - supply;
  const midpoint = Math.max(
    1,
    Math.round(basePrice * (1 + pressure / 100 + transportCost / 100 + legalPressure / 200 + factionControl / 200)),
  );
  const spread = Math.max(1, Math.round(midpoint * (10 + volatility) / 100));
  return {
    low: Math.max(1, midpoint - spread),
    high: midpoint + spread,
    midpoint,
    confidence: Math.max(0, 100 - volatility - Math.min(50, Math.abs(pressure))),
  };
}

export function createInitialWorld({ worldId = "wwk-demo", startDate = "1998-01-01" } = {}) {
  assertNonEmptyString(worldId, "worldId");
  assertDate(startDate, "startDate");
  return {
    schemaVersion: ENGINE_SCHEMA_VERSION,
    worldId,
    startDate,
    date: startDate,
    tick: 0,
    revision: 0,
    nextEventId: 1,
    lastEventHash: null,
    district: {
      id: "sofia-south",
      label: "South Sofia (fictionalized)",
      condition: "stable",
    },
    relationships: {},
    characters: {},
    npcLife: {},
    rumors: {},
    beliefs: {},
    organizations: {},
    objects: {},
    markets: {},
    cases: {},
    businesses: {},
    protectionArrangements: {},
    surveillance: {},
    actions: [],
    vehicles: {},
    events: [],
  };
}

function nextEventId(world) {
  return `evt-${String(world.nextEventId).padStart(6, "0")}`;
}

function makeEvent(world, { eventType, actors, subjects, location, cause, payload, visibility }) {
  const event = {
    eventId: nextEventId(world),
    eventType,
    tick: world.tick,
    worldRevision: world.revision + 1,
    actors,
    subjects,
    location: location ?? null,
    cause: cause ?? null,
    payload: payload ?? {},
    visibility: visibility ?? "local",
    provenance: {
      engineSchemaVersion: ENGINE_SCHEMA_VERSION,
      source: "wolves-without-kings",
    },
  };
  const withParent = {
    ...event,
    previousHash: world.lastEventHash,
  };
  return {
    ...withParent,
    hash: eventHash(withParent, world.lastEventHash),
  };
}

function reduceEvent(world, event, { verifyChain = true } = {}) {
  const expectedId = nextEventId(world);
  if (event.eventId !== expectedId) {
    throw new InvalidCommandError(`event id ${event.eventId} does not follow ${expectedId}`);
  }
  if (event.worldRevision !== world.revision + 1) {
    throw new InvalidCommandError(`event ${event.eventId} has a non-contiguous world revision`);
  }
  if (verifyChain) {
    if (event.previousHash !== world.lastEventHash) {
      throw new InvalidCommandError(`event ${event.eventId} has a broken parent hash`);
    }
    const { hash, ...unsignedEvent } = event;
    if (hash !== eventHash(unsignedEvent, event.previousHash)) {
      throw new InvalidCommandError(`event ${event.eventId} has an invalid hash`);
    }
  }

  const next = clone(world);
  if (event.eventType === "world.time_advanced") {
    next.date = event.payload.toDate;
    next.tick = event.payload.toTick;
    for (const settlement of event.payload.npcSettlements ?? []) {
      const npc = next.npcLife[settlement.npcId];
      if (npc) {
        next.npcLife[settlement.npcId] = {
          ...settlement.nextNpc,
          lastEventId: event.eventId,
        };
      }
    }
    for (const beliefSettlement of event.payload.beliefSettlements ?? []) {
      const observerBeliefs = next.beliefs[beliefSettlement.observerId];
      if (observerBeliefs?.[beliefSettlement.rumorId]) {
        observerBeliefs[beliefSettlement.rumorId] = {
          ...observerBeliefs[beliefSettlement.rumorId],
          stalenessDays: beliefSettlement.stalenessDays,
          lastUpdatedEventId: event.eventId,
        };
      }
    }
    for (const relationshipSettlement of event.payload.relationshipSettlements ?? []) {
      const relationship = next.relationships[relationshipSettlement.relationshipId];
      if (relationship?.sharedEvents) {
        relationship.relationshipAgeDays = relationshipSettlement.relationshipAgeDays;
        relationship.lastEventId = event.eventId;
      }
    }
    for (const workSettlement of event.payload.workSettlements ?? []) {
      const organization = next.organizations[workSettlement.organizationId];
      const item = organization?.workItems[workSettlement.workItemId];
      if (item) {
        organization.workItems[workSettlement.workItemId] = {
          ...item,
          ...workSettlement.nextItem,
          lastEventId: event.eventId,
        };
        refreshWorkAvailability(organization);
      }
    }
    for (const marketSettlement of event.payload.marketSettlements ?? []) {
      const market = next.markets[marketSettlement.marketId];
      if (market) {
        next.markets[marketSettlement.marketId] = {
          ...market,
          ...marketSettlement.nextMarket,
          lastEventId: event.eventId,
        };
      }
    }
    for (const caseSettlement of event.payload.caseSettlements ?? []) {
      const caseFile = next.cases[caseSettlement.caseId];
      if (caseFile) {
        next.cases[caseSettlement.caseId] = {
          ...caseFile,
          ...caseSettlement.nextCase,
          lastEventId: event.eventId,
        };
      }
    }
    for (const businessSettlement of event.payload.businessSettlements ?? []) {
      const business = next.businesses[businessSettlement.businessId];
      if (business) {
        next.businesses[businessSettlement.businessId] = {
          ...business,
          ...businessSettlement.nextBusiness,
          lastEventId: event.eventId,
        };
      }
    }
    for (const protectionSettlement of event.payload.protectionSettlements ?? []) {
      const arrangement = next.protectionArrangements[protectionSettlement.arrangementId];
      if (arrangement) {
        next.protectionArrangements[protectionSettlement.arrangementId] = {
          ...arrangement,
          ...protectionSettlement.nextArrangement,
          lastEventId: event.eventId,
        };
      }
    }
    for (const surveillanceSettlement of event.payload.surveillanceSettlements ?? []) {
      const record = next.surveillance[surveillanceSettlement.surveillanceId];
      if (record) {
        next.surveillance[surveillanceSettlement.surveillanceId] = {
          ...record,
          ...surveillanceSettlement.nextRecord,
          lastEventId: event.eventId,
        };
      }
    }
  } else if (event.eventType === "district.condition_changed") {
    next.district = {
      ...next.district,
      condition: event.payload.condition,
    };
  } else if (event.eventType === "social.contact_resolved") {
    const relationshipId = event.payload.relationshipId;
    next.relationships[relationshipId] = {
      trust: event.payload.nextTrust,
      respect: event.payload.nextRespect,
      lastEventId: event.eventId,
    };
  } else if (event.eventType === "character.created") {
    next.characters[event.payload.character.id] = clone(event.payload.character);
  } else if (event.eventType === "character.skill_practiced") {
    const character = next.characters[event.payload.characterId];
    character.skills[event.payload.skill] = {
      practice: event.payload.nextPractice,
      tier: event.payload.nextTier,
      lastPracticeEventId: event.eventId,
    };
  } else if (event.eventType === "character.familiarity_changed") {
    const character = next.characters[event.payload.characterId];
    character.familiarity[event.payload.contextId] = {
      exposure: event.payload.nextExposure,
      level: event.payload.nextLevel,
      lastEventId: event.eventId,
    };
  } else if (event.eventType === "character.condition_changed") {
    const character = next.characters[event.payload.characterId];
    character.condition = {
      fatigue: event.payload.nextFatigue,
      injury: event.payload.nextInjury,
      healthState: event.payload.nextHealthState,
      lastEventId: event.eventId,
    };
  } else if (event.eventType === "npc.life_started") {
    next.npcLife[event.payload.npc.id] = {
      ...clone(event.payload.npc),
      lastEventId: event.eventId,
    };
  } else if (event.eventType === "npc.life_updated") {
    next.npcLife[event.payload.npcId] = {
      ...clone(event.payload.nextNpc),
      lastEventId: event.eventId,
    };
  } else if (event.eventType === "npc.life_interrupted") {
    next.npcLife[event.payload.npcId] = {
      ...clone(event.payload.nextNpc),
      lastEventId: event.eventId,
    };
  } else if (event.eventType === "relationship.updated") {
    next.relationships[event.payload.relationshipId] = {
      ...clone(event.payload.nextRelationship),
      lastEventId: event.eventId,
    };
  } else if (event.eventType === "rumor.created") {
    next.rumors[event.payload.rumor.id] = {
      ...clone(event.payload.rumor),
      lastEventId: event.eventId,
    };
  } else if (event.eventType === "belief.heard") {
    if (!next.beliefs[event.payload.observerId]) next.beliefs[event.payload.observerId] = {};
    next.beliefs[event.payload.observerId][event.payload.rumorId] = {
      ...clone(event.payload.nextBelief),
      lastUpdatedEventId: event.eventId,
    };
  } else if (event.eventType === "organization.created") {
    next.organizations[event.payload.organization.id] = {
      ...clone(event.payload.organization),
      lastEventId: event.eventId,
    };
  } else if (event.eventType === "organization.work_graph_created") {
    const organization = next.organizations[event.payload.organizationId];
    organization.workItems = clone(event.payload.workItems);
    refreshWorkAvailability(organization);
    organization.lastEventId = event.eventId;
  } else if (event.eventType === "organization.member_availability_changed") {
    const organization = next.organizations[event.payload.organizationId];
    organization.members[event.payload.memberId].availability = event.payload.availability;
    organization.lastEventId = event.eventId;
  } else if (event.eventType === "organization.work_claimed") {
    const organization = next.organizations[event.payload.organizationId];
    organization.workItems[event.payload.workItemId] = {
      ...organization.workItems[event.payload.workItemId],
      status: "active",
      claimOwner: event.payload.memberId,
      leaseUntil: event.payload.leaseUntil,
      attempts: event.payload.attempts,
      recoveryState: "none",
      lastEventId: event.eventId,
    };
    organization.lastEventId = event.eventId;
  } else if (event.eventType === "organization.work_completed") {
    const organization = next.organizations[event.payload.organizationId];
    organization.workItems[event.payload.workItemId] = {
      ...organization.workItems[event.payload.workItemId],
      status: "completed",
      claimOwner: null,
      leaseUntil: null,
      reviewState: event.payload.reviewState,
      recoveryState: "none",
      completedOn: event.payload.completedOn,
      lastEventId: event.eventId,
    };
    refreshWorkAvailability(organization);
    organization.lastEventId = event.eventId;
  } else if (event.eventType === "organization.work_recovered") {
    const organization = next.organizations[event.payload.organizationId];
    organization.workItems[event.payload.workItemId] = {
      ...organization.workItems[event.payload.workItemId],
      ...clone(event.payload.nextItem),
      lastEventId: event.eventId,
    };
    refreshWorkAvailability(organization);
    organization.lastEventId = event.eventId;
  } else if (event.eventType === "object.created") {
    next.objects[event.payload.object.id] = {
      ...clone(event.payload.object),
      lastEventId: event.eventId,
    };
  } else if (event.eventType === "object.transferred") {
    const object = next.objects[event.payload.objectId];
    next.objects[event.payload.objectId] = {
      ...object,
      currentOwnerId: event.payload.toId,
      ownerChain: [...object.ownerChain, clone(event.payload.ownerRecord)],
      custodyChain: [...object.custodyChain, clone(event.payload.custodyRecord)],
      status: "held",
      lastEventId: event.eventId,
    };
  } else if (event.eventType === "object.moved") {
    const object = next.objects[event.payload.objectId];
    next.objects[event.payload.objectId] = {
      ...object,
      currentLocationId: event.payload.locationId,
      currentContainerId: event.payload.containerId,
      locationHistory: [...object.locationHistory, clone(event.payload.locationRecord)],
      custodyChain: [...object.custodyChain, clone(event.payload.custodyRecord)],
      lastEventId: event.eventId,
    };
  } else if (event.eventType === "object.seized") {
    const object = next.objects[event.payload.objectId];
    next.objects[event.payload.objectId] = {
      ...object,
      status: "seized",
      currentLocationId: event.payload.locationId,
      currentContainerId: null,
      evidenceFlags: [...new Set([...object.evidenceFlags, event.payload.evidenceFlag])],
      eventLinks: [...object.eventLinks, event.eventId],
      custodyChain: [...object.custodyChain, clone(event.payload.custodyRecord)],
      lastEventId: event.eventId,
    };
  } else if (event.eventType === "object.returned") {
    const object = next.objects[event.payload.objectId];
    next.objects[event.payload.objectId] = {
      ...object,
      status: "held",
      currentLocationId: event.payload.locationId,
      currentContainerId: event.payload.containerId,
      custodyChain: [...object.custodyChain, clone(event.payload.custodyRecord)],
      lastEventId: event.eventId,
    };
  } else if (event.eventType === "object.damaged") {
    const object = next.objects[event.payload.objectId];
    next.objects[event.payload.objectId] = {
      ...object,
      damageHistory: [...object.damageHistory, clone(event.payload.damageRecord)],
      condition: event.payload.nextCondition,
      lastEventId: event.eventId,
    };
  } else if (event.eventType === "object.repaired") {
    const object = next.objects[event.payload.objectId];
    next.objects[event.payload.objectId] = {
      ...object,
      repairHistory: [...object.repairHistory, clone(event.payload.repairRecord)],
      condition: event.payload.nextCondition,
      lastEventId: event.eventId,
    };
  } else if (event.eventType === "market.created") {
    next.markets[event.payload.market.id] = {
      ...clone(event.payload.market),
      lastEventId: event.eventId,
    };
  } else if (event.eventType === "market.updated") {
    next.markets[event.payload.marketId] = {
      ...clone(event.payload.nextMarket),
      lastEventId: event.eventId,
    };
  } else if (event.eventType === "case.created") {
    next.cases[event.payload.caseFile.id] = {
      ...clone(event.payload.caseFile),
      lastEventId: event.eventId,
    };
  } else if (event.eventType === "case.agency_attached") {
    const caseFile = next.cases[event.payload.caseId];
    caseFile.agencyViews[event.payload.agencyId] = clone(event.payload.agencyView);
    caseFile.lastEventId = event.eventId;
  } else if (event.eventType === "case.evidence_added") {
    const caseFile = next.cases[event.payload.caseId];
    caseFile.evidenceLinks.push(clone(event.payload.evidence));
    caseFile.confidence = event.payload.nextConfidence;
    caseFile.agencyViews[event.payload.agencyId].knownEvidence.push(event.payload.evidence.evidenceId);
    caseFile.lastEventId = event.eventId;
  } else if (event.eventType === "case.witness_recorded") {
    const caseFile = next.cases[event.payload.caseId];
    caseFile.witnesses.push(clone(event.payload.witness));
    caseFile.confidence = event.payload.nextConfidence;
    caseFile.agencyViews[event.payload.agencyId].knownWitnesses.push(event.payload.witness.witnessId);
    caseFile.lastEventId = event.eventId;
  } else if (event.eventType === "case.action_authorized") {
    const caseFile = next.cases[event.payload.caseId];
    caseFile.agencyViews[event.payload.agencyId].authorizedActions = [
      ...new Set([...caseFile.agencyViews[event.payload.agencyId].authorizedActions, event.payload.action]),
    ];
    caseFile.lastEventId = event.eventId;
  } else if (event.eventType === "case.stage_changed") {
    const caseFile = next.cases[event.payload.caseId];
    caseFile.legalStage = event.payload.nextStage;
    caseFile.lastEventId = event.eventId;
  } else if (event.eventType === "business.created") {
    next.businesses[event.payload.business.id] = {
      ...clone(event.payload.business),
      lastEventId: event.eventId,
    };
  } else if (event.eventType === "business.updated") {
    next.businesses[event.payload.businessId] = {
      ...clone(event.payload.nextBusiness),
      lastEventId: event.eventId,
    };
  } else if (event.eventType === "protection.created") {
    next.protectionArrangements[event.payload.arrangement.id] = {
      ...clone(event.payload.arrangement),
      lastEventId: event.eventId,
    };
  } else if (event.eventType === "protection.cycle_resolved") {
    next.protectionArrangements[event.payload.arrangementId] = {
      ...clone(event.payload.nextArrangement),
      lastEventId: event.eventId,
    };
    if (event.payload.nextBusiness) {
      next.businesses[event.payload.businessId] = {
        ...clone(event.payload.nextBusiness),
        lastEventId: event.eventId,
      };
    }
  } else if (event.eventType === "protection.claim_disputed") {
    next.protectionArrangements[event.payload.arrangementId] = {
      ...clone(event.payload.nextArrangement),
      lastEventId: event.eventId,
    };
  } else if (event.eventType === "surveillance.started") {
    next.surveillance[event.payload.record.id] = {
      ...clone(event.payload.record),
      lastEventId: event.eventId,
    };
  } else if (event.eventType === "surveillance.updated" || event.eventType === "surveillance.interrupted") {
    next.surveillance[event.payload.surveillanceId] = {
      ...clone(event.payload.nextRecord),
      lastEventId: event.eventId,
    };
  } else if (event.eventType === "action.traversal_resolved") {
    next.actions.push(clone(event.payload.action));
  } else if (event.eventType === "action.melee_resolved") {
    next.actions.push(clone(event.payload.action));
    const character = next.characters[event.payload.actorId];
    if (character && event.payload.nextCondition) {
      character.condition = {
        ...event.payload.nextCondition,
        lastEventId: event.eventId,
      };
    }
  } else if (event.eventType === "vehicle.created") {
    next.vehicles[event.payload.vehicle.id] = {
      ...clone(event.payload.vehicle),
      lastEventId: event.eventId,
    };
  } else if (event.eventType === "vehicle.action_resolved") {
    next.vehicles[event.payload.vehicleId] = {
      ...clone(event.payload.nextVehicle),
      lastEventId: event.eventId,
    };
    next.actions.push(clone(event.payload.action));
  } else if (event.eventType === "vehicle.provenance_advanced") {
    next.vehicles[event.payload.vehicleId] = {
      ...clone(event.payload.nextVehicle),
      lastEventId: event.eventId,
    };
  }

  next.events.push(clone(event));
  next.revision = event.worldRevision;
  next.nextEventId += 1;
  next.lastEventHash = event.hash;
  return next;
}

function commit(world, command) {
  const next = clone(world);
  const event = makeEvent(next, command);
  return reduceEvent(next, event);
}

function assertExpectedRevision(world, command) {
  assertInteger(command.expectedRevision, "expectedRevision");
  if (command.expectedRevision !== world.revision) {
    throw new StaleRevisionError(command.expectedRevision, world.revision);
  }
}

function buildTimeSettlements(world, days, toDate) {
  const npcSettlements = Object.values(world.npcLife).map((npc) => ({
    npcId: npc.id,
    nextNpc: settleNpcForDays(npc, days),
  }));
  const beliefSettlements = [];
  for (const [observerId, observerBeliefs] of Object.entries(world.beliefs)) {
    for (const [rumorId, belief] of Object.entries(observerBeliefs)) {
      beliefSettlements.push({
        observerId,
        rumorId,
        stalenessDays: belief.stalenessDays + days,
      });
    }
  }
  const relationshipSettlements = Object.entries(world.relationships)
    .filter(([, relationship]) => relationship.sharedEvents)
    .map(([relationshipId, relationship]) => ({
      relationshipId,
      relationshipAgeDays: relationship.relationshipAgeDays + days,
    }));
  const workSettlements = [];
  for (const [organizationId, organization] of Object.entries(world.organizations)) {
    for (const [workItemId, item] of Object.entries(organization.workItems)) {
      if (item.status === "active" && item.leaseUntil && item.leaseUntil < toDate) {
        workSettlements.push({
          organizationId,
          workItemId,
          nextItem: {
            status: "recovery",
            claimOwner: null,
            leaseUntil: null,
            recoveryState: "required",
            lastTransitionReason: "lease-expired",
          },
        });
      }
    }
  }
  const marketSettlements = Object.values(world.markets).map((market) => ({
    marketId: market.id,
    nextMarket: {
      lastSettledDate: toDate,
      informationLagDays: Math.max(0, market.informationLagDays - days),
    },
  }));
  const caseSettlements = Object.values(world.cases).map((caseFile) => {
    const ageDays = caseFile.caseAgeDays + days;
    const nextStage = caseFile.legalStage === "open"
      && ageDays >= 30
      && caseFile.confidence < 40
      ? "cold"
      : caseFile.legalStage;
    return {
      caseId: caseFile.id,
      nextCase: {
        caseAgeDays: ageDays,
        legalStage: nextStage,
      },
    };
  });
  const businessSettlements = Object.values(world.businesses).map((business) => ({
    businessId: business.id,
    nextBusiness: {
      ageDays: business.ageDays + days,
      operatingMonths: Math.floor((business.ageDays + days) / 30),
      lastSettledDate: toDate,
    },
  }));
  const protectionSettlements = Object.values(world.protectionArrangements).map((arrangement) => ({
    arrangementId: arrangement.id,
    nextArrangement: {
      daysActive: arrangement.daysActive + days,
      daysSinceReview: arrangement.daysSinceReview + days,
    },
  }));
  const surveillanceSettlements = Object.values(world.surveillance).map((record) => {
    const target = world.npcLife[record.targetId];
    const scheduleChanged = Boolean(target && record.knownRoutineId && target.currentRoutineId !== record.knownRoutineId);
    return {
      surveillanceId: record.id,
      nextRecord: {
        stalenessDays: record.stalenessDays + days,
        routineConfidence: scheduleChanged
          ? Math.max(0, record.routineConfidence - Math.min(50, days))
          : record.routineConfidence,
        scheduleStatus: scheduleChanged ? "stale" : record.scheduleStatus,
      },
    };
  });
  return {
    npcSettlements,
    beliefSettlements,
    relationshipSettlements,
    workSettlements,
    marketSettlements,
    caseSettlements,
    businessSettlements,
    protectionSettlements,
    surveillanceSettlements,
  };
}

export function advanceTime(world, { expectedRevision, days, actorId = "system:time" }) {
  assertExpectedRevision(world, { expectedRevision });
  assertInteger(days, "days", 1);
  assertNonEmptyString(actorId, "actorId");
  const toDate = addDays(world.date, days);
  const settlements = buildTimeSettlements(world, days, toDate);
  return commit(world, {
    eventType: "world.time_advanced",
    actors: [actorId],
    subjects: [world.worldId],
    location: null,
    payload: {
      fromDate: world.date,
      toDate,
      fromTick: world.tick,
      toTick: world.tick + days,
      days,
      ...settlements,
    },
    visibility: "local",
  });
}

export function changeDistrictCondition(
  world,
  { expectedRevision, condition, actorId = "system:district", districtId = world.district.id },
) {
  assertExpectedRevision(world, { expectedRevision });
  assertNonEmptyString(condition, "condition");
  assertNonEmptyString(actorId, "actorId");
  assertNonEmptyString(districtId, "districtId");
  if (districtId !== world.district.id) {
    throw new InvalidCommandError(`unknown district: ${districtId}`);
  }
  return commit(world, {
    eventType: "district.condition_changed",
    actors: [actorId],
    subjects: [districtId],
    location: districtId,
    payload: { districtId, condition },
    visibility: "local",
  });
}

export function resolveSocialContact(
  world,
  {
    expectedRevision,
    actorId,
    subjectId,
    locationId,
    outcome = "uncertain",
  },
) {
  assertExpectedRevision(world, { expectedRevision });
  assertNonEmptyString(actorId, "actorId");
  assertNonEmptyString(subjectId, "subjectId");
  assertNonEmptyString(locationId, "locationId");
  if (!["welcomed", "declined", "uncertain"].includes(outcome)) {
    throw new InvalidCommandError(`unsupported social contact outcome: ${outcome}`);
  }
  const relationshipId = `${actorId}|${subjectId}`;
  const previous = world.relationships[relationshipId] ?? { trust: 0, respect: 0 };
  const delta = { welcomed: 1, declined: -1, uncertain: 0 }[outcome];
  const nextTrust = Math.max(-5, Math.min(5, previous.trust + delta));
  const nextRespect = Math.max(-5, Math.min(5, previous.respect + (outcome === "welcomed" ? 1 : 0)));
  return commit(world, {
    eventType: "social.contact_resolved",
    actors: [actorId],
    subjects: [subjectId],
    location: locationId,
    payload: {
      relationshipId,
      outcome,
      previousTrust: previous.trust,
      nextTrust,
      previousRespect: previous.respect,
      nextRespect,
      informationScope: "local-observation",
    },
    visibility: "local",
  });
}

function requireCharacter(world, characterId) {
  assertNonEmptyString(characterId, "characterId");
  const character = world.characters[characterId];
  if (!character) throw new InvalidCommandError(`unknown character: ${characterId}`);
  return character;
}

function skillTier(practice) {
  if (practice >= 60) return "seasoned";
  if (practice >= 25) return "capable";
  if (practice >= 10) return "practiced";
  if (practice >= 3) return "initiated";
  return "latent";
}

function familiarityLevel(exposure) {
  if (exposure >= 20) return "deep";
  if (exposure >= 10) return "familiar";
  if (exposure >= 3) return "known";
  return "new";
}

export function createCharacter(
  world,
  {
    expectedRevision,
    characterId,
    displayName,
    birthYear = 1980,
    background = "resident",
  },
) {
  assertExpectedRevision(world, { expectedRevision });
  assertNonEmptyString(characterId, "characterId");
  assertNonEmptyString(displayName, "displayName");
  assertRange(birthYear, "birthYear", 1900, 2100);
  assertNonEmptyString(background, "background");
  if (world.characters[characterId]) throw new InvalidCommandError(`character already exists: ${characterId}`);
  const skills = Object.fromEntries(CHARACTER_SKILLS.map((skill) => [skill, { practice: 0, tier: "latent" }]));
  const character = {
    id: characterId,
    displayName,
    birthYear,
    background,
    condition: { fatigue: 0, injury: 0, healthState: "stable" },
    skills,
    familiarity: {},
  };
  return commit(world, {
    eventType: "character.created",
    actors: [characterId],
    subjects: [characterId],
    payload: { character },
    visibility: "local",
  });
}

export function practiceCharacterSkill(
  world,
  { expectedRevision, characterId, skill, units = 1, contextId = null },
) {
  assertExpectedRevision(world, { expectedRevision });
  const character = requireCharacter(world, characterId);
  assertNonEmptyString(skill, "skill");
  if (!CHARACTER_SKILLS.includes(skill)) throw new InvalidCommandError(`unsupported skill: ${skill}`);
  assertRange(units, "units", 1, 100);
  if (contextId !== null) assertNonEmptyString(contextId, "contextId");
  const previousPractice = character.skills[skill].practice;
  const nextPractice = previousPractice + units;
  return commit(world, {
    eventType: "character.skill_practiced",
    actors: [characterId],
    subjects: [characterId],
    location: contextId,
    payload: {
      characterId,
      skill,
      contextId,
      previousPractice,
      nextPractice,
      previousTier: character.skills[skill].tier,
      nextTier: skillTier(nextPractice),
      evidence: "recorded-practice",
    },
    visibility: "local",
  });
}

export function changeCharacterFamiliarity(
  world,
  { expectedRevision, characterId, contextId, exposure = 1 },
) {
  assertExpectedRevision(world, { expectedRevision });
  const character = requireCharacter(world, characterId);
  assertNonEmptyString(contextId, "contextId");
  assertRange(exposure, "exposure", 1, 100);
  const previous = character.familiarity[contextId]?.exposure ?? 0;
  const nextExposure = Math.min(100, previous + exposure);
  return commit(world, {
    eventType: "character.familiarity_changed",
    actors: [characterId],
    subjects: [characterId],
    location: contextId,
    payload: {
      characterId,
      contextId,
      previousExposure: previous,
      nextExposure,
      previousLevel: familiarityLevel(previous),
      nextLevel: familiarityLevel(nextExposure),
    },
    visibility: "local",
  });
}

export function changeCharacterCondition(
  world,
  {
    expectedRevision,
    characterId,
    fatigueDelta = 0,
    injuryDelta = 0,
    healthState = null,
  },
) {
  assertExpectedRevision(world, { expectedRevision });
  const character = requireCharacter(world, characterId);
  if (!Number.isInteger(fatigueDelta) || !Number.isInteger(injuryDelta)) throw new InvalidCommandError("condition deltas must be integers");
  if (healthState !== null && !["stable", "strained", "injured", "recovering"].includes(healthState)) {
    throw new InvalidCommandError(`unsupported health state: ${healthState}`);
  }
  const nextFatigue = Math.max(0, Math.min(100, character.condition.fatigue + fatigueDelta));
  const nextInjury = Math.max(0, Math.min(100, character.condition.injury + injuryDelta));
  const nextHealthState = healthState ?? (nextInjury > 0 ? "injured" : character.condition.healthState);
  return commit(world, {
    eventType: "character.condition_changed",
    actors: [characterId],
    subjects: [characterId],
    payload: {
      characterId,
      previousFatigue: character.condition.fatigue,
      nextFatigue,
      previousInjury: character.condition.injury,
      nextInjury,
      previousHealthState: character.condition.healthState,
      nextHealthState,
    },
    visibility: "local",
  });
}

function requireNpc(world, npcId) {
  assertNonEmptyString(npcId, "npcId");
  const npc = world.npcLife[npcId];
  if (!npc) throw new InvalidCommandError(`unknown NPC: ${npcId}`);
  return npc;
}

export function createNpc(
  world,
  {
    expectedRevision,
    npcId,
    displayName,
    home,
    occupation = "resident",
    routineBlocks = null,
    threatLevel = 0,
  },
) {
  assertExpectedRevision(world, { expectedRevision });
  assertNonEmptyString(npcId, "npcId");
  assertNonEmptyString(displayName, "displayName");
  assertNonEmptyString(home, "home");
  assertNonEmptyString(occupation, "occupation");
  assertRange(threatLevel, "threatLevel", 0, 100);
  if (world.npcLife[npcId]) throw new InvalidCommandError(`NPC already exists: ${npcId}`);
  const normalizedBlocks = normalizeRoutineBlocks(
    routineBlocks ?? [
      { id: "rest", label: "Rest", locationId: home, need: "sleep" },
      { id: "work", label: occupation, locationId: home, need: "money" },
      { id: "social", label: "Social time", locationId: home, need: "social" },
    ],
  );
  const firstBlock = normalizedBlocks[0];
  const npc = {
    id: npcId,
    displayName,
    home,
    occupation,
    routineBlocks: normalizedBlocks,
    routineIndex: 0,
    currentRoutineId: firstBlock.id,
    currentLocationId: firstBlock.locationId,
    scheduleMode: threatLevel > 0 ? "threat-adjusted" : "normal",
    threatLevel,
    lifeDays: 0,
    needs: defaultNpcNeeds(),
    activeLongAction: null,
    completedActions: [],
    interruptions: 0,
  };
  return commit(world, {
    eventType: "npc.life_started",
    actors: [npcId],
    subjects: [npcId],
    location: home,
    payload: { npc },
    visibility: "local",
  });
}

export function setNpcThreat(world, { expectedRevision, npcId, threatLevel }) {
  assertExpectedRevision(world, { expectedRevision });
  const npc = requireNpc(world, npcId);
  assertRange(threatLevel, "threatLevel", 0, 100);
  const nextNpc = {
    ...clone(npc),
    threatLevel,
    scheduleMode: threatLevel > 0 ? "threat-adjusted" : "normal",
  };
  return commit(world, {
    eventType: "npc.life_updated",
    actors: [npcId],
    subjects: [npcId],
    location: npc.home,
    payload: { npcId, nextNpc, reason: "threat-level-changed" },
    visibility: "local",
  });
}

export function startNpcLongAction(
  world,
  { expectedRevision, npcId, actionId, label, durationDays },
) {
  assertExpectedRevision(world, { expectedRevision });
  const npc = requireNpc(world, npcId);
  assertNonEmptyString(actionId, "actionId");
  assertNonEmptyString(label, "label");
  assertRange(durationDays, "durationDays", 1, 365);
  if (npc.activeLongAction) throw new InvalidCommandError(`NPC already has an active long action: ${npcId}`);
  const nextNpc = {
    ...clone(npc),
    activeLongAction: {
      id: actionId,
      label,
      startedOn: world.date,
      durationDays,
      elapsedDays: 0,
      status: "active",
    },
  };
  return commit(world, {
    eventType: "npc.life_updated",
    actors: [npcId],
    subjects: [npcId],
    location: npc.currentLocationId,
    payload: { npcId, nextNpc, reason: "long-action-started" },
    visibility: "local",
  });
}

export function interruptNpcLongAction(world, { expectedRevision, npcId, reason = "interrupted" }) {
  assertExpectedRevision(world, { expectedRevision });
  const npc = requireNpc(world, npcId);
  assertNonEmptyString(reason, "reason");
  if (!npc.activeLongAction) throw new InvalidCommandError(`NPC has no active long action: ${npcId}`);
  const nextNpc = {
    ...clone(npc),
    activeLongAction: null,
    interruptions: npc.interruptions + 1,
  };
  return commit(world, {
    eventType: "npc.life_interrupted",
    actors: [npcId],
    subjects: [npcId],
    location: npc.currentLocationId,
    payload: {
      npcId,
      nextNpc,
      interruptedActionId: npc.activeLongAction.id,
      reason,
    },
    visibility: "local",
  });
}

export function updateRelationship(
  world,
  {
    expectedRevision,
    actorId,
    subjectId,
    deltas = {},
    sharedEventType = null,
  },
) {
  assertExpectedRevision(world, { expectedRevision });
  assertNonEmptyString(actorId, "actorId");
  assertNonEmptyString(subjectId, "subjectId");
  const relationshipId = `${actorId}|${subjectId}`;
  const previous = enrichRelationship(world.relationships[relationshipId] ?? {});
  const nextRelationship = clone(previous);
  for (const [axis, delta] of Object.entries(deltas)) {
    if (!RELATIONSHIP_AXES.includes(axis)) throw new InvalidCommandError(`unsupported relationship axis: ${axis}`);
    assertInteger(delta, `deltas.${axis}`);
    nextRelationship[axis] = clampAxis(previous[axis] + delta, axis);
  }
  if (sharedEventType !== null) {
    assertNonEmptyString(sharedEventType, "sharedEventType");
    nextRelationship.sharedEvents.push({ type: sharedEventType, date: world.date });
  }
  return commit(world, {
    eventType: "relationship.updated",
    actors: [actorId],
    subjects: [subjectId],
    payload: {
      relationshipId,
      previousRelationship: previous,
      nextRelationship,
      informationScope: "relationship-participants",
    },
    visibility: "local",
  });
}

export function createRumor(
  world,
  {
    expectedRevision,
    rumorId,
    sourceId,
    subjectId,
    topic,
    retelling,
    truthStatus = "unknown",
    locationId = null,
  },
) {
  assertExpectedRevision(world, { expectedRevision });
  assertNonEmptyString(rumorId, "rumorId");
  assertNonEmptyString(sourceId, "sourceId");
  assertNonEmptyString(subjectId, "subjectId");
  assertNonEmptyString(topic, "topic");
  assertNonEmptyString(retelling, "retelling");
  if (!["unknown", "true", "false", "contested"].includes(truthStatus)) {
    throw new InvalidCommandError(`unsupported rumor truth status: ${truthStatus}`);
  }
  if (locationId !== null) assertNonEmptyString(locationId, "locationId");
  if (world.rumors[rumorId]) throw new InvalidCommandError(`rumor already exists: ${rumorId}`);
  const rumor = {
    id: rumorId,
    sourceId,
    subjectId,
    topic,
    originRetelling: retelling,
    truthStatus,
    originDate: world.date,
  };
  return commit(world, {
    eventType: "rumor.created",
    actors: [sourceId],
    subjects: [subjectId, rumorId],
    location: locationId,
    payload: { rumor },
    visibility: "local",
  });
}

export function hearRumor(
  world,
  {
    expectedRevision,
    observerId,
    rumorId,
    sourceId,
    retelling = null,
    confidence = 50,
  },
) {
  assertExpectedRevision(world, { expectedRevision });
  assertNonEmptyString(observerId, "observerId");
  assertNonEmptyString(rumorId, "rumorId");
  assertNonEmptyString(sourceId, "sourceId");
  assertRange(confidence, "confidence", 0, 100);
  const rumor = world.rumors[rumorId];
  if (!rumor) throw new InvalidCommandError(`unknown rumor: ${rumorId}`);
  if (retelling !== null) assertNonEmptyString(retelling, "retelling");
  const previous = world.beliefs[observerId]?.[rumorId] ?? null;
  const nextBelief = {
    rumorId,
    observerId,
    sourceId,
    retelling: retelling ?? rumor.originRetelling,
    confidence,
    truthStatus: "unknown",
    heardOn: world.date,
    stalenessDays: 0,
  };
  return commit(world, {
    eventType: "belief.heard",
    actors: [sourceId],
    subjects: [observerId, rumorId],
    payload: { observerId, rumorId, previousBelief: previous, nextBelief },
    visibility: "observer-scoped",
  });
}

function requireOrganization(world, organizationId) {
  assertNonEmptyString(organizationId, "organizationId");
  const organization = world.organizations[organizationId];
  if (!organization) throw new InvalidCommandError(`unknown organization: ${organizationId}`);
  return organization;
}

function requireWorkItem(organization, workItemId) {
  assertNonEmptyString(workItemId, "workItemId");
  const item = organization.workItems[workItemId];
  if (!item) throw new InvalidCommandError(`unknown work item: ${workItemId}`);
  return item;
}

export function createOrganization(
  world,
  { expectedRevision, organizationId, displayName, doctrine = "trust-and-competence", members = [] },
) {
  assertExpectedRevision(world, { expectedRevision });
  assertNonEmptyString(organizationId, "organizationId");
  assertNonEmptyString(displayName, "displayName");
  assertNonEmptyString(doctrine, "doctrine");
  if (!Array.isArray(members)) throw new InvalidCommandError("members must be an array");
  if (world.organizations[organizationId]) {
    throw new InvalidCommandError(`organization already exists: ${organizationId}`);
  }
  const normalizedMembers = {};
  for (const member of members) {
    if (!member || typeof member !== "object" || Array.isArray(member)) {
      throw new InvalidCommandError("organization members must be objects");
    }
    assertNonEmptyString(member.memberId, "member.memberId");
    assertNonEmptyString(member.role, "member.role");
    if (normalizedMembers[member.memberId]) {
      throw new InvalidCommandError(`duplicate organization member: ${member.memberId}`);
    }
    normalizedMembers[member.memberId] = {
      memberId: member.memberId,
      role: member.role,
      capabilities: normalizeStringArray(member.capabilities, "member.capabilities"),
      availability: member.availability ?? "available",
      locationId: member.locationId ?? null,
    };
    if (!["available", "unavailable", "arrested", "injured", "disconnected"].includes(normalizedMembers[member.memberId].availability)) {
      throw new InvalidCommandError(`unsupported member availability: ${normalizedMembers[member.memberId].availability}`);
    }
    if (normalizedMembers[member.memberId].locationId !== null) {
      assertNonEmptyString(normalizedMembers[member.memberId].locationId, "member.locationId");
    }
  }
  const organization = {
    id: organizationId,
    displayName,
    doctrine,
    members: normalizedMembers,
    workItems: {},
  };
  return commit(world, {
    eventType: "organization.created",
    actors: [organizationId],
    subjects: [organizationId],
    payload: { organization },
    visibility: "local",
  });
}

export function createWorkGraph(world, { expectedRevision, organizationId, workItems }) {
  assertExpectedRevision(world, { expectedRevision });
  const organization = requireOrganization(world, organizationId);
  if (!Array.isArray(workItems) || workItems.length === 0) {
    throw new InvalidCommandError("workItems must contain at least one item");
  }
  const normalized = {};
  for (const workItem of workItems) {
    if (!workItem || typeof workItem !== "object" || Array.isArray(workItem)) {
      throw new InvalidCommandError("work items must be objects");
    }
    assertNonEmptyString(workItem.workItemId, "workItem.workItemId");
    assertNonEmptyString(workItem.label, "workItem.label");
    if (normalized[workItem.workItemId] || organization.workItems[workItem.workItemId]) {
      throw new InvalidCommandError(`duplicate work item: ${workItem.workItemId}`);
    }
    const dependencies = normalizeStringArray(workItem.dependencies, "workItem.dependencies");
    if (dependencies.includes(workItem.workItemId)) {
      throw new InvalidCommandError(`work item cannot depend on itself: ${workItem.workItemId}`);
    }
    normalized[workItem.workItemId] = {
      id: workItem.workItemId,
      label: workItem.label,
      dependencies,
      requiredCapabilities: normalizeStringArray(workItem.requiredCapabilities, "workItem.requiredCapabilities"),
      exclusionGroup: workItem.exclusionGroup ?? null,
      status: "blocked",
      claimOwner: null,
      leaseUntil: null,
      attempts: 0,
      recoveryState: "none",
      reviewState: "pending",
      completedOn: null,
    };
    if (normalized[workItem.workItemId].exclusionGroup !== null) {
      assertNonEmptyString(normalized[workItem.workItemId].exclusionGroup, "workItem.exclusionGroup");
    }
  }
  const allIds = new Set([...Object.keys(organization.workItems), ...Object.keys(normalized)]);
  for (const item of Object.values(normalized)) {
    for (const dependency of item.dependencies) {
      if (!allIds.has(dependency)) throw new InvalidCommandError(`unknown work dependency: ${dependency}`);
    }
  }
  return commit(world, {
    eventType: "organization.work_graph_created",
    actors: [organizationId],
    subjects: Object.keys(normalized),
    payload: { organizationId, workItems: normalized },
    visibility: "local",
  });
}

export function changeMemberAvailability(
  world,
  { expectedRevision, organizationId, memberId, availability },
) {
  assertExpectedRevision(world, { expectedRevision });
  const organization = requireOrganization(world, organizationId);
  assertNonEmptyString(memberId, "memberId");
  if (!organization.members[memberId]) throw new InvalidCommandError(`unknown organization member: ${memberId}`);
  if (!["available", "unavailable", "arrested", "injured", "disconnected"].includes(availability)) {
    throw new InvalidCommandError(`unsupported member availability: ${availability}`);
  }
  return commit(world, {
    eventType: "organization.member_availability_changed",
    actors: [memberId],
    subjects: [organizationId, memberId],
    payload: { organizationId, memberId, availability },
    visibility: "local",
  });
}

export function claimWorkItem(
  world,
  { expectedRevision, organizationId, workItemId, memberId, leaseDays = 1 },
) {
  assertExpectedRevision(world, { expectedRevision });
  const organization = requireOrganization(world, organizationId);
  const item = requireWorkItem(organization, workItemId);
  assertNonEmptyString(memberId, "memberId");
  assertRange(leaseDays, "leaseDays", 1, 30);
  const member = organization.members[memberId];
  if (!member) throw new InvalidCommandError(`unknown organization member: ${memberId}`);
  if (!["available", "recovery"].includes(item.status)) {
    throw new InvalidCommandError(`work item is not claimable: ${workItemId}`);
  }
  if (member.availability !== "available") {
    throw new InvalidCommandError(`member is not available: ${memberId}`);
  }
  if (!item.dependencies.every((dependencyId) => organization.workItems[dependencyId]?.status === "completed")) {
    throw new InvalidCommandError(`work dependencies are incomplete: ${workItemId}`);
  }
  if (item.requiredCapabilities.some((capability) => !member.capabilities.includes(capability))) {
    throw new InvalidCommandError(`member lacks required capability for ${workItemId}`);
  }
  if (item.exclusionGroup && Object.values(organization.workItems).some((other) => (
    other.id !== item.id
    && other.status === "active"
    && other.claimOwner === memberId
    && other.exclusionGroup === item.exclusionGroup
  ))) {
    throw new InvalidCommandError(`member is excluded from simultaneous work group: ${item.exclusionGroup}`);
  }
  return commit(world, {
    eventType: "organization.work_claimed",
    actors: [memberId],
    subjects: [organizationId, workItemId],
    location: member.locationId,
    payload: {
      organizationId,
      workItemId,
      memberId,
      leaseUntil: addDays(world.date, leaseDays),
      attempts: item.attempts + 1,
    },
    visibility: "local",
  });
}

export function completeWorkItem(
  world,
  { expectedRevision, organizationId, workItemId, memberId, reviewState = "accepted" },
) {
  assertExpectedRevision(world, { expectedRevision });
  const organization = requireOrganization(world, organizationId);
  const item = requireWorkItem(organization, workItemId);
  assertNonEmptyString(memberId, "memberId");
  if (item.status !== "active" || item.claimOwner !== memberId) {
    throw new InvalidCommandError(`member does not own active work item: ${workItemId}`);
  }
  if (!["accepted", "disputed"].includes(reviewState)) {
    throw new InvalidCommandError(`unsupported review state: ${reviewState}`);
  }
  return commit(world, {
    eventType: "organization.work_completed",
    actors: [memberId],
    subjects: [organizationId, workItemId],
    payload: {
      organizationId,
      workItemId,
      memberId,
      reviewState,
      completedOn: world.date,
    },
    visibility: "local",
  });
}

function requireObject(world, objectId) {
  assertNonEmptyString(objectId, "objectId");
  const object = world.objects[objectId];
  if (!object) throw new InvalidCommandError(`unknown object: ${objectId}`);
  return object;
}

function requireMarket(world, marketId) {
  assertNonEmptyString(marketId, "marketId");
  const market = world.markets[marketId];
  if (!market) throw new InvalidCommandError(`unknown market: ${marketId}`);
  return market;
}

export function createProvenanceObject(
  world,
  {
    expectedRevision,
    objectId,
    objectType,
    origin,
    ownerId = null,
    locationId = world.district.id,
    fidelity = "promoted",
    authenticity = "unknown",
    evidenceFlags = [],
    trophyTags = [],
  },
) {
  assertExpectedRevision(world, { expectedRevision });
  assertNonEmptyString(objectId, "objectId");
  assertNonEmptyString(objectType, "objectType");
  assertNonEmptyString(origin, "origin");
  assertNonEmptyString(locationId, "locationId");
  if (ownerId !== null) assertNonEmptyString(ownerId, "ownerId");
  if (!["ordinary", "promoted", "important"].includes(fidelity)) {
    throw new InvalidCommandError(`unsupported object fidelity: ${fidelity}`);
  }
  if (!["unknown", "verified", "contested", "altered"].includes(authenticity)) {
    throw new InvalidCommandError(`unsupported object authenticity: ${authenticity}`);
  }
  if (world.objects[objectId]) throw new InvalidCommandError(`object already exists: ${objectId}`);
  const ownerRecord = ownerId ? [{ ownerId, date: world.date, reason: "origin" }] : [];
  const object = {
    id: objectId,
    objectType,
    origin,
    fidelity,
    authenticity,
    currentOwnerId: ownerId,
    currentLocationId: locationId,
    currentContainerId: null,
    status: "held",
    ownerChain: ownerRecord,
    custodyChain: [{ holderId: ownerId ?? "world:origin", locationId, date: world.date, state: "held", reason: "created" }],
    eventLinks: [],
    damageHistory: [],
    repairHistory: [],
    locationHistory: [{ locationId, date: world.date, reason: "created" }],
    evidenceFlags: normalizeStringArray(evidenceFlags, "evidenceFlags"),
    trophyTags: normalizeStringArray(trophyTags, "trophyTags"),
    condition: "intact",
  };
  return commit(world, {
    eventType: "object.created",
    actors: ownerId ? [ownerId] : ["system:provenance"],
    subjects: [objectId],
    location: locationId,
    payload: { object },
    visibility: "local",
  });
}

export function transferObject(
  world,
  { expectedRevision, objectId, fromId, toId, locationId = null, reason = "transfer" },
) {
  assertExpectedRevision(world, { expectedRevision });
  const object = requireObject(world, objectId);
  assertNonEmptyString(fromId, "fromId");
  assertNonEmptyString(toId, "toId");
  assertNonEmptyString(reason, "reason");
  if (object.status === "seized") throw new InvalidCommandError(`seized object cannot be transferred: ${objectId}`);
  if (object.currentOwnerId !== fromId) throw new InvalidCommandError(`object is not owned by ${fromId}: ${objectId}`);
  const nextLocation = locationId ?? object.currentLocationId;
  assertNonEmptyString(nextLocation, "locationId");
  return commit(world, {
    eventType: "object.transferred",
    actors: [fromId, toId],
    subjects: [objectId],
    location: nextLocation,
    payload: {
      objectId,
      fromId,
      toId,
      ownerRecord: { ownerId: toId, date: world.date, reason },
      custodyRecord: { holderId: toId, locationId: nextLocation, date: world.date, state: "held", reason },
    },
    visibility: "local",
  });
}

export function moveObject(
  world,
  { expectedRevision, objectId, actorId, locationId, containerId = null, reason = "moved" },
) {
  assertExpectedRevision(world, { expectedRevision });
  const object = requireObject(world, objectId);
  assertNonEmptyString(actorId, "actorId");
  assertNonEmptyString(locationId, "locationId");
  assertNonEmptyString(reason, "reason");
  if (object.status === "seized") throw new InvalidCommandError(`seized object cannot be moved: ${objectId}`);
  if (containerId !== null) assertNonEmptyString(containerId, "containerId");
  return commit(world, {
    eventType: "object.moved",
    actors: [actorId],
    subjects: [objectId],
    location: locationId,
    payload: {
      objectId,
      locationId,
      containerId,
      locationRecord: { locationId, containerId, date: world.date, reason },
      custodyRecord: {
        holderId: object.currentOwnerId ?? "world:origin",
        locationId,
        containerId,
        date: world.date,
        state: containerId ? "stored" : "held",
        reason,
      },
    },
    visibility: "local",
  });
}

export function seizeObject(
  world,
  { expectedRevision, objectId, agencyId, locationId, evidenceFlag = "evidence:seized" },
) {
  assertExpectedRevision(world, { expectedRevision });
  const object = requireObject(world, objectId);
  assertNonEmptyString(agencyId, "agencyId");
  assertNonEmptyString(locationId, "locationId");
  assertNonEmptyString(evidenceFlag, "evidenceFlag");
  if (object.status === "seized") throw new InvalidCommandError(`object is already seized: ${objectId}`);
  return commit(world, {
    eventType: "object.seized",
    actors: [agencyId],
    subjects: [objectId],
    location: locationId,
    payload: {
      objectId,
      agencyId,
      locationId,
      evidenceFlag,
      custodyRecord: { holderId: agencyId, locationId, date: world.date, state: "seized", reason: "evidence" },
    },
    visibility: "institutional",
  });
}

export function returnSeizedObject(
  world,
  { expectedRevision, objectId, agencyId, locationId, containerId = null },
) {
  assertExpectedRevision(world, { expectedRevision });
  const object = requireObject(world, objectId);
  assertNonEmptyString(agencyId, "agencyId");
  assertNonEmptyString(locationId, "locationId");
  if (object.status !== "seized") throw new InvalidCommandError(`object is not seized: ${objectId}`);
  if (containerId !== null) assertNonEmptyString(containerId, "containerId");
  return commit(world, {
    eventType: "object.returned",
    actors: [agencyId, object.currentOwnerId ?? "world:origin"],
    subjects: [objectId],
    location: locationId,
    payload: {
      objectId,
      agencyId,
      locationId,
      containerId,
      custodyRecord: {
        holderId: object.currentOwnerId ?? "world:origin",
        locationId,
        containerId,
        date: world.date,
        state: containerId ? "stored" : "held",
        reason: "evidence-returned",
      },
    },
    visibility: "institutional",
  });
}

export function recordObjectDamage(
  world,
  { expectedRevision, objectId, actorId, severity, cause = "unknown", locationId = null },
) {
  assertExpectedRevision(world, { expectedRevision });
  const object = requireObject(world, objectId);
  assertNonEmptyString(actorId, "actorId");
  assertRange(severity, "severity", 1, 100);
  assertNonEmptyString(cause, "cause");
  if (locationId !== null) assertNonEmptyString(locationId, "locationId");
  const nextCondition = severity === 100 ? "destroyed" : "damaged";
  return commit(world, {
    eventType: "object.damaged",
    actors: [actorId],
    subjects: [objectId],
    location: locationId ?? object.currentLocationId,
    payload: {
      objectId,
      nextCondition,
      damageRecord: { severity, cause, date: world.date, locationId: locationId ?? object.currentLocationId },
    },
    visibility: "local",
  });
}

export function recordObjectRepair(
  world,
  { expectedRevision, objectId, actorId, condition = "intact", locationId = null },
) {
  assertExpectedRevision(world, { expectedRevision });
  const object = requireObject(world, objectId);
  assertNonEmptyString(actorId, "actorId");
  if (!["intact", "damaged"].includes(condition)) throw new InvalidCommandError(`unsupported object condition: ${condition}`);
  if (locationId !== null) assertNonEmptyString(locationId, "locationId");
  return commit(world, {
    eventType: "object.repaired",
    actors: [actorId],
    subjects: [objectId],
    location: locationId ?? object.currentLocationId,
    payload: {
      objectId,
      nextCondition: condition,
      repairRecord: { date: world.date, actorId, locationId: locationId ?? object.currentLocationId, condition },
    },
    visibility: "local",
  });
}

export function createMarket(
  world,
  {
    expectedRevision,
    marketId,
    regionId,
    commodity,
    basePrice,
    supply = 0,
    demand = 0,
    inventory = 0,
    transportCost = 0,
    legalPressure = 0,
    factionControl = 0,
    volatility = 10,
  },
) {
  assertExpectedRevision(world, { expectedRevision });
  assertNonEmptyString(marketId, "marketId");
  assertNonEmptyString(regionId, "regionId");
  assertNonEmptyString(commodity, "commodity");
  assertInteger(basePrice, "basePrice", 1);
  assertRange(supply, "supply", 0, 1000);
  assertRange(demand, "demand", 0, 1000);
  assertRange(inventory, "inventory", 0, 100000);
  assertRange(transportCost, "transportCost", 0, 100);
  assertRange(legalPressure, "legalPressure", 0, 100);
  assertRange(factionControl, "factionControl", 0, 100);
  assertRange(volatility, "volatility", 0, 50);
  if (world.markets[marketId]) throw new InvalidCommandError(`market already exists: ${marketId}`);
  const market = {
    id: marketId,
    regionId,
    commodity,
    basePrice,
    supply,
    demand,
    inventory,
    transportCost,
    legalPressure,
    factionControl,
    volatility,
    priceBand: priceBand({ basePrice, supply, demand, transportCost, legalPressure, factionControl, volatility }),
    shockHistory: [],
    informationLagDays: 0,
    lastSettledDate: world.date,
  };
  return commit(world, {
    eventType: "market.created",
    actors: ["system:market"],
    subjects: [marketId],
    location: regionId,
    payload: { market },
    visibility: "local",
  });
}

export function updateMarket(
  world,
  {
    expectedRevision,
    marketId,
    actorId = "system:market",
    supplyDelta = 0,
    demandDelta = 0,
    inventoryDelta = 0,
    transportCostDelta = 0,
    legalPressureDelta = 0,
    factionControlDelta = 0,
    shockType = "ordinary-settlement",
    informationLagDays = null,
  },
) {
  assertExpectedRevision(world, { expectedRevision });
  const market = requireMarket(world, marketId);
  assertNonEmptyString(actorId, "actorId");
  assertNonEmptyString(shockType, "shockType");
  for (const [field, value] of Object.entries({
    supplyDelta,
    demandDelta,
    inventoryDelta,
    transportCostDelta,
    legalPressureDelta,
    factionControlDelta,
  })) {
    if (!Number.isInteger(value)) throw new InvalidCommandError(`${field} must be an integer`);
  }
  const next = {
    ...clone(market),
    supply: Math.max(0, Math.min(1000, market.supply + supplyDelta)),
    demand: Math.max(0, Math.min(1000, market.demand + demandDelta)),
    inventory: Math.max(0, Math.min(100000, market.inventory + inventoryDelta)),
    transportCost: Math.max(0, Math.min(100, market.transportCost + transportCostDelta)),
    legalPressure: Math.max(0, Math.min(100, market.legalPressure + legalPressureDelta)),
    factionControl: Math.max(0, Math.min(100, market.factionControl + factionControlDelta)),
  };
  if (informationLagDays !== null) assertRange(informationLagDays, "informationLagDays", 0, 365);
  if (informationLagDays !== null) next.informationLagDays = informationLagDays;
  next.priceBand = priceBand(next);
  next.shockHistory = [
    ...market.shockHistory,
    {
      type: shockType,
      date: world.date,
      supplyDelta,
      demandDelta,
      inventoryDelta,
      transportCostDelta,
      legalPressureDelta,
      factionControlDelta,
    },
  ];
  return commit(world, {
    eventType: "market.updated",
    actors: [actorId],
    subjects: [marketId],
    location: market.regionId,
    payload: {
      marketId,
      previousMarket: market,
      nextMarket: next,
      shockType,
    },
    visibility: "local",
  });
}

function requireCase(world, caseId) {
  assertNonEmptyString(caseId, "caseId");
  const caseFile = world.cases[caseId];
  if (!caseFile) throw new InvalidCommandError(`unknown case: ${caseId}`);
  return caseFile;
}

function requireCaseAgency(caseFile, agencyId) {
  assertNonEmptyString(agencyId, "agencyId");
  const agencyView = caseFile.agencyViews[agencyId];
  if (!agencyView) throw new InvalidCommandError(`agency is not attached to case: ${agencyId}`);
  return agencyView;
}

export function createCase(
  world,
  {
    expectedRevision,
    caseId,
    matterType,
    leadAgency,
    jurisdiction,
    suspects = [],
    authorityActions = [],
    confidence = 0,
  },
) {
  assertExpectedRevision(world, { expectedRevision });
  assertNonEmptyString(caseId, "caseId");
  assertNonEmptyString(matterType, "matterType");
  assertNonEmptyString(leadAgency, "leadAgency");
  assertNonEmptyString(jurisdiction, "jurisdiction");
  assertRange(confidence, "confidence", 0, 100);
  if (world.cases[caseId]) throw new InvalidCommandError(`case already exists: ${caseId}`);
  const caseFile = {
    id: caseId,
    matterType,
    leadAgency,
    jurisdiction,
    suspects: normalizeIds(suspects, "suspects"),
    supportingAgencies: [],
    evidenceLinks: [],
    witnesses: [],
    confidence,
    legalStage: "intake",
    caseAgeDays: 0,
    agencyViews: {
      [leadAgency]: {
        agencyId: leadAgency,
        jurisdiction,
        authorityActions: normalizeStringArray(authorityActions, "authorityActions"),
        authorizedActions: [],
        knownEvidence: [],
        knownWitnesses: [],
      },
    },
  };
  return commit(world, {
    eventType: "case.created",
    actors: [leadAgency],
    subjects: [caseId, ...caseFile.suspects],
    payload: { caseFile },
    visibility: "institutional",
  });
}

export function attachCaseAgency(
  world,
  { expectedRevision, caseId, agencyId, jurisdiction, authorityActions = [] },
) {
  assertExpectedRevision(world, { expectedRevision });
  const caseFile = requireCase(world, caseId);
  assertNonEmptyString(agencyId, "agencyId");
  assertNonEmptyString(jurisdiction, "jurisdiction");
  if (caseFile.agencyViews[agencyId]) throw new InvalidCommandError(`agency already attached to case: ${agencyId}`);
  const agencyView = {
    agencyId,
    jurisdiction,
    authorityActions: normalizeStringArray(authorityActions, "authorityActions"),
    authorizedActions: [],
    knownEvidence: [],
    knownWitnesses: [],
  };
  return commit(world, {
    eventType: "case.agency_attached",
    actors: [agencyId],
    subjects: [caseId, agencyId],
    payload: { caseId, agencyId, agencyView },
    visibility: "institutional",
  });
}

export function recordCaseEvidence(
  world,
  { expectedRevision, caseId, agencyId, evidenceId, source, strength = 10, objectId = null },
) {
  assertExpectedRevision(world, { expectedRevision });
  const caseFile = requireCase(world, caseId);
  requireCaseAgency(caseFile, agencyId);
  assertNonEmptyString(evidenceId, "evidenceId");
  assertNonEmptyString(source, "source");
  assertRange(strength, "strength", 1, 100);
  if (objectId !== null) assertNonEmptyString(objectId, "objectId");
  if (caseFile.evidenceLinks.some((evidence) => evidence.evidenceId === evidenceId)) {
    throw new InvalidCommandError(`evidence already linked to case: ${evidenceId}`);
  }
  const evidence = {
    evidenceId,
    source,
    strength,
    objectId,
    observedBy: agencyId,
    observedOn: world.date,
    interpretation: "agency-scoped",
  };
  const nextConfidence = Math.min(100, caseFile.confidence + Math.max(1, Math.round(strength / 10)));
  return commit(world, {
    eventType: "case.evidence_added",
    actors: [agencyId],
    subjects: [caseId, evidenceId],
    payload: { caseId, agencyId, evidence, nextConfidence },
    visibility: "institutional",
  });
}

export function recordCaseWitness(
  world,
  {
    expectedRevision,
    caseId,
    agencyId,
    witnessId,
    retelling,
    confidence = 50,
    status = "reported",
  },
) {
  assertExpectedRevision(world, { expectedRevision });
  const caseFile = requireCase(world, caseId);
  requireCaseAgency(caseFile, agencyId);
  assertNonEmptyString(witnessId, "witnessId");
  assertNonEmptyString(retelling, "retelling");
  assertRange(confidence, "confidence", 0, 100);
  if (!["reported", "recanted", "corroborated"].includes(status)) {
    throw new InvalidCommandError(`unsupported witness status: ${status}`);
  }
  if (caseFile.witnesses.some((witness) => witness.witnessId === witnessId)) {
    throw new InvalidCommandError(`witness statement already recorded: ${witnessId}`);
  }
  const witness = {
    witnessId,
    retelling,
    confidence,
    status,
    observedBy: agencyId,
    observedOn: world.date,
  };
  const nextConfidence = Math.min(100, caseFile.confidence + (status === "corroborated" ? 5 : Math.round(confidence / 25)));
  return commit(world, {
    eventType: "case.witness_recorded",
    actors: [agencyId],
    subjects: [caseId, witnessId],
    payload: { caseId, agencyId, witness, nextConfidence },
    visibility: "institutional",
  });
}

export function authorizeCaseAction(
  world,
  { expectedRevision, caseId, agencyId, action },
) {
  assertExpectedRevision(world, { expectedRevision });
  const caseFile = requireCase(world, caseId);
  const agencyView = requireCaseAgency(caseFile, agencyId);
  assertNonEmptyString(action, "action");
  if (!agencyView.authorityActions.includes(action)) {
    throw new InvalidCommandError(`action is outside agency jurisdiction: ${action}`);
  }
  return commit(world, {
    eventType: "case.action_authorized",
    actors: [agencyId],
    subjects: [caseId],
    payload: { caseId, agencyId, action },
    visibility: "institutional",
  });
}

export function advanceCaseStage(
  world,
  { expectedRevision, caseId, agencyId, nextStage },
) {
  assertExpectedRevision(world, { expectedRevision });
  const caseFile = requireCase(world, caseId);
  const agencyView = requireCaseAgency(caseFile, agencyId);
  if (!["intake", "open", "investigating", "charged", "court", "cold", "closed"].includes(nextStage)) {
    throw new InvalidCommandError(`unsupported case stage: ${nextStage}`);
  }
  if (!agencyView.authorizedActions.includes("advance-stage")) {
    throw new InvalidCommandError(`agency cannot advance case stage: ${agencyId}`);
  }
  const validTransitions = {
    intake: ["open", "closed"],
    open: ["investigating", "cold", "closed"],
    investigating: ["charged", "cold", "closed"],
    charged: ["court", "closed"],
    court: ["closed"],
    cold: ["open", "closed"],
    closed: [],
  };
  if (!validTransitions[caseFile.legalStage].includes(nextStage)) {
    throw new InvalidCommandError(`invalid case stage transition: ${caseFile.legalStage} -> ${nextStage}`);
  }
  return commit(world, {
    eventType: "case.stage_changed",
    actors: [agencyId],
    subjects: [caseId],
    payload: { caseId, agencyId, previousStage: caseFile.legalStage, nextStage },
    visibility: "institutional",
  });
}

function requireBusiness(world, businessId) {
  assertNonEmptyString(businessId, "businessId");
  const business = world.businesses[businessId];
  if (!business) throw new InvalidCommandError(`unknown business: ${businessId}`);
  return business;
}

export function createBusiness(
  world,
  {
    expectedRevision,
    businessId,
    displayName,
    locationId,
    venueType,
    ownerId = null,
    reputation = 0,
    condition = "stable",
  },
) {
  assertExpectedRevision(world, { expectedRevision });
  assertNonEmptyString(businessId, "businessId");
  assertNonEmptyString(displayName, "displayName");
  assertNonEmptyString(locationId, "locationId");
  assertNonEmptyString(venueType, "venueType");
  if (ownerId !== null) assertNonEmptyString(ownerId, "ownerId");
  assertRange(reputation, "reputation", -100, 100);
  if (!["stable", "strained", "damaged", "closed"].includes(condition)) {
    throw new InvalidCommandError(`unsupported business condition: ${condition}`);
  }
  if (world.businesses[businessId]) throw new InvalidCommandError(`business already exists: ${businessId}`);
  const business = {
    id: businessId,
    displayName,
    locationId,
    venueType,
    ownerId,
    reputation,
    condition,
    ageDays: 0,
    operatingMonths: 0,
    lastSettledDate: world.date,
  };
  return commit(world, {
    eventType: "business.created",
    actors: [ownerId ?? "system:business"],
    subjects: [businessId],
    location: locationId,
    payload: { business },
    visibility: "local",
  });
}

export function updateBusiness(
  world,
  {
    expectedRevision,
    businessId,
    actorId = "system:business",
    reputationDelta = 0,
    condition = null,
    ownerId = undefined,
  },
) {
  assertExpectedRevision(world, { expectedRevision });
  const business = requireBusiness(world, businessId);
  assertNonEmptyString(actorId, "actorId");
  if (!Number.isInteger(reputationDelta)) throw new InvalidCommandError("reputationDelta must be an integer");
  if (condition !== null && !["stable", "strained", "damaged", "closed"].includes(condition)) {
    throw new InvalidCommandError(`unsupported business condition: ${condition}`);
  }
  if (ownerId !== undefined && ownerId !== null) assertNonEmptyString(ownerId, "ownerId");
  const nextBusiness = {
    ...clone(business),
    reputation: Math.max(-100, Math.min(100, business.reputation + reputationDelta)),
    condition: condition ?? business.condition,
    ownerId: ownerId === undefined ? business.ownerId : ownerId,
  };
  return commit(world, {
    eventType: "business.updated",
    actors: [actorId],
    subjects: [businessId],
    location: business.locationId,
    payload: { businessId, previousBusiness: business, nextBusiness },
    visibility: "local",
  });
}

function requireProtectionArrangement(world, arrangementId) {
  assertNonEmptyString(arrangementId, "arrangementId");
  const arrangement = world.protectionArrangements[arrangementId];
  if (!arrangement) throw new InvalidCommandError(`unknown protection arrangement: ${arrangementId}`);
  return arrangement;
}

function assertBoolean(value, field) {
  if (typeof value !== "boolean") throw new InvalidCommandError(`${field} must be a boolean`);
}

function bounded(value) {
  return Math.max(0, Math.min(100, value));
}

function protectionTreatmentDelta(treatment) {
  return {
    respectful: { trust: 4, fear: -3, resentment: -4 },
    pressured: { trust: -1, fear: 6, resentment: 4 },
    humiliating: { trust: -4, fear: 12, resentment: 12 },
    protective: { trust: 6, fear: -2, resentment: -5 },
    absent: { trust: -3, fear: 0, resentment: 5 },
  }[treatment];
}

function protectionBusinessImpact({ treatment, paymentStatus, serviceDelivered, previousReputation }) {
  const treatmentDelta = {
    respectful: 1,
    pressured: -2,
    humiliating: -8,
    protective: 2,
    absent: -4,
  }[treatment];
  const paymentDelta = paymentStatus === "paid" ? 0 : paymentStatus === "waived" ? 1 : -2;
  const serviceDelta = serviceDelivered ? 1 : -1;
  const nextReputation = Math.max(-100, Math.min(100, previousReputation + treatmentDelta + paymentDelta + serviceDelta));
  const nextCondition = nextReputation <= -80 ? "damaged" : nextReputation <= -45 ? "strained" : "stable";
  return { nextReputation, nextCondition };
}

export function createProtectionArrangement(
  world,
  {
    expectedRevision,
    arrangementId,
    businessId,
    ownerId,
    providerId,
    districtId = world.district.id,
    mode = "negotiated",
    paymentBand = "moderate",
    serviceExpectations = ["presence", "information"],
    vulnerability = 30,
    competitorPressure = 0,
    policeExposure = 0,
  },
) {
  assertExpectedRevision(world, { expectedRevision });
  assertNonEmptyString(arrangementId, "arrangementId");
  assertNonEmptyString(businessId, "businessId");
  assertNonEmptyString(ownerId, "ownerId");
  assertNonEmptyString(providerId, "providerId");
  assertNonEmptyString(districtId, "districtId");
  if (![
    "coercive",
    "protective",
    "negotiated",
    "partnership",
  ].includes(mode)) throw new InvalidCommandError(`unsupported protection mode: ${mode}`);
  if (!["low", "moderate", "high"].includes(paymentBand)) {
    throw new InvalidCommandError(`unsupported payment band: ${paymentBand}`);
  }
  assertRange(vulnerability, "vulnerability", 0, 100);
  assertRange(competitorPressure, "competitorPressure", 0, 100);
  assertRange(policeExposure, "policeExposure", 0, 100);
  const business = requireBusiness(world, businessId);
  if (business.ownerId !== null && business.ownerId !== ownerId) {
    throw new InvalidCommandError(`business owner does not match protection owner: ${businessId}`);
  }
  if (world.protectionArrangements[arrangementId]) {
    throw new InvalidCommandError(`protection arrangement already exists: ${arrangementId}`);
  }
  const defaults = {
    coercive: { trust: 0, fear: 35, resentment: 25 },
    protective: { trust: 25, fear: 0, resentment: 0 },
    negotiated: { trust: 20, fear: 5, resentment: 5 },
    partnership: { trust: 40, fear: 0, resentment: 0 },
  }[mode];
  const arrangement = {
    id: arrangementId,
    businessId,
    ownerId,
    providerId,
    districtId,
    mode,
    paymentBand,
    serviceExpectations: normalizeStringArray(serviceExpectations, "serviceExpectations"),
    vulnerability,
    trust: defaults.trust,
    fear: defaults.fear,
    resentment: defaults.resentment,
    competitorPressure,
    policeExposure,
    status: "active",
    missedPayments: 0,
    completedCycles: 0,
    daysActive: 0,
    daysSinceReview: 0,
    lastPaymentStatus: "not-due",
    lastTreatment: null,
    lastOwnerDecision: "continue",
    history: [{ type: "created", date: world.date, mode }],
  };
  return commit(world, {
    eventType: "protection.created",
    actors: [providerId, ownerId],
    subjects: [arrangementId, businessId],
    location: districtId,
    payload: { arrangement },
    visibility: "local",
  });
}

export function resolveProtectionCycle(
  world,
  {
    expectedRevision,
    arrangementId,
    collectorId,
    treatment = "respectful",
    paymentStatus = "paid",
    serviceDelivered = true,
    observedByPolice = false,
    competitorAction = "none",
    ownerDecision = "continue",
  },
) {
  assertExpectedRevision(world, { expectedRevision });
  const arrangement = requireProtectionArrangement(world, arrangementId);
  const business = requireBusiness(world, arrangement.businessId);
  assertNonEmptyString(collectorId, "collectorId");
  if (collectorId !== arrangement.providerId) {
    throw new InvalidCommandError("collector is not authorized by the protection arrangement");
  }
  if (!["respectful", "pressured", "humiliating", "protective", "absent"].includes(treatment)) {
    throw new InvalidCommandError(`unsupported protection treatment: ${treatment}`);
  }
  if (!["paid", "missed", "disputed", "waived"].includes(paymentStatus)) {
    throw new InvalidCommandError(`unsupported protection payment status: ${paymentStatus}`);
  }
  if (!["none", "rival-claim"].includes(competitorAction)) {
    throw new InvalidCommandError(`unsupported competitor action: ${competitorAction}`);
  }
  if (!["continue", "report", "flee", "rival", "partner", "request-help"].includes(ownerDecision)) {
    throw new InvalidCommandError(`unsupported owner decision: ${ownerDecision}`);
  }
  assertBoolean(serviceDelivered, "serviceDelivered");
  assertBoolean(observedByPolice, "observedByPolice");
  if (business.condition === "closed" && paymentStatus === "paid") {
    throw new InvalidCommandError("closed business cannot complete a paid protection cycle");
  }
  if (arrangement.status === "ended") throw new InvalidCommandError(`protection arrangement is ended: ${arrangementId}`);
  const delta = protectionTreatmentDelta(treatment);
  const nextArrangement = {
    ...clone(arrangement),
    trust: bounded(arrangement.trust + delta.trust + (serviceDelivered ? 2 : -1) + (ownerDecision === "partner" ? 6 : 0)),
    fear: bounded(arrangement.fear + delta.fear + (ownerDecision === "report" ? -5 : 0)),
    resentment: bounded(arrangement.resentment + delta.resentment + (paymentStatus === "missed" ? 3 : 0)),
    policeExposure: bounded(arrangement.policeExposure + (observedByPolice ? 15 : 0)),
    vulnerability: bounded(arrangement.vulnerability + (serviceDelivered ? -2 : 4)),
    missedPayments: arrangement.missedPayments + (paymentStatus === "missed" ? 1 : 0),
    completedCycles: arrangement.completedCycles + 1,
    daysSinceReview: 0,
    lastPaymentStatus: paymentStatus,
    lastTreatment: treatment,
    lastOwnerDecision: ownerDecision,
    history: [
      ...arrangement.history,
      {
        type: "cycle",
        date: world.date,
        collectorId,
        treatment,
        paymentStatus,
        serviceDelivered,
        observedByPolice,
        competitorAction,
        ownerDecision,
      },
    ],
  };
  if (ownerDecision === "partner") nextArrangement.mode = "partnership";
  if (competitorAction === "rival-claim" || ownerDecision === "rival") nextArrangement.status = "disputed";
  if (["report", "flee"].includes(ownerDecision)) nextArrangement.status = "ended";
  if (ownerDecision === "request-help") nextArrangement.vulnerability = bounded(nextArrangement.vulnerability - 5);
  const businessImpact = protectionBusinessImpact({
    treatment,
    paymentStatus,
    serviceDelivered,
    previousReputation: business.reputation,
  });
  const nextBusiness = {
    ...clone(business),
    reputation: businessImpact.nextReputation,
    condition: businessImpact.nextCondition,
  };
  return commit(world, {
    eventType: "protection.cycle_resolved",
    actors: [collectorId, arrangement.ownerId],
    subjects: [arrangementId, arrangement.businessId],
    location: arrangement.districtId,
    payload: {
      arrangementId,
      businessId: arrangement.businessId,
      nextArrangement,
      nextBusiness,
      cycle: {
        treatment,
        paymentStatus,
        serviceDelivered,
        observedByPolice,
        competitorAction,
        ownerDecision,
      },
    },
    visibility: "local",
  });
}

export function disputeProtectionClaim(
  world,
  { expectedRevision, arrangementId, claimantId, reason = "rival-claim" },
) {
  assertExpectedRevision(world, { expectedRevision });
  const arrangement = requireProtectionArrangement(world, arrangementId);
  assertNonEmptyString(claimantId, "claimantId");
  if (!["rival-claim", "owner-request"].includes(reason)) {
    throw new InvalidCommandError(`unsupported protection dispute reason: ${reason}`);
  }
  if (arrangement.status === "ended") throw new InvalidCommandError(`protection arrangement is ended: ${arrangementId}`);
  const nextArrangement = {
    ...clone(arrangement),
    status: "disputed",
    competitorPressure: bounded(arrangement.competitorPressure + 20),
    history: [
      ...arrangement.history,
      { type: "claim-disputed", date: world.date, claimantId, reason },
    ],
  };
  return commit(world, {
    eventType: "protection.claim_disputed",
    actors: [claimantId],
    subjects: [arrangementId, arrangement.businessId],
    location: arrangement.districtId,
    payload: { arrangementId, nextArrangement, claimantId, reason },
    visibility: "local",
  });
}

function requireSurveillance(world, surveillanceId) {
  assertNonEmptyString(surveillanceId, "surveillanceId");
  const record = world.surveillance[surveillanceId];
  if (!record) throw new InvalidCommandError(`unknown surveillance record: ${surveillanceId}`);
  return record;
}

export function startSurveillance(
  world,
  {
    expectedRevision,
    surveillanceId,
    observerId,
    targetId,
    locationId,
    visibility = 0,
    sound = 0,
    accessState = "public",
    entryMethod = "observation",
    timeWindowDays = 1,
  },
) {
  assertExpectedRevision(world, { expectedRevision });
  assertNonEmptyString(surveillanceId, "surveillanceId");
  assertNonEmptyString(observerId, "observerId");
  assertNonEmptyString(targetId, "targetId");
  assertNonEmptyString(locationId, "locationId");
  assertRange(visibility, "visibility", 0, 100);
  assertRange(sound, "sound", 0, 100);
  assertRange(timeWindowDays, "timeWindowDays", 1, 30);
  if (!["public", "restricted", "unknown"].includes(accessState)) {
    throw new InvalidCommandError(`unsupported access state: ${accessState}`);
  }
  assertNonEmptyString(entryMethod, "entryMethod");
  if (world.surveillance[surveillanceId]) throw new InvalidCommandError(`surveillance already exists: ${surveillanceId}`);
  const record = {
    id: surveillanceId,
    observerId,
    targetId,
    locationId,
    visibility,
    sound,
    accessState,
    entryMethod,
    timeWindowDays,
    status: "active",
    witnessState: "none",
    counterSurveillance: 0,
    knownRoutineId: null,
    routineConfidence: 0,
    informationGained: [],
    stalenessDays: 0,
    scheduleStatus: "unknown",
    startedOn: world.date,
  };
  return commit(world, {
    eventType: "surveillance.started",
    actors: [observerId],
    subjects: [targetId, surveillanceId],
    location: locationId,
    payload: { record },
    visibility: "observer-scoped",
  });
}

export function recordSurveillanceObservation(
  world,
  {
    expectedRevision,
    surveillanceId,
    observerId,
    knownRoutineId = null,
    routineConfidence = null,
    informationGained = [],
    witnessState = "none",
    counterSurveillance = 0,
  },
) {
  assertExpectedRevision(world, { expectedRevision });
  const record = requireSurveillance(world, surveillanceId);
  assertNonEmptyString(observerId, "observerId");
  if (record.observerId !== observerId) throw new InvalidCommandError(`observer does not own surveillance record: ${surveillanceId}`);
  if (knownRoutineId !== null) assertNonEmptyString(knownRoutineId, "knownRoutineId");
  if (routineConfidence !== null) assertRange(routineConfidence, "routineConfidence", 0, 100);
  const normalizedInformation = normalizeStringArray(informationGained, "informationGained");
  if (!["none", "uncertain", "noticed", "withdrawn"].includes(witnessState)) {
    throw new InvalidCommandError(`unsupported witness state: ${witnessState}`);
  }
  assertRange(counterSurveillance, "counterSurveillance", 0, 100);
  const nextRecord = {
    ...clone(record),
    knownRoutineId: knownRoutineId ?? record.knownRoutineId,
    routineConfidence: routineConfidence ?? record.routineConfidence,
    informationGained: [...new Set([...record.informationGained, ...normalizedInformation])],
    witnessState,
    counterSurveillance,
    stalenessDays: 0,
    scheduleStatus: knownRoutineId === null ? record.scheduleStatus : "current",
    lastObservedOn: world.date,
  };
  return commit(world, {
    eventType: "surveillance.updated",
    actors: [observerId],
    subjects: [record.targetId, surveillanceId],
    location: record.locationId,
    payload: { surveillanceId, nextRecord, observation: { knownRoutineId, informationGained: normalizedInformation } },
    visibility: "observer-scoped",
  });
}

export function interruptSurveillance(
  world,
  { expectedRevision, surveillanceId, observerId, outcome = "withdrawn" },
) {
  assertExpectedRevision(world, { expectedRevision });
  const record = requireSurveillance(world, surveillanceId);
  assertNonEmptyString(observerId, "observerId");
  if (record.observerId !== observerId) throw new InvalidCommandError(`observer does not own surveillance record: ${surveillanceId}`);
  if (!["uncertain", "noticed", "withdrawn"].includes(outcome)) {
    throw new InvalidCommandError(`unsupported surveillance interruption: ${outcome}`);
  }
  const nextRecord = {
    ...clone(record),
    status: "interrupted",
    witnessState: outcome,
    endedOn: world.date,
  };
  return commit(world, {
    eventType: "surveillance.interrupted",
    actors: [observerId],
    subjects: [record.targetId, surveillanceId],
    location: record.locationId,
    payload: { surveillanceId, nextRecord, outcome },
    visibility: "observer-scoped",
  });
}

export function resolveTraversalAction(
  world,
  {
    expectedRevision,
    actionId,
    actorId,
    fromLocationId,
    toLocationId,
    routeIds,
    mode = "walk",
    noise = 0,
    risk = 0,
    conditionCost = 0,
    familiarity = "unknown",
    outcome = "completed",
  },
) {
  assertExpectedRevision(world, { expectedRevision });
  assertNonEmptyString(actionId, "actionId");
  assertNonEmptyString(actorId, "actorId");
  assertNonEmptyString(fromLocationId, "fromLocationId");
  assertNonEmptyString(toLocationId, "toLocationId");
  const normalizedRoutes = normalizeStringArray(routeIds, "routeIds");
  if (normalizedRoutes.length === 0) throw new InvalidCommandError("routeIds must contain at least one route");
  assertNonEmptyString(mode, "mode");
  assertRange(noise, "noise", 0, 100);
  assertRange(risk, "risk", 0, 100);
  assertRange(conditionCost, "conditionCost", 0, 100);
  if (!["known", "partial", "unknown"].includes(familiarity)) {
    throw new InvalidCommandError(`unsupported traversal familiarity: ${familiarity}`);
  }
  if (!["completed", "interrupted", "blocked"].includes(outcome)) {
    throw new InvalidCommandError(`unsupported traversal outcome: ${outcome}`);
  }
  const action = {
    id: actionId,
    type: "traversal",
    actorId,
    fromLocationId,
    toLocationId,
    routeIds: normalizedRoutes,
    mode,
    noise,
    risk,
    conditionCost,
    familiarity,
    outcome,
    date: world.date,
  };
  return commit(world, {
    eventType: "action.traversal_resolved",
    actors: [actorId],
    subjects: [actionId, fromLocationId, toLocationId],
    location: toLocationId,
    payload: { action },
    visibility: "local",
  });
}

export function resolveMeleeEncounter(
  world,
  {
    expectedRevision,
    actionId,
    actorId,
    opponentIds,
    style = "improvised",
    outcome,
    locationId,
    staminaCost = 0,
    injuryDelta = 0,
    environmentContact = null,
    witnessCount = 0,
  },
) {
  assertExpectedRevision(world, { expectedRevision });
  assertNonEmptyString(actionId, "actionId");
  assertNonEmptyString(actorId, "actorId");
  assertNonEmptyString(locationId, "locationId");
  const opponents = normalizeIds(opponentIds, "opponentIds");
  if (opponents.length === 0) throw new InvalidCommandError("opponentIds must contain at least one opponent");
  assertNonEmptyString(style, "style");
  if (!["escaped", "disengaged", "injured", "dominant"].includes(outcome)) {
    throw new InvalidCommandError(`unsupported melee outcome: ${outcome}`);
  }
  assertRange(staminaCost, "staminaCost", 0, 100);
  assertRange(injuryDelta, "injuryDelta", 0, 100);
  assertRange(witnessCount, "witnessCount", 0, 100);
  if (environmentContact !== null) assertNonEmptyString(environmentContact, "environmentContact");
  const character = world.characters[actorId];
  const nextCondition = character
    ? {
        fatigue: Math.min(100, character.condition.fatigue + staminaCost),
        injury: Math.min(100, character.condition.injury + injuryDelta),
        healthState: injuryDelta > 0 ? "injured" : character.condition.healthState,
      }
    : null;
  const action = {
    id: actionId,
    type: "melee",
    actorId,
    opponentIds: opponents,
    style,
    outcome,
    locationId,
    staminaCost,
    injuryDelta,
    environmentContact,
    witnessCount,
    date: world.date,
  };
  return commit(world, {
    eventType: "action.melee_resolved",
    actors: [actorId, ...opponents],
    subjects: [actionId],
    location: locationId,
    payload: { action, actorId, nextCondition },
    visibility: "local",
  });
}

function requireVehicle(world, vehicleId) {
  assertNonEmptyString(vehicleId, "vehicleId");
  const vehicle = world.vehicles[vehicleId];
  if (!vehicle) throw new InvalidCommandError(`unknown vehicle: ${vehicleId}`);
  return vehicle;
}

export function createVehicle(
  world,
  {
    expectedRevision,
    vehicleId,
    vehicleClass = "hatchback",
    mass,
    handling,
    ownerId = null,
    tires = "standard",
    damage = 0,
    locationId,
  },
) {
  assertExpectedRevision(world, { expectedRevision });
  assertNonEmptyString(vehicleId, "vehicleId");
  assertNonEmptyString(vehicleClass, "vehicleClass");
  assertRange(mass, "mass", 1, 100);
  assertRange(handling, "handling", 0, 100);
  assertNonEmptyString(tires, "tires");
  assertRange(damage, "damage", 0, 100);
  assertNonEmptyString(locationId, "locationId");
  if (ownerId !== null) assertNonEmptyString(ownerId, "ownerId");
  if (world.vehicles[vehicleId]) throw new InvalidCommandError(`vehicle already exists: ${vehicleId}`);
  const vehicle = {
    id: vehicleId,
    vehicleClass,
    mass,
    handling,
    ownerId,
    holderId: ownerId,
    tires,
    damage,
    condition: damage >= 100 ? "retired" : damage > 0 ? "damaged" : "intact",
    locationId,
    status: "held",
    ownerHistory: ownerId ? [{ ownerId, date: world.date, reason: "origin" }] : [],
    plateHistory: [],
    serviceHistory: [],
    storageHistory: [],
    policeInterest: 0,
    marketDemand: 0,
    recognitionRisk: 0,
    trophyTags: [],
    driverFamiliarity: {},
    pursuitHistory: [],
    observerSignals: [],
  };
  return commit(world, {
    eventType: "vehicle.created",
    actors: [ownerId ?? "system:vehicle"],
    subjects: [vehicleId],
    location: locationId,
    payload: { vehicle },
    visibility: "local",
  });
}

export function resolveVehicleAction(
  world,
  {
    expectedRevision,
    actionId,
    vehicleId,
    driverId,
    locationId,
    surface,
    speedBand = "steady",
    damageDelta = 0,
    outcome = "continued",
    observerSignal = null,
  },
) {
  assertExpectedRevision(world, { expectedRevision });
  const vehicle = requireVehicle(world, vehicleId);
  assertNonEmptyString(actionId, "actionId");
  assertNonEmptyString(driverId, "driverId");
  assertNonEmptyString(locationId, "locationId");
  assertNonEmptyString(surface, "surface");
  assertNonEmptyString(speedBand, "speedBand");
  if (!Number.isInteger(damageDelta) || damageDelta < 0 || damageDelta > 100) {
    throw new InvalidCommandError("damageDelta must be an integer between 0 and 100");
  }
  if (!["continued", "switched", "disabled", "retired"].includes(outcome)) {
    throw new InvalidCommandError(`unsupported vehicle outcome: ${outcome}`);
  }
  if (observerSignal !== null) assertNonEmptyString(observerSignal, "observerSignal");
  if (vehicle.condition === "retired") throw new InvalidCommandError(`vehicle is retired: ${vehicleId}`);
  const nextDamage = Math.min(100, vehicle.damage + damageDelta);
  const nextVehicle = {
    ...clone(vehicle),
    damage: nextDamage,
    condition: nextDamage >= 100 || outcome === "retired" ? "retired" : nextDamage > 0 ? "damaged" : vehicle.condition,
    locationId,
    driverFamiliarity: {
      ...vehicle.driverFamiliarity,
      [driverId]: Math.min(100, (vehicle.driverFamiliarity[driverId] ?? 0) + 1),
    },
    pursuitHistory: [
      ...vehicle.pursuitHistory,
      { actionId, driverId, locationId, surface, speedBand, damageDelta, outcome, date: world.date },
    ],
    observerSignals: observerSignal === null
      ? vehicle.observerSignals
      : [...vehicle.observerSignals, { signal: observerSignal, locationId, date: world.date }],
  };
  const action = {
    id: actionId,
    type: "vehicle",
    vehicleId,
    driverId,
    locationId,
    surface,
    speedBand,
    outcome,
    damageDelta,
    date: world.date,
  };
  return commit(world, {
    eventType: "vehicle.action_resolved",
    actors: [driverId],
    subjects: [vehicleId, actionId],
    location: locationId,
    payload: { vehicleId, nextVehicle, action },
    visibility: "local",
  });
}

export function advanceVehicleProvenance(
  world,
  {
    expectedRevision,
    vehicleId,
    actorId,
    transition,
    locationId = null,
    recipientId = null,
    newOwnerId = null,
    appearanceBand = null,
    serviceLabel = null,
    repairDelta = 0,
    policeInterestDelta = 0,
    marketDemandDelta = 0,
    recognitionRiskDelta = 0,
    evidenceSignal = "none",
    trophyTag = null,
  },
) {
  assertExpectedRevision(world, { expectedRevision });
  const vehicle = requireVehicle(world, vehicleId);
  assertNonEmptyString(actorId, "actorId");
  assertNonEmptyString(transition, "transition");
  if (![
    "theft",
    "storage",
    "service",
    "repaint",
    "fence",
    "chop",
    "transfer",
    "resale",
    "trophy",
    "return",
  ].includes(transition)) throw new InvalidCommandError(`unsupported vehicle provenance transition: ${transition}`);
  if (locationId !== null) assertNonEmptyString(locationId, "locationId");
  if (recipientId !== null) assertNonEmptyString(recipientId, "recipientId");
  if (newOwnerId !== null) assertNonEmptyString(newOwnerId, "newOwnerId");
  if (appearanceBand !== null) assertNonEmptyString(appearanceBand, "appearanceBand");
  if (serviceLabel !== null) assertNonEmptyString(serviceLabel, "serviceLabel");
  if (trophyTag !== null) assertNonEmptyString(trophyTag, "trophyTag");
  assertRange(repairDelta, "repairDelta", 0, 100);
  if (!Number.isInteger(policeInterestDelta) || policeInterestDelta < -100 || policeInterestDelta > 100) {
    throw new InvalidCommandError("policeInterestDelta must be an integer between -100 and 100");
  }
  if (!Number.isInteger(marketDemandDelta) || marketDemandDelta < -100 || marketDemandDelta > 100) {
    throw new InvalidCommandError("marketDemandDelta must be an integer between -100 and 100");
  }
  if (!Number.isInteger(recognitionRiskDelta) || recognitionRiskDelta < -100 || recognitionRiskDelta > 100) {
    throw new InvalidCommandError("recognitionRiskDelta must be an integer between -100 and 100");
  }
  assertNonEmptyString(evidenceSignal, "evidenceSignal");
  if (vehicle.condition === "retired") throw new InvalidCommandError(`vehicle is retired: ${vehicleId}`);
  if (transition === "resale" && newOwnerId === null) throw new InvalidCommandError("resale requires newOwnerId");
  if (transition === "transfer" && recipientId === null) throw new InvalidCommandError("transfer requires recipientId");
  if (transition === "repaint" && appearanceBand === null) throw new InvalidCommandError("repaint requires appearanceBand");
  if (transition === "service" && serviceLabel === null) throw new InvalidCommandError("service requires serviceLabel");
  if (transition === "trophy" && actorId !== vehicle.ownerId && actorId !== vehicle.holderId) {
    throw new InvalidCommandError("trophy transition requires the current owner or holder");
  }
  if (transition === "return" && vehicle.ownerId === null) {
    throw new InvalidCommandError("vehicle without an owner cannot be returned");
  }
  const nextVehicle = clone(vehicle);
  nextVehicle.locationId = locationId ?? vehicle.locationId;
  nextVehicle.policeInterest = Math.max(0, Math.min(100, vehicle.policeInterest + policeInterestDelta));
  nextVehicle.marketDemand = Math.max(0, Math.min(100, vehicle.marketDemand + marketDemandDelta));
  nextVehicle.recognitionRisk = Math.max(0, Math.min(100, vehicle.recognitionRisk + recognitionRiskDelta));
  if (transition === "theft") {
    nextVehicle.status = "stolen";
    nextVehicle.holderId = actorId;
  } else if (transition === "storage") {
    nextVehicle.status = "stored";
    nextVehicle.storageHistory.push({ holderId: vehicle.holderId ?? actorId, locationId: nextVehicle.locationId, date: world.date });
  } else if (transition === "service") {
    nextVehicle.damage = Math.max(0, vehicle.damage - repairDelta);
    nextVehicle.condition = nextVehicle.damage === 0 ? "intact" : "damaged";
    nextVehicle.serviceHistory.push({ label: serviceLabel, repairDelta, date: world.date });
  } else if (transition === "repaint") {
    nextVehicle.plateHistory.push({ appearanceBand, date: world.date, reason: "appearance-change" });
  } else if (transition === "fence" || transition === "chop") {
    nextVehicle.status = "processed";
    nextVehicle.holderId = recipientId ?? actorId;
  } else if (transition === "transfer") {
    nextVehicle.ownerId = recipientId;
    nextVehicle.holderId = recipientId;
    nextVehicle.status = "held";
    nextVehicle.ownerHistory.push({ ownerId: recipientId, date: world.date, reason: "transfer" });
  } else if (transition === "resale") {
    nextVehicle.ownerId = newOwnerId;
    nextVehicle.holderId = newOwnerId;
    nextVehicle.status = "held";
    nextVehicle.ownerHistory.push({ ownerId: newOwnerId, date: world.date, reason: "resale" });
  } else if (transition === "trophy") {
    nextVehicle.status = "trophy";
    nextVehicle.trophyTags = trophyTag === null
      ? nextVehicle.trophyTags
      : [...new Set([...nextVehicle.trophyTags, trophyTag])];
  } else if (transition === "return") {
    nextVehicle.status = "held";
    nextVehicle.holderId = vehicle.ownerId;
  }
  nextVehicle.provenanceHistory = [
    ...(vehicle.provenanceHistory ?? []),
    {
      transition,
      actorId,
      locationId: nextVehicle.locationId,
      recipientId,
      newOwnerId,
      evidenceSignal,
      date: world.date,
    },
  ];
  return commit(world, {
    eventType: "vehicle.provenance_advanced",
    actors: [actorId, ...(recipientId ? [recipientId] : []), ...(newOwnerId ? [newOwnerId] : [])],
    subjects: [vehicleId],
    location: nextVehicle.locationId,
    payload: {
      vehicleId,
      transition,
      evidenceSignal,
      nextVehicle,
    },
    visibility: "local",
  });
}

export function recordEvent(
  world,
  {
    expectedRevision,
    eventType,
    actors = [],
    subjects = [],
    location = null,
    cause = null,
    payload = {},
    visibility = "local",
  },
) {
  assertExpectedRevision(world, { expectedRevision });
  assertNonEmptyString(eventType, "eventType");
  const normalizedActors = normalizeIds(actors, "actors");
  const normalizedSubjects = normalizeIds(subjects, "subjects");
  if (location !== null) assertNonEmptyString(location, "location");
  if (cause !== null) assertNonEmptyString(cause, "cause");
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new InvalidCommandError("payload must be an object");
  }
  assertNonEmptyString(visibility, "visibility");
  return commit(world, {
    eventType,
    actors: normalizedActors,
    subjects: normalizedSubjects,
    location,
    cause,
    payload: clone(payload),
    visibility,
  });
}

export function snapshot(world) {
  return {
    snapshotVersion: 1,
    engineSchemaVersion: ENGINE_SCHEMA_VERSION,
    world: clone(world),
  };
}

export function restore(snapshotValue) {
  if (!snapshotValue || snapshotValue.snapshotVersion !== 1) {
    throw new InvalidCommandError("unsupported snapshot version");
  }
  const savedWorld = snapshotValue.world;
  if (!savedWorld || savedWorld.schemaVersion !== ENGINE_SCHEMA_VERSION) {
    throw new InvalidCommandError("unsupported engine schema version");
  }
  const base = createInitialWorld({ worldId: savedWorld.worldId, startDate: savedWorld.startDate });
  let rebuilt = base;
  for (const event of savedWorld.events) rebuilt = reduceEvent(rebuilt, event);
  if (canonicalJson(rebuilt) !== canonicalJson(savedWorld)) {
    throw new InvalidCommandError("snapshot state does not match its event history");
  }
  return rebuilt;
}

export function inspect(world) {
  return {
    worldId: world.worldId,
    date: world.date,
    tick: world.tick,
    revision: world.revision,
    district: clone(world.district),
    eventCount: world.events.length,
    lastEventHash: world.lastEventHash,
  };
}
