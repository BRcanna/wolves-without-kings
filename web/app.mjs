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

async function render() {
  try {
    const response = await fetch("./scenario.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`scenario.json returned ${response.status}`);
    const payload = await response.json();
    const projection = payload.projection;
    const summary = payload.summary;
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
