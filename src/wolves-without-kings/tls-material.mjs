import { createHash, createPrivateKey, createPublicKey } from "node:crypto";

export const TLS_MATERIAL_SCHEMA_VERSION = 1;

export class TlsMaterialValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "TlsMaterialValidationError";
  }
}

function clone(value) { return structuredClone(value); }

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new TlsMaterialValidationError(`${field} must be a non-empty string`);
}

function assertInteger(value, field, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) throw new TlsMaterialValidationError(`${field} must be an integer >= ${minimum}`);
}

function assertPem(value, field, label) {
  assertNonEmpty(value, field);
  if (!value.includes(`-----BEGIN ${label}-----`) || !value.includes(`-----END ${label}-----`)) {
    throw new TlsMaterialValidationError(`${field} must contain a PEM ${label} block`);
  }
}

function fingerprint(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function publicKeyFingerprint(privateKeyPem) {
  try {
    const privateKey = createPrivateKey(privateKeyPem);
    return fingerprint(createPublicKey(privateKey).export({ type: "spki", format: "der" }).toString("base64"));
  } catch (error) {
    throw new TlsMaterialValidationError(`private key is invalid: ${error.message}`);
  }
}

function materialStatus(material, tick) {
  if (material.retiredAtTick !== null) return "retired";
  if (tick < material.notBeforeTick) return "not-yet-valid";
  if (tick >= material.notAfterTick) return "expired";
  return "active";
}

function assertState(state) {
  if (!state || state.schemaVersion !== TLS_MATERIAL_SCHEMA_VERSION || !state.materials || typeof state.materials !== "object" || Array.isArray(state.materials)) {
    throw new TlsMaterialValidationError("invalid TLS material registry state");
  }
  assertInteger(state.currentTick, "currentTick");
}

export function createTlsMaterialRegistry({ currentTick = 0 } = {}) {
  assertInteger(currentTick, "currentTick");
  return { schemaVersion: TLS_MATERIAL_SCHEMA_VERSION, currentTick, activeMaterialId: null, materials: {} };
}

export function registerTlsMaterial(state, {
  materialId,
  certificatePem,
  privateKeyPem,
  notBeforeTick = state.currentTick,
  notAfterTick,
  serverNames = [],
} = {}) {
  assertState(state);
  assertNonEmpty(materialId, "materialId");
  assertPem(certificatePem, "certificatePem", "CERTIFICATE");
  assertPem(privateKeyPem, "privateKeyPem", privateKeyPem.includes("BEGIN RSA PRIVATE KEY") ? "RSA PRIVATE KEY" : privateKeyPem.includes("BEGIN EC PRIVATE KEY") ? "EC PRIVATE KEY" : "PRIVATE KEY");
  assertInteger(notBeforeTick, "notBeforeTick");
  assertInteger(notAfterTick, "notAfterTick");
  if (notAfterTick <= notBeforeTick) throw new TlsMaterialValidationError("notAfterTick must be after notBeforeTick");
  if (!Array.isArray(serverNames) || serverNames.some((name) => typeof name !== "string" || name.trim() === "")) throw new TlsMaterialValidationError("serverNames must contain non-empty strings");
  if (state.materials[materialId]) throw new TlsMaterialValidationError(`TLS material already exists: ${materialId}`);
  const next = clone(state);
  next.materials[materialId] = {
    materialId,
    certificatePem,
    privateKeyPem,
    certificateDigest: fingerprint(certificatePem),
    publicKeyDigest: publicKeyFingerprint(privateKeyPem),
    notBeforeTick,
    notAfterTick,
    serverNames: [...new Set(serverNames)],
    retiredAtTick: null,
  };
  if (!next.activeMaterialId) next.activeMaterialId = materialId;
  return next;
}

export function rotateTlsMaterial(state, options = {}) {
  const next = registerTlsMaterial(state, options);
  next.activeMaterialId = options.materialId;
  return next;
}

export function retireTlsMaterial(state, { materialId, retiredAtTick = state.currentTick } = {}) {
  assertState(state);
  assertNonEmpty(materialId, "materialId");
  assertInteger(retiredAtTick, "retiredAtTick");
  if (!state.materials[materialId]) throw new TlsMaterialValidationError(`unknown TLS material ${materialId}`);
  const next = clone(state);
  next.materials[materialId].retiredAtTick = retiredAtTick;
  if (next.activeMaterialId === materialId) next.activeMaterialId = null;
  return next;
}

export function resolveTlsMaterial(state, { materialId = state.activeMaterialId, serverName, tick = state.currentTick } = {}) {
  assertState(state);
  assertNonEmpty(materialId, "materialId");
  assertInteger(tick, "tick");
  const material = state.materials[materialId];
  if (!material) throw new TlsMaterialValidationError(`unknown TLS material ${materialId}`);
  const status = materialStatus(material, tick);
  if (status !== "active") throw new TlsMaterialValidationError(`TLS material ${materialId} is ${status}`);
  if (serverName !== undefined) {
    assertNonEmpty(serverName, "serverName");
    if (material.serverNames.length > 0 && !material.serverNames.includes(serverName)) throw new TlsMaterialValidationError(`TLS material ${materialId} does not cover server name ${serverName}`);
  }
  return clone(material);
}

export function projectTlsMaterialRegistry(state, tick = state.currentTick) {
  assertState(state);
  assertInteger(tick, "tick");
  return {
    schemaVersion: TLS_MATERIAL_SCHEMA_VERSION,
    currentTick: tick,
    activeMaterialId: state.activeMaterialId,
    materials: Object.values(state.materials).map((material) => ({
      materialId: material.materialId,
      status: materialStatus(material, tick),
      certificateDigest: material.certificateDigest,
      publicKeyDigest: material.publicKeyDigest,
      notBeforeTick: material.notBeforeTick,
      notAfterTick: material.notAfterTick,
      serverNames: [...material.serverNames],
      retiredAtTick: material.retiredAtTick,
    })),
    omittedFields: ["certificatePem", "privateKeyPem"],
  };
}

export function snapshotTlsMaterialRegistry(state) {
  assertState(state);
  return {
    snapshotVersion: 1,
    state: {
      schemaVersion: state.schemaVersion,
      currentTick: state.currentTick,
      activeMaterialId: state.activeMaterialId,
      materials: Object.fromEntries(Object.entries(state.materials).map(([materialId, material]) => [materialId, {
        materialId: material.materialId,
        certificateDigest: material.certificateDigest,
        publicKeyDigest: material.publicKeyDigest,
        notBeforeTick: material.notBeforeTick,
        notAfterTick: material.notAfterTick,
        serverNames: [...material.serverNames],
        retiredAtTick: material.retiredAtTick,
      }])),
    },
  };
}

export function restoreTlsMaterialRegistry(snapshot, { materials = {} } = {}) {
  if (!snapshot || snapshot.snapshotVersion !== 1) throw new TlsMaterialValidationError("unsupported TLS material snapshot version");
  const state = clone(snapshot.state);
  assertState(state);
  if (!materials || typeof materials !== "object" || Array.isArray(materials)) throw new TlsMaterialValidationError("materials must be an object");
  for (const material of Object.values(state.materials)) {
    const supplied = materials[material.materialId];
    if (!supplied || typeof supplied !== "object") throw new TlsMaterialValidationError(`runtime material missing: ${material.materialId}`);
    assertPem(supplied.certificatePem, `materials.${material.materialId}.certificatePem`, "CERTIFICATE");
    const keyDigest = publicKeyFingerprint(supplied.privateKeyPem);
    if (fingerprint(supplied.certificatePem) !== material.certificateDigest || keyDigest !== material.publicKeyDigest) throw new TlsMaterialValidationError(`runtime material digest mismatch: ${material.materialId}`);
    material.certificatePem = supplied.certificatePem;
    material.privateKeyPem = supplied.privateKeyPem;
  }
  return state;
}
