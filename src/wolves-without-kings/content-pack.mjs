import { createDistrictFixture } from "./district.mjs";

export const VERTICAL_CONTENT_PACK_VERSION = 1;

const LOCATION_ACCESS = {
  "loc:market-street": ["walk"],
  "loc:night-market": ["walk", "staff"],
  "loc:lantern-rooftop": ["climb"],
  "loc:motel-lobby": ["walk"],
  "loc:motel-service-yard": ["service"],
  "loc:tram-underpass": ["service"],
  "loc:community-clinic": ["walk"],
  "loc:river-walk": ["walk"],
};

function residents(regionId) {
  return Array.from({ length: 30 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return {
      id: `npc:resident-${number}`,
      displayName: `Resident ${number}`,
      regionId,
      occupation: index % 3 === 0 ? "shopkeeper" : index % 3 === 1 ? "driver" : "night-worker",
    };
  });
}

export function buildVerticalContentPack() {
  const fixture = createDistrictFixture();
  const regionId = "region:sofia-south";
  const routeModes = new Map(fixture.routes.map((route) => [route.id, route.mode]));
  const locations = fixture.locations.map((location) => ({
    id: location.id,
    label: location.label,
    regionId,
    layer: location.layer,
    accessModes: LOCATION_ACCESS[location.id],
  }));
  const routes = fixture.routes.map((route) => ({
    id: route.id,
    fromLocationId: route.from,
    toLocationId: route.to,
    movementModes: [route.mode],
    public: route.public,
  }));
  const npcs = residents(regionId);
  const businesses = [
    { id: "business:night-market", label: "Night Market Hall", regionId, locationId: "loc:night-market", sector: "nightlife" },
    { id: "business:south-ring-motel", label: "South Ring Motel", regionId, locationId: "loc:motel-lobby", sector: "lodging" },
    { id: "business:river-cafe", label: "River Cafe", regionId, locationId: "loc:river-walk", sector: "cafe" },
  ];
  const organizations = [
    { id: "org:lantern-circle", displayName: "Lantern Circle", regionIds: [regionId], memberIds: ["npc:resident-04"] },
    { id: "org:river-crew", displayName: "River Crew", regionIds: [regionId], memberIds: ["npc:resident-07", "npc:resident-08"] },
  ];
  const scheduleTemplates = npcs.map((npc, index) => ({
    id: `schedule:${npc.id}`,
    actorId: npc.id,
    locationId: index % 2 === 0 ? "loc:market-street" : "loc:night-market",
    startHour: index % 2 === 0 ? 8 : 18,
    endHour: index % 2 === 0 ? 16 : 2,
  }));
  return {
    packVersion: VERTICAL_CONTENT_PACK_VERSION,
    packId: "pack:sofia-south-vertical",
    safetyBoundary: "fictionalized social consequence and abstracted systems; no transferable criminal procedure",
    regions: [{ id: regionId, label: "South Sofia", mode: "full" }],
    npcs,
    businesses,
    organizations,
    locations,
    routes,
    scheduleTemplates,
    eraVariants: {
      "late-1990s": [
        { id: "variant:night-market-sign-1998", baseId: "loc:night-market", label: "late-1990s venue signage" },
        { id: "variant:tram-underpass-1998", baseId: "route:yard-to-underpass", label: `late-1990s ${routeModes.get("route:yard-to-underpass")} route treatment` },
      ],
    },
  };
}
