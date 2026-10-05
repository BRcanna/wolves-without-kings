# Deep Dive — Tattoo, Rank and Visible Status Ontology

Tattoos should function as an underworld semiotic system. The mechanic is not “collect tattoo cosmetics.” It is **people reading history off a body, sometimes correctly and sometimes incorrectly**.

## Marker classes

1. **Personal/cosmetic** — aesthetic choice with little fixed underworld meaning.
2. **Neighborhood/cultural** — local identity, music/football/community associations, generational cues.
3. **Organization affiliation** — marks a real or claimed relationship to a group.
4. **Role/status** — indicates earned position or specialization.
5. **Prison history** — acquired in custody and meaningful to people with relevant knowledge.
6. **Memorial** — tied to a dead person or event.
7. **Victory/survival** — references a promoted historical event.
8. **Humiliation/forced history** — rare marks with social consequence.
9. **Obsolete/era marker** — once meaningful, now associated with older criminal generations.

## Meaning is observer-relative

A tattoo record stores canonical origin/history. It does not contain one universal NPC reaction.

```text
TattooRecord
  canonical origin
  body location
  creator / place / date
  organization/event links
  visibility
  authenticity

Observer interpretation
  knows symbol? yes/no/partial
  believes affiliation? confidence
  respects origin? yes/no
  considers misuse? yes/no
  personal history with symbol
```

An older prison veteran may recognize a symbol instantly. A young nightclub bouncer may only know it means “serious old criminal.” A tourist sees decoration. A detective may have a database association but not know whether the mark is legitimately earned.

## Rank is separate from tattoo

Formal organizational rank lives in the organization runtime. Tattoos can communicate or claim rank, but they never become the source of authority. This prevents a clothing/body customization feature from bypassing the organization state model.

## Earning

An earned marker should normally depend on:

- a historical event or sustained role;
- time served in a relevant context;
- social recognition/sponsorship;
- an available artist/context;
- player choice to actually receive it.

The player should be able to refuse a tattoo. Refusal can itself say something about identity.

## Fraud and unauthorized use

The player can sometimes deliberately wear a symbol they did not earn. The game should treat this as social deception with stakes, not a disabled customization button.

Outcomes depend on the observer:

- no one notices;
- someone assumes it is legitimate;
- someone quietly becomes suspicious;
- a knowledgeable person challenges the claim;
- an organization treats it as disrespect;
- police use it as one weak association clue.

## Aging

Tattoos age visually with the character. Meaning also ages culturally. A mark that was terrifying in 2001 may look old-guard in 2011. Younger criminals may imitate it incorrectly. That generational drift is useful worldbuilding.

## Clothing and concealment

Visibility matters. A player operating in elite business circles may intentionally cover everything. Prison, beach, gym, medical treatment, intimacy and police processing can expose otherwise hidden markers.

The game should track `visible_to(observer, context)` rather than assuming every NPC sees every tattoo.

## Status ecosystem beyond tattoos

Tattoos belong to a broader status ontology:

- rings;
- watches;
- cars;
- clothing quality;
- scars;
- office/property;
- who accompanies the player;
- who greets them;
- where they are seated;
- who calls first;
- prison history;
- public titles;
- organization roles;
- known historical trophies.

A tattoo therefore participates in status rather than carrying the entire system.

## Trophy connection

Some tattoos are effectively trophies that cannot be sold or displayed in a cabinet. They encode history on the character and can become impossible for successors to inherit, helping distinguish personal legacy from dynasty legacy.

## Online

Online players will aggressively min-max visible prestige. That is acceptable if meaning remains tied to durable history. Do not sell or casually grant exact equivalents of earned historical markers. Cosmetic tattoos can be monetized only if they are clearly not mechanically or socially equivalent to earned rank/history marks.
