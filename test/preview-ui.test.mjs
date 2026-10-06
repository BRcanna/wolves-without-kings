import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

test("browser preview carries the public qualitative UI projection", () => {
  execFileSync(process.execPath, ["scripts/build-preview.mjs"], { encoding: "utf8" });
  const payload = JSON.parse(readFileSync("web/scenario.json", "utf8"));

  assert.equal(payload.ui.projectionVersion, 1);
  assert.equal(payload.ui.calendar.era, "late-1990s");
  assert.equal(payload.ui.mapKnowledge.length, 1);
  assert.equal(payload.ui.properties.length, payload.projection.businesses.length);
  assert.ok(payload.ui.omittedFields.includes("hidden competence"));
});

test("browser preview renders UI projection sections without private fields", () => {
  const html = readFileSync("web/index.html", "utf8");
  const app = readFileSync("web/app.mjs", "utf8");
  assert.match(html, /id="calendar-cue"/);
  assert.match(html, /id="ui-pressure-list"/);
  assert.match(html, /id="ui-property-list"/);
  assert.match(app, /renderUi\(payload\.ui\)/);
  assert.doesNotMatch(app, /beliefs|hiddenCompetence|caseConfidence/);
});
