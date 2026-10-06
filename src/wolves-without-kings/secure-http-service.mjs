import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { timingSafeEqual } from "node:crypto";

import { createAuthorityHttpHandler } from "./http-service.mjs";

export class SecureHttpConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "SecureHttpConfigurationError";
  }
}

function clone(value) {
  return structuredClone(value);
}

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new SecureHttpConfigurationError(`${field} must be a non-empty string`);
}

function tokenMatches(received, configured) {
  const receivedBytes = Buffer.from(received, "utf8");
  const configuredBytes = Buffer.from(configured, "utf8");
  return receivedBytes.length === configuredBytes.length && timingSafeEqual(receivedBytes, configuredBytes);
}

function normalizeTokens(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) throw new SecureHttpConfigurationError("tokens must contain at least one token");
  return tokens.map((entry, index) => {
    if (typeof entry === "string") {
      assertNonEmpty(entry, `tokens[${index}]`);
      return { tokenId: `token:${index + 1}`, secret: entry };
    }
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new SecureHttpConfigurationError(`tokens[${index}] must be a token or object`);
    assertNonEmpty(entry.tokenId, `tokens[${index}].tokenId`);
    assertNonEmpty(entry.secret, `tokens[${index}].secret`);
    return { tokenId: entry.tokenId, secret: entry.secret };
  });
}

function pathIsPublic(context, publicPaths) {
  if (context.method !== "GET" && context.method !== "HEAD") return false;
  return publicPaths.has(new URL(context.path, "http://wolves-without-kings.local").pathname);
}

export function createBearerAuthorizer({ tokens, publicPaths = ["/health"], requireTls = false } = {}) {
  const configuredTokens = normalizeTokens(tokens);
  if (!Array.isArray(publicPaths) || publicPaths.some((path) => typeof path !== "string" || !path.startsWith("/"))) {
    throw new SecureHttpConfigurationError("publicPaths must contain absolute URL paths");
  }
  const publicPathSet = new Set(publicPaths);
  if (typeof requireTls !== "boolean") throw new SecureHttpConfigurationError("requireTls must be a boolean");

  return (context) => {
    if (requireTls && !context.encrypted) {
      return {
        status: 426,
        body: { error: "tls_required", message: "secure transport is required" },
        headers: { "upgrade": "TLS/1.3" },
      };
    }
    if (pathIsPublic(context, publicPathSet)) return null;
    const header = context.headers?.authorization;
    const match = typeof header === "string" ? /^Bearer\s+([^\s]+)$/.exec(header) : null;
    if (!match) {
      return {
        status: 401,
        body: { error: "authentication_required" },
        headers: { "www-authenticate": "Bearer" },
      };
    }
    const configured = configuredTokens.find((entry) => tokenMatches(match[1], entry.secret));
    if (!configured) return { status: 403, body: { error: "authentication_rejected" } };
    return { principal: { tokenId: configured.tokenId } };
  };
}

export function createSecureModerationGuard(moderate) {
  if (typeof moderate !== "function") throw new SecureHttpConfigurationError("moderate must be a function");
  return async (context) => {
    const result = await moderate({
      method: context.method,
      path: context.path,
      body: clone(context.body),
      principal: clone(context.principal ?? null),
    });
    if (!result || result.decision === "allow") return null;
    if (result.decision === "hold") {
      return {
        status: 202,
        body: { accepted: false, decision: "moderation-hold", reviewRequired: true },
      };
    }
    if (result.decision === "deny") return { status: 403, body: { error: "moderation_denied" } };
    throw new SecureHttpConfigurationError("moderation decision must be allow, hold, or deny");
  };
}

export function createSecureAuthorityHttpHandler({
  service,
  tokens,
  publicPaths = ["/health"],
  requireTls = false,
  moderate = async () => ({ decision: "allow" }),
  maxBodyBytes,
} = {}) {
  const authorize = createBearerAuthorizer({ tokens, publicPaths, requireTls });
  const moderation = createSecureModerationGuard(moderate);
  return createAuthorityHttpHandler({ service, maxBodyBytes, authorize, moderate: moderation });
}

export function createSecureAuthorityHttpServer({ tls = null, ...options } = {}) {
  if (tls !== null && (!tls || typeof tls !== "object" || Array.isArray(tls) || !tls.key || !tls.cert)) {
    throw new SecureHttpConfigurationError("tls must provide key and cert together");
  }
  if (options.requireTls && !tls) throw new SecureHttpConfigurationError("requireTls needs TLS key and cert configuration");
  const handler = createSecureAuthorityHttpHandler(options);
  return tls ? createHttpsServer(tls, handler) : createHttpServer(handler);
}

