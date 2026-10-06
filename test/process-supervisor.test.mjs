import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

import { createProcessSupervisor, ProcessSupervisorValidationError } from "../src/wolves-without-kings/process-supervisor.mjs";

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

const fixture = "const http=require('node:http'); const port=Number(process.env.WWK_SUPERVISOR_PORT); const server=http.createServer((req,res)=>{if(req.url==='/health'){res.writeHead(200,{'content-type':'application/json'});res.end('{\"status\":\"ok\"}');return;}res.writeHead(404);res.end();}); server.listen(port,'127.0.0.1'); process.on('SIGTERM',()=>server.close(()=>process.exit(0)));";

test("process supervisor starts, health-checks, restarts within budget, and drains gracefully", async () => {
  const port = await reservePort();
  const supervisor = createProcessSupervisor({
    command: process.execPath,
    args: ["-e", fixture],
    env: { WWK_SUPERVISOR_PORT: String(port) },
    healthUrl: `http://127.0.0.1:${port}/health`,
    maxRestarts: 1,
  });
  await supervisor.start();
  assert.equal(supervisor.lifecycle, "ready");
  const firstPid = supervisor.pid;
  assert.equal(typeof firstPid, "number");
  process.kill(firstPid);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(supervisor.lifecycle, "failed");
  await supervisor.restart();
  assert.equal(supervisor.lifecycle, "ready");
  assert.notEqual(supervisor.pid, firstPid);
  assert.equal(supervisor.projection.restartCount, 1);
  assert.equal(JSON.stringify(supervisor.projection).includes(fixture), false);
  await supervisor.stop();
  assert.equal(supervisor.lifecycle, "stopped");
  await assert.rejects(() => supervisor.restart(), (error) => error instanceof ProcessSupervisorValidationError && /budget exhausted/.test(error.message));
});

test("process supervisor rejects malformed configuration before spawning", () => {
  assert.throws(() => createProcessSupervisor({ command: process.execPath, healthUrl: "not-a-url" }), /valid URL/);
  assert.throws(() => createProcessSupervisor({ command: process.execPath, healthUrl: "http://127.0.0.1:1/health", args: [1] }), /only strings/);
});
