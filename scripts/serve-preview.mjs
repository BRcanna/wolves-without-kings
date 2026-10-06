import { createPreviewServer } from "../src/wolves-without-kings/preview-server.mjs";

const port = Number.parseInt(process.env.WWK_PREVIEW_PORT ?? "8788", 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("WWK_PREVIEW_PORT must be a valid TCP port");

const server = createPreviewServer();
const shutdown = () => server.close(() => process.exit(0));
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
server.listen(port, "127.0.0.1", () => {
  console.log(`wolves-without-kings preview listening on http://127.0.0.1:${port}`);
});
