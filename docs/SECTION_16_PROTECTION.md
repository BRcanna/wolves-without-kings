# Section 16 — Protection relationship economy

## Purpose

Section 16 implements protection as a relationship and business-economy system. It records what the owner experiences, what the provider delivers, whether payment is possible, how rival pressure changes the arrangement, and how the relationship ages. It does not provide real-world criminal operating instructions.

## Canonical state

Each arrangement is attached to a business and retains:

- owner, provider, district, mode, payment band, and service expectations;
- vulnerability, trust, fear, resentment, competitor pressure, and police exposure;
- payment misses, completed cycles, days active, last treatment, last owner decision, and evented history;
- active, disputed, or ended status.

Treatment is abstracted into systemic outcomes: respectful, pressured, humiliating, protective, or absent. Owner decisions are similarly outcome labels: continue, report, flee, rival, partner, or request help. The runtime models consequences and relationships; it does not encode collection tactics, evasion, or transferable procedure.

## Business and rival interaction

Each cycle changes the arrangement and the attached business atomically. Service and treatment affect business reputation/condition; payment can be paid, missed, disputed, or waived; observation can increase police exposure; a rival claim creates a disputed arrangement rather than replacing the previous history. Reporting or fleeing ends the arrangement, while partnership can change the mode and deepen trust.

World-time settlement advances arrangement age and resets the review clock through the same evented time transaction used by NPCs, markets, cases, businesses, and surveillance.

## Projection boundary

Public projection exposes only business/district identity, mode, status, payment band, days active, and a qualitative relationship band. Trust, fear, resentment, provider identity, police exposure, competitor pressure, and detailed history remain outside the public view.

## Verification

```text
npm test
```

`test/protection.test.mjs` compares coercive, protective, and partnership strategies over six months; verifies rival disputes and public redaction; checks owner decisions and impossible transitions; and restores the arrangement from its event history.
