# Exoskeleton

**The Exoskeleton does not hoard static prose. It maintains one index
sheet and delegates retrieval to the Headless GitHub CLI Agent.**

An autonomous, doctrinally-governed AI agent framework built on
second-order cybernetics. Three planes. One Kiri runtime. Zero
interactive prompts. Every claim passes through the epistemic gate
before graduating from INFERRED to OBSERVED.

---

## What this is

| Component | Purpose |
|---|---|
| **KICE** | Kinetic Intelligence Coupling Engine — couples specialized models at runtime without merging weights |
| **Benchmarks** | Empirical gate — the only path from INFERRED to OBSERVED |
| **Sensory/The_Beeper** | Tier 1 Sensory Edge — ingestion with full network metrics and epistemic provenance |
| **Dependencies** | Headless GitHub CLI Agent — autonomous dependency indexing into DuckDB 2.0 |
| **A2A-Networks** | Transport fabric — rustunnel, sync bridge, mesh controller |
| **Memory** | Dual-band DuckDB — Short-Term Hot State + Long-Term Lake |
| **sandbox** | All-in-one container for OpenCode execution |

## Quick start

```bash
# Start the sandbox (Kiri Compose)
export GH_TOKEN=ghp_your_token_here
make -C sandbox up

# Drop in
make -C sandbox opencode

# Run everything
make kice-foil && make kice-budget && make status
```

## The Three Planes

```
┌─────────────────────────────────────────────────────────┐
│                   Kiri Runtime                          │
│                                                         │
│  Plane 1: Dependency Plane                              │
│  ┌──────────────┐    ┌──────────────┐                  │
│  │ GitHub Agent │───►│ DuckDB Index │                  │
│  └──────────────┘    └──────────────┘                  │
│                                                         │
│  Plane 2: Sensory Plane                                 │
│  ┌──────────────┐    ┌──────────────┐                  │
│  │  The_Beeper  │───►│ Short-Term   │                  │
│  │  (Tier 1)    │    │ DuckDB       │                  │
│  └──────────────┘    └──────────────┘                  │
│                                                         │
│  Plane 3: Transport Plane                               │
│  ┌──────────────┐    ┌──────────────┐                  │
│  │ KICE Engine  │───►│ Long-Term    │                  │
│  │ + Sovereign  │    │ Lake         │                  │
│  └──────────────┘    └──────────────┘                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Documentation

| Document | Contents |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Three-plane architecture, data flow, service mesh |
| [docs/DOCTRINAL-STANDARDS.md](docs/DOCTRINAL-STANDARDS.md) | The Five Disciplines, deny rules, epistemic states |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Kiri Compose, sandbox, OpenCode integration |
| [docs/API.md](docs/API.md) | All HTTP endpoints, CLI commands, Make targets |
| [docs/EPISTEMIC-STATE-MACHINE.md](docs/EPISTEMIC-STATE-MACHINE.md) | INFERRED→OBSERVED graduation rules |

## Directory guide

| Directory | README | What lives there |
|---|---|---|
| `KICE/` | [KICE/README.md](KICE/README.md) | Coupling engine, foil tests, benchmarks, sovereignty |
| `Benchmarks/` | [Benchmarks/README.md](Benchmarks/README.md) | Empirical gate, epistemic foils, quarantine |
| `Sensory/` | [Sensory/README.md](Sensory/README.md) | The_Beeper ingestion node |
| `Dependencies/` | [Dependencies/README.md](Dependencies/README.md) | Headless GitHub CLI Agent |
| `A2A-Networks/` | [A2A-Networks/README.md](A2A-Networks/README.md) | rustunnel, sync bridge, mesh |
| `Memory/` | [Memory/README.md](Memory/README.md) | DuckDB dual-band architecture |
| `Exoskeleton-Manifesto-Collection/` | [Manifesto README](Exoskeleton-Manifesto-Collection/README.md) | Ava-007 Manifesto, doctrinal source |
| `MiMo-Bot/` | [MiMo-Bot README](MiMo-Bot/README.md) | Collapsed bot, lead selector |
| `sandbox/` | [sandbox/README.md](sandbox/README.md) | Docker/Kiri sandbox for OpenCode |

## Epistemic states

Every claim in this system has an epistemic state:

| State | Meaning | Can be promoted to OBSERVED? |
|---|---|---|
| **OBSERVED** | Measured from real I/O or benchmark | N/A (already there) |
| **DERIVED** | Computed from OBSERVED values | Yes (with provenance) |
| **INFERRED** | Reasoning from evidence, not measured | Yes (with benchmark) |
| **HYPOTHESIZED** | Proposed but unverified | No (must become INFERRED first) |

**INFERRED → OBSERVED is forbidden without measured evidence.**

## Core doctrine

> "Many specialized models, one merged intelligence. Merging happens in
> representations, embeddings, the gate, the substrate, and the decision
> layer — not in the foundation weights."

> "Build the verifier before the thing it verifies."

> "Confidence is cheap. Knowing exactly where certainty ends is much
> more useful."

> "MUST NOT execute any merge, training, or inference without the gate."

---

*Exoskeleton Manifesto Collection · Memory / Doctrinal Verification Engine Gate*
