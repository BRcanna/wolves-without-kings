export const UI_PROJECTION_VERSION = 1;

export class UiProjectionValidationError extends Error {
  constructor(message) { super(message); this.name = "UiProjectionValidationError"; }
}

function clone(value) { return structuredClone(value); }
function assertObject(value, field) { if (!value || typeof value !== "object" || Array.isArray(value)) throw new UiProjectionValidationError(`${field} must be an object`); }
function assertNonEmpty(value, field) { if (typeof value !== "string" || value.trim() === "") throw new UiProjectionValidationError(`${field} must be a non-empty string`); }
function band(value, field) { if (!["low", "moderate", "high", "unknown"].includes(value)) throw new UiProjectionValidationError(`${field} must be a qualitative band`); return value; }
function cue(value, field, allowed) { if (!allowed.includes(value)) throw new UiProjectionValidationError(`${field} must be a supported qualitative cue`); return value; }

const RELIABILITY_CUES = { reliable: "usually reliable", mixed: "hard to read", unreliable: "often unreliable", unknown: "little is known" };
const DEBT_CUES = { clear: "nothing is owed", open: "an old obligation remains", strained: "the obligation is becoming a problem", unknown: "the obligation is unclear" };
const AVAILABILITY_CUES = { present: "close at hand", mobile: "moving between places", absent: "not currently reachable", unknown: "whereabouts uncertain" };

export function formatContactCue(contact) {
  assertObject(contact, "contact");
  assertNonEmpty(contact.id, "contact.id");
  assertNonEmpty(contact.displayName, "contact.displayName");
  const reliability = RELIABILITY_CUES[cue(contact.reliabilityBand ?? "unknown", "contact.reliabilityBand", Object.keys(RELIABILITY_CUES))];
  const debt = DEBT_CUES[cue(contact.debtBand ?? "unknown", "contact.debtBand", Object.keys(DEBT_CUES))];
  const availability = AVAILABILITY_CUES[cue(contact.availabilityBand ?? "unknown", "contact.availabilityBand", Object.keys(AVAILABILITY_CUES))];
  const years = Number.isInteger(contact.knownYears) && contact.knownYears > 0 ? "known for years" : "recently known";
  return { id: contact.id, displayName: contact.displayName, summary: `${years}; ${reliability}; ${debt}.`, availability, sourceCue: contact.sourceCue ?? "history incomplete" };
}

export function formatPressureCue(cue) {
  assertObject(cue, "cue");
  assertNonEmpty(cue.id, "cue.id");
  assertNonEmpty(cue.title, "cue.title");
  const severity = band(cue.severityBand ?? "unknown", "cue.severityBand");
  const direction = cue.direction === "rising" ? "rising" : cue.direction === "falling" ? "easing" : "unclear";
  const cause = typeof cue.causeCue === "string" && cue.causeCue.trim() ? cue.causeCue : "the cause is unclear";
  return { id: cue.id, title: cue.title, severity, direction, message: `${cause}; pressure is ${direction}.` };
}

export function buildUiProjection({
  scope = "public",
  calendar,
  contacts = [],
  organization = null,
  properties = [],
  pressureCues = [],
  mapKnowledge = [],
  notifications = [],
} = {}) {
  if (scope !== "public") throw new UiProjectionValidationError("UI projection requires public scope");
  assertObject(calendar, "calendar");
  assertNonEmpty(calendar.date, "calendar.date");
  assertNonEmpty(calendar.era, "calendar.era");
  if (!Array.isArray(contacts) || !Array.isArray(properties) || !Array.isArray(pressureCues) || !Array.isArray(mapKnowledge) || !Array.isArray(notifications)) throw new UiProjectionValidationError("UI collections must be arrays");
  const orgView = organization === null ? null : (() => {
    assertObject(organization, "organization");
    return {
      id: organization.id,
      label: organization.label,
      doctrineCue: organization.doctrineCue ?? "rules are not fully known",
      assignments: (organization.assignments ?? []).map((assignment) => ({ id: assignment.id, label: assignment.label, status: assignment.status, ownerCue: assignment.ownerCue ?? "ownership unclear" })),
    };
  })();
  return {
    projectionVersion: UI_PROJECTION_VERSION,
    calendar: { date: calendar.date, era: calendar.era, lifeCourseCue: calendar.lifeCourseCue ?? "the years are moving" },
    contacts: contacts.map(formatContactCue),
    organization: orgView,
    properties: properties.map((property) => ({ id: property.id, label: property.label, conditionCue: property.conditionCue ?? "condition unclear", claimCue: property.claimCue ?? "ownership history incomplete" })),
    pressureCues: pressureCues.map(formatPressureCue),
    mapKnowledge: mapKnowledge.filter((place) => place.known === true).map((place) => ({ id: place.id, label: place.label, familiarityCue: place.familiarityCue ?? "familiarity growing", discoveredFeatures: [...(place.discoveredFeatures ?? [])] })),
    notifications: notifications.map((notification) => ({ id: notification.id, label: notification.label, tone: ["info", "warning", "urgent"].includes(notification.tone) ? notification.tone : "info" })),
    omittedFields: ["exact trust", "exact debt", "hidden competence", "case confidence", "private NPC belief", "server-only pressure", "event hashes"],
  };
}
