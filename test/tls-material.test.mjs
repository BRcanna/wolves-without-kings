import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

import {
  createTlsMaterialRegistry,
  projectTlsMaterialRegistry,
  registerTlsMaterial,
  resolveTlsMaterial,
  restoreTlsMaterialRegistry,
  retireTlsMaterial,
  rotateTlsMaterial,
  snapshotTlsMaterialRegistry,
  TlsMaterialValidationError,
} from "../src/wolves-without-kings/tls-material.mjs";

function fixtureMaterial(label) {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });
  const certificatePem = `-----BEGIN CERTIFICATE-----\nWWK-${label}\n-----END CERTIFICATE-----`;
  return { certificatePem, privateKeyPem };
}

test("TLS material registry supports overlap rotation and server-name resolution", () => {
  const oldMaterial = fixtureMaterial("old");
  const newMaterial = fixtureMaterial("new");
  let registry = registerTlsMaterial(createTlsMaterialRegistry(), { materialId: "tls:old", ...oldMaterial, notAfterTick: 20, serverNames: ["authority.local"] });
  registry = rotateTlsMaterial(registry, { materialId: "tls:new", ...newMaterial, notBeforeTick: 1, notAfterTick: 30, serverNames: ["authority.local"] });
  assert.equal(resolveTlsMaterial(registry, { materialId: "tls:old", serverName: "authority.local", tick: 1 }).materialId, "tls:old");
  assert.equal(resolveTlsMaterial(registry, { serverName: "authority.local", tick: 1 }).materialId, "tls:new");
  assert.throws(() => resolveTlsMaterial(registry, { serverName: "other.local", tick: 1 }), /does not cover/);
});

test("TLS material expiry and retirement fail closed", () => {
  const material = fixtureMaterial("expiring");
  let registry = registerTlsMaterial(createTlsMaterialRegistry(), { materialId: "tls:expiring", ...material, notAfterTick: 5 });
  assert.throws(() => resolveTlsMaterial(registry, { tick: 5 }), /expired/);
  registry = rotateTlsMaterial(registry, { materialId: "tls:replacement", ...fixtureMaterial("replacement"), notBeforeTick: 1, notAfterTick: 20 });
  registry = retireTlsMaterial(registry, { materialId: "tls:expiring", retiredAtTick: 2 });
  assert.throws(() => resolveTlsMaterial(registry, { materialId: "tls:expiring", tick: 2 }), /retired/);
  assert.equal(resolveTlsMaterial(registry, { tick: 2 }).materialId, "tls:replacement");
});

test("TLS snapshots and public projection omit PEM material and require matching runtime injection", () => {
  const material = fixtureMaterial("snapshot");
  const registry = registerTlsMaterial(createTlsMaterialRegistry(), { materialId: "tls:snapshot", ...material, notAfterTick: 10 });
  const snapshot = snapshotTlsMaterialRegistry(registry);
  assert.equal(JSON.stringify(snapshot).includes("BEGIN CERTIFICATE"), false);
  assert.equal(JSON.stringify(snapshot).includes("BEGIN PRIVATE KEY"), false);
  const projection = projectTlsMaterialRegistry(registry);
  assert.equal(JSON.stringify(projection).includes("BEGIN CERTIFICATE"), false);
  assert.ok(projection.omittedFields.includes("privateKeyPem"));
  const restored = restoreTlsMaterialRegistry(snapshot, { materials: { "tls:snapshot": material } });
  assert.equal(resolveTlsMaterial(restored).certificatePem, material.certificatePem);
  assert.throws(
    () => restoreTlsMaterialRegistry(snapshot, { materials: { "tls:snapshot": fixtureMaterial("wrong") } }),
    (error) => error instanceof TlsMaterialValidationError && /digest mismatch/.test(error.message),
  );
});
