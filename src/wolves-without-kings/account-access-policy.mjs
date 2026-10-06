import { createHash } from "node:crypto";

import { canonicalJson } from "./engine.mjs";
import { validateIdentityClaim } from "./account-identity.mjs";

export const ACCOUNT_ACCESS_POLICY_SCHEMA_VERSION = 1;

export class AccountAccessPolicyValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AccountAccessPolicyValidationError";
  }
}

function clone(value) { return structuredClone(value); }

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new AccountAccessPolicyValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) throw new AccountAccessPolicyValidationError(`${field} must be an integer >= ${minimum}`);
}

function assertAccountStatus(value) {
  if (!["active", "suspended", "revoked"].includes(value)) throw new AccountAccessPolicyValidationError("account status must be active, suspended, or revoked");
}

function assertAgeBand(value) {
  if (!["adult", "minor", "unknown"].includes(value)) throw new AccountAccessPolicyValidationError("ageBand must be adult, minor, or unknown");
}

function digest(value) {
  assertNonEmpty(value, "secret input");
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function challengeDigest(challengeId, code) {
  assertNonEmpty(code, "code");
  return digest(`${challengeId}:${code}`);
}

function eventHash(event, previousHash) {
  return createHash("sha256").update(`${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`, "utf8").digest("hex");
}

function appendEvent(state, eventType, payload) {
  const next = clone(state);
  const unsigned = {
    eventId: `access-${String(next.nextEventId).padStart(6, "0")}`,
    eventType,
    accessTick: next.currentTick,
    payload: clone(payload),
    previousHash: next.lastEventHash,
  };
  const event = { ...unsigned, hash: eventHash(unsigned, unsigned.previousHash) };
  next.events.push(event);
  next.nextEventId += 1;
  next.lastEventHash = event.hash;
  return next;
}

function assertState(state) {
  if (!state || state.schemaVersion !== ACCOUNT_ACCESS_POLICY_SCHEMA_VERSION || !state.accounts || !state.challenges || !Array.isArray(state.events)) {
    throw new AccountAccessPolicyValidationError("invalid account access policy state");
  }
  assertNonEmpty(state.policyIssuer, "policyIssuer");
  assertInteger(state.currentTick, "currentTick");
  assertInteger(state.nextChallengeId, "nextChallengeId", 1);
  assertInteger(state.nextEventId, "nextEventId", 1);
  if (!Number.isInteger(state.maxChallengeAttempts) || state.maxChallengeAttempts < 1) throw new AccountAccessPolicyValidationError("maxChallengeAttempts must be a positive integer");
}

function account(state, accountId) {
  assertNonEmpty(accountId, "accountId");
  const value = state.accounts[accountId];
  if (!value) throw new AccountAccessPolicyValidationError(`unknown access account: ${accountId}`);
  return value;
}

function activeAccount(state, accountId) {
  const value = account(state, accountId);
  if (value.status !== "active") throw new AccountAccessPolicyValidationError(`access account ${accountId} is ${value.status}`);
  return value;
}

export function createAccountAccessPolicyState({ policyIssuer = "wwk-local-access-policy", currentTick = 0, maxChallengeAttempts = 3 } = {}) {
  assertNonEmpty(policyIssuer, "policyIssuer");
  assertInteger(currentTick, "currentTick");
  assertInteger(maxChallengeAttempts, "maxChallengeAttempts", 1);
  return {
    schemaVersion: ACCOUNT_ACCESS_POLICY_SCHEMA_VERSION,
    policyIssuer,
    currentTick,
    maxChallengeAttempts,
    nextChallengeId: 1,
    accounts: {},
    challenges: {},
    events: [],
    nextEventId: 1,
    lastEventHash: null,
  };
}

export function registerAccessAccount(state, { accountId, createdAtTick = state.currentTick } = {}) {
  assertState(state);
  assertNonEmpty(accountId, "accountId");
  assertInteger(createdAtTick, "createdAtTick");
  if (state.accounts[accountId]) throw new AccountAccessPolicyValidationError(`access account already exists: ${accountId}`);
  const next = clone(state);
  next.accounts[accountId] = {
    accountId,
    status: "active",
    createdAtTick,
    consent: null,
    mfa: { factorId: null, factorDigest: null, enrolledAtTick: null, verifiedUntilTick: null },
  };
  return appendEvent(next, "access.account.registered", { accountId, createdAtTick });
}

export function setAccessAccountStatus(state, { accountId, status } = {}) {
  assertState(state);
  const current = account(state, accountId);
  assertAccountStatus(status);
  const next = clone(state);
  next.accounts[current.accountId].status = status;
  if (status !== "active") next.accounts[current.accountId].mfa.verifiedUntilTick = null;
  return appendEvent(next, `access.account.${status}`, { accountId });
}

export function grantAccountConsent(state, { accountId, policyVersion, ageBand = "unknown", grantedAtTick = state.currentTick } = {}) {
  assertState(state);
  activeAccount(state, accountId);
  assertNonEmpty(policyVersion, "policyVersion");
  assertAgeBand(ageBand);
  assertInteger(grantedAtTick, "grantedAtTick");
  const next = clone(state);
  next.accounts[accountId].consent = { policyVersion, ageBand, grantedAtTick };
  return appendEvent(next, "access.consent.granted", { accountId, policyVersion, ageBand, grantedAtTick });
}

export function enrollAccessMfa(state, { accountId, factorId, factorMaterial, enrolledAtTick = state.currentTick } = {}) {
  assertState(state);
  activeAccount(state, accountId);
  assertNonEmpty(factorId, "factorId");
  assertNonEmpty(factorMaterial, "factorMaterial");
  assertInteger(enrolledAtTick, "enrolledAtTick");
  const next = clone(state);
  next.accounts[accountId].mfa = { factorId, factorDigest: digest(factorMaterial), enrolledAtTick, verifiedUntilTick: null };
  return appendEvent(next, "access.mfa.enrolled", { accountId, factorId, enrolledAtTick });
}

export function issueAccessMfaChallenge(state, { accountId, code, issuedAtTick = state.currentTick, expiresAtTick = issuedAtTick + 3, verificationTicks = 2 } = {}) {
  assertState(state);
  const current = activeAccount(state, accountId);
  if (!current.mfa.factorId) throw new AccountAccessPolicyValidationError(`MFA is not enrolled for account ${accountId}`);
  assertNonEmpty(code, "code");
  assertInteger(issuedAtTick, "issuedAtTick");
  assertInteger(expiresAtTick, "expiresAtTick");
  assertInteger(verificationTicks, "verificationTicks", 1);
  if (expiresAtTick <= issuedAtTick) throw new AccountAccessPolicyValidationError("expiresAtTick must be after issuedAtTick");
  const next = clone(state);
  const challengeId = `mfa:${String(next.nextChallengeId).padStart(6, "0")}`;
  next.nextChallengeId += 1;
  next.challenges[challengeId] = {
    challengeId,
    accountId,
    issuedAtTick,
    expiresAtTick,
    verificationTicks,
    attempts: 0,
    status: "pending",
    codeDigest: challengeDigest(challengeId, code),
  };
  const committed = appendEvent(next, "access.mfa.challenge.issued", { challengeId, accountId, expiresAtTick });
  return { state: committed, challengeId, expiresAtTick };
}

export function verifyAccessMfaChallenge(state, { accountId, challengeId, code, currentTick = state.currentTick } = {}) {
  assertState(state);
  activeAccount(state, accountId);
  assertNonEmpty(challengeId, "challengeId");
  assertNonEmpty(code, "code");
  assertInteger(currentTick, "currentTick");
  const challenge = state.challenges[challengeId];
  if (!challenge || challenge.accountId !== accountId) throw new AccountAccessPolicyValidationError("MFA challenge is not registered for account");
  if (challenge.status !== "pending") throw new AccountAccessPolicyValidationError(`MFA challenge is ${challenge.status}`);
  if (currentTick < challenge.issuedAtTick || currentTick >= challenge.expiresAtTick) {
    const expired = clone(state);
    expired.challenges[challengeId].status = "expired";
    return { state: appendEvent(expired, "access.mfa.challenge.expired", { challengeId, accountId }), verified: false, status: "expired" };
  }
  const next = clone(state);
  const current = next.challenges[challengeId];
  current.attempts += 1;
  if (current.codeDigest !== challengeDigest(challengeId, code)) {
    if (current.attempts >= next.maxChallengeAttempts) current.status = "failed";
    const failed = appendEvent(next, "access.mfa.challenge.rejected", { challengeId, accountId, attempts: current.attempts, status: current.status });
    return { state: failed, verified: false, status: current.status, error: current.status === "failed" ? "attempt_limit" : "invalid_code" };
  }
  current.status = "verified";
  next.accounts[accountId].mfa.verifiedUntilTick = currentTick + current.verificationTicks;
  return { state: appendEvent(next, "access.mfa.challenge.verified", { challengeId, accountId, verifiedUntilTick: next.accounts[accountId].mfa.verifiedUntilTick }), verified: true, status: "verified" };
}

export function authorizeAccountAccess(state, { accountId, currentTick = state.currentTick, requireConsent = true, requireMfa = true } = {}) {
  assertState(state);
  const current = activeAccount(state, accountId);
  assertInteger(currentTick, "currentTick");
  if (requireConsent && (!current.consent || current.consent.ageBand !== "adult")) throw new AccountAccessPolicyValidationError("adult consent is required");
  if (requireMfa && (!current.mfa.factorId || current.mfa.verifiedUntilTick === null || current.mfa.verifiedUntilTick <= currentTick)) throw new AccountAccessPolicyValidationError("MFA verification is required");
  return { accountId, access: "admitted", consent: current.consent ? "granted" : "not-required", mfa: requireMfa ? "verified" : "not-required" };
}

export function authorizeIdentityAccess({ identityState, accessState, claim, signingKey, tick = accessState.currentTick, expectedClientId, expectedCharacterId, requireConsent = true, requireMfa = true } = {}) {
  const identity = validateIdentityClaim(identityState, { claim, signingKey, tick, expectedClientId, expectedCharacterId });
  const access = authorizeAccountAccess(accessState, { accountId: identity.accountId, currentTick: tick, requireConsent, requireMfa });
  return { identity, access };
}

export function projectAccountAccessPolicy(state, tick = state.currentTick) {
  assertState(state);
  assertInteger(tick, "tick");
  return {
    schemaVersion: ACCOUNT_ACCESS_POLICY_SCHEMA_VERSION,
    policyIssuer: state.policyIssuer,
    currentTick: tick,
    accounts: Object.values(state.accounts).map((current) => ({
      accountId: current.accountId,
      status: current.status,
      consentBand: current.consent ? "granted" : "missing",
      ageEligibilityBand: current.consent?.ageBand ?? "unknown",
      mfaBand: current.mfa.verifiedUntilTick !== null && current.mfa.verifiedUntilTick > tick ? "verified" : current.mfa.factorId ? "enrolled" : "missing",
    })),
    pendingChallengeCount: Object.values(state.challenges).filter((challenge) => challenge.status === "pending" && tick < challenge.expiresAtTick).length,
    omittedFields: ["factor digests", "MFA code digests", "challenge codes", "factor material", "exact verification expiry"],
  };
}

export function snapshotAccountAccessPolicy(state) {
  assertState(state);
  return { snapshotVersion: 1, state: clone(state) };
}

export function restoreAccountAccessPolicy(snapshot) {
  if (!snapshot || snapshot.snapshotVersion !== 1) throw new AccountAccessPolicyValidationError("unsupported account access snapshot version");
  const state = clone(snapshot.state);
  assertState(state);
  let previousHash = null;
  let nextEventId = 1;
  for (const event of state.events) {
    if (event.eventId !== `access-${String(nextEventId).padStart(6, "0")}`) throw new AccountAccessPolicyValidationError("access event IDs are not contiguous");
    if (event.previousHash !== previousHash) throw new AccountAccessPolicyValidationError("access event chain is broken");
    const { hash, ...unsigned } = event;
    if (hash !== eventHash(unsigned, event.previousHash)) throw new AccountAccessPolicyValidationError("access event hash is invalid");
    previousHash = hash;
    nextEventId += 1;
  }
  if (state.nextEventId !== nextEventId || state.lastEventHash !== previousHash) throw new AccountAccessPolicyValidationError("access snapshot does not match history");
  return state;
}
