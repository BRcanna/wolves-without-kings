# Section 79 — Synthetic Availability Probe

The operational lifecycle now bounds in-flight work and drains active requests. This section adds an executable synthetic probe so those policies can be evaluated over a repeatable workload instead of being described only in prose.

## Contract

- a probe runs a bounded request count through a caller-provided request adapter with a configured concurrency cap;
- each outcome records status, measured or supplied duration, acceptance, overload, and failure state;
- the report summarizes accepted, overloaded, failed, and p50/p95/max/mean latency bands;
- budget evaluation separates expected overload from request failures and reports each violated threshold;
- the probe is deterministic when the adapter supplies durations, making it suitable for regression evidence.

## Acceptance evidence

`availability-probe.test.mjs` proves successful bounded work, expected overload accounting, thrown-request failure capture, latency summaries, and threshold evaluation.

## Boundary

This is a synthetic local availability contract. It is not hardware benchmarking, real network load, autoscaling, process supervision, multi-host failover, SLA/SLO evidence, user population modeling, or production availability acceptance. The fiction/safety boundary remains unchanged.
