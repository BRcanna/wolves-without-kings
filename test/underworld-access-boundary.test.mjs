import test from "node:test";
import assert from "node:assert/strict";

import {
  bindIdentityCharacter,
  createAccountIdentityState,
  issueIdentityClaim,
  registerIdentityAccount,
} from "../src/wolves-without-kings/account-identity.mjs";
import {
  createAccountAccessPolicyState,
  enrollAccessMfa,
  grantAccountConsent,
  issueAccessMfaChallenge,
  registerAccessAccount,
  verifyAccessMfaChallenge,
} from "../src/wolves-without-kings/account-access-policy.mjs";
import { createIdentityBoundUnderworldHttpService } from "../src/wolves-without-kings/underworld-access-boundary.mjs";
import { createUnderworldHttpService } from "../src/wolves-without-kings/underworld-http-service.mjs";
import { createUnderworldState, registerMarket, registerOrganization } from "../src/wolves-without-kings/underworld.mjs";

const SIGNING_KEY = "wwk-test-identity-signing-key";

function seedService() {
  let state = createUnderworldState({ shardId: "shard:access" });
  state = registerOrganization(state, { expectedRevision: state.revision, orgId: "org:access", headquartersRegionId: "region:coast" });
  state = registerMarket(state, { expectedRevision: state.revision, marketId: "market:access", regionId: "region:coast", commodityClass: "vehicle-demand" });
  return createUnderworldHttpService({ state });
}

function identityAndAccess() {
  let identityState = createAccountIdentityState({ issuerId: "issuer:access" });
  identityState = registerIdentityAccount(identityState, { accountId: "account:access" });
  identityState = bindIdentityCharacter(identityState, { accountId: "account:access", characterId: "character:access" });
  const issued = issueIdentityClaim(identityState, {
    accountId: "account:access",
    sessionId: "session:access",
    clientId: "client:access",
    characterId: "character:access",
    issuedAtTick: 0,
    expiresAtTick: 10,
    signingKey: SIGNING_KEY,
  });
  identityState = issued.state;
  let accessState = createAccountAccessPolicyState({ policyIssuer: "policy:access" });
  accessState = registerAccessAccount(accessState, { accountId: "account:access" });
  accessState = grantAccountConsent(accessState, { accountId: "account:access", policyVersion: "adult-v1", ageBand: "adult" });
  accessState = enrollAccessMfa(accessState, { accountId: "account:access", factorId: "factor:access", factorMaterial: "factor-secret" });
  const challenge = issueAccessMfaChallenge(accessState, { accountId: "account:access", code: "123456" });
  accessState = verifyAccessMfaChallenge(challenge.state, { accountId: "account:access", challengeId: challenge.challengeId, code: "123456" }).state;
  return { identityState, accessState, claim: issued.claim };
}

test("identity-bound Underworld service admits valid claim plus adult consent and MFA", () => {
  const service = seedService();
  const { identityState, accessState, claim } = identityAndAccess();
  const guarded = createIdentityBoundUnderworldHttpService({ service, identityState, accessState, signingKey: SIGNING_KEY, tick: 0 });
  const result = guarded.request({
    method: "POST",
    path: "/sessions/join",
    body: {
      identityClaim: claim,
      clientId: "client:access",
      characterId: "character:access",
      expectedRevision: service.state.revision,
      sessionId: "session:access",
      regionId: "region:coast",
    },
  });
  assert.equal(result.status, 201);
  assert.equal(service.state.playerSessions["session:access"].characterId, "character:access");
  assert.equal(Object.hasOwn(result.body, "state"), false);
});

test("identity-bound Underworld service rejects missing, mismatched, expired, and revoked access without mutation", () => {
  const service = seedService();
  const { identityState, accessState, claim } = identityAndAccess();
  const guarded = createIdentityBoundUnderworldHttpService({ service, identityState, accessState, signingKey: SIGNING_KEY, tick: 0 });
  const request = (overrides = {}) => guarded.request({ method: "POST", path: "/sessions/join", body: {
    clientId: "client:access",
    characterId: "character:access",
    expectedRevision: service.state.revision,
    sessionId: "session:access",
    regionId: "region:coast",
    ...overrides,
  } });
  assert.deepEqual(request().body, { error: "underworld_access_denied" });
  assert.equal(request({ identityClaim: claim, clientId: "client:other" }).status, 403);
  const expired = createIdentityBoundUnderworldHttpService({ service, identityState, accessState, signingKey: SIGNING_KEY, tick: 10 });
  assert.equal(expired.request({ method: "POST", path: "/sessions/join", body: { identityClaim: claim, clientId: "client:access", characterId: "character:access", expectedRevision: service.state.revision, sessionId: "session:expired", regionId: "region:coast" } }).status, 403);
  const before = service.state.revision;
  assert.equal(service.state.playerSessions["session:access"], undefined);
  assert.equal(service.state.revision, before);
});

test("identity-bound Underworld service keeps public projection redacted", () => {
  const service = seedService();
  const { identityState, accessState } = identityAndAccess();
  const guarded = createIdentityBoundUnderworldHttpService({ service, identityState, accessState, signingKey: SIGNING_KEY, tick: 0 });
  const projection = guarded.request({ method: "GET", path: "/projection" });
  assert.equal(projection.status, 200);
  assert.equal(Object.hasOwn(projection.body, "playerSessions"), false);
  assert.equal(Object.hasOwn(projection.body, "identityState"), false);
});
