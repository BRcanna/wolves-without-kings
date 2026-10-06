import test from "node:test";
import assert from "node:assert/strict";

import {
  bindIdentityCharacter,
  createAccountIdentityState,
  issueIdentityClaim,
  projectAccountIdentity,
  registerIdentityAccount,
  restoreAccountIdentity,
  revokeIdentityClaim,
  setIdentityAccountStatus,
  snapshotAccountIdentity,
  validateIdentityClaim,
  AccountIdentityValidationError,
} from "../src/wolves-without-kings/account-identity.mjs";

const SIGNING_KEY = "local-identity-fixture-secret";

function identityState() {
  let state = createAccountIdentityState();
  state = registerIdentityAccount(state, { accountId: "account:one" });
  return bindIdentityCharacter(state, { accountId: "account:one", characterId: "character:one" });
}

test("identity claims bind account, character, client, and session", () => {
  const issued = issueIdentityClaim(identityState(), { accountId: "account:one", sessionId: "session:one", clientId: "client:one", characterId: "character:one", issuedAtTick: 1, expiresAtTick: 10, signingKey: SIGNING_KEY });
  const identity = validateIdentityClaim(issued.state, { claim: issued.claim, signingKey: SIGNING_KEY, tick: 2, expectedClientId: "client:one", expectedCharacterId: "character:one" });
  assert.deepEqual(identity, { accountId: "account:one", sessionId: "session:one", clientId: "client:one", characterId: "character:one", issuerId: "wwk-local-identity" });
  assert.throws(() => validateIdentityClaim(issued.state, { claim: issued.claim, signingKey: SIGNING_KEY, tick: 2, expectedClientId: "client:other" }), /client mismatch/);
  assert.throws(() => validateIdentityClaim(issued.state, { claim: { ...issued.claim, accountId: "account:other" }, signingKey: SIGNING_KEY, tick: 2 }), /signature is invalid/);
});

test("suspended accounts, revoked claims, and expired claims fail closed", () => {
  const issued = issueIdentityClaim(identityState(), { accountId: "account:one", sessionId: "session:one", clientId: "client:one", characterId: "character:one", issuedAtTick: 1, expiresAtTick: 3, signingKey: SIGNING_KEY });
  assert.throws(() => validateIdentityClaim(issued.state, { claim: issued.claim, signingKey: SIGNING_KEY, tick: 3 }), /validity window/);
  const revoked = revokeIdentityClaim(issued.state, { claimId: issued.claim.claimId });
  assert.throws(() => validateIdentityClaim(revoked, { claim: issued.claim, signingKey: SIGNING_KEY, tick: 2 }), /revoked/);
  const suspended = setIdentityAccountStatus(issued.state, { accountId: "account:one", status: "suspended" });
  assert.throws(() => issueIdentityClaim(suspended, { accountId: "account:one", sessionId: "session:two", clientId: "client:two", characterId: "character:one", issuedAtTick: 2, expiresAtTick: 5, signingKey: SIGNING_KEY }), /suspended/);
});

test("identity snapshots restore history while public projection omits security material", () => {
  const state = identityState();
  const issued = issueIdentityClaim(state, { accountId: "account:one", sessionId: "session:one", clientId: "client:one", characterId: "character:one", issuedAtTick: 1, expiresAtTick: 10, signingKey: SIGNING_KEY });
  const restored = restoreAccountIdentity(snapshotAccountIdentity(issued.state));
  assert.deepEqual(restored, issued.state);
  const projection = projectAccountIdentity(restored);
  assert.equal(JSON.stringify(projection).includes(SIGNING_KEY), false);
  assert.equal(JSON.stringify(projection).includes(issued.claim.signature), false);
  const tampered = snapshotAccountIdentity(issued.state);
  tampered.state.events[0].payload.accountId = "account:tampered";
  assert.throws(() => restoreAccountIdentity(tampered), (error) => error instanceof AccountIdentityValidationError && /hash is invalid/.test(error.message));
});
