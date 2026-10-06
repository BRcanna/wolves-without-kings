import { mkdir, writeFile } from "node:fs/promises";
import { admitContentPack, createContentRegistry, projectContent } from "../src/wolves-without-kings/content.mjs";
import { assertVerticalContentMatchesWorld, buildVerticalContentPack } from "../src/wolves-without-kings/content-pack.mjs";
import { admitScenarioPack, buildVerticalScenarioPack, createScenarioRegistry, projectScenario } from "../src/wolves-without-kings/scenario-pack.mjs";
import { projectWorld } from "../src/wolves-without-kings/projection.mjs";
import { buildUiProjection } from "../src/wolves-without-kings/ui-projection.mjs";
import { runVerticalHistory } from "../src/wolves-without-kings/vertical-slice.mjs";

const { world, summary } = runVerticalHistory("relationship");
const projection = projectWorld(world, { scope: "public" });
const playerContacts = Object.entries(world.relationships)
  .filter(([relationshipId]) => relationshipId.startsWith("character:player|"))
  .slice(0, 4)
  .map(([relationshipId, relationship]) => {
    const contactId = relationshipId.split("|")[1];
    const life = world.npcLife[contactId];
    return {
      id: contactId,
      displayName: life?.displayName ?? contactId,
      reliabilityBand: relationship.trust >= 5 ? "reliable" : relationship.trust >= 2 ? "mixed" : "unknown",
      debtBand: relationship.debt > 0 ? "open" : "clear",
      availabilityBand: life?.currentLocationId ? "present" : "unknown",
      knownYears: relationship.relationshipAgeDays >= 365 ? 1 : 0,
      sourceCue: "shared district history",
    };
  });
const organization = world.organizations["org:lantern-circle"];
const contentPack = buildVerticalContentPack();
assertVerticalContentMatchesWorld(contentPack, world);
let contentState = createContentRegistry({ packId: contentPack.packId, simulationDate: summary.date });
contentState = admitContentPack(contentState, { expectedRevision: contentState.revision, ...contentPack });
const scenarioPack = buildVerticalScenarioPack();
let scenarioState = createScenarioRegistry({
  scenarioPackId: scenarioPack.scenarioPackId,
  contentPackId: scenarioPack.contentPackId,
  simulationDate: summary.date,
  knownLocationIds: contentPack.locations.map((location) => location.id),
});
scenarioState = admitScenarioPack(scenarioState, { expectedRevision: scenarioState.revision, scenes: scenarioPack.scenes });
const payload = {
  previewVersion: 1,
  generatedAt: world.date,
  summary,
  content: projectContent(contentState),
  scenario: projectScenario(scenarioState),
  projection,
  ui: buildUiProjection({
    calendar: {
      date: projection.date,
      era: "late-1990s",
      lifeCourseCue: "the first year has settled into a longer history",
    },
    contacts: playerContacts,
    organization: {
      id: organization.id,
      label: organization.displayName,
      doctrineCue: "rules favor trust and competence",
      assignments: Object.values(organization.workItems).map((item) => ({
        id: item.id,
        label: item.label,
        status: item.status,
        ownerCue: item.claimOwner ? "an organization member holds the work" : "unassigned",
      })),
    },
    properties: projection.businesses.map((business) => ({
      id: business.id,
      label: business.displayName,
      conditionCue: `condition is ${business.condition}`,
      claimCue: "ownership history is part of the public record",
    })),
    pressureCues: projection.markets.map((market) => ({
      id: market.id,
      title: `${market.commodity} pressure`,
      severityBand: market.priceBand.midpoint >= 120 ? "high" : market.priceBand.midpoint >= 100 ? "moderate" : "low",
      direction: market.priceBand.midpoint >= 100 ? "rising" : "falling",
      causeCue: "regional market conditions are changing",
    })),
    mapKnowledge: [{
      id: projection.district.id,
      label: projection.district.label,
      known: true,
      familiarityCue: "the district is known through lived history",
      discoveredFeatures: projection.businesses.map((business) => business.displayName),
    }],
    notifications: [
      { id: "notice:year-one", label: "A year of district history has settled", tone: "info" },
      ...(Object.values(organization.workItems).some((item) => item.status === "blocked")
        ? [{ id: "notice:blocked-work", label: "One organization assignment is waiting on history", tone: "warning" }]
        : []),
    ],
  }),
};

await mkdir("web", { recursive: true });
await writeFile("web/scenario.json", `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`wrote web/scenario.json for ${summary.date}`);
