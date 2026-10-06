import { createServer } from "node:http";

import { createAuthorityService } from "./service.mjs";

export const DEFAULT_MAX_BODY_BYTES = 256 * 1024;

class HttpRequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = "HttpRequestError";
  }
}

function readBody(request, maxBodyBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    request.on("data", (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBodyBytes) {
        reject(new HttpRequestError(413, "request body exceeds the local service limit"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (totalBytes === 0) {
        resolve(null);
        return;
      }
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new HttpRequestError(400, "request body must be valid JSON"));
      }
    });
    request.on("error", (error) => reject(error));
  });
}

export function writeJson(response, status, body, headers = {}) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

export function createAuthorityHttpHandler({
  service = createAuthorityService(),
  maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
  authorize = null,
  moderate = null,
} = {}) {
  if (!service || typeof service.request !== "function") throw new TypeError("service must expose request");
  if (!Number.isInteger(maxBodyBytes) || maxBodyBytes < 1) throw new TypeError("maxBodyBytes must be a positive integer");
  if (authorize !== null && typeof authorize !== "function") throw new TypeError("authorize must be a function or null");
  if (moderate !== null && typeof moderate !== "function") throw new TypeError("moderate must be a function or null");

  return async (request, response) => {
    try {
      const context = {
        method: request.method,
        path: request.url ?? "/",
        headers: request.headers,
        remoteAddress: request.socket?.remoteAddress ?? null,
        encrypted: request.socket?.encrypted === true,
      };
      if (authorize) {
        const authorization = await authorize(context);
        if (authorization?.status) {
          writeJson(response, authorization.status, authorization.body ?? { error: "unauthorized" }, authorization.headers ?? {});
          return;
        }
        if (authorization?.principal) context.principal = authorization.principal;
      }
      const body = request.method === "GET" || request.method === "HEAD" ? null : await readBody(request, maxBodyBytes);
      if (moderate) {
        const moderation = await moderate({ ...context, body });
        if (moderation?.status) {
          writeJson(response, moderation.status, moderation.body ?? { error: "moderation_review" }, moderation.headers ?? {});
          return;
        }
      }
      const result = service.request({ method: request.method, path: request.url ?? "/", body });
      if (request.method === "HEAD") {
        response.writeHead(result.status, { "cache-control": "no-store" });
        response.end();
        return;
      }
      writeJson(response, result.status, result.body);
    } catch (error) {
      if (error instanceof HttpRequestError) {
        writeJson(response, error.status, { error: "invalid_http_request", message: error.message });
        return;
      }
      writeJson(response, 500, { error: "internal_service_error" });
    }
  };
}

export function createAuthorityHttpServer(options = {}) {
  return createServer(createAuthorityHttpHandler(options));
}
