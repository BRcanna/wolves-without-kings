import test from "node:test";
import assert from "node:assert/strict";

import {
  UiProjectionValidationError,
  buildUiProjection,
  formatContactCue,
  formatPressureCue,
} from "../src/wolves-without-kings/ui-projection.mjs";

test("contact UI communicates history without exposing exact relationship numbers", () => {
  const contact = formatContactCue({ id: "npc:ana", displayName: "Ana", knownYears: 5, reliabilityBand: "reliable", debtBand: "open", availabilityBand: "mobile", trust: 91, debt: 42 });
  assert.equal(contact.summary, "known for years; usually reliable; an old obligation remains.");
  assert.equal(Object.hasOwn(contact, "trust"), false);
  assert.equal(Object.hasOwn(contact, "debt"), false);
});

test("pressure UI names direction and uncertainty instead of stat spam", () => {
  const cue = formatPressureCue({ id: "case:one", title: "Attention around the market", severityBand: "high", direction: "rising", causeCue: "a witness changed their story", exactConfidence: 88 });
  assert.equal(cue.message, "a witness changed their story; pressure is rising.");
  assert.equal(Object.hasOwn(cue, "exactConfidence"), false);
});

test("public UI projection preserves calendar, learned map knowledge, and explicit organization assignments", () => {
  const view = buildUiProjection({
    calendar: { date: "2003-06-01", era: "early-2000s", lifeCourseCue: "a new decade is taking shape" },
    contacts: [{ id: "npc:ana", displayName: "Ana", reliabilityBand: "mixed", debtBand: "unknown", availabilityBand: "present" }],
    organization: { id: "org:lanterns", label: "Lantern House", doctrineCue: "rules are conditional", assignments: [{ id: "work:one", label: "Watch the venue", status: "active", ownerCue: "assigned to a familiar hand", hiddenMemberId: "npc:private" }] },
    mapKnowledge: [{ id: "place:known", label: "Old Yard", known: true, familiarityCue: "well remembered", discoveredFeatures: ["back entrance"] }, { id: "place:unknown", label: "Unknown", known: false }],
  });
  assert.equal(view.calendar.date, "2003-06-01");
  assert.equal(view.mapKnowledge.length, 1);
  assert.equal(view.organization.assignments[0].ownerCue, "assigned to a familiar hand");
  assert.equal(Object.hasOwn(view.organization.assignments[0], "hiddenMemberId"), false);
  assert.equal(view.omittedFields.includes("hidden competence"), true);
});

test("UI projection refuses private scope and invalid qualitative bands", () => {
  assert.throws(() => buildUiProjection({ scope: "debug", calendar: { date: "1998-01-01", era: "late-1990s" } }), UiProjectionValidationError);
  assert.throws(() => formatContactCue({ id: "npc:bad", displayName: "Bad", reliabilityBand: "91" }), UiProjectionValidationError);
});

test("UI notification tones fail soft to informational language while preserving stable IDs", () => {
  const view = buildUiProjection({ calendar: { date: "1998-01-01", era: "late-1990s" }, notifications: [{ id: "notice:one", label: "Something changed", tone: "secret" }] });
  assert.deepEqual(view.notifications, [{ id: "notice:one", label: "Something changed", tone: "info" }]);
});
