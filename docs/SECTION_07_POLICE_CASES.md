# Section 7 — Evidence-bearing police cases

This episode composes the docuseries police-case contract with the existing event ledger, provenance, rumors, and world time.

## Implemented contract

- Cases are institutional interpretations of incidents, not a universal wanted meter.
- Each agency has its own jurisdiction, authority actions, known evidence, and known witness statements.
- Evidence links and witness retellings are append-only and can update case confidence without erasing uncertainty.
- Agency-specific action authorization prevents one institution from silently acquiring another institution's powers.
- Cases age through world time; weak open cases can become cold without deleting their history.
- Case state survives save/restore by event replay.

## Acceptance evidence

`npm test` covers one warehouse-fire incident observed by district police and customs, divergent witness retellings, agency-specific evidence views, jurisdiction rejection, stage advancement, cold-case aging, and snapshot restoration.

## Boundary

This is a fictional, headless institutional-state model. It does not provide legal advice, real-world police procedure, evasion guidance, platform moderation, or claims about any jurisdiction. The implementation preserves uncertainty and separates agency knowledge from authoritative world truth.

## Next dependency

Compose the existing district, character, social, economy, provenance, organization, and case systems into the single-player vertical trace described by Volume 49.
