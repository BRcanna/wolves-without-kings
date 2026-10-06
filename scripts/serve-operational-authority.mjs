import { readFileSync } from "node:fs";

import { createOperationalAuthorityHttpServer } from "../src/wolves-without-kings/operational-http-service.mjs";

const token = process.env.WWK_AUTH_TOKEN;
if (typeof token !== "string" || token.trim() === "") throw new Error("WWK_AUTH_TOKEN is required");

const keyPath = process.env.WWK_TLS_KEY_PATH;
const certPath = process.env.WWK_TLS_CERT_PATH;
if ((keyPath && !certPath) || (!keyPath && certPath)) throw new Error("WWK_TLS_KEY_PATH and WWK_TLS_CERT_PATH must be provided together");
const tls = keyPath && certPath ? { key: readFileSync(keyPath), cert: readFileSync(certPath) } : null;
const requireTls = process.env.WWK_REQUIRE_TLS === "1";
const port = Number.parseInt(process.env.WWK_PORT ?? "8789", 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("WWK_PORT must be a valid TCP port");

const runtime = createOperationalAuthorityHttpServer({
  tokens: [{ tokenId: "env:WWK_AUTH_TOKEN", secret: token }],
  tls,
  requireTls,
  maxInFlight: Number.parseInt(process.env.WWK_MAX_IN_FLIGHT ?? "32", 10),
});
const protocol = tls ? "https" : "http";
let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  await runtime.drain({ timeoutMs: Number.parseInt(process.env.WWK_DRAIN_TIMEOUT_MS ?? "5000", 10) });
  runtime.server.close(() => {
    runtime.markStopped();
    process.exit(0);
  });
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
runtime.server.listen(port, "127.0.0.1", () => {
  console.log(`wolves-without-kings operational authority listening on ${protocol}://127.0.0.1:${port}`);
});

