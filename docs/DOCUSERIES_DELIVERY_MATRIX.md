# WOLVES WITHOUT KINGS — docuseries delivery matrix

This matrix inventories every supplied docuseries source group: 74 numbered volumes and 10 scenario traces. It is an evidence map, not a claim that a local contract proves production game acceptance.

Status meanings:

- `SHIPPED` — the source group has a local executable contract and acceptance evidence in this repository;
- `BOUNDED` — a local contract is shipped, but the source group still has an explicit scale, visual, production, or usability boundary;
- `COMPOSED` — the source group is represented by the dependency-ordered architecture, docs, and adjacent executable contracts, without a separate runtime subsystem;
- `OPEN` — required evidence depends on external production infrastructure, hardware, review, or live-player acceptance;
- `DEFERRED` — the source explicitly defers the breadth beyond this foundation.

| Dependency group | Source directory | Source files | Local evidence | Status |
| --- | --- | ---: | --- | --- |
| Foundation volumes 01–04 | `docs/docuseries/01_FOUNDATION` | 4 | `authority-engine.test.mjs`, `save-replay.test.mjs`, `SECTION_03_DISTRICT.md` | SHIPPED |
| Character volumes 05–11 | `docs/docuseries/02_CHARACTER` | 7 | `character.test.mjs`, `unlock-web.test.mjs`, `tattoos.test.mjs`, `SECTION_04_CHARACTER.md` | SHIPPED |
| Social volumes 12–16 | `docs/docuseries/03_SOCIAL` | 5 | `social-organization.test.mjs`, `npc-ai.test.mjs`, `doctrine.test.mjs` | SHIPPED |
| Underworld volumes 17–22 | `docs/docuseries/04_UNDERWORLD` | 6 | `protection.test.mjs`, `drug-economy.test.mjs`, `vehicle.test.mjs`, `SECTION_20_UNDERWORLD.md` | BOUNDED |
| Action volumes 23–29 | `docs/docuseries/05_ACTION` | 7 | `district.test.mjs`, `action.test.mjs`, `ranged.test.mjs`, `police-case.test.mjs`, `SECTION_22_RANGED_ACTION.md` | BOUNDED |
| World volumes 30–35 | `docs/docuseries/06_WORLD` | 6 | `geography.test.mjs`, `region.test.mjs`, `market-ecology.test.mjs`, `world-aging.test.mjs` | BOUNDED |
| Mode volumes 36–40 | `docs/docuseries/07_MODES` | 5 | `campaign.test.mjs`, `coop.test.mjs`, `underworld.test.mjs`, `dynasty.test.mjs`, `conflict.test.mjs` | BOUNDED |
| Technical volumes 41–48 | `docs/docuseries/08_TECH` | 8 | `authority-network.test.mjs`, `save-replay.test.mjs`, `event-projections.test.mjs`, `transport-envelope.test.mjs`, `verification.test.mjs` | BOUNDED |
| Build volumes 49–54 | `docs/docuseries/09_BUILD` | 6 | `vertical-slice.test.mjs`, `content-pack.test.mjs`, `scenario-pack.test.mjs`, `runtime-bundle.test.mjs` | BOUNDED |
| Appendix volumes 55–60 | `docs/docuseries/10_APPENDICES` | 6 | `SCENARIO_ACCEPTANCE.md`, `ONLINE_BOUNDARY.md`, `SECTION_42_TESTING_ACCEPTANCE.md` | COMPOSED |
| Deep-dive volumes 61–74 | `docs/docuseries/11_DEEP_DIVES` | 14 | `ACCEPTANCE.md`, subsystem tests, and `SCENARIO_ACCEPTANCE.md` | COMPOSED |
| Scenario traces 01–10 | `docs/docuseries/12_SCENARIO_TRACES` | 10 | `SCENARIO_ACCEPTANCE.md`, `scenario-coverage.test.mjs` | SHIPPED |

## Explicit remaining gates

The following are deliberately not promoted to local PASS by this matrix:

- production network deployment, authentication/encryption, moderation operations, availability, and production acceptance;
- fresh-player usability, localization, controller navigation, accessibility study, authored dialogue/audio, animation, native-client delivery, cultural review, and hardware/FPS acceptance;
- the full persistent online underworld breadth, which remains explicitly deferred by the source build sequence.

`npm run verify` checks the directory/file counts, contiguous build episodes, acceptance evidence references, scenario ledger, public preview scope, and these recorded-open boundaries.
