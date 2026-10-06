import { createAuthorityHttpServer } from "../src/wolves-without-kings/http-service.mjs";

const port = Number.parseInt(process.env.WWK_PORT ?? "8787", 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("WWK_PORT must be a valid TCP port");

const server = createAuthorityHttpServer();
const shutdown = () => server.close(() => process.exit(0));
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
server.listen(port, "127.0.0.1", () => {
  console.log(`wolves-without-kings authority listening on http://127.0.0.1:${port}`);
});
