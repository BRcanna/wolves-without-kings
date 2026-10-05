import {
  AuthorityValidationError,
  DuplicateInputError,
  StaleInputError,
  connectSession,
  createAuthorityState,
  disconnectSession,
  reconcileSession,
  reconnectSession,
  submitIntent,
} from "./authority.mjs";

function clone(value) {
  return structuredClone(value);
}

function response(status, body) {
  return { status, body: clone(body) };
}

function errorResponse(error) {
  if (error instanceof StaleInputError) {
    return response(409, {
      error: "stale_input",
      expectedRevision: error.expectedRevision,
      authoritativeRevision: error.actualRevision,
      reconcileRequired: true,
    });
  }
  if (error instanceof DuplicateInputError) {
    return response(409, {
      error: "duplicate_input",
      sessionId: error.sessionId,
      clientInputSeq: error.inputSeq,
      lastInputSeq: error.lastInputSeq,
    });
  }
  if (error instanceof AuthorityValidationError) {
    const status = /unknown session|unknown owned entity/.test(error.message) ? 404 : 400;
    return response(status, { error: "invalid_authority_request", message: error.message });
  }
  throw error;
}

function routeParts(pathname) {
  return pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
}

function requireBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AuthorityValidationError("request body must be an object");
  }
  return body;
}

export function createAuthorityService(
  initialState = createAuthorityState(),
  { resolveIntent = ({ intent }) => ({
    eventType: `intent.${intent.type}`,
    affectedEntityIds: intent.entityIds,
    payload: { accepted: true },
  }) } = {},
) {
  let state = clone(initialState);

  return {
    get state() {
      return clone(state);
    },

    request({ method = "GET", path, body = null } = {}) {
      try {
        if (typeof path !== "string" || path.trim() === "") {
          throw new AuthorityValidationError("path must be a non-empty string");
        }
        const url = new URL(path, "http://wolves-without-kings.local");
        const parts = routeParts(url.pathname);

        if (method === "GET" && parts.length === 1 && parts[0] === "health") {
          return response(200, {
            service: "wolves-without-kings-authority",
            mode: "in-process",
            status: "ok",
            serverTick: state.serverTick,
            authoritativeRevision: state.worldRevision,
          });
        }

        if (method === "POST" && parts.length === 2 && parts[0] === "sessions" && parts[1] === "connect") {
          state = connectSession(state, requireBody(body));
          const session = state.sessions[body.sessionId];
          return response(201, {
            sessionId: session.sessionId,
            characterId: session.characterId,
            role: session.role,
            regionId: session.regionId,
            status: session.status,
            authoritativeRevision: state.worldRevision,
          });
        }

        if (parts.length === 3 && parts[0] === "sessions") {
          const sessionId = parts[1];
          const action = parts[2];
          if (method === "POST" && action === "input") {
            const input = { ...requireBody(body), sessionId };
            state = submitIntent(state, input, { resolve: resolveIntent });
            const session = state.sessions[sessionId];
            return response(200, {
              accepted: true,
              sessionId,
              clientInputSeq: session.lastInputSeq,
              serverTick: state.serverTick,
              authoritativeRevision: state.worldRevision,
              reconciliation: clone(session.reconciliation),
            });
          }
          if (method === "POST" && action === "disconnect") {
            state = disconnectSession(state, { ...requireBody(body), sessionId });
            return response(200, {
              sessionId,
              status: state.sessions[sessionId].status,
              authoritativeRevision: state.worldRevision,
              releasedClaims: clone(state.events.at(-1).summary.releasedClaims),
            });
          }
          if (method === "POST" && action === "reconnect") {
            state = reconnectSession(state, { ...requireBody(body), sessionId });
            return response(200, {
              sessionId,
              status: state.sessions[sessionId].status,
              authoritativeRevision: state.worldRevision,
              reconciliation: clone(state.sessions[sessionId].reconciliation),
            });
          }
          if (method === "GET" && action === "reconcile") {
            const fromRevision = Number(url.searchParams.get("fromRevision") ?? "0");
            return response(200, reconcileSession(state, { sessionId, fromRevision }));
          }
        }

        return response(404, { error: "not_found" });
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}
