# Section 91 — GitHub Actions Local-Gate CI

The repository now includes a read-only GitHub Actions workflow for every `main` push and pull request. It executes the same full test, public-preview build, and docuseries verification gates used locally.

## Contract

- the workflow runs on `push` to `main` and `pull_request` events;
- the job uses Node.js 22, pinned official checkout/setup actions, and `contents: read` permissions;
- the job runs `npm test`, `npm run preview:build`, and `npm run verify` without repository secrets;
- a static contract audit rejects unsafe `pull_request_target` triggers, write permissions, missing gates, or secret dependencies.

## Acceptance evidence

`ci-contract.test.mjs` audits the committed workflow and proves unsafe or incomplete workflow text fails closed.

## Boundary

This is GitHub-hosted local-gate automation. It is not evidence that GitHub Actions is currently enabled for the account, that a hosted run has completed, or that the game has production deployment, security, availability, hardware/FPS, or live-player acceptance.
