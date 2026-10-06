import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { request as httpsRequest } from "node:https";
import { connect as tlsConnect } from "node:tls";

import { createAuthorityService } from "../src/wolves-without-kings/service.mjs";
import { createLiveTlsAuthorityRuntime } from "../src/wolves-without-kings/live-tls-runtime.mjs";
import { createTlsMaterialRegistry, registerTlsMaterial, rotateTlsMaterial } from "../src/wolves-without-kings/tls-material.mjs";

const oldMaterial = {
  certificatePem: readFileSync(new URL("./fixtures/wwk-tls-old-cert.pem", import.meta.url), "utf8"),
  privateKeyPem: readFileSync(new URL("./fixtures/wwk-tls-old-key.pem", import.meta.url), "utf8"),
};
const newMaterial = {
  certificatePem: readFileSync(new URL("./fixtures/wwk-tls-new-cert.pem", import.meta.url), "utf8"),
  privateKeyPem: readFileSync(new URL("./fixtures/wwk-tls-new-key.pem", import.meta.url), "utf8"),
};

async function listen(runtime) {
  await new Promise((resolve, reject) => {
    runtime.server.once("error", reject);
    runtime.server.listen(0, "127.0.0.1", resolve);
  });
  return runtime.server.address().port;
}

async function close(runtime) {
  runtime.markDraining();
  await runtime.drain({ timeoutMs: 1000 });
  await new Promise((resolve, reject) => runtime.server.close((error) => error ? reject(error) : resolve()));
  runtime.markStopped();
}

function tlsRequest(port, path, { method = "GET", body = null, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const request = httpsRequest({ hostname: "127.0.0.1", port, path, method, rejectUnauthorized: false, headers: body === null ? headers : { "content-type": "application/json", ...headers } }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) }));
    });
    request.once("error", reject);
    if (body !== null) request.end(JSON.stringify(body));
    else request.end();
  });
}

function peerFingerprint(port) {
  return new Promise((resolve, reject) => {
    const socket = tlsConnect({ host: "127.0.0.1", port, servername: "localhost", rejectUnauthorized: false }, () => {
      const fingerprint = socket.getPeerCertificate().fingerprint256;
      socket.end();
      resolve(fingerprint);
    });
    socket.once("error", reject);
  });
}

test("live TLS runtime serves HTTPS and rotates the active secure context without exposing PEM material", async () => {
  let registry = registerTlsMaterial(createTlsMaterialRegistry(), { materialId: "tls:old", ...oldMaterial, notAfterTick: 20, serverNames: ["localhost"] });
  registry = rotateTlsMaterial(registry, { materialId: "tls:new", ...newMaterial, notBeforeTick: 1, notAfterTick: 30, serverNames: ["localhost"] });
  const runtime = createLiveTlsAuthorityRuntime({ service: createAuthorityService(), tokens: ["tls-test-token"], tlsRegistry: registry, materialId: "tls:old", serverName: "localhost", tick: 0 });
  const port = await listen(runtime);
  try {
    const before = await peerFingerprint(port);
    const health = await tlsRequest(port, "/health");
    assert.equal(health.status, 200);
    assert.equal(health.body.lifecycle, "ready");
    const rotated = runtime.rotate({ nextRegistry: registry, nextMaterialId: "tls:new", nextServerName: "localhost", nextTick: 2 });
    const after = await peerFingerprint(port);
    assert.notEqual(after, before);
    assert.equal(rotated.activeMaterialId, "tls:new");
    assert.equal(JSON.stringify(runtime.projection).includes("BEGIN CERTIFICATE"), false);
    const connected = await tlsRequest(port, "/sessions/connect", {
      method: "POST",
      headers: { authorization: "Bearer tls-test-token" },
      body: { sessionId: "session:tls", clientId: "client:tls", characterId: "character:tls", role: "host", regionId: "region:sofia-south" },
    });
    assert.equal(connected.status, 201);
  } finally {
    await close(runtime);
  }
});

test("live TLS runtime rejects material that is not valid at the requested tick or server name", () => {
  const registry = registerTlsMaterial(createTlsMaterialRegistry(), { materialId: "tls:future", ...oldMaterial, notBeforeTick: 5, notAfterTick: 10, serverNames: ["authority.local"] });
  assert.throws(() => createLiveTlsAuthorityRuntime({ service: createAuthorityService(), tokens: ["token"], tlsRegistry: registry, materialId: "tls:future", serverName: "authority.local", tick: 1 }), /not-yet-valid/);
  assert.throws(() => createLiveTlsAuthorityRuntime({ service: createAuthorityService(), tokens: ["token"], tlsRegistry: registry, materialId: "tls:future", serverName: "other.local", tick: 5 }), /does not cover/);
});
