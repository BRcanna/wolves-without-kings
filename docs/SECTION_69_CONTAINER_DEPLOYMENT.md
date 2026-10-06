# Section 69 — Container deployment contract

Status: built as a reproducible packaging slice; image execution remains environment-gated.

## Implemented

- `Dockerfile` packages the operational authority on Node 22 Alpine;
- the image runs as the non-root `node` user, publishes port 8789, binds through `WWK_HOST=0.0.0.0`, and declares a `/health` container healthcheck;
- `.dockerignore` excludes repository metadata, tests, docs, browser assets, logs, and environment files;
- the launcher still requires `WWK_AUTH_TOKEN` at runtime and accepts optional TLS material by path, so no credentials are copied into the image.

## Acceptance evidence

- `deployment-contract.test.mjs` checks the Dockerfile, ignore rules, launcher secret requirements, host binding, non-root user, and healthcheck;
- `node --check scripts/serve-operational-authority.mjs` passes;
- Docker image build/runtime execution is not locally verified because Docker is unavailable in the current environment.

## Boundary

This is a deployment artifact and structural contract, not a built image, registry publication, orchestrated rollout, TLS certificate operation, secret manager integration, persistent volume/failover proof, load test, or production acceptance. The image contains only the fictional simulation runtime and does not encode real-world criminal procedure.
