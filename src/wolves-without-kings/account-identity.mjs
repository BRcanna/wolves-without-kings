import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { canonicalJson } from "./engine.mjs";

export const ACCOUNT_IDENTITY_SCHEMA_VERSION = 1;

export class AccountIdentityValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AccountIdentityValidationError";
  }
}

function clone(value) { return structuredClone(value); }

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new AccountIdentityValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) throw new AccountIdentityValidationError(`${field} must be an integer >= ${minimum}`);
}

function assertStatus(value, field = "status") {
  if (!["active", "suspended", "revoked"].includes(value)) throw new AccountIdentityValidationError(`${field} must be active, suspended, or revoked`);
}

function eventHash(event, previousHash) {
  return createHash("sha256").update(`${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`, "utf8").digest("hex");
}

function appendEvent(state, eventType, payload) {
  const next = clone(state);
  const unsigned = {
    eventId: `identity-${String(next.nextEventId).padStart(6, "0")}`,
    eventType,
    identityTick: next.currentTick,
    payload: clone(payload),
    previousHash: next.lastEventHash,
  };
  const event = { ...unsigned, hash: eventHash(unsigned, unsigned.previousHash) };
  next.events.push(event);
  next.nextEventId += 1;
  next.lastEventHash = event.hash;
  return next;
}

function claimMaterial(claim) {
  return {
    schemaVersion: claim.schemaVersion,
    issuerId: claim.issuerId,
    claimId: claim.claimId,
    accountId: claim.accountId,
    sessionId: claim.sessionId,
    clientId: claim.clientId,
    characterId: claim.characterId,
    issuedAtTick: claim.issuedAtTick,
    expiresAtTick: claim.expiresAtTick,
  };
}

function claimSignature(claim, signingKey) {
  assertNonEmpty(signingKey, "signingKey");
  return createHmac("sha256", signingKey).update(canonicalJson(claimMaterial(claim)), "utf8").digest("hex");
}

