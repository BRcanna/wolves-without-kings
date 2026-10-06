import { authorizeIdentityAccess } from "./account-access-policy.mjs";
import { AccountAccessPolicyValidationError } from "./account-access-policy.mjs";
import { AccountIdentityValidationError } from "./account-identity.mjs";
import { createUnderworldHttpService } from "./underworld-http-service.mjs";

export const UNDERWORLD_ACCESS_BOUNDARY_SCHEMA_VERSION = 1;

export class UnderworldAccessBoundaryValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnderworldAccessBoundaryValidationError";
  }
}

function clone(value) { return structuredClone(value); }

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new UnderworldAccessBoundaryValidationError(`${field} must be a non-empty string`);
}

function denied() {
  return { status: 403, body: { error: "underworld_access_denied" } };
}

export function createIdentityBoundUnderworldHttpService({
  service = createUnderworldHttpService(),
  identityState,
  accessState,
  signingKey,
  tick = accessState?.currentTick,
  requireConsent = true,
  requireMfa = true,
} = {}) {
  if (!service || typeof service.request !== "function") throw new UnderworldAccessBoundaryValidationError("service must expose request");
  if (!identityState || typeof identityState !== "object") throw new UnderworldAccessBoundaryValidationError("identityState must be provided");
  if (!accessState || typeof accessState !== "object") throw new UnderworldAccessBoundaryValidationError("accessState must be provided");
  assertNonEmpty(signingKey, "signingKey");
  if (typeof requireConsent !== "boolean" || typeof requireMfa !== "boolean") throw new UnderworldAccessBoundaryValidationError("requireConsent and requireMfa must be booleans");
  const selectedTick = typeof tick === "function" ? tick : () => tick;

  return {
    version: UNDERWORLD_ACCESS_BOUNDARY_SCHEMA_VERSION,
    get state() { return clone(service.state); },
    request({ method = "GET", path = "/", body = null } = {}) {
      const pathname = new URL(path, "http://wolves-without-kings.local").pathname;
      const publicRoute = method === "GET" && (pathname === "/health" || pathname === "/projection");
      if (publicRoute || method !== "POST") return service.request({ method, path, body });
      if (!body || typeof body !== "object" || Array.isArray(body)) return service.request({ method, path, body });
      const claim = body.identityClaim;
      try {
        authorizeIdentityAccess({
          identityState,
          accessState,
          claim,
          signingKey,
          tick: selectedTick(),
          expectedClientId: body.clientId,
          expectedCharacterId: body.characterId,
          requireConsent,
          requireMfa,
        });
      } catch (error) {
        if (error instanceof AccountIdentityValidationError || error instanceof AccountAccessPolicyValidationError) return denied();
        throw error;
      }
      const { identityClaim: _identityClaim, ...command } = body;
      return service.request({ method, path, body: command });
    },
  };
}
