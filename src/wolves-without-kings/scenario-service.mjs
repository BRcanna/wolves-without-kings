import { InvalidCommandError, StaleRevisionError } from "./engine.mjs";
import { ScenarioStaleRevisionError, ScenarioValidationError } from "./scenario-pack.mjs";
import { createVerticalRuntime, dispatchVerticalScenarioChoice, projectVerticalRuntime } from "./vertical-runtime.mjs";

function clone(value) { return structuredClone(value); }
function response(status, body) { return { status, body: clone(body) }; }
function routeParts(pathname) { return pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part)); }
function requireBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ScenarioValidationError("request body must be an object");
  return body;
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

  return {
    get state() { return clone(runtime); },

    request({ method = "GET", path, body = null } = {}) {
      try {
        if (typeof path !== "string" || path.trim() === "") throw new ScenarioValidationError("path must be a non-empty string");
        const url = new URL(path, "http://wolves-without-kings.local");
        const parts = routeParts(url.pathname);
        if (method === "GET" && parts.length === 1 && parts[0] === "scenario") {
          return response(200, projectVerticalRuntime(runtime));
        }
        if (method === "POST" && parts.length === 2 && parts[0] === "scenario" && parts[1] === "choice") {
          const request = requireBody(body);
          const result = dispatchVerticalScenarioChoice(runtime, request);
          runtime = result.runtime;
          return response(200, {
            accepted: true,
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
