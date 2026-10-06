export const PREVIEW_ACCESSIBILITY_VERSION = 1;

export class PreviewAccessibilityValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "PreviewAccessibilityValidationError";
  }
}

function assertMarkup(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new PreviewAccessibilityValidationError(`${field} must be non-empty markup`);
}

function addFinding(findings, id, message) {
  findings.push({ id, message });
}

function attributeValue(attributes, name) {
  const match = attributes.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1] ?? null;
}

export function auditPreviewAccessibility({ html, css } = {}) {
  assertMarkup(html, "html");
  assertMarkup(css, "css");
  const findings = [];

  if (!/<html\b[^>]*\blang\s*=\s*["'][^"']+["']/i.test(html)) addFinding(findings, "document-language", "the document must declare a language on <html>");
  if (!/<title>\s*[^<]+\s*<\/title>/i.test(html)) addFinding(findings, "document-title", "the document must provide a non-empty title");
  if (!/<a\b[^>]*\bhref\s*=\s*["']#main-content["'][^>]*>\s*[^<]+\s*<\/a>/i.test(html)) addFinding(findings, "skip-navigation", "the document must provide a skip link to #main-content");
  if (!/<main\b[^>]*\bid\s*=\s*["']main-content["']/i.test(html)) addFinding(findings, "main-landmark", "the primary content must expose a main landmark with id main-content");
  if (!/<h1\b[^>]*>\s*[^<]+\s*<\/h1>/i.test(html)) addFinding(findings, "page-heading", "the document must provide a non-empty h1");
  if (!/<noscript\b[^>]*>\s*[^<]+/i.test(html)) addFinding(findings, "noscript-fallback", "the preview must explain its boundary when scripts are unavailable");

  const liveRegions = [...html.matchAll(/\baria-live\s*=\s*["'](polite|assertive)["']/gi)];
  if (liveRegions.length < 2) addFinding(findings, "live-status", "status and interactive feedback must expose at least two live regions");

  const headingIds = new Set([...html.matchAll(/<h[1-6]\b[^>]*\bid\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]));
  for (const match of html.matchAll(/<section\b([^>]*)>/gi)) {
    const labelId = attributeValue(match[1], "aria-labelledby");
    if (labelId && !headingIds.has(labelId)) addFinding(findings, `section-heading:${labelId}`, `section aria-labelledby=${labelId} must reference a heading id`);
  }

  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    if (attributeValue(match[1], "alt") === null) addFinding(findings, "image-alternative", "images must provide an alt attribute");
  }

  if (!/:focus-visible\b/i.test(css)) addFinding(findings, "focus-visible", "interactive controls must define a visible focus-visible state");
  if (!/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/i.test(css)) addFinding(findings, "reduced-motion", "the preview must define a prefers-reduced-motion fallback");

  return {
    version: PREVIEW_ACCESSIBILITY_VERSION,
    passed: findings.length === 0,
    findings,
    boundary: "static preview-asset audit; not screen-reader, fresh-player, localization, controller, visual-regression, or hardware acceptance",
  };
}
