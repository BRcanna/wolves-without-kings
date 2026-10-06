import test from "node:test";
import assert from "node:assert/strict";

import {
  TransportEnvelopeValidationError,
  admitTransportEnvelope,
  createTransportState,
  projectTransport,
  registerTransportSession,
  restoreTransport,
  signTransportEnvelope,
  snapshotTransport,
} from "../src/wolves-without-kings/transport-envelope.mjs";

const KEY = "local-fixture-key";

function connected(options = {}) {
  let state = createTransportState(options);
  state = registerTransportSession(state, { expectedRevision: state.revision, sessionId: "session:one", clientId: "client:one", keyId: "key:one" });
  return state;
}

function envelope(inputSeq = 1, issuedAtTick = 0, intent = { type: "move", direction: "north" }) {
  return signTransportEnvelope({ sessionId: "session:one", inputSeq, nonce: `nonce:${inputSeq}`, issuedAtTick, intent, key: KEY });
}

test("signed transport intents admit without accepting authoritative client results", () => {
  let state = connected();
  const result = admitTransportEnvelope(state, { expectedRevision: state.revision, envelope: envelope(), key: KEY });
  assert.equal(result.decision, "accepted");
  assert.equal(result.state.sessions["session:one"].lastInputSeq, 1);
  assert.throws(
    () => signTransportEnvelope({ sessionId: "session:one", inputSeq: 2, nonce: "nonce:2", intent: { type: "move", serverOutcome: "accepted" }, key: KEY }),
    /serverOutcome/,
  );
});

test("tampering, conflicting duplicates, and out-of-order inputs fail closed", () => {
  let state = connected();
  const first = envelope();
  const accepted = admitTransportEnvelope(state, { expectedRevision: state.revision, envelope: first, key: KEY });
  state = accepted.state;
  const duplicate = admitTransportEnvelope(state, { expectedRevision: state.revision, envelope: first, key: KEY });
  assert.equal(duplicate.decision, "duplicate");
  assert.throws(() => admitTransportEnvelope(state, { expectedRevision: state.revision, envelope: { ...first, signature: "00".repeat(32) }, key: KEY }), TransportEnvelopeValidationError);
  assert.throws(() => admitTransportEnvelope(state, { expectedRevision: state.revision, envelope: envelope(3), key: KEY }), /sequence/);
});

test("rate limiting and moderation holds settle as explicit transport outcomes", () => {
  let state = connected({ maxInputsPerWindow: 1, windowTicks: 10 });
  let result = admitTransportEnvelope(state, { expectedRevision: state.revision, envelope: envelope(1), key: KEY, serverTick: 0 });
  state = result.state;
  result = admitTransportEnvelope(state, { expectedRevision: state.revision, envelope: envelope(2), key: KEY, serverTick: 0 });
  assert.equal(result.decision, "rate-limited");
  state = result.state;
  result = admitTransportEnvelope(state, { expectedRevision: state.revision, envelope: envelope(2, 10), key: KEY, serverTick: 10, moderationFlags: ["abusive-content"] });
  assert.equal(result.decision, "moderation-hold");
  assert.equal(result.state.sessions["session:one"].moderationHolds, 1);
});

test("clock-skew and wrong-key envelopes reject before admission", () => {
  const state = connected({ clockSkewTicks: 2 });
  assert.throws(() => admitTransportEnvelope(state, { expectedRevision: state.revision, envelope: envelope(1, 10), key: KEY, serverTick: 0 }), /clock-skew/);
  assert.throws(() => admitTransportEnvelope(state, { expectedRevision: state.revision, envelope: envelope(), key: "wrong-key" }), /signature/);
});

test("transport snapshots restore while public projection omits security material", () => {
  let state = connected();
  state = admitTransportEnvelope(state, { expectedRevision: state.revision, envelope: envelope(), key: KEY }).state;
  assert.deepEqual(restoreTransport(snapshotTransport(state)), state);
  const projection = projectTransport(state);
  assert.equal("events" in projection, false);
  assert.equal("receipts" in projection.sessions[0], false);
  assert.ok(projection.omittedFields.includes("signatures"));
});
