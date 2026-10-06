import test from "node:test";
import assert from "node:assert/strict";

import {
  admitKeyedTransportEnvelope,
  advanceTransportKeyring,
  createTransportKeyring,
  projectTransportKeyring,
  registerTransportKey,
  restoreTransportKeyring,
  revokeTransportKey,
  rotateTransportKey,
  signKeyedTransportEnvelope,
  snapshotTransportKeyring,
  TransportKeyringValidationError,
} from "../src/wolves-without-kings/transport-keyring.mjs";
import { createTransportState, registerTransportSession } from "../src/wolves-without-kings/transport-envelope.mjs";

function connected() {
  let state = createTransportState();
  state = registerTransportSession(state, { expectedRevision: state.revision, sessionId: "session:keyring", clientId: "client:keyring", keyId: "key:one" });
  return state;
}

test("keyring binds signing and admission to the session key and supports overlap rotation", () => {
  let keyring = registerTransportKey(createTransportKeyring(), { keyId: "key:one", secret: "secret-one", expiresAtTick: 10 });
  keyring = rotateTransportKey(keyring, { keyId: "key:two", secret: "secret-two", createdAtTick: 1 });
  const state = connected();
  const envelope = signKeyedTransportEnvelope(keyring, { keyId: "key:one", sessionId: "session:keyring", inputSeq: 1, nonce: "nonce:1", issuedAtTick: 1, intent: { type: "wait" } });
  assert.equal(envelope.keyId, "key:one");
  const accepted = admitKeyedTransportEnvelope(state, keyring, { expectedRevision: state.revision, envelope, serverTick: 1 });
  assert.equal(accepted.decision, "accepted");
  assert.equal(accepted.state.sessions["session:keyring"].lastInputSeq, 1);
});

test("expired and revoked keys fail closed while public projection and snapshots omit secrets", () => {
  let keyring = registerTransportKey(createTransportKeyring(), { keyId: "key:one", secret: "secret-one", expiresAtTick: 5 });
  const state = connected();
  const envelope = signKeyedTransportEnvelope(keyring, { sessionId: "session:keyring", inputSeq: 1, nonce: "nonce:1", issuedAtTick: 0, intent: { type: "wait" } });
  keyring = advanceTransportKeyring(keyring, { currentTick: 5 });
  assert.throws(() => admitKeyedTransportEnvelope(state, keyring, { expectedRevision: state.revision, envelope, serverTick: 5 }), /expired/);
  keyring = registerTransportKey(createTransportKeyring(), { keyId: "key:revoke", secret: "secret-revoke" });
  keyring = revokeTransportKey(keyring, { keyId: "key:revoke" });
  assert.throws(() => signKeyedTransportEnvelope(keyring, { keyId: "key:revoke", sessionId: "session:keyring", inputSeq: 1, nonce: "nonce:1", intent: { type: "wait" } }), /revoked/);
  const projection = projectTransportKeyring(keyring);
  assert.equal(JSON.stringify(projection).includes("secret-revoke"), false);
  const snapshot = snapshotTransportKeyring(keyring);
  assert.equal(JSON.stringify(snapshot).includes("secret-revoke"), false);
  assert.equal(restoreTransportKeyring(snapshot, { secrets: { "key:revoke": "secret-revoke" } }).keys["key:revoke"].secret, "secret-revoke");
});

test("keyring rejects a mismatched session key and missing restore secret", () => {
  let keyring = registerTransportKey(createTransportKeyring(), { keyId: "key:one", secret: "secret-one" });
  keyring = rotateTransportKey(keyring, { keyId: "key:two", secret: "secret-two" });
  const state = connected();
  const envelope = signKeyedTransportEnvelope(keyring, { keyId: "key:two", sessionId: "session:keyring", inputSeq: 1, nonce: "nonce:1", intent: { type: "wait" } });
  assert.throws(() => admitKeyedTransportEnvelope(state, keyring, { expectedRevision: state.revision, envelope }), /does not match session binding/);
  assert.throws(() => restoreTransportKeyring(snapshotTransportKeyring(keyring), { secrets: { "key:one": "secret-one" } }), TransportKeyringValidationError);
});
