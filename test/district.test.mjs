import test from "node:test";
import assert from "node:assert/strict";

import { createDistrictFixture, findTraversalPath, validateDistrictFixture } from "../src/wolves-without-kings/district.mjs";

test("authored district fixture has stable locations, layers, routes, and entities", () => {
  const district = createDistrictFixture();
  assert.equal(validateDistrictFixture(district), true);
  assert.equal(district.districtId, "district:sofia-south");
  assert.deepEqual(district.layers, ["street", "interior", "roof", "service"]);
  assert.equal(district.locations.length, 8);
  assert.equal(district.entities.length, 5);
});

test("traversal is deterministic and respects movement modes", () => {
  const district = createDistrictFixture();
  const expected = ["route:street-to-market", "route:market-to-roof"];

  assert.deepEqual(findTraversalPath(district, {
    from: "loc:market-street",
    to: "loc:lantern-rooftop",
    mode: "climb",
  }), expected);
  assert.deepEqual(findTraversalPath(district, {
    from: "loc:market-street",
    to: "loc:lantern-rooftop",
    mode: "climb",
  }), expected);
  assert.equal(findTraversalPath(district, {
    from: "loc:motel-lobby",
    to: "loc:tram-underpass",
    mode: "walk",
  }), null);
});

test("fixture rejects duplicate location identity", () => {
  const district = createDistrictFixture();
  district.locations.push({ ...district.locations[0] });
  assert.throws(() => validateDistrictFixture(district), /duplicate location/);
});
