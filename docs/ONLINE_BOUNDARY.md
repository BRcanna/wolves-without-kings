# Online boundary

The current repository is single-player with a tested in-process authority contract. Its online boundary is explicit:

- canonical mutations remain revision-bound and evented;
- ordered client intents, unique-object ownership, leases, disconnect settlement, reconnect metadata, and redacted reconciliation are implemented in-process only;
- public, observer, and institutional projections are scope-filtered;
- public transport does not include hidden practice, private beliefs, global case confidence, full agency views, or server-only surveillance records;
- `debug` projection is for local inspection only and is not a network payload;
- a local secure-service adapter now provides bearer-token admission, an optional TLS-required configuration, and pre-mutation moderation hold/deny hooks; token custody, certificate issuance/rotation, account identity, deployment, and operations remain external gates.
- a local operational wrapper now exposes liveness/readiness state, bounded in-flight admission, and graceful drain behavior; this is lifecycle evidence, not a load, failover, or availability guarantee.
- a non-root Docker deployment artifact now declares host binding and a healthcheck while requiring runtime-injected secrets; image build, registry, orchestration, and rollout remain environment-gated.
- the operational launcher can persist authority checkpoints to a local fsynced journal and the container mounts `/data`; replication, backup, encryption at rest, and failover remain unimplemented.
- a same-host mirrored checkpoint service can repair a missing/stale copy and reject divergence; a deterministic file-backed quorum harness now models strict-majority commits, partition fail-closed behavior, stale-node repair, and split-brain rejection; actual cross-host transport, membership, fencing, and failover timing remain unimplemented.
- a local backup envelope can validate and restore mirrored journal records with overwrite protection; retention, off-host storage, encryption, disaster recovery, and restore objectives remain unimplemented.
- a local backup catalog can validate registrations, preserve pinned history, and produce a non-destructive retention plan; scheduling, deletion authorization, immutable/off-host storage, encryption, and production disaster recovery remain unimplemented.
- a local transport keyring can rotate, expire, revoke, and restore metadata for runtime-injected secrets while binding admission to the session key; account identity, hardware/secret custody, certificate operations, TLS rotation, and production security acceptance remain unimplemented.
- a local TLS-material registry validates private-key syntax, tracks certificate digests/validity/name coverage, supports overlap rotation and retirement, and requires runtime reinjection on restore; CA issuance, live TLS termination, revocation infrastructure, and production security acceptance remain unimplemented.
- a local identity registry now binds signed, time-bounded claims to accounts, sessions, clients, and characters with suspension/revocation checks; external account providers, MFA/consent services, secret custody, privacy/compliance, and production identity acceptance remain unimplemented.
- a local moderation queue now provides expiring reviewer leases, explicit allow/deny/escalate decisions, audit restoration, and redacted counts; staffed human review, policy/appeals, escalation coverage, response objectives, and production moderation acceptance remain unimplemented.
- a synthetic availability probe now reports bounded concurrency, latency bands, overload, failures, and explicit threshold violations; hardware/load, autoscaling, multi-host failover, SLA/SLO, and production availability acceptance remain unimplemented.
- a local coordination contract now provides expiring authority leases, monotonic fencing terms, explicit handoff, and stale-token rejection; distributed election/membership, clock safety, process supervision, cross-host transport, and production failover remain unimplemented.
- a portable local backup repository now validates immutable object publication, idempotent replay, safe IDs, verification, and restore; cloud/off-host isolation, object lock, encryption, access control, replication transport, and production disaster recovery remain unimplemented.
- online authority, anti-cheat, durable moderation operations, persistence operations, and availability are not claimed as implemented.

This boundary is a safety and evidence statement, not a promise of multiplayer support.
