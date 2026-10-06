import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const read = (relativePath) => readFileSync(resolve(root, relativePath), "utf8");
const fail = (message) => {
  console.error(`docuseries-verify: FAIL — ${message}`);
  process.exit(1);
};

const readRequired = (relativePath) => {
  const absolutePath = resolve(root, relativePath);
  if (!existsSync(absolutePath)) fail(`missing ${relativePath}`);
  return read(relativePath);
};

const packageJson = JSON.parse(readRequired("package.json"));
const readme = readRequired("README.md");
const acceptance = readRequired("docs/ACCEPTANCE.md");
const buildLog = readRequired("docs/BUILD_LOG.md");
const scenarioLedger = readRequired("docs/SCENARIO_ACCEPTANCE.md");
const deliveryMatrix = readRequired("docs/DOCUSERIES_DELIVERY_MATRIX.md");
const preview = JSON.parse(readRequired("web/scenario.json"));

if (!readme.includes("Sections 3–65")) {
  fail("README does not declare the current Sections 3–65 build scope");
}

for (const scriptName of ["test", "preview:build", "verify"]) {
  if (typeof packageJson.scripts?.[scriptName] !== "string") {
    fail(`package.json is missing the ${scriptName} script`);
  }
}

const episodeNumbers = [...buildLog.matchAll(/^## Episode (\d+) —/gm)].map((match) => Number(match[1]));
if (episodeNumbers.length === 0 || episodeNumbers[0] !== 0) {
  fail("BUILD_LOG.md must begin with Episode 0");
}
episodeNumbers.forEach((episode, index) => {
  if (episode !== index) fail(`BUILD_LOG.md has a gap or duplicate at Episode ${episode}`);
});

const matrixRows = [...acceptance.matchAll(/^\| ([^|]+) \| ([^|]+) \| (PASS|OPEN) \|$/gm)];
if (matrixRows.length === 0) fail("ACCEPTANCE.md contains no status rows");
const passRows = matrixRows.filter(([, , , status]) => status === "PASS");
const openRows = matrixRows.filter(([, , , status]) => status === "OPEN");
if (passRows.length < 40) fail(`acceptance matrix has only ${passRows.length} PASS rows`);

const scenarioRows = [...scenarioLedger.matchAll(/^\| (Scenario Trace \d+[^|]*) \| `([^`]+)` \| ([^|]+) \| PASS \|$/gm)];
if (scenarioRows.length !== 10) fail(`scenario acceptance ledger has ${scenarioRows.length} PASS rows; expected 10`);
for (const [, , source, evidence] of scenarioRows) {
  if (!existsSync(resolve(root, source))) fail(`scenario ledger references missing source ${source}`);
  for (const [, testFile] of evidence.matchAll(/`([^`]+\.test\.mjs)`/g)) {
    if (!existsSync(resolve(root, "test", testFile))) fail(`scenario ledger references missing test ${testFile}`);
  }
}

const evidenceReferences = passRows.flatMap(([, , evidence]) =>
  [...evidence.matchAll(/`([^`]+)`/g)].map((match) => match[1]),
);
for (const reference of evidenceReferences) {
  if (/^SECTION_[A-Z0-9_]+\.md$/.test(reference) || reference === "ONLINE_BOUNDARY.md") {
    if (!existsSync(resolve(root, "docs", reference))) fail(`PASS evidence references missing docs/${reference}`);
  }
  if (/^[a-z0-9-]+\.mjs$/.test(reference)) {
    const candidates = [
      resolve(root, "src/wolves-without-kings", reference),
      resolve(root, "test", reference),
      resolve(root, "web", reference),
      resolve(root, "scripts", reference),
    ];
    if (!candidates.some((candidate) => existsSync(candidate))) {
      fail(`PASS evidence references missing executable ${reference}`);
    }
  }
}

if (preview.previewVersion !== 1 || preview.projection?.scope !== "public") {
  fail("web/scenario.json is not a version 1 public projection preview");
}
if (preview.content?.counts?.locations !== 8 || preview.content?.counts?.npcs !== 30 || preview.content?.counts?.scheduleTemplates !== 30) {
  fail("web/scenario.json does not contain the admitted vertical-slice content package");
}
if (preview.scenario?.scenes?.length !== 2 || preview.scenario.scenes[0]?.choices?.length !== 3) {
  fail("web/scenario.json does not contain the branchable vertical-slice scenario pack");
}

const deliveryRows = [...deliveryMatrix.matchAll(/^\| ([^|]+) \| `([^`]+)` \| (\d+) \| ([^|]+) \| (SHIPPED|BOUNDED|COMPOSED|OPEN|DEFERRED) \|$/gm)];
if (deliveryRows.length !== 12) fail(`docuseries delivery matrix has ${deliveryRows.length} groups; expected 12`);
const deliveryFileTotal = deliveryRows.reduce((total, [, , relativeDirectory, expectedCount]) => {
  const absoluteDirectory = resolve(root, relativeDirectory);
  if (!existsSync(absoluteDirectory)) fail(`delivery matrix references missing directory ${relativeDirectory}`);
  const actualCount = readdirSync(absoluteDirectory).filter((entry) => entry.endsWith(".md")).length;
  if (actualCount !== Number(expectedCount)) fail(`delivery matrix count mismatch for ${relativeDirectory}: expected ${expectedCount}, found ${actualCount}`);
  return total + actualCount;
}, 0);
if (deliveryFileTotal !== 84) fail(`delivery matrix covers ${deliveryFileTotal} source files; expected 84`);

console.log("docuseries-verify: PASS");
console.log(`acceptance-pass-rows=${passRows.length}`);
console.log(`acceptance-open-rows=${openRows.length}`);
console.log(`build-log-episodes=0..${episodeNumbers.at(-1)}`);
console.log(`scenario-traces=${scenarioRows.length}`);
console.log(`docuseries-source-files=${deliveryFileTotal}`);
console.log(`preview-scope=${preview.projection.scope}`);
console.log("external-gates=recorded-open");
