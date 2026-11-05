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

## Repository Layout (current)

```
Exoskeleton/
├── docs/
│   ├── VALIDATION.md                # Evidence dock
│   ├── PNPM_WORKSPACE_POLICY.md
│   └── …
├── packages/                        # Capability layer, memory chassis, etc.
├── pnpm-workspace.yaml
└── package.json
```

Related authority:

- `Cybernetic-Ava007/docs/DECLARATION_OF_INTENT.md` — architecture definition
- `Cybernetic-Ava007/docs/SELF_ALIGNMENT_9_MANIFESTOS.md` — self-alignment stance
- `artifacts/LLM-Doctrine/CANONICAL-MODEL-CATALOGUE.yaml` — model role assignments

---

## Quick Orientation

| Domain | Role | Owns |
|--------|------|------|
| **Ava-007** | Sole actor | Cybernetic-Ava007 |
| **REV.IKE** | Read-only lens / catalyst | Identity preserved; docs live with Cybernetic-Ava007 |
| **Exoskeleton** | Structural interface, capability layer, Grants surface, memory chassis | This repository |

## Memory system

- [Memory System Source Truth — 2026-11-05](docs/MEMORY_SYSTEM_SOURCE_TRUTH_2026-11-05.md) records the active memory layers, implementation inventory, ownership boundaries, and validation gaps.
- [Layer 0 Memory Plane](docs/LAYER_0_MEMORY_PLANE.md) and [Vector Core](docs/VECTOR_CORE.md) define the native mailbox and vector integration constraints.
- [Memory Governance + Liquid AI Integration Proposal](docs/MEMORY_GOVERNANCE_LIQUID_AI_INTEGRATION_PROPOSAL.md) — source-checked Mem0, d1-Omni and LFM3-Omni roles, adapter contracts, implementation blockers, and acceptance gates.