function verifyClaimSignature(claim, signingKey) {
  assertNonEmpty(claim.signature, "claim.signature");
  const expected = Buffer.from(claimSignature(claim, signingKey), "hex");
  const actual = Buffer.from(claim.signature, "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new AccountIdentityValidationError("identity claim signature is invalid");
}

function assertState(state) {
  if (!state || state.schemaVersion !== ACCOUNT_IDENTITY_SCHEMA_VERSION || !state.accounts || !state.claims || !Array.isArray(state.events)) {
    throw new AccountIdentityValidationError("invalid account identity state");
  }
  assertNonEmpty(state.issuerId, "issuerId");
  assertInteger(state.currentTick, "currentTick");
}

export function createAccountIdentityState({ issuerId = "wwk-local-identity", currentTick = 0 } = {}) {
  assertNonEmpty(issuerId, "issuerId");
  assertInteger(currentTick, "currentTick");
  return {
    schemaVersion: ACCOUNT_IDENTITY_SCHEMA_VERSION,
    issuerId,
    currentTick,
    nextClaimId: 1,
    accounts: {},
    claims: {},
    events: [],
    nextEventId: 1,
    lastEventHash: null,
  };
}

export function registerIdentityAccount(state, { accountId, createdAtTick = state.currentTick } = {}) {
  assertState(state);
  assertNonEmpty(accountId, "accountId");
  assertInteger(createdAtTick, "createdAtTick");
  if (state.accounts[accountId]) throw new AccountIdentityValidationError(`account already exists: ${accountId}`);
  const next = clone(state);
  next.accounts[accountId] = { accountId, status: "active", createdAtTick, characterIds: [] };
  return appendEvent(next, "identity.account.registered", { accountId, createdAtTick });
}

export function bindIdentityCharacter(state, { accountId, characterId } = {}) {
  assertState(state);
  assertNonEmpty(accountId, "accountId");
  assertNonEmpty(characterId, "characterId");
  const account = state.accounts[accountId];
  if (!account) throw new AccountIdentityValidationError(`unknown account: ${accountId}`);
  if (account.status !== "active") throw new AccountIdentityValidationError(`account ${accountId} is ${account.status}`);
  const owner = Object.values(state.accounts).find((candidate) => candidate.characterIds.includes(characterId));
  if (owner && owner.accountId !== accountId) throw new AccountIdentityValidationError(`character ${characterId} is already bound to another account`);
  if (account.characterIds.includes(characterId)) return clone(state);
  const next = clone(state);
  next.accounts[accountId].characterIds.push(characterId);
  return appendEvent(next, "identity.character.bound", { accountId, characterId });
}

export function setIdentityAccountStatus(state, { accountId, status } = {}) {
  assertState(state);
  assertNonEmpty(accountId, "accountId");
  assertStatus(status);
  if (!state.accounts[accountId]) throw new AccountIdentityValidationError(`unknown account: ${accountId}`);
  const next = clone(state);
  next.accounts[accountId].status = status;
  return appendEvent(next, `identity.account.${status}`, { accountId });
}

export function issueIdentityClaim(state, {
  accountId,
  sessionId,
  clientId,
  characterId,
  issuedAtTick = state.currentTick,
  expiresAtTick,
  signingKey,
} = {}) {
  assertState(state);
  assertNonEmpty(accountId, "accountId");
  assertNonEmpty(sessionId, "sessionId");
  assertNonEmpty(clientId, "clientId");
  assertNonEmpty(characterId, "characterId");
  assertInteger(issuedAtTick, "issuedAtTick");
  assertInteger(expiresAtTick, "expiresAtTick");
  if (expiresAtTick <= issuedAtTick) throw new AccountIdentityValidationError("expiresAtTick must be after issuedAtTick");
  const account = state.accounts[accountId];
  if (!account) throw new AccountIdentityValidationError(`unknown account: ${accountId}`);
  if (account.status !== "active") throw new AccountIdentityValidationError(`account ${accountId} is ${account.status}`);
  if (!account.characterIds.includes(characterId)) throw new AccountIdentityValidationError(`character ${characterId} is not bound to account ${accountId}`);
  assertNonEmpty(signingKey, "signingKey");
  if (Object.values(state.claims).some((claim) => claim.sessionId === sessionId && claim.status === "active")) throw new AccountIdentityValidationError(`session already has an active identity claim: ${sessionId}`);
  const next = clone(state);
  const claim = {
    schemaVersion: ACCOUNT_IDENTITY_SCHEMA_VERSION,
    issuerId: state.issuerId,
    claimId: `claim:${String(state.nextClaimId).padStart(6, "0")}`,
    accountId,
    sessionId,
    clientId,
    characterId,
    issuedAtTick,
    expiresAtTick,
    signature: "",
    status: "active",
  };
  claim.signature = claimSignature(claim, signingKey);
  next.nextClaimId += 1;
  next.claims[claim.claimId] = clone(claim);
  const committed = appendEvent(next, "identity.claim.issued", { claimId: claim.claimId, accountId, sessionId, characterId, expiresAtTick });
  return { state: committed, claim: clone(claim) };
}

export function revokeIdentityClaim(state, { claimId } = {}) {
  assertState(state);
  assertNonEmpty(claimId, "claimId");
  if (!state.claims[claimId]) throw new AccountIdentityValidationError(`unknown identity claim: ${claimId}`);
  const next = clone(state);
  next.claims[claimId].status = "revoked";
  return appendEvent(next, "identity.claim.revoked", { claimId });
}

export function validateIdentityClaim(state, { claim, signingKey, tick = state.currentTick, expectedClientId, expectedCharacterId } = {}) {
  assertState(state);
  if (!claim || typeof claim !== "object" || Array.isArray(claim)) throw new AccountIdentityValidationError("claim must be an object");
  assertInteger(tick, "tick");
  if (claim.schemaVersion !== ACCOUNT_IDENTITY_SCHEMA_VERSION || claim.issuerId !== state.issuerId) throw new AccountIdentityValidationError("identity claim issuer or schema is invalid");
  const stored = state.claims[claim.claimId];
  if (!stored || stored.signature !== claim.signature) throw new AccountIdentityValidationError("identity claim is not registered");
  verifyClaimSignature(claim, signingKey);
  if (stored.status !== "active") throw new AccountIdentityValidationError(`identity claim is ${stored.status}`);
  const account = state.accounts[claim.accountId];
  if (!account || account.status !== "active") throw new AccountIdentityValidationError("identity account is not active");
  if (!account.characterIds.includes(claim.characterId)) throw new AccountIdentityValidationError("identity character binding is invalid");
  if (tick < claim.issuedAtTick || tick >= claim.expiresAtTick) throw new AccountIdentityValidationError("identity claim is outside its validity window");
  if (expectedClientId !== undefined && claim.clientId !== expectedClientId) throw new AccountIdentityValidationError("identity claim client mismatch");
  if (expectedCharacterId !== undefined && claim.characterId !== expectedCharacterId) throw new AccountIdentityValidationError("identity claim character mismatch");
  return { accountId: claim.accountId, sessionId: claim.sessionId, clientId: claim.clientId, characterId: claim.characterId, issuerId: claim.issuerId };
}

export function projectAccountIdentity(state) {
  assertState(state);
  return {
    schemaVersion: ACCOUNT_IDENTITY_SCHEMA_VERSION,
    issuerId: state.issuerId,
    currentTick: state.currentTick,
    accounts: Object.values(state.accounts).map((account) => ({ accountId: account.accountId, status: account.status, characterCount: account.characterIds.length })),
    activeClaimCount: Object.values(state.claims).filter((claim) => claim.status === "active").length,
    omittedFields: ["claim signatures", "session client IDs", "character bindings", "signing keys"],
  };
}

export function snapshotAccountIdentity(state) {
  assertState(state);
  return { snapshotVersion: 1, state: clone(state) };
}

export function restoreAccountIdentity(snapshot) {
  if (!snapshot || snapshot.snapshotVersion !== 1) throw new AccountIdentityValidationError("unsupported account identity snapshot version");
  const state = clone(snapshot.state);
  assertState(state);
  let previousHash = null;
  let nextEventId = 1;
  for (const event of state.events) {
    if (event.eventId !== `identity-${String(nextEventId).padStart(6, "0")}`) throw new AccountIdentityValidationError("identity event IDs are not contiguous");
    if (event.previousHash !== previousHash) throw new AccountIdentityValidationError("identity event chain is broken");
    const { hash, ...unsigned } = event;
    if (hash !== eventHash(unsigned, event.previousHash)) throw new AccountIdentityValidationError("identity event hash is invalid");
    previousHash = hash;
    nextEventId += 1;
  }
  if (state.nextEventId !== nextEventId || state.lastEventHash !== previousHash) throw new AccountIdentityValidationError("identity snapshot does not match history");
  return state;
}
