export const CI_CONTRACT_VERSION = 1;

export class CiContractValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "CiContractValidationError";
  }
}

function assertNonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new CiContractValidationError(`${field} must be a non-empty string`);
}

export function auditCiWorkflow(workflow) {
  assertNonEmpty(workflow, "workflow");
  const findings = [];
  const requirePattern = (id, pattern, message) => {
    if (!pattern.test(workflow)) findings.push({ id, message });
  };
  requirePattern("push-trigger", /push:\s*\n\s*branches:\s*\[main\]/, "CI must run on pushes to main");
  requirePattern("pull-request-trigger", /pull_request:/, "CI must run on pull requests");
  requirePattern("read-only-permission", /permissions:\s*\n\s*contents:\s*read/, "CI must use read-only repository permissions");
  requirePattern("checkout-action", /uses:\s*actions\/checkout@v4/, "CI must use the pinned checkout action major version");
  requirePattern("node-action", /uses:\s*actions\/setup-node@v4/, "CI must use the pinned Node setup action major version");
  requirePattern("node-version", /node-version:\s*22(?:\.x)?/, "CI must exercise the supported Node.js 22 runtime");
  requirePattern("test-gate", /run:\s*npm test/, "CI must run the full test suite");
  requirePattern("preview-gate", /run:\s*npm run preview:build/, "CI must build the public preview");
  requirePattern("verify-gate", /run:\s*npm run verify/, "CI must run the docuseries verifier");
  if (/pull_request_target:/i.test(workflow)) findings.push({ id: "unsafe-pull-request-trigger", message: "CI must not execute untrusted pull requests with pull_request_target" });
  if (/secrets\./i.test(workflow)) findings.push({ id: "secret-dependency", message: "local CI gates must not require repository secrets" });
  return { version: CI_CONTRACT_VERSION, passed: findings.length === 0, findings, boundary: "GitHub-hosted local-gate automation; not production deployment, security, availability, or hardware acceptance" };
}
