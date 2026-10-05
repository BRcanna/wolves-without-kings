import test from "node:test";
import assert from "node:assert/strict";

import {
  NpcAiValidationError,
  advanceNpcAiTime,
  createNpcAiState,
  planNpcAgent,
  projectNpcAi,
  recordNpcObservation,
  registerNpcAiAgent,
  resolveNpcOrganizationOrder,
  restoreNpcAi,
  snapshotNpcAi,
} from "../src/wolves-without-kings/npc-ai.mjs";

function register(state, options) {
  return registerNpcAiAgent(state, { expectedRevision: state.revision, ...options });
}

test("NPC plans use scoped beliefs instead of evaluator truth", () => {
  let state = createNpcAiState();
  state = register(state, {
    agentId: "npc:major",
    tier: "major",
    beliefs: { "claim:route-pattern": "uncertain" },
  });
  state = planNpcAgent(state, {
    expectedRevision: state.revision,
    agentId: "npc:major",
    goal: "protect the venue",
    requiredBeliefs: ["claim:route-pattern"],
  });

  assert.equal(state.agents["npc:major"].plans.at(-1).knowledgeBand, "uncertain");
  assert.equal(state.agents["npc:major"].plans.at(-1).posture, "hesitant");
  assert.equal(state.agents["npc:major"].plans.at(-1).steps.length, 4);
});

test("needs and obligations compete while background agents remain bounded", () => {
  let state = createNpcAiState();
  state = register(state, {
    agentId: "npc:major",
    tier: "major",
    needs: { safety: 90, sleep: 40, family: 20, money: 10 },
    obligations: { family: 10, organization: 20 },
  });
  state = register(state, { agentId: "npc:background", tier: "background" });
  state = planNpcAgent(state, { expectedRevision: state.revision, agentId: "npc:major", goal: "hold position" });
  state = planNpcAgent(state, { expectedRevision: state.revision, agentId: "npc:background", goal: "continue routine" });

  assert.equal(state.agents["npc:major"].plans.at(-1).posture, "need-led");
  assert.equal(state.agents["npc:background"].plans.at(-1).steps.length, 2);
});

test("adaptive pressure requires repeated observations and remains capped", () => {
  let state = createNpcAiState({ maxAdaptivePressure: 3 });
  state = register(state, { agentId: "npc:observer", tier: "major" });
  state = recordNpcObservation(state, { expectedRevision: state.revision, agentId: "npc:observer", patternKey: "route-a", outcome: "successful" });
  state = recordNpcObservation(state, { expectedRevision: state.revision, agentId: "npc:observer", patternKey: "route-b", outcome: "missed" });
  assert.equal(state.agents["npc:observer"].adaptivePressure, 0);
  for (let index = 0; index < 8; index += 1) {
    state = recordNpcObservation(state, { expectedRevision: state.revision, agentId: "npc:observer", patternKey: "route-a", outcome: "successful" });
  }
  assert.equal(state.agents["npc:observer"].adaptivePressure, 3);
  assert.equal(state.events.at(-1).payload.adaptivePressureBand, "high");
});

test("organization orders resolve through loyalty, fear, and competence without mind control", () => {
  let state = createNpcAiState();
  state = register(state, { agentId: "npc:aligned", values: { loyalty: 90, fear: 40, competence: 80 } });
  state = register(state, { agentId: "npc:uncertain", values: { loyalty: 50, fear: 20, competence: 50 } });
  state = register(state, { agentId: "npc:independent", values: { loyalty: 10, fear: 5, competence: 20 } });
  state = resolveNpcOrganizationOrder(state, { expectedRevision: state.revision, agentId: "npc:aligned", orderId: "order:one" });
  state = resolveNpcOrganizationOrder(state, { expectedRevision: state.revision, agentId: "npc:uncertain", orderId: "order:two" });
  state = resolveNpcOrganizationOrder(state, { expectedRevision: state.revision, agentId: "npc:independent", orderId: "order:three", consequenceBand: "high" });

  assert.equal(state.agents["npc:aligned"].orders.at(-1).outcome, "complies");
  assert.equal(state.agents["npc:uncertain"].orders.at(-1).outcome, "hesitates");
  assert.equal(state.agents["npc:independent"].orders.at(-1).outcome, "deviates");
});

test("NPC time settlement, snapshot integrity, and public projection preserve the privacy boundary", () => {
  let state = createNpcAiState();
  state = register(state, {
    agentId: "npc:private",
    beliefs: { "claim:hidden": "known" },
    needs: { safety: 70, sleep: 20, family: 30, money: 20 },
  });
  state = advanceNpcAiTime(state, { expectedRevision: state.revision, days: 60 });
  const restored = restoreNpcAi(snapshotNpcAi(state));
  const projection = projectNpcAi(restored);

  assert.equal(restored.simulationDate, "1998-03-02");
  assert.deepEqual(restored, state);
  assert.equal("beliefs" in projection.agents[0], false);
  assert.equal("needs" in projection.agents[0], false);
  assert.ok(projection.omittedFields.includes("observations"));

  const tampered = snapshotNpcAi(state);
  tampered.state.agents["npc:private"].needs.sleep = 100;
  assert.throws(() => restoreNpcAi(tampered), (error) => error instanceof NpcAiValidationError);
});
