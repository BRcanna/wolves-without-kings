import test from "node:test";
import assert from "node:assert/strict";

import {
  authorizeAccountAccess,
  authorizeIdentityAccess,
  createAccountAccessPolicyState,
  enrollAccessMfa,
  grantAccountConsent,
  issueAccessMfaChallenge,
  projectAccountAccessPolicy,
  registerAccessAccount,
  restoreAccountAccessPolicy,
  setAccessAccountStatus,
  snapshotAccountAccessPolicy,
  verifyAccessMfaChallenge,
  AccountAccessPolicyValidationError,
} from "../src/wolves-without-kings/account-access-policy.mjs";
import {
  bindIdentityCharacter,
  createAccountIdentityState,
  issueIdentityClaim,
  registerIdentityAccount,
} from "../src/wolves-without-kings/account-identity.mjs";

const SIGNING_KEY = "identity-test-signing-key";

function identity() {
  let state = createAccountIdentityState();
  state = registerIdentityAccount(state, { accountId: "account:one" });
  return bindIdentityCharacter(state, { accountId: "account:one", characterId: "character:one" });
}

function access() {
  let state = createAccountAccessPolicyState();
  state = registerAccessAccount(state, { accountId: "account:one" });
  state = grantAccountConsent(state, { accountId: "account:one", policyVersion: "fictional-policy-v1", ageBand: "adult" });
  return enrollAccessMfa(state, { accountId: "account:one", factorId: "factor:one", factorMaterial: "test-factor-material" });
}

test("consent and MFA admission compose with signed identity claims", () => {
  const identityState = identity();
  const issued = issueIdentityClaim(identityState, { accountId: "account:one", sessionId: "session:one", clientId: "client:one", characterId: "character:one", issuedAtTick: 1, expiresAtTick: 20, signingKey: SIGNING_KEY });
  let accessState = access();
  const challenge = issueAccessMfaChallenge(accessState, { accountId: "account:one", code: "123456", issuedAtTick: 2, expiresAtTick: 6, verificationTicks: 3 });
  accessState = challenge.state;
  assert.throws(() => authorizeAccountAccess(accessState, { accountId: "account:one", currentTick: 2 }), /MFA verification/);
  const verification = verifyAccessMfaChallenge(accessState, { accountId: "account:one", challengeId: challenge.challengeId, code: "123456", currentTick: 3 });
  assert.equal(verification.verified, true);
  accessState = verification.state;
  const admitted = authorizeIdentityAccess({ identityState: issued.state, accessState, claim: issued.claim, signingKey: SIGNING_KEY, tick: 3, expectedClientId: "client:one", expectedCharacterId: "character:one" });
  assert.equal(admitted.access.access, "admitted");
  assert.equal(admitted.identity.accountId, "account:one");
});

test("invalid, expired, exhausted, and non-adult access paths fail closed", () => {
  let state = createAccountAccessPolicyState({ maxChallengeAttempts: 2 });
  state = registerAccessAccount(state, { accountId: "account:minor" });
  state = grantAccountConsent(state, { accountId: "account:minor", policyVersion: "v1", ageBand: "minor" });
  state = enrollAccessMfa(state, { accountId: "account:minor", factorId: "factor:minor", factorMaterial: "material" });
  const challenge = issueAccessMfaChallenge(state, { accountId: "account:minor", code: "654321", issuedAtTick: 1, expiresAtTick: 3 });
  state = challenge.state;
  const rejected = verifyAccessMfaChallenge(state, { accountId: "account:minor", challengeId: challenge.challengeId, code: "000000", currentTick: 1 });
  assert.equal(rejected.verified, false);
  assert.equal(rejected.status, "pending");
  state = rejected.state;
  const exhausted = verifyAccessMfaChallenge(state, { accountId: "account:minor", challengeId: challenge.challengeId, code: "000000", currentTick: 1 });
  assert.equal(exhausted.verified, false);
  assert.equal(exhausted.status, "failed");
  state = exhausted.state;
  assert.throws(() => authorizeAccountAccess(state, { accountId: "account:minor", currentTick: 1, requireMfa: false }), /adult consent/);
  assert.throws(() => authorizeAccountAccess(state, { accountId: "account:minor", currentTick: 1, requireConsent: false }), /MFA verification/);
  const revoked = setAccessAccountStatus(state, { accountId: "account:minor", status: "suspended" });
  assert.throws(() => authorizeAccountAccess(revoked, { accountId: "account:minor", currentTick: 1 }), /suspended/);
});

test("access snapshots restore history and projections omit factor/code material", () => {
  let state = access();
  const challenge = issueAccessMfaChallenge(state, { accountId: "account:one", code: "123456" });
  state = challenge.state;
  const snapshot = snapshotAccountAccessPolicy(state);
  const projection = projectAccountAccessPolicy(state);
  assert.deepEqual(restoreAccountAccessPolicy(snapshot), state);
  assert.equal(JSON.stringify(snapshot).includes("123456"), false);
  assert.equal(JSON.stringify(projection).includes("test-factor-material"), false);
  const tampered = snapshotAccountAccessPolicy(state);
  tampered.state.events[0].payload.accountId = "account:tampered";
  assert.throws(() => restoreAccountAccessPolicy(tampered), (error) => error instanceof AccountAccessPolicyValidationError && /hash is invalid/.test(error.message));
});
