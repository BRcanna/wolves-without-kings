const LAYERS = new Set(["street", "interior", "roof", "service"]);

export const DISTRICT_FIXTURE_VERSION = 1;

export function createDistrictFixture() {
  const locations = [
    { id: "loc:market-street", label: "Market Street", layer: "street", kind: "public-street" },
    { id: "loc:night-market", label: "Night Market Hall", layer: "interior", kind: "venue" },
    { id: "loc:lantern-rooftop", label: "Lantern Rooftop", layer: "roof", kind: "roof-space" },
    { id: "loc:motel-lobby", label: "South Ring Motel Lobby", layer: "interior", kind: "business" },
    { id: "loc:motel-service-yard", label: "Motel Service Yard", layer: "service", kind: "service-yard" },
    { id: "loc:tram-underpass", label: "Tram Underpass", layer: "service", kind: "underpass" },
    { id: "loc:community-clinic", label: "Community Clinic", layer: "interior", kind: "civic-service" },
    { id: "loc:river-walk", label: "River Walk", layer: "street", kind: "public-walk" },
  ];
  const routes = [
    { id: "route:street-to-market", from: "loc:market-street", to: "loc:night-market", mode: "walk", public: true },
    { id: "route:market-to-roof", from: "loc:night-market", to: "loc:lantern-rooftop", mode: "climb", public: false },
    { id: "route:street-to-motel", from: "loc:market-street", to: "loc:motel-lobby", mode: "walk", public: true },
    { id: "route:motel-to-yard", from: "loc:motel-lobby", to: "loc:motel-service-yard", mode: "service", public: false },
    { id: "route:yard-to-underpass", from: "loc:motel-service-yard", to: "loc:tram-underpass", mode: "service", public: false },
    { id: "route:underpass-to-river", from: "loc:tram-underpass", to: "loc:river-walk", mode: "walk", public: false },
    { id: "route:street-to-clinic", from: "loc:market-street", to: "loc:community-clinic", mode: "walk", public: true },
  ];
  const entities = [
    { id: "business:night-market", label: "Night Market Hall", kind: "business", locationId: "loc:night-market" },
    { id: "business:south-ring-motel", label: "South Ring Motel", kind: "business", locationId: "loc:motel-lobby" },
    { id: "civic:community-clinic", label: "Community Clinic", kind: "civic-service", locationId: "loc:community-clinic" },
    { id: "npc:broker-01", label: "Mila Petkova", kind: "resident", locationId: "loc:night-market" },
    { id: "npc:steward-01", label: "Ivan Stoyanov", kind: "district-steward", locationId: "loc:market-street" },
  ];
  const fixture = {
    fixtureVersion: DISTRICT_FIXTURE_VERSION,
    districtId: "district:sofia-south",
    displayName: "South Sofia",
    setting: "fictionalized Sofia-inspired district",
    safetyBoundary: "social consequence and abstracted systems; no transferable criminal procedure",
    layers: [...LAYERS],
    locations,
    routes,
    entities,
  };
  validateDistrictFixture(fixture);
  return fixture;
}

export function validateDistrictFixture(fixture) {
  if (!fixture || fixture.fixtureVersion !== DISTRICT_FIXTURE_VERSION) throw new Error("unsupported district fixture version");
  if (fixture.safetyBoundary.includes("step-by-step") || fixture.safetyBoundary.includes("recipe")) throw new Error("district fixture violates its fiction/safety boundary");
  const locationIds = new Set();
  for (const location of fixture.locations) {
    if (locationIds.has(location.id)) throw new Error(`duplicate location: ${location.id}`);
    if (!LAYERS.has(location.layer)) throw new Error(`invalid location layer: ${location.layer}`);
    locationIds.add(location.id);
  }
  const routeIds = new Set();
  for (const route of fixture.routes) {
    if (routeIds.has(route.id)) throw new Error(`duplicate route: ${route.id}`);
    if (!locationIds.has(route.from) || !locationIds.has(route.to)) throw new Error(`route references unknown location: ${route.id}`);
    routeIds.add(route.id);
  }
  const entityIds = new Set();
  for (const entity of fixture.entities) {
    if (entityIds.has(entity.id)) throw new Error(`duplicate entity: ${entity.id}`);
    if (!locationIds.has(entity.locationId)) throw new Error(`entity references unknown location: ${entity.id}`);
    entityIds.add(entity.id);
  }
  return true;
}

export function findTraversalPath(fixture, { from, to, mode = "walk" }) {
  validateDistrictFixture(fixture);
  if (from === to) return [];
  const frontier = [{ locationId: from, path: [] }];
  const visited = new Set([from]);
  while (frontier.length > 0) {
    const current = frontier.shift();
    const nextRoutes = fixture.routes
      .filter((route) => route.from === current.locationId && (route.mode === mode || route.mode === "walk"))
      .sort((a, b) => a.id.localeCompare(b.id));
    for (const route of nextRoutes) {
      if (visited.has(route.to)) continue;
      const path = [...current.path, route.id];
      if (route.to === to) return path;
      visited.add(route.to);
      frontier.push({ locationId: route.to, path });
    }
  }
  return null;
}
