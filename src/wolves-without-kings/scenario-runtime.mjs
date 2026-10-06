import { claimWorkItem, recordEvent, resolveSocialContact } from "./engine.mjs";
import { buildVerticalScenarioPack } from "./scenario-pack.mjs";

function choiceById(choiceId) {
  for (const scene of buildVerticalScenarioPack().scenes) {
    const choice = scene.choices.find((candidate) => candidate.id === choiceId);
    if (choice) return { scene, choice };
  }
  throw new Error(`unknown vertical scenario choice: ${choiceId}`);
}

export function applyVerticalScenarioChoice(
  world,
  { expectedRevision, choiceId, actorId = "character:player" },
) {
  const { scene, choice } = choiceById(choiceId);
  if (choice.branch === "meet") {
    return resolveSocialContact(world, {
      expectedRevision,
      actorId,
      subjectId: "npc:resident-01",
      locationId: scene.locationId,
      outcome: "welcomed",
    });
  }
  if (choice.branch === "delegate") {
    return claimWorkItem(world, {
      expectedRevision,
      organizationId: "org:lantern-circle",
      workItemId: "work:lantern-check",
      memberId: actorId,
      leaseDays: 4,
    });
  }
  return recordEvent(world, {
    expectedRevision,
    eventType: choice.branch === "observe" ? "scenario.context_observed" : "scenario.time_deferred",
    actors: [actorId],
    subjects: [scene.id, choice.id],
    location: scene.locationId,
    payload: {
      branch: choice.branch,
      consequenceBand: choice.branch === "observe" ? "context-gained" : "history-left-to-settle",
      informationScope: "public-qualitative",
    },
    visibility: "local",
  });
}
