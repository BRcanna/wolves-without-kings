import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";

import { writeJson } from "./http-service.mjs";
import { createSecureAuthorityHttpHandler } from "./secure-http-service.mjs";

export class OperationalHttpConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "OperationalHttpConfigurationError";
  }
}

function assertPositiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) throw new OperationalHttpConfigurationError(`${field} must be a positive integer`);
}

function pathname(request) {
  return new URL(request.url ?? "/", "http://wolves-without-kings.local").pathname;
}

function isPublicLifecyclePath(request) {
  return request.method === "GET" && ["/health", "/ready"].includes(pathname(request));
}

export function createOperationalAuthorityHttpServer({
  handler = null,
  tls = null,
  requireTls = false,
  maxInFlight = 32,
  ...secureOptions
} = {}) {
  assertPositiveInteger(maxInFlight, "maxInFlight");
  if (tls !== null && (!tls || typeof tls !== "object" || Array.isArray(tls) || !tls.key || !tls.cert)) {
    throw new OperationalHttpConfigurationError("tls must provide key and cert together");
  }
  if (requireTls && !tls) throw new OperationalHttpConfigurationError("requireTls needs TLS key and cert configuration");
  if (handler !== null && typeof handler !== "function") throw new OperationalHttpConfigurationError("handler must be a function or null");

  const requestHandler = handler ?? createSecureAuthorityHttpHandler({ ...secureOptions, requireTls });
  const state = { lifecycle: "starting", activeRequests: 0 };
  let drainWaiters = [];

  const releaseRequest = () => {
    state.activeRequests -= 1;
    if (state.activeRequests === 0 && drainWaiters.length > 0) {
      const waiters = drainWaiters;
      drainWaiters = [];
      for (const resolve of waiters) resolve();
    }
  };

  const onRequest = async (request, response) => {
    const path = pathname(request);
    if (request.method === "GET" && path === "/health") {
      writeJson(response, 200, { service: "wolves-without-kings-authority", status: "ok", lifecycle: state.lifecycle, activeRequests: state.activeRequests });
      return;
    }
    if (request.method === "GET" && path === "/ready") {
      const ready = state.lifecycle === "ready";
      writeJson(response, ready ? 200 : 503, { service: "wolves-without-kings-authority", status: ready ? "ready" : "not-ready", lifecycle: state.lifecycle, activeRequests: state.activeRequests });
      return;
    }
    if (state.lifecycle !== "ready") {
      writeJson(response, 503, { error: state.lifecycle === "draining" ? "service_draining" : "service_not_ready" });
      return;
    }
    if (state.activeRequests >= maxInFlight) {
      writeJson(response, 503, { error: "service_overloaded" });
      return;
    }

    state.activeRequests += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      releaseRequest();
    };
    response.once("finish", release);
    response.once("close", release);
    try {
      await requestHandler(request, response);
    } catch {
      if (!response.headersSent) writeJson(response, 500, { error: "internal_service_error" });
      release();
    }
  };

  const server = tls ? createHttpsServer(tls, onRequest) : createHttpServer(onRequest);
  server.once("listening", () => { state.lifecycle = "ready"; });

  return {
    server,
    get lifecycle() { return state.lifecycle; },
    get activeRequests() { return state.activeRequests; },
    markDraining() {
      if (state.lifecycle !== "stopped") state.lifecycle = "draining";
    },
    async drain({ timeoutMs = 5000 } = {}) {
      assertPositiveInteger(timeoutMs, "timeoutMs");
      this.markDraining();
      if (state.activeRequests === 0) return { drained: true, activeRequests: 0 };
      let timeout;
      await Promise.race([
        new Promise((resolve) => drainWaiters.push(resolve)),
        new Promise((resolve) => { timeout = setTimeout(resolve, timeoutMs); }),
      ]);
      if (timeout) clearTimeout(timeout);
      return { drained: state.activeRequests === 0, activeRequests: state.activeRequests };
    },
    markStopped() { state.lifecycle = "stopped"; },
  };
}

