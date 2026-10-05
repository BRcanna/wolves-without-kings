import { mkdir, writeFile } from "node:fs/promises";
import { projectWorld } from "../src/wolves-without-kings/projection.mjs";
import { runVerticalHistory } from "../src/wolves-without-kings/vertical-slice.mjs";

const { world, summary } = runVerticalHistory("relationship");
const payload = {
  previewVersion: 1,
  generatedAt: world.date,
  summary,
  projection: projectWorld(world, { scope: "public" }),
};

await mkdir("web", { recursive: true });
await writeFile("web/scenario.json", `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`wrote web/scenario.json for ${summary.date}`);
