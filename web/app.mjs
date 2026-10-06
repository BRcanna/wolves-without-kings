import { resolvePublicScenarioChoice } from "./scenario-preview.mjs";

const status = document.querySelector("#status");

function text(value) {
  return document.createTextNode(String(value));
}

function appendMetric(container, label, value) {
  const card = document.createElement("article");
  card.className = "metric";
  const number = document.createElement("strong");
  number.className = "metric-value";
  number.append(text(value));
  const caption = document.createElement("span");
  caption.className = "metric-label";
  caption.append(text(label));
  card.append(number, caption);
  container.append(card);
}

function appendBusiness(container, business) {
  const card = document.createElement("article");
  card.className = "card";
  const title = document.createElement("h3");
  title.append(text(business.displayName));
  const type = document.createElement("p");
  type.append(text(`${business.venueType} · ${business.condition}`));
  const age = document.createElement("p");
  age.append(text(`${business.ageDays} days in the world`));
  card.append(title, type, age);
  container.append(card);
}

function appendMarket(container, market) {
  const card = document.createElement("article");
  card.className = "card";
  const title = document.createElement("h3");
  title.append(text(market.commodity));
  const price = document.createElement("p");
  price.className = "price";
  price.append(text(`${market.priceBand.low}–${market.priceBand.high} band`));
  const region = document.createElement("p");
  region.append(text(`${market.regionId} · information lag ${market.informationLagDays}d`));
  card.append(title, price, region);
  container.append(card);
}

function appendUiCard(container, titleText, bodyText) {
  const card = document.createElement("article");
  card.className = "card";
  const title = document.createElement("h3");
  title.append(text(titleText));
  const body = document.createElement("p");
  body.append(text(bodyText));
  card.append(title, body);
  container.append(card);
}

function clear(container) {
  while (container.firstChild) container.removeChild(container.firstChild);
}

function renderScenario(scenario) {
  const container = document.querySelector("#scenario-list");
  const feedback = document.querySelector("#scenario-feedback");
  clear(container);
  scenario.scenes.forEach((scene) => {
    const card = document.createElement("article");
    card.className = "card scenario-card";
    const title = document.createElement("h3");
    title.append(text(scene.title));
    const summary = document.createElement("p");
    summary.append(text(scene.summary));
    card.append(title, summary);

    const resolution = [...scenario.resolutions].reverse().find((entry) => entry.sceneId === scene.id);
    if (resolution) {
      const resolved = document.createElement("p");
      resolved.className = "scenario-resolved";
      const chosen = scene.choices.find((choice) => choice.id === resolution.choiceId);
      resolved.append(text(`Resolved: ${chosen?.label ?? resolution.choiceId} · ${chosen?.publicCue ?? "history recorded"}.`));
      card.append(resolved);
    } else if (scenario.activeSceneId === scene.id) {
      const actions = document.createElement("div");
      actions.className = "scenario-choices";
      scene.choices.forEach((choice) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "choice-button";
        button.dataset.choiceId = choice.id;
        button.append(text(choice.label));
        button.addEventListener("click", () => {
          const result = resolvePublicScenarioChoice(scenario, { sceneId: scene.id, choiceId: choice.id });
          scenario.resolutions = result.scenario.resolutions;
          scenario.activeSceneId = result.scenario.activeSceneId;
          feedback.textContent = `${result.choice.publicCue}. Preview branch is held in memory only; no authoritative world state was changed.`;
          renderScenario(scenario);
        });
        actions.append(button);
      });
      card.append(actions);
    } else {
      const waiting = document.createElement("p");
      waiting.className = "scenario-waiting";
      waiting.append(text("This scene becomes available when the preceding history reaches it."));
      card.append(waiting);
    }
    container.append(card);
  });
  if (scenario.activeSceneId === null) {
    feedback.textContent = "This preview branch has reached its local endpoint. The recorded choices remain presentation-only.";
  }
}

function renderUi(ui) {
  document.querySelector("#calendar-cue").textContent = `${ui.calendar.date} · ${ui.calendar.era} · ${ui.calendar.lifeCourseCue}`;
  ui.mapKnowledge.forEach((place) => appendUiCard(document.querySelector("#map-list"), place.label, `${place.familiarityCue}; known features: ${place.discoveredFeatures.join(", ")}.`));
  ui.contacts.forEach((contact) => appendUiCard(document.querySelector("#contacts-list"), contact.displayName, `${contact.summary} ${contact.availability}.`));
  if (ui.organization) {
    document.querySelector("#organization-cue").textContent = `${ui.organization.label} · ${ui.organization.doctrineCue}`;
    ui.organization.assignments.forEach((assignment) => appendUiCard(document.querySelector("#assignment-list"), assignment.label, `${assignment.status}; ${assignment.ownerCue}.`));
  } else {
    document.querySelector("#organization-cue").textContent = "No organization assignment is currently known.";
  }
  ui.pressureCues.forEach((cue) => appendUiCard(document.querySelector("#ui-pressure-list"), cue.title, cue.message));
  ui.properties.forEach((property) => appendUiCard(document.querySelector("#ui-property-list"), property.label, `${property.conditionCue}; ${property.claimCue}.`));
  ui.notifications.forEach((notification) => appendUiCard(document.querySelector("#notifications-list"), notification.label, notification.tone));
}

async function render() {
  try {
    const response = await fetch("./scenario.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`scenario.json returned ${response.status}`);
    const payload = await response.json();
    const projection = payload.projection;
    const summary = payload.summary;
    renderUi(payload.ui);
    renderScenario(payload.scenario);
    const metrics = document.querySelector("#summary");
    appendMetric(metrics, "world date", summary.date);
    appendMetric(metrics, "businesses", summary.businessCount);
    appendMetric(metrics, "market bands", projection.markets.length);
    appendMetric(metrics, "public objects", projection.objects.length);
    projection.businesses.forEach((business) => appendBusiness(document.querySelector("#business-list"), business));
    projection.markets.forEach((market) => appendMarket(document.querySelector("#market-list"), market));
    status.textContent = `Loaded public projection · ${projection.worldId}`;
  } catch (error) {
    status.className = "status error";
    status.textContent = `Projection unavailable: ${error.message}`;
  }
}

render();
