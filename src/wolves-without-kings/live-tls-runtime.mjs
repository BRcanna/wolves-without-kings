import { createOperationalAuthorityHttpServer } from "./operational-http-service.mjs";
import { projectTlsMaterialRegistry, resolveTlsMaterial } from "./tls-material.mjs";

export const LIVE_TLS_RUNTIME_SCHEMA_VERSION = 1;

export class LiveTlsRuntimeValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "LiveTlsRuntimeValidationError";
  }
}

function clone(value) { return structuredClone(value); }

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new LiveTlsRuntimeValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) throw new LiveTlsRuntimeValidationError(`${field} must be an integer >= ${minimum}`);
}

function resolveMaterial(registry, { materialId, serverName, tick }) {
  try {
    return resolveTlsMaterial(registry, { materialId, serverName, tick });
  } catch (error) {
    throw new LiveTlsRuntimeValidationError(`live TLS material resolution failed: ${error.message}`);
  }
}

export function createLiveTlsAuthorityRuntime({
  service,
  tokens,
  tlsRegistry,
  materialId,
  serverName,
  tick = tlsRegistry?.currentTick ?? 0,
  publicPaths = ["/health", "/ready"],
  maxInFlight = 32,
} = {}) {
  if (!service || typeof service.request !== "function") throw new LiveTlsRuntimeValidationError("service must expose request");
  if (!tlsRegistry || typeof tlsRegistry !== "object") throw new LiveTlsRuntimeValidationError("tlsRegistry is required");
  assertNonEmpty(materialId, "materialId");
  assertNonEmpty(serverName, "serverName");
  assertInteger(tick, "tick");
  const initialMaterial = resolveMaterial(tlsRegistry, { materialId, serverName, tick });
  let registry = clone(tlsRegistry);
  let activeMaterialId = materialId;
  let activeServerName = serverName;
  let currentTick = tick;
  const runtime = createOperationalAuthorityHttpServer({
    service,
    tokens,
    publicPaths,
    tls: { key: initialMaterial.privateKeyPem, cert: initialMaterial.certificatePem },
    requireTls: true,
    maxInFlight,
  });

  function projection() {
    return {
      schemaVersion: LIVE_TLS_RUNTIME_SCHEMA_VERSION,
      lifecycle: runtime.lifecycle,
      activeMaterialId,
      serverName: activeServerName,
      tick: currentTick,
      tls: projectTlsMaterialRegistry(registry, currentTick),
      omittedFields: ["certificatePem", "privateKeyPem", "runtime secret values"],
    };
  }

  function rotate({ nextRegistry, nextMaterialId, nextServerName = activeServerName, nextTick = currentTick } = {}) {
    if (!nextRegistry || typeof nextRegistry !== "object") throw new LiveTlsRuntimeValidationError("nextRegistry is required");
    assertNonEmpty(nextMaterialId, "nextMaterialId");
    assertNonEmpty(nextServerName, "nextServerName");
    assertInteger(nextTick, "nextTick");
    const nextMaterial = resolveMaterial(nextRegistry, { materialId: nextMaterialId, serverName: nextServerName, tick: nextTick });
    if (typeof runtime.server.setSecureContext !== "function") throw new LiveTlsRuntimeValidationError("live server does not support secure-context rotation");
    runtime.server.setSecureContext({ key: nextMaterial.privateKeyPem, cert: nextMaterial.certificatePem });
    registry = clone(nextRegistry);
    activeMaterialId = nextMaterialId;
    activeServerName = nextServerName;
    currentTick = nextTick;
    return clone(projection());
  }

  return {
    server: runtime.server,
    get lifecycle() { return runtime.lifecycle; },
    get activeMaterialId() { return activeMaterialId; },
    get projection() { return clone(projection()); },
    rotate,
    markDraining: runtime.markDraining,
    drain: runtime.drain.bind(runtime),
    markStopped: runtime.markStopped,
  };
}
