import {
  applyPlayerMarketInfluence,
  claimProperty,
  createUnderworldState,
  joinPlayerSession,
  leavePlayerSession,
  projectUnderworld,
  registerMarket,
  registerNpcBaseline,
  registerOrganization,
  registerProperty,
  settleUnderworldWeek,
  UnderworldStaleRevisionError,
  UnderworldValidationError,
} from "./underworld.mjs";
import { createSecureAuthorityHttpServer } from "./secure-http-service.mjs";

export const UNDERWORLD_HTTP_SERVICE_VERSION = 1;

function clone(value) { return structuredClone(value); }

function redactedError(error) {
  if (error instanceof UnderworldStaleRevisionError) return { status: 409, body: { error: "stale_underworld_revision" } };
  if (error instanceof UnderworldValidationError) return { status: 400, body: { error: "invalid_underworld_request" } };
  return { status: 500, body: { error: "internal_underworld_service_error" } };
}

function route(pathname, method) {
  if (method === "GET" && pathname === "/health") return "health";
  if (method === "GET" && pathname === "/projection") return "projection";
  if (method === "POST" && pathname === "/sessions/join") return "join";
  if (method === "POST" && pathname === "/sessions/leave") return "leave";
  if (method === "POST" && pathname === "/markets/influence") return "influence";
  if (method === "POST" && pathname === "/properties/claim") return "claim";
  if (method === "POST" && pathname === "/weeks/settle") return "settle";
  return null;
}

export function createUnderworldHttpService({ state = createUnderworldState() } = {}) {
  const service = {
    version: UNDERWORLD_HTTP_SERVICE_VERSION,
    state: clone(state),
    request({ method = "GET", path = "/", body = null } = {}) {
      const pathname = new URL(path, "http://wolves-without-kings.local").pathname;
      const selectedRoute = route(pathname, method);
      if (selectedRoute === "health") {
        return { status: 200, body: { mode: "in-process", shardId: service.state.shardId, serverWeek: service.state.serverWeek, revision: service.state.revision, projectionScope: "public" } };
      }
      if (selectedRoute === "projection") return { status: 200, body: projectUnderworld(service.state) };
      if (!selectedRoute) return { status: 404, body: { error: "route_not_found" } };
      if (!body || typeof body !== "object" || Array.isArray(body)) return { status: 400, body: { error: "invalid_underworld_request" } };

      try {
        const command = { ...body };
        if (selectedRoute === "join") service.state = joinPlayerSession(service.state, command);
        if (selectedRoute === "leave") service.state = leavePlayerSession(service.state, command);
        if (selectedRoute === "influence") service.state = applyPlayerMarketInfluence(service.state, command);
        if (selectedRoute === "claim") service.state = claimProperty(service.state, command);
        if (selectedRoute === "settle") service.state = settleUnderworldWeek(service.state, command);
        return {
          status: selectedRoute === "join" ? 201 : 200,
          body: {
            accepted: true,
            revision: service.state.revision,
            serverWeek: service.state.serverWeek,
            projection: projectUnderworld(service.state),
          },
        };
      } catch (error) {
        return redactedError(error);
      }
    },
  };
  return service;
}

export function createUnderworldHttpServer({ service = createUnderworldHttpService(), tokens, publicPaths = ["/health", "/projection"], requireTls = false, tls = null, maxBodyBytes } = {}) {
  return createSecureAuthorityHttpServer({ service, tokens, publicPaths, requireTls, tls, maxBodyBytes });
}

export { registerMarket, registerNpcBaseline, registerOrganization, registerProperty };
