import test from "node:test";
import assert from "node:assert/strict";

import {
  ContentStaleRevisionError,
  ContentValidationError,
  activateContentEra,
  admitContentPack,
  createContentRegistry,
  projectContent,
  restoreContent,
  snapshotContent,
} from "../src/wolves-without-kings/content.mjs";

function packState() {
  let state = createContentRegistry({ packId: "pack:sofia-south" });
  return admitContentPack(state, {
    expectedRevision: state.revision,
    regions: [
      { id: "region:sofia-south", label: "South Sofia (fictionalized)", mode: "full" },
      { id: "region:coast-fictional", label: "Black Sea Coast (fictionalized)", mode: "aggregate" },
    ],
    npcs: [
      { id: "npc:ana", displayName: "Ana", regionId: "region:sofia-south" },
      { id: "npc:boris", displayName: "Boris", regionId: "region:coast-fictional" },
      { id: "npc:vesa", displayName: "Vesa", regionId: "region:sofia-south" },
    ],
    businesses: [{ id: "business:garage", label: "South Garage", regionId: "region:sofia-south" }],
    organizations: [{ id: "organization:lanterns", displayName: "Lantern House", regionIds: ["region:sofia-south"], memberIds: ["npc:ana", "npc:vesa"] }],
    eraVariants: {
      "late-1990s": [{ id: "variant:garage-1998", baseId: "business:garage", label: "Garage before renovation" }],
      "early-2000s": [{ id: "variant:garage-2002", baseId: "business:garage", label: "Garage after renovation" }],
    },
  });
}

test("content pack admission validates cross-references and stable authored identity", () => {
  const state = packState();
  assert.equal(Object.keys(state.regions).length, 2);
  assert.equal(Object.keys(state.npcs).length, 3);
  assert.equal(state.organizations["organization:lanterns"].memberIds.length, 2);
  assert.equal(projectContent(state).counts.businesses, 1);
});

test("era variants activate without replacing stable base content IDs", () => {
  let state = packState();
  state = activateContentEra(state, { expectedRevision: state.revision, era: "early-2000s" });
  const projected = projectContent(state);
  assert.equal(projected.activeEra, "early-2000s");
  assert.equal(projected.activeEraVariantCount, 1);
  assert.equal(state.businesses["business:garage"].id, "business:garage");
});

test("missing references, stale writes, and duplicate IDs fail before partial admission", () => {
  const state = createContentRegistry({ packId: "pack:invalid" });
  assert.throws(
    () => admitContentPack(state, {
      expectedRevision: state.revision,
      regions: [{ id: "region:a", label: "A" }],
      npcs: [{ id: "npc:bad", displayName: "Bad", regionId: "region:missing" }],
    }),
    /unknown region/,
  );
  assert.equal(Object.keys(state.regions).length, 0);
  let admitted = admitContentPack(state, { expectedRevision: state.revision, regions: [{ id: "region:a", label: "A" }] });
  assert.throws(
    () => admitContentPack(admitted, { expectedRevision: admitted.revision - 1, regions: [{ id: "region:b", label: "B" }] }),
    ContentStaleRevisionError,
  );
  assert.throws(
    () => admitContentPack(admitted, { expectedRevision: admitted.revision, regions: [{ id: "region:a", label: "duplicate" }] }),
    ContentValidationError,
  );
  assert.equal(admitted.regions["region:a"].label, "A");
});

test("content snapshots preserve the registry and reject tampering", () => {
  const state = packState();
  assert.deepEqual(restoreContent(snapshotContent(state)), state);
  assert.throws(
    () => restoreContent({ snapshotVersion: 1, state: { ...state, lastEventHash: "tampered" } }),
    ContentValidationError,
  );
});
