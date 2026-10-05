function clone(value) {
  return structuredClone(value);
}

function publicBusiness(business) {
  return {
    id: business.id,
    displayName: business.displayName,
    locationId: business.locationId,
    venueType: business.venueType,
    condition: business.condition,
    reputationBand: business.reputation >= 20 ? "strong" : business.reputation <= -20 ? "strained" : "steady",
    ageDays: business.ageDays,
  };
}

function publicMarket(market) {
  return {
    id: market.id,
    regionId: market.regionId,
    commodity: market.commodity,
    priceBand: clone(market.priceBand),
    informationLagDays: market.informationLagDays,
  };
}

function protectionRelationshipBand(arrangement) {
  if (arrangement.status === "disputed") return "contested";
  if (arrangement.trust >= 40 && arrangement.resentment <= 20) return "cooperative";
  if (arrangement.fear >= 50 || arrangement.resentment >= 50) return "fragile";
  return "strained";
}

function baseProjection(world) {
  return {
    projectionVersion: 1,
    scope: "public",
    worldId: world.worldId,
    date: world.date,
    tick: world.tick,
    district: clone(world.district),
    businesses: Object.values(world.businesses).map(publicBusiness),
    markets: Object.values(world.markets).map(publicMarket),
    protectionArrangements: Object.values(world.protectionArrangements).map((arrangement) => ({
      id: arrangement.id,
      businessId: arrangement.businessId,
      districtId: arrangement.districtId,
      mode: arrangement.mode,
      status: arrangement.status,
      paymentBand: arrangement.paymentBand,
      relationshipBand: protectionRelationshipBand(arrangement),
      daysActive: arrangement.daysActive,
    })),
    regions: Object.values(world.regions).map((region) => ({
      id: region.id,
      label: region.label,
      mode: region.mode,
      populationBand: region.populationBand,
      businessCount: region.businessCount,
      condition: region.condition,
      offscreenDays: region.offscreenDays,
    })),
    corridors: Object.values(world.corridors).map((corridor) => ({
      id: corridor.id,
      fromRegionId: corridor.fromRegionId,
      toRegionId: corridor.toRegionId,
      travelDays: corridor.travelDays,
      status: corridor.status,
      transportFrictionBand: corridor.transportFriction >= 60 ? "high" : corridor.transportFriction >= 25 ? "moderate" : "low",
      legalPressureBand: corridor.legalPressure >= 60 ? "high" : corridor.legalPressure >= 25 ? "moderate" : "low",
    })),
    vehicles: Object.values(world.vehicles).map((vehicle) => ({
      id: vehicle.id,
      vehicleClass: vehicle.vehicleClass,
      locationId: vehicle.locationId,
      status: vehicle.status,
      condition: vehicle.condition,
      marketDemand: vehicle.marketDemand,
      recognitionRiskBand: vehicle.recognitionRisk >= 60 ? "high" : vehicle.recognitionRisk >= 25 ? "moderate" : "low",
      trophyTags: clone(vehicle.trophyTags),
    })),
    objects: Object.values(world.objects).map((object) => ({
      id: object.id,
      objectType: object.objectType,
      currentLocationId: object.currentLocationId,
      status: object.status,
      condition: object.condition,
      trophyTags: clone(object.trophyTags),
    })),
  };
}

function actorRelationships(world, actorId) {
  return Object.fromEntries(
    Object.entries(world.relationships)
      .filter(([relationshipId]) => relationshipId.startsWith(`${actorId}|`) || relationshipId.endsWith(`|${actorId}`))
      .map(([relationshipId, relationship]) => [relationshipId, {
        trust: relationship.trust,
        respect: relationship.respect,
        familiarity: relationship.familiarity,
        relationshipAgeDays: relationship.relationshipAgeDays ?? 0,
      }]),
  );
}

function observerProjection(world, actorId) {
  const projection = baseProjection(world);
  projection.scope = "observer";
  projection.actorId = actorId;
  projection.relationships = actorRelationships(world, actorId);
  projection.beliefs = clone(world.beliefs[actorId] ?? {});
  projection.surveillance = Object.fromEntries(
    Object.entries(world.surveillance)
      .filter(([, record]) => record.observerId === actorId)
      .map(([id, record]) => [id, clone(record)]),
  );
  const character = world.characters[actorId];
  if (character) {
    projection.character = {
      id: character.id,
      displayName: character.displayName,
      background: character.background,
      condition: clone(character.condition),
      skills: Object.fromEntries(Object.entries(character.skills).map(([skill, state]) => [skill, state.tier])),
      familiarity: Object.fromEntries(Object.entries(character.familiarity).map(([contextId, state]) => [contextId, state.level])),
    };
  }
  return projection;
}

function institutionalProjection(world, agencyId) {
  const projection = baseProjection(world);
  projection.scope = "institutional";
  projection.agencyId = agencyId;
  projection.cases = Object.fromEntries(
    Object.entries(world.cases)
      .filter(([, caseFile]) => Boolean(caseFile.agencyViews[agencyId]))
      .map(([caseId, caseFile]) => {
        const view = caseFile.agencyViews[agencyId];
        return [caseId, {
          id: caseFile.id,
          matterType: caseFile.matterType,
          jurisdiction: view.jurisdiction,
          legalStage: caseFile.legalStage,
          suspects: clone(caseFile.suspects),
          knownEvidence: clone(view.knownEvidence),
          knownWitnesses: clone(view.knownWitnesses),
          authorizedActions: clone(view.authorizedActions),
        }];
      }),
  );
  return projection;
}

export function projectWorld(world, { scope = "public", actorId = null } = {}) {
  if (!["public", "observer", "institutional", "debug"].includes(scope)) {
    throw new Error(`unsupported projection scope: ${scope}`);
  }
  if (scope === "debug") return clone(world);
  if (scope === "observer") {
    if (typeof actorId !== "string" || actorId.trim() === "") throw new Error("observer projection requires actorId");
    return observerProjection(world, actorId);
  }
  if (scope === "institutional") {
    if (typeof actorId !== "string" || actorId.trim() === "") throw new Error("institutional projection requires agencyId");
    return institutionalProjection(world, actorId);
  }
  return baseProjection(world);
}
