import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("container deployment contract is non-root, health-checked, and secret-free", () => {
  const dockerfile = readFileSync("Dockerfile", "utf8");
  const dockerignore = readFileSync(".dockerignore", "utf8");
  const launcher = readFileSync("scripts/serve-operational-authority.mjs", "utf8");

  assert.match(dockerfile, /^FROM node:22-alpine/m);
  assert.match(dockerfile, /USER node/);
  assert.match(dockerfile, /HEALTHCHECK/);
  assert.match(dockerfile, /EXPOSE 8789/);
  assert.match(dockerfile, /CMD \["node", "scripts\/serve-operational-authority\.mjs"\]/);
  assert.match(dockerfile, /WWK_HOST=0\.0\.0\.0/);
  assert.match(dockerfile, /WWK_JOURNAL_PATH=\/data\/authority\.jsonl/);
  assert.match(dockerfile, /VOLUME \["\/data"\]/);
  assert.match(dockerignore, /^\.env$/m);
  assert.match(dockerignore, /^\.git$/m);
  assert.match(launcher, /WWK_AUTH_TOKEN is required/);
  assert.match(launcher, /WWK_TLS_KEY_PATH/);
  assert.match(launcher, /WWK_HOST/);
  assert.match(launcher, /WWK_JOURNAL_PATH/);
  assert.doesNotMatch(dockerfile, /WWK_AUTH_TOKEN=/);
});
