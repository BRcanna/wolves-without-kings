import { createContentRegistry, admitContentPack, projectContent } from "./content.mjs";

export const REGIONAL_CONTENT_PACK_VERSION = 1;

const REGIONS = [
  { id: "region:capital", label: "Capital Network (fictionalized)", mode: "full" },
  { id: "region:coast", label: "Coastal Network (fictionalized)", mode: "aggregate" },
  { id: "region:rural", label: "Rural Network (fictionalized)", mode: "aggregate" },
  { id: "region:mountain", label: "Mountain Network (fictionalized)", mode: "aggregate" },
];

const LOCATIONS = [
  ["loc:capital-station", "Capital Station", "region:capital", "transit", ["walk", "rail"]],
  ["loc:capital-market", "Capital Market", "region:capital", "commercial", ["walk", "service"]],
  ["loc:coast-port", "Coastal Port Edge", "region:coast", "industrial", ["walk", "service"]],
  ["loc:coast-guesthouse", "Coastal Guesthouse", "region:coast", "hospitality", ["walk", "staff"]],
  ["loc:rural-town", "Rural Town Center", "region:rural", "community", ["walk", "road"]],
  ["loc:rural-warehouse", "Rural Warehouse", "region:rural", "industrial", ["walk", "service"]],
  ["loc:mountain-pass", "Mountain Pass", "region:mountain", "route", ["walk", "road"]],
  ["loc:mountain-hamlet", "Mountain Hamlet", "region:mountain", "community", ["walk", "road"]],
];

function buildResidents() {
  const occupations = ["teacher", "mechanic", "nurse", "shopkeeper", "driver", "seasonal-worker"];
  return REGIONS.flatMap((region, regionIndex) => Array.from({ length: 3 }, (_, index) => ({
    id: `npc:regional-${region.id.split(":")[1]}-${String(index + 1).padStart(2, "0")}`,
    displayName: `${region.label.split(" ")[0]} Resident ${index + 1}`,
    regionId: region.id,
    occupation: occupations[(regionIndex * 3 + index) % occupations.length],
  })));
}

export function buildRegionalContentPack() {
  const npcs = buildResidents();
  const locations = LOCATIONS.map(([id, label, regionId, layer, accessModes]) => ({ id, label, regionId, layer, accessModes }));
  const locationById = Object.fromEntries(locations.map((location) => [location.id, location]));
  const routes = [
    ["route:capital-to-coast", "loc:capital-station", "loc:coast-port", ["rail"]],
    ["route:coast-to-rural", "loc:coast-port", "loc:rural-town", ["road"]],
    ["route:rural-to-mountain", "loc:rural-town", "loc:mountain-pass", ["road"]],
    ["route:mountain-to-hamlet", "loc:mountain-pass", "loc:mountain-hamlet", ["road", "walk"]],
  ].map(([id, fromLocationId, toLocationId, movementModes]) => ({ id, fromLocationId, toLocationId, movementModes, public: true }));
  const businesses = [
    { id: "business:capital-repair", label: "Capital Repair Cooperative", regionId: "region:capital", locationId: "loc:capital-market", sector: "repair" },
    { id: "business:coast-guesthouse", label: "Coastal Guesthouse", regionId: "region:coast", locationId: "loc:coast-guesthouse", sector: "hospitality" },
    { id: "business:rural-market", label: "Rural Market Hall", regionId: "region:rural", locationId: "loc:rural-town", sector: "market" },
    { id: "business:mountain-workshop", label: "Mountain Workshop", regionId: "region:mountain", locationId: "loc:mountain-hamlet", sector: "repair" },
  ];
  const organizations = [
    { id: "organization:lanterns", displayName: "Lanterns (fictional organization)", regionIds: ["region:capital", "region:coast"], memberIds: [] },
    { id: "organization:rivals", displayName: "Rivals (fictional organization)", regionIds: ["region:coast", "region:rural"], memberIds: [] },
  ];
  const scheduleTemplates = npcs.map((npc, index) => ({
    id: `schedule:${npc.id}`,
    actorId: npc.id,
    locationId: locations[index % locations.length].id,
    startHour: index % 2 === 0 ? 8 : 18,
    endHour: index % 2 === 0 ? 16 : 2,
  }));
  return {
    packVersion: REGIONAL_CONTENT_PACK_VERSION,
    packId: "pack:regional-vertical-b",
    safetyBoundary: "fictionalized ordinary life, social consequence, and abstracted regional systems; no transferable criminal procedure",
    regions: REGIONS,
    npcs,
    businesses,
    organizations,
    locations,
    routes,
    scheduleTemplates,
    eraVariants: {
      "late-1990s": [
        { id: "variant:capital-station-1998", baseId: "loc:capital-station", label: "late-1990s station signage" },
        { id: "variant:coast-port-1998", baseId: "loc:coast-port", label: "late-1990s port-front treatment" },
        { id: "variant:rural-market-1998", baseId: "business:rural-market", label: "late-1990s market materials" },
        { id: "variant:mountain-route-1998", baseId: "route:rural-to-mountain", label: "late-1990s route treatment" },
      ],
    },
    metadata: { ordinaryLifeRoles: ["school", "repair", "health", "market", "transport", "seasonal-work"] },
    locationById,
  };
}

export function admitRegionalContentPack({ simulationDate = "1999-01-01" } = {}) {
  const pack = buildRegionalContentPack();
  let state = createContentRegistry({ packId: pack.packId, simulationDate });
  state = admitContentPack(state, { expectedRevision: state.revision, ...pack });
  return { pack, state, projection: projectContent(state) };
}

export function assertRegionalContentMatchesRuntime(pack, runtime) {
  if (!pack || pack.packId !== "pack:regional-vertical-b") throw new Error("unexpected regional content pack");
  if (!runtime?.geography?.regions || !runtime?.underworld?.organizations) throw new Error("regional runtime is missing geography or organization state");
  const regionIds = new Set(Object.keys(runtime.geography.regions));
  for (const region of pack.regions) if (!regionIds.has(region.id)) throw new Error(`regional content references unknown geography region: ${region.id}`);
  for (const organization of pack.organizations) if (!runtime.underworld.organizations[organization.id]) throw new Error(`regional content references unknown organization: ${organization.id}`);
  return {
    regions: pack.regions.length,
    npcs: pack.npcs.length,
    businesses: pack.businesses.length,
    organizations: pack.organizations.length,
    locations: pack.locations.length,
    routes: pack.routes.length,
    scheduleTemplates: pack.scheduleTemplates.length,
  };
}
