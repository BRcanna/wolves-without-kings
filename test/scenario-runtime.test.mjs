import test from "node:test";
import assert from "node:assert/strict";

import { runVerticalHistory } from "../src/wolves-without-kings/vertical-slice.mjs";
import { applyVerticalScenarioChoice } from "../src/wolves-without-kings/scenario-runtime.mjs";

test("authored scenario choices dispatch into bounded systemic outcomes", () => {
  const baseline = runVerticalHistory("relationship").world;
  const observed = applyVerticalScenarioChoice(baseline, { expectedRevision: baseline.revision, choiceId: "choice:listen" });
  assert.equal(observed.events.at(-1).eventType, "scenario.context_observed");
  assert.equal(observed.events.at(-1).payload.informationScope, "public-qualitative");

  const met = applyVerticalScenarioChoice(baseline, { expectedRevision: baseline.revision, choiceId: "choice:meet-owner" });
  assert.equal(met.relationships["character:player|npc:resident-01"].trust, 3);

  const delegated = applyVerticalScenarioChoice(baseline, { expectedRevision: baseline.revision, choiceId: "choice:delegate-check" });
  assert.equal(delegated.organizations["org:lantern-circle"].workItems["work:lantern-check"].status, "active");
});

test("scenario runtime rejects stale dispatch before world mutation", () => {
  const baseline = runVerticalHistory("relationship").world;
  assert.throws(
    () => applyVerticalScenarioChoice(baseline, { expectedRevision: baseline.revision - 1, choiceId: "choice:listen" }),
    /stale command/,
  );
  assert.equal(baseline.events.at(-1).eventType, "world.time_advanced");
});
