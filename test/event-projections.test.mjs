import test from "node:test";
import assert from "node:assert/strict";

import {
  createInitialWorld,
  recordEvent,
} from "../src/wolves-without-kings/engine.mjs";
import {
  EventProjectionValidationError,
  createEventProjectionState,
  ingestCommittedEvents,
  projectEventProjections,
  restoreEventProjections,
  snapshotEventProjections,
} from "../src/wolves-without-kings/event-projections.mjs";

function buildEvents() {
  let world = createInitialWorld();
  const events = [];
  for (const [eventType, subjectId] of [
    ["social.contact_resolved", "npc:broker"],
    ["case.evidence_recorded", "case:warehouse"],
    ["social.relationship_aged", "npc:broker"],
    ["vehicle.provenance_changed", "vehicle:blue"],
  ]) {
    world = recordEvent(world, {
      expectedRevision: world.revision,
      eventType,
      actors: ["character:player"],
      subjects: [subjectId],
      payload: { abstract: true },
    });
    events.push(world.events.at(-1));
  }
  return events;
}

test("projection fan-out is order-independent for committed events", () => {
  const events = buildEvents();
  let ordered = createEventProjectionState();
  let shuffled = createEventProjectionState();
  ordered = ingestCommittedEvents(ordered, { expectedRevision: ordered.revision, events });
  shuffled = ingestCommittedEvents(shuffled, { expectedRevision: shuffled.revision, events: [events[2], events[0], events[3], events[1]] });

  assert.deepEqual(ordered.projection, shuffled.projection);
  assert.equal(ordered.lastSourceRevision, 4);
  assert.equal(ordered.projection.familyCounts.social, 2);
  assert.equal(ordered.projection.familyCounts.case, 1);
});

test("duplicate ingestion is idempotent and conflicting duplicates fail closed", () => {
  const [event] = buildEvents();
  let state = createEventProjectionState();
  state = ingestCommittedEvents(state, { expectedRevision: state.revision, events: [event] });
  const unchanged = ingestCommittedEvents(state, { expectedRevision: state.revision, events: [event] });
  assert.deepEqual(unchanged, state);

  const conflicting = { ...event, payload: { abstract: false } };
  assert.throws(
    () => ingestCommittedEvents(state, { expectedRevision: state.revision, events: [conflicting] }),
    (error) => error instanceof EventProjectionValidationError,
  );
  assert.equal(state.revision, 1);
});

test("public fan-out exposes qualitative activity without private event payloads", () => {
  let state = createEventProjectionState();
  state = ingestCommittedEvents(state, { expectedRevision: state.revision, events: buildEvents() });
  const projection = projectEventProjections(state);

  assert.equal(projection.families.social, "steady");
  assert.equal(projection.subjectActivity["npc:broker"], "steady");
  assert.equal("events" in projection, false);
  assert.ok(projection.omittedFields.includes("payloads"));
});

test("event projection snapshots validate the derived fan-out state", () => {
  let state = createEventProjectionState();
  state = ingestCommittedEvents(state, { expectedRevision: state.revision, events: buildEvents() });
  const saved = snapshotEventProjections(state);
  assert.deepEqual(restoreEventProjections(saved), state);

  saved.state.projection.familyCounts.social = 99;
  assert.throws(() => restoreEventProjections(saved), (error) => error instanceof EventProjectionValidationError);
});
