# Section 101 — Coordinated Online Underworld Leadership

The quorum-backed online Underworld now has a bounded coordination contract. A current lease-bearing leader is the only node allowed to checkpoint, fencing terms advance on handoff/election, stale terms fail closed, and quorum is required for lease renewal or replacement.

## Contract

- startup names the first available quorum node as leader with an initial fencing term;
- leader checkpoints require the current node identity, current fencing term, an unexpired lease, and a live quorum;
- handoff advances the fencing term and requires an available target;
- expired or unavailable leaders can be replaced only by an available target while quorum exists;
- stale terms and follower writes fail closed without changing Underworld state;
- health reports leader, fencing term, lease expiry, clock, and nested quorum evidence.

## Acceptance evidence

`underworld-coordination.test.mjs` proves current-leader admission, stale-term rejection, handoff fencing, lease expiry, quorum-gated election/renewal, unavailable-target rejection, and expired-write rejection.

## Boundary

This is a deterministic in-process coordination contract over file-backed fictional Underworld journals. It is not cross-host transport, distributed membership, synchronized clocks, process supervision, encrypted custody, matchmaking, anti-cheat, staffed moderation, SLA availability, or production failover acceptance.
