import { InvalidCommandError, StaleRevisionError } from "./engine.mjs";
import { ScenarioStaleRevisionError, ScenarioValidationError } from "./scenario-pack.mjs";
import { createVerticalRuntime, dispatchVerticalScenarioChoice, projectVerticalRuntime } from "./vertical-runtime.mjs";

function clone(value) { return structuredClone(value); }
function response(status, body) { return { status, body: clone(body) }; }
function routeParts(pathname) { return pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part)); }
function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new ScenarioValidationError(`${field} must be a non-empty string`);
  return value;
}
function requireBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ScenarioValidationError("request body must be an object");
  return body;
}

class ScenarioSessionError extends Error {
  constructor(message) {
    super(message);
    this.name = "ScenarioSessionError";
  }
}

function errorResponse(error) {
  if (error instanceof StaleRevisionError) {
    return response(409, {
      error: "stale_world_revision",
      expectedRevision: error.expectedRevision,
      authoritativeRevision: error.actualRevision,
      reconcileRequired: true,
    });
  }
  if (error instanceof ScenarioStaleRevisionError) {
    return response(409, {
      error: "stale_scenario_revision",
      expectedRevision: error.expectedRevision,
      authoritativeRevision: error.actualRevision,
      reconcileRequired: true,
    });
  }
  if (error instanceof ScenarioSessionError) {
    return response(404, { error: "unknown_scenario_session", message: error.message });
  }
  if (error instanceof InvalidCommandError || error instanceof ScenarioValidationError) {
    return response(400, { error: "invalid_scenario_request", message: error.message });
  }
  throw error;
}

export function createVerticalScenarioService(initialRuntime = createVerticalRuntime()) {
  let runtime = {
    world: clone(initialRuntime.world),
    contentState: clone(initialRuntime.contentState),
    scenarioState: clone(initialRuntime.scenarioState),
  };
  let sessions = {};

  return {
    get state() { return { ...clone(runtime), sessions: clone(sessions) }; },

    request({ method = "GET", path, body = null } = {}) {
      try {
        if (typeof path !== "string" || path.trim() === "") throw new ScenarioValidationError("path must be a non-empty string");
        const url = new URL(path, "http://wolves-without-kings.local");
        const parts = routeParts(url.pathname);
        if (method === "GET" && parts.length === 1 && parts[0] === "scenario") {
          return response(200, projectVerticalRuntime(runtime));
        }
        if (method === "POST" && parts.length === 3 && parts[0] === "scenario" && parts[1] === "sessions" && parts[2] === "connect") {
          const request = requireBody(body);
          const sessionId = requireString(request.sessionId, "sessionId");
          const characterId = requireString(request.characterId, "characterId");
          const clientId = requireString(request.clientId, "clientId");
          if (characterId !== "character:player") throw new ScenarioValidationError("vertical preview accepts only the authored player identity");
          const existing = sessions[sessionId];
          if (existing && existing.characterId !== characterId) throw new ScenarioValidationError("session identity cannot be reassigned");
          sessions = {
            ...sessions,
            [sessionId]: { sessionId, clientId, characterId, status: "connected" },
          };
          return response(existing ? 200 : 201, {
            sessionId,
            clientId,
            characterId,
            status: "connected",
            worldRevision: runtime.world.revision,
            scenarioRevision: runtime.scenarioState.revision,
          });
        }
        if (method === "POST" && parts.length === 2 && parts[0] === "scenario" && parts[1] === "choice") {
          const request = requireBody(body);
          const sessionId = requireString(request.sessionId, "sessionId");
          const session = sessions[sessionId];
          if (!session) throw new ScenarioSessionError(`unknown scenario session: ${sessionId}`);
          if (request.actorId !== undefined && request.actorId !== session.characterId) throw new ScenarioValidationError("actorId must match the connected session identity");
          const result = dispatchVerticalScenarioChoice(runtime, { ...request, actorId: session.characterId });
          runtime = result.runtime;
          return response(200, {
            accepted: true,
            sessionId,
            actorId: session.characterId,
            resolution: result.resolution,
            ...projectVerticalRuntime(runtime),
          });
        }
        return response(404, { error: "not_found" });
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}
