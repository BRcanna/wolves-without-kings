import { createHash } from "node:crypto";

import { canonicalJson } from "./engine.mjs";
import { buildVerticalContentPack } from "./content-pack.mjs";

export const SCENARIO_SCHEMA_VERSION = 1;

export class ScenarioValidationError extends Error {
  constructor(message) { super(message); this.name = "ScenarioValidationError"; }
}

export class ScenarioStaleRevisionError extends ScenarioValidationError {
  constructor(expectedRevision, actualRevision) {
    super(`stale scenario command: expected revision ${expectedRevision}, actual revision ${actualRevision}`);
    this.name = "ScenarioStaleRevisionError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

function clone(value) { return structuredClone(value); }
function assertObject(value, field) { if (!value || typeof value !== "object" || Array.isArray(value)) throw new ScenarioValidationError(`${field} must be an object`); }
function assertArray(value, field) { if (!Array.isArray(value)) throw new ScenarioValidationError(`${field} must be an array`); }
function assertNonEmpty(value, field) { if (typeof value !== "string" || value.trim() === "") throw new ScenarioValidationError(`${field} must be a non-empty string`); }
function assertRevision(state, expectedRevision) {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw new ScenarioValidationError("expectedRevision must be a non-negative integer");
  if (expectedRevision !== state.revision) throw new ScenarioStaleRevisionError(expectedRevision, state.revision);
}
function eventHash(event, previousHash) {
  return createHash("sha256").update(`${previousHash ?? "GENESIS"}\n${canonicalJson(event)}`).digest("hex");
}
function appendEvent(state, { eventType, actorId = "system:scenario", subjectIds = [], payload = {} }) {
  const next = clone(state);
  const unsignedEvent = {
    eventId: `scenario-${String(next.nextEventId).padStart(6, "0")}`,
    eventType,
    revision: next.revision + 1,
    simulationDate: next.simulationDate,
    actorId,
    subjectIds: [...subjectIds],
    payload: clone(payload),
    previousHash: next.lastEventHash,
  };
  const event = { ...unsignedEvent, hash: eventHash(unsignedEvent, unsignedEvent.previousHash) };
  next.events.push(event);
  next.nextEventId += 1;
  next.revision = event.revision;
  next.lastEventHash = event.hash;
  return next;
}

function validateChoice(choice, field, sceneIds) {
  assertObject(choice, field);
  assertNonEmpty(choice.id, `${field}.id`);
  assertNonEmpty(choice.label, `${field}.label`);
  assertNonEmpty(choice.branch, `${field}.branch`);
  assertNonEmpty(choice.publicCue, `${field}.publicCue`);
  if (!["observe", "meet", "delegate", "defer"].includes(choice.branch)) throw new ScenarioValidationError(`${field}.branch must be a bounded narrative branch`);
  if (/step-by-step|recipe|instructions|bypass|conceal|evade/i.test(`${choice.label} ${choice.publicCue}`)) throw new ScenarioValidationError(`${field} contains instructional or evasion language`);
  if (choice.nextSceneId !== null && choice.nextSceneId !== undefined) {
    assertNonEmpty(choice.nextSceneId, `${field}.nextSceneId`);
    if (!sceneIds.has(choice.nextSceneId)) throw new ScenarioValidationError(`${field} references unknown scene: ${choice.nextSceneId}`);
  }
}

function validateScenes(state, scenes) {
  const sceneIds = new Set([...Object.keys(state.scenes), ...scenes.map((scene) => scene.id)]);
  const seen = new Set();
  for (const [index, scene] of scenes.entries()) {
    const field = `scenes[${index}]`;
    assertObject(scene, field);
    assertNonEmpty(scene.id, `${field}.id`);
    assertNonEmpty(scene.title, `${field}.title`);
    assertNonEmpty(scene.locationId, `${field}.locationId`);
    assertNonEmpty(scene.summary, `${field}.summary`);
    if (seen.has(scene.id) || state.scenes[scene.id]) throw new ScenarioValidationError(`duplicate scene: ${scene.id}`);
    if (!state.knownLocationIds.includes(scene.locationId)) throw new ScenarioValidationError(`scene references unknown location: ${scene.id}`);
    assertArray(scene.choices, `${field}.choices`);
    if (scene.choices.length === 0) throw new ScenarioValidationError(`${field}.choices must not be empty`);
    const choiceIds = new Set();
    for (const [choiceIndex, choice] of scene.choices.entries()) {
      if (choiceIds.has(choice.id)) throw new ScenarioValidationError(`duplicate choice: ${scene.id}/${choice.id}`);
      choiceIds.add(choice.id);
      validateChoice(choice, `${field}.choices[${choiceIndex}]`, sceneIds);
    }
    seen.add(scene.id);
  }
}

export function createScenarioRegistry({ scenarioPackId = "pack:scenario:wwk", contentPackId, simulationDate = "1998-01-01", knownLocationIds = [] } = {}) {
  assertNonEmpty(scenarioPackId, "scenarioPackId");
  assertNonEmpty(contentPackId, "contentPackId");
  assertNonEmpty(simulationDate, "simulationDate");
  assertArray(knownLocationIds, "knownLocationIds");
  if (knownLocationIds.some((locationId) => typeof locationId !== "string" || locationId.trim() === "")) throw new ScenarioValidationError("knownLocationIds must contain non-empty strings");
  return {
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    scenarioPackId,
    contentPackId,
    simulationDate,
    revision: 0,
    nextEventId: 1,
    lastEventHash: null,
    knownLocationIds: [...new Set(knownLocationIds)],
    scenes: {},
    activeSceneId: null,
    resolutions: [],
    events: [],
  };
}

export function admitScenarioPack(state, { expectedRevision, scenes }) {
  assertRevision(state, expectedRevision);
  assertArray(scenes, "scenes");
  validateScenes(state, scenes);
  const next = clone(state);
  for (const scene of scenes) next.scenes[scene.id] = clone(scene);
  if (next.activeSceneId === null) next.activeSceneId = scenes[0]?.id ?? null;
  return appendEvent(next, {
    eventType: "scenario.pack_admitted",
    subjectIds: [state.scenarioPackId, ...scenes.map((scene) => scene.id)],
    payload: { sceneCount: scenes.length, contentPackId: state.contentPackId },
  });
}

export function resolveScenarioChoice(state, { expectedRevision, sceneId, choiceId, actorId = "character:player" }) {
  assertRevision(state, expectedRevision);
  assertNonEmpty(sceneId, "sceneId");
  assertNonEmpty(choiceId, "choiceId");
  assertNonEmpty(actorId, "actorId");
  if (state.activeSceneId !== sceneId) throw new ScenarioValidationError("scene is not the active authored scene");
  const scene = state.scenes[sceneId];
  if (!scene) throw new ScenarioValidationError(`unknown scene: ${sceneId}`);
  const choice = scene.choices.find((candidate) => candidate.id === choiceId);
  if (!choice) throw new ScenarioValidationError(`unknown choice: ${choiceId}`);
  const next = clone(state);
  next.resolutions.push({ sceneId, choiceId, branch: choice.branch, date: state.simulationDate });
  next.activeSceneId = choice.nextSceneId ?? null;
  return appendEvent(next, {
    eventType: "scenario.choice_resolved",
    actorId,
    subjectIds: [sceneId, choiceId],
    payload: { branch: choice.branch, nextSceneId: next.activeSceneId },
  });
}

export function projectScenario(state, { scope = "public" } = {}) {
  if (scope !== "public") throw new ScenarioValidationError("scenario projection requires public scope");
  return {
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    scenarioPackId: state.scenarioPackId,
    contentPackId: state.contentPackId,
    simulationDate: state.simulationDate,
    activeSceneId: state.activeSceneId,
    scenes: Object.values(state.scenes).map((scene) => ({
      id: scene.id,
      title: scene.title,
      locationId: scene.locationId,
      summary: scene.summary,
      choices: scene.choices.map((choice) => ({ id: choice.id, label: choice.label, branch: choice.branch, publicCue: choice.publicCue, nextSceneId: choice.nextSceneId ?? null })),
    })),
    resolutions: state.resolutions.map((resolution) => ({ sceneId: resolution.sceneId, choiceId: resolution.choiceId, branch: resolution.branch, date: resolution.date })),
    omittedFields: ["authoring metadata", "private prerequisites", "event hashes"],
  };
}

export function buildVerticalScenarioPack() {
  const contentPack = buildVerticalContentPack();
  return {
    scenarioPackId: "pack:scenario:market-lights",
    contentPackId: contentPack.packId,
    scenes: [
      {
        id: "scene:market-lights",
        title: "When the market remembers",
        locationId: "loc:night-market",
        summary: "A venue carries a changed history into the next evening. The district offers more than one coherent response.",
        choices: [
          { id: "choice:listen", label: "Listen before deciding", branch: "observe", publicCue: "learn from the surrounding history", nextSceneId: "scene:market-followup" },
          { id: "choice:meet-owner", label: "Meet the owner", branch: "meet", publicCue: "let a relationship carry the next step", nextSceneId: "scene:market-followup" },
          { id: "choice:delegate-check", label: "Delegate a bounded check", branch: "delegate", publicCue: "give the organization a limited responsibility", nextSceneId: "scene:market-followup" },
        ],
      },
      {
        id: "scene:market-followup",
        title: "What the history changed",
        locationId: "loc:market-street",
        summary: "The next state is shaped by the choice and by the district's accumulated relationships, pressure, and time.",
        choices: [
          { id: "choice:let-time-settle", label: "Let time reveal more", branch: "defer", publicCue: "allow the world to settle before choosing again", nextSceneId: null },
        ],
      },
    ],
  };
}

export function snapshotScenario(state) { return { snapshotVersion: 1, state: clone(state) }; }

export function restoreScenario(snapshotValue) {
  if (!snapshotValue || snapshotValue.snapshotVersion !== 1) throw new ScenarioValidationError("unsupported scenario snapshot version");
  const state = clone(snapshotValue.state);
  if (!state || state.schemaVersion !== SCENARIO_SCHEMA_VERSION) throw new ScenarioValidationError("unsupported scenario schema version");
  let revision = 0;
  let previousHash = null;
  for (const event of state.events) {
    if (event.revision !== revision + 1) throw new ScenarioValidationError("scenario revisions are not contiguous");
    if (event.previousHash !== previousHash) throw new ScenarioValidationError("scenario event chain is broken");
    const { hash, ...unsignedEvent } = event;
    if (hash !== eventHash(unsignedEvent, event.previousHash)) throw new ScenarioValidationError("scenario event hash is invalid");
    revision = event.revision;
    previousHash = event.hash;
  }
  if (state.revision !== revision || state.lastEventHash !== previousHash) throw new ScenarioValidationError("scenario snapshot does not match history");
  return state;
}
