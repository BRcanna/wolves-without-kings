import { mkdir, writeFile } from "node:fs/promises";
import { projectWorld } from "../src/wolves-without-kings/projection.mjs";
import { buildUiProjection } from "../src/wolves-without-kings/ui-projection.mjs";
import { runVerticalHistory } from "../src/wolves-without-kings/vertical-slice.mjs";

const { world, summary } = runVerticalHistory("relationship");
const projection = projectWorld(world, { scope: "public" });
const payload = {
  previewVersion: 1,
  generatedAt: world.date,
  summary,
  projection,
  ui: buildUiProjection({
    calendar: {
      date: projection.date,
      era: "late-1990s",
      lifeCourseCue: "the first year has settled into a longer history",
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
    notifications: [{ id: "notice:year-one", label: "A year of district history has settled", tone: "info" }],
  }),
};

await mkdir("web", { recursive: true });
await writeFile("web/scenario.json", `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`wrote web/scenario.json for ${summary.date}`);
