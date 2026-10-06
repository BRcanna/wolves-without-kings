import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { resolvePublicScenarioChoice } from "../web/scenario-preview.mjs";

test("browser preview carries the public qualitative UI projection", () => {
  execFileSync(process.execPath, ["scripts/build-preview.mjs"], { encoding: "utf8" });
  const payload = JSON.parse(readFileSync("web/scenario.json", "utf8"));

  assert.equal(payload.ui.projectionVersion, 1);
  assert.equal(payload.ui.calendar.era, "late-1990s");
  assert.equal(payload.ui.mapKnowledge.length, 1);
  assert.equal(payload.scenario.scenes.length, 2);
  assert.equal(payload.scenario.scenes[0].choices.length, 3);
  assert.ok(payload.ui.contacts.length >= 1);
  assert.ok(payload.ui.organization.assignments.length >= 1);
  assert.ok(payload.ui.notifications.length >= 1);
  assert.equal(payload.ui.properties.length, payload.projection.businesses.length);
  assert.ok(payload.ui.omittedFields.includes("hidden competence"));
});

test("browser preview renders UI projection sections without private fields", () => {
  const html = readFileSync("web/index.html", "utf8");
  const app = readFileSync("web/app.mjs", "utf8");
  assert.match(html, /id="calendar-cue"/);
  assert.match(html, /id="contacts-list"/);
  assert.match(html, /id="assignment-list"/);
  assert.match(html, /id="ui-pressure-list"/);
  assert.match(html, /id="ui-property-list"/);
  assert.match(html, /id="notifications-list"/);
  assert.match(html, /id="scenario-list"/);
  assert.match(html, /id="scenario-feedback"/);
  assert.match(app, /renderUi\(payload\.ui\)/);
  assert.match(app, /renderScenario\(payload\.scenario\)/);
  assert.match(app, /choice-button/);
  assert.match(app, /addEventListener\("click"/);
  assert.match(app, /in memory only/);
  assert.doesNotMatch(app, /beliefs|hiddenCompetence|caseConfidence/);
});

test("browser scenario transition advances only the public in-memory projection", () => {
  execFileSync(process.execPath, ["scripts/build-preview.mjs"], { encoding: "utf8" });
  const payload = JSON.parse(readFileSync("web/scenario.json", "utf8"));
  const first = resolvePublicScenarioChoice(payload.scenario, {
    sceneId: "scene:market-lights",
    choiceId: "choice:listen",
  });
  assert.equal(first.scenario.activeSceneId, "scene:market-followup");
  assert.deepEqual(first.scenario.resolutions.at(-1), {
    sceneId: "scene:market-lights",
    choiceId: "choice:listen",
    branch: "observe",
    date: "1999-01-01",
  });
  const endpoint = resolvePublicScenarioChoice(first.scenario, {
    sceneId: "scene:market-followup",
    choiceId: "choice:let-time-settle",
  });
  assert.equal(endpoint.scenario.activeSceneId, null);
  assert.equal(endpoint.scenario.resolutions.length, 2);
  assert.throws(() => resolvePublicScenarioChoice(payload.scenario, {
    sceneId: "scene:market-followup",
    choiceId: "choice:let-time-settle",
  }), /active preview scene/);
});
