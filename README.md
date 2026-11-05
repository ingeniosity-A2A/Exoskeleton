# Exoskeleton

Structural interface and boundary for **Ava-007**, the 2nd Order Cybernetic Advanced AI Model.

**Status: bootstrap.** Only claims backed by recorded command output (see `docs/VALIDATION.md`) are made. Unrun builds, tests, and benchmarks are unverified, never "passing".

Claims need a dated source and a label: Official, Local evidence, Independent, or Interpretation.

---

## Canonical Definition

The authoritative definition of Ava-007 lives in the **Cybernetic-Ava007** repository, not here:

→ `../Cybernetic-Ava007/docs/DECLARATION_OF_INTENT.md` (architecture)  
→ `../Cybernetic-Ava007/docs/SELF_ALIGNMENT_9_MANIFESTOS.md` (stance)

Those two documents are the source of truth. This repository (Exoskeleton) is the structural interface only. It does not own them.

---

## Repository Layout

```
Exoskeleton/
├── docs/
├── packages/
│   ├── memory-chassis/
│   └── substrate-native/
└── pnpm-workspace.yaml
```

## Memory system and optimization source of truth

- [System Memory Source of Truth and Whole-System Optimization Contract](docs/SYSTEM_MEMORY_SOURCE_OF_TRUTH_AND_OPTIMIZATION_2026-11-05.md) — governing memory implementation map, DuckDB 2.0 evaluation, Arrow optionality, Quack distinction, whole-system benchmark and release gates.

- [Memory System Source Truth — 2026-11-05](docs/MEMORY_SYSTEM_SOURCE_TRUTH_2026-11-05.md)
- [Layer 0 Memory Plane](docs/LAYER_0_MEMORY_PLANE.md)
- [Vector Core](docs/VECTOR_CORE.md)
- [Memory Governance + Liquid AI Integration Proposal](docs/MEMORY_GOVERNANCE_LIQUID_AI_INTEGRATION_PROPOSAL.md)
- [Memory Subsystem Feed Integration](docs/MEMORY_SUBSYSTEM_FEED_INTEGRATION_2026-11-05.md)
- [Memory Subsystem Patch Status](docs/MEMORY_SUBSYSTEM_PATCH_STATUS_2026-11-05.md)
- [DFM and Distributed Coordination Implementation](docs/DFM_DISTRIBUTED_COORDINATION_IMPLEMENTATION.md) — experimental Rust support seams and explicit non-claims.

## Research integration modules

The substrate-native crate exports experimental modules for DFM promotion metadata, safety-constrained candidate selection, weighted neighbor updates, and digital packet aggregation. These are not a trained DFM model, a formal distributed-convergence implementation, or physical OTA-C. See the implementation note and validation dock before relying on them.


## Kinetic intelligence execution

- [Kinetic Intelligence Retrieval Architecture and Benchmark](docs/KINETIC_INTELLIGENCE_RETRIEVAL_ARCHITECTURE_AND_BENCHMARK_2026-11-05.md)
- [FreeBuff execution handoff](docs/FREEBUFF_EXECUTION_HANDOFF.md)
- Run the reproducible suite: `python3 scripts/kinetic_suite.py --profile full`
- Core native tests and microbenchmarks: `python3 scripts/kinetic_suite.py --profile core`

The runner records environment, exact commands, output, and blocked integrations under `artifacts/kinetic/`. It does not fabricate retrieval scores or implicitly download models. A completed core run is not full architecture acceptance.


## TweenAtom state-carrying contract

- [TweenAtom State-Carrying Contract](docs/TWEENATOM_STATE_CARRYING_CONTRACT.md)
- Rust type: `packages/substrate-native/src/tween_atom.rs`
- DuckDB schema: `packages/memory-chassis/src/schema_tween_atom.sql`
- FreeBuff execution: `python3 scripts/kinetic_suite.py --profile full`

TweenAtom is a typed, versioned, provenance-bearing state-transition envelope. The compact 53-token intent is one field, not the complete state. AVA-007 retains authority; Exoskeleton implements runtime mechanics and validates evidence.
