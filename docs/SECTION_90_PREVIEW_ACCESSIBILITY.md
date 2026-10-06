# Section 90 — Public Preview Accessibility Contract

The public browser preview now carries a small structural accessibility gate. This makes the presentation surface easier to enter and inspect without exposing private simulation state or treating static markup checks as a usability study.

## Contract

- the document declares its language, title, main landmark, page heading, skip-navigation target, and no-script boundary;
- status and scenario feedback retain live-region semantics for asynchronous projection and choice changes;
- labelled sections resolve to heading IDs, and any future images must carry alternative text;
- controls have a visible `:focus-visible` state and the stylesheet declares reduced-motion behavior;
- the audit reports its limitation explicitly: static asset structure is not screen-reader, fresh-player, localization, controller, visual-regression, or hardware acceptance.

## Acceptance evidence

`preview-accessibility.test.mjs` audits the committed HTML/CSS, rejects missing language/navigation/live-region/motion semantics, and rejects images without alternative text.

## Boundary

This is a structural public-preview accessibility contract. It is not a screen-reader audit, fresh-player usability study, localization review, controller/navigation test, animation review, native-client delivery, visual regression suite, cultural review, or hardware/FPS acceptance. The fiction/safety and public-projection boundaries remain unchanged.
