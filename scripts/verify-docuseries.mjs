import { existsSync, readFileSync } from "node:fs";
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
const preview = JSON.parse(readRequired("web/scenario.json"));

if (!readme.includes("Sections 3–43")) {
  fail("README does not declare the current Sections 3–43 build scope");
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

console.log("docuseries-verify: PASS");
console.log(`acceptance-pass-rows=${passRows.length}`);
console.log(`acceptance-open-rows=${openRows.length}`);
console.log(`build-log-episodes=0..${episodeNumbers.at(-1)}`);
console.log(`preview-scope=${preview.projection.scope}`);
console.log("external-gates=recorded-open");
