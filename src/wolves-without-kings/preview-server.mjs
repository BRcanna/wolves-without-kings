import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createAuthorityHttpHandler } from "./http-service.mjs";
import { createVerticalScenarioService } from "./scenario-service.mjs";

const STATIC_FILES = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/app.mjs", ["app.mjs", "text/javascript; charset=utf-8"]],
  ["/scenario-preview.mjs", ["scenario-preview.mjs", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/scenario.json", ["scenario.json", "application/json; charset=utf-8"]],
]);

function writeBytes(response, status, contentType, body) {
  response.writeHead(status, { "content-type": contentType, "cache-control": "no-store" });
  response.end(body);
}

export function createPreviewServer({ publicDirectory = resolve(process.cwd(), "web"), service = createVerticalScenarioService() } = {}) {
  const apiHandler = createAuthorityHttpHandler({ service });
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://wolves-without-kings.local");
    if (url.pathname === "/scenario" || url.pathname === "/scenario/choice" || url.pathname === "/scenario/sessions/connect") {
      await apiHandler(request, response);
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      writeBytes(response, 405, "application/json; charset=utf-8", JSON.stringify({ error: "method_not_allowed" }));
      return;
    }
    const staticFile = STATIC_FILES.get(url.pathname);
    if (!staticFile) {
      writeBytes(response, 404, "application/json; charset=utf-8", JSON.stringify({ error: "not_found" }));
      return;
    }
    try {
      const [fileName, contentType] = staticFile;
      const body = await readFile(resolve(publicDirectory, fileName));
      if (request.method === "HEAD") {
        response.writeHead(200, { "content-type": contentType, "cache-control": "no-store" });
        response.end();
        return;
      }
      writeBytes(response, 200, contentType, body);
    } catch {
      writeBytes(response, 500, "application/json; charset=utf-8", JSON.stringify({ error: "preview_asset_unavailable" }));
    }
  });
}
