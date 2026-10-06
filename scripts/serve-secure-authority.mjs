import { readFileSync } from "node:fs";

import { createSecureAuthorityHttpServer } from "../src/wolves-without-kings/secure-http-service.mjs";

const token = process.env.WWK_AUTH_TOKEN;
if (typeof token !== "string" || token.trim() === "") throw new Error("WWK_AUTH_TOKEN is required");

const keyPath = process.env.WWK_TLS_KEY_PATH;
const certPath = process.env.WWK_TLS_CERT_PATH;
if ((keyPath && !certPath) || (!keyPath && certPath)) throw new Error("WWK_TLS_KEY_PATH and WWK_TLS_CERT_PATH must be provided together");

const tls = keyPath && certPath
  ? { key: readFileSync(keyPath), cert: readFileSync(certPath) }
  : null;
const requireTls = process.env.WWK_REQUIRE_TLS === "1";
const port = Number.parseInt(process.env.WWK_PORT ?? "8788", 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("WWK_PORT must be a valid TCP port");

const server = createSecureAuthorityHttpServer({
  tokens: [{ tokenId: "env:WWK_AUTH_TOKEN", secret: token }],
  tls,
  requireTls,
});
const protocol = tls ? "https" : "http";
const shutdown = () => server.close(() => process.exit(0));
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
server.listen(port, "127.0.0.1", () => {
  console.log(`wolves-without-kings secure authority listening on ${protocol}://127.0.0.1:${port}`);
});

