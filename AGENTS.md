# AGENTS.md — Exoskeleton

## Mandatory source of truth

Before changing architecture, memory, persistence, transport, synchronization, performance, or dependencies, read these documents in order:

1. [Cybernetic-Ava007 Declaration of Intent](https://github.com/ingeniosity-A2A/Cybernetic-Ava007/blob/main/docs/DECLARATION_OF_INTENT.md) and the existing Manifesto canon/gates. Preserve their wording; do not rewrite doctrine.
2. [Ava-007 System Source-of-Truth and Whole-System Optimization Contract](https://github.com/ingeniosity-A2A/Cybernetic-Ava007/blob/main/docs/SYSTEM_SOURCE_OF_TRUTH_AND_OPTIMIZATION_2026-11-05.md).
3. [Exoskeleton Memory System Source Truth](docs/MEMORY_SYSTEM_SOURCE_TRUTH_2026-11-05.md).
4. [System Memory Source of Truth and Whole-System Optimization Contract](docs/SYSTEM_MEMORY_SOURCE_OF_TRUTH_AND_OPTIMIZATION_2026-11-05.md).
5. [Memory subsystem feed integration](docs/MEMORY_SUBSYSTEM_FEED_INTEGRATION_2026-11-05.md), [patch status](docs/MEMORY_SUBSYSTEM_PATCH_STATUS_2026-11-05.md), and [validation dock](docs/VALIDATION.md).
6. [Rustunnel Transport Architecture Audit](docs/RUSTUNNEL_TRANSPORT_ARCHITECTURE_AUDIT_2026-11-05.md).
7. [Kinetic Intelligence Retrieval Architecture and Benchmark Contract](docs/KINETIC_INTELLIGENCE_RETRIEVAL_ARCHITECTURE_AND_BENCHMARK_2026-11-05.md).
8. [TweenAtom State-Carrying Contract](docs/TWEENATOM_STATE_CARRYING_CONTRACT.md).
9. [FreeBuff execution handoff](docs/FREEBUFF_EXECUTION_HANDOFF.md) before running the kinetic suite.

These are mandatory engineering inputs, not optional background reading. Inspect current `main` HEAD and actual source before every change. Chat summaries, old trees, stale branches, and prior assistant descriptions are not implementation evidence.

## Ownership and authority

- Cybernetic-Ava007 owns cognitive purpose, reasoning, interpretation, acceptance decisions, curation policy, authorization and action authority.
- Exoskeleton owns the non-cognitive runtime substrate, memory mechanics, persistence, synchronization, transport, scheduling and resource governance.
- REV.IKE is read-only interpretation and proposal generation. It cannot write Source Truth, accept proposals, promote, authorize or execute.
- Ava007 Omni-OS owns device, operating-environment, network, compute and hardware interfaces.
- MA Computing owns A2A documentation and communication architecture.

The retired A2A Exoskeleton architecture is obsolete. QAG_MemBrain is obsolete and excluded. Do not introduce either as a dependency, target, baseline, memory source or migration destination.

## Whole-system optimization

Optimize the complete observation-to-durable-ledger-to-retrieval-to-decision lifecycle. Do not optimize a library or isolated microbenchmark at the expense of correctness, capability quality, authority, privacy, durability, auditability or recovery.

DuckDB 2.0.0 is the current target identified by `schema_20.sql`. Validate the exact native/server and Wasm engine versions and schema behavior before writes or migration. Follow the DuckDB 2.0 migration guidance; never open a 2.0-written database with a pre-2.0 engine.

Arrow is optional interchange, not a mandatory memory tier or assumed hot-path dependency. Retain, replace or remove it only after controlled full-workload comparison. Distinguish DuckDB's native Quack client/server protocol from this repository's application outbox/apply mechanism.

For every candidate, record copies, allocations, serialization, ownership/lifetime, latency distributions, throughput, memory, durability, recovery, retrieval quality, and energy where measurable. A local pointer view is not end-to-end zero-copy.

## Evidence and change discipline

Use the status labels precisely: specified, implemented, compiled, tested, benchmarked, deployed, accepted. Never infer a stronger status from a document or source file.

Every change must include:
- exact inspected base commit and source paths;
- architecture impact and alternatives considered;
- tests and reproducible benchmark commands/results where applicable;
- dependency and license provenance;
- validation-dock update and rollback path;
- explicit unresolved risks and non-claims.

Do not require GitHub Actions. Do not alter Manifesto wording. Do not claim production readiness or zero-copy without the required evidence.
