function clone(value) {
  return structuredClone(value);
}

export function resolvePublicScenarioChoice(scenario, { sceneId, choiceId } = {}) {
  if (!scenario || typeof scenario !== "object") throw new Error("scenario projection is required");
  if (scenario.activeSceneId !== sceneId) throw new Error("scene is not the active preview scene");
  const scene = scenario.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) throw new Error(`unknown preview scene: ${sceneId}`);
  const choice = scene.choices.find((candidate) => candidate.id === choiceId);
  if (!choice) throw new Error(`unknown preview choice: ${choiceId}`);
  const next = clone(scenario);
  next.resolutions.push({
    sceneId,
    choiceId,
    branch: choice.branch,
    date: scenario.simulationDate,
  });
  next.activeSceneId = choice.nextSceneId;
  return { scenario: next, choice: clone(choice) };
}
