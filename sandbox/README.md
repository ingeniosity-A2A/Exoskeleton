# Sandbox — All-in-One Container for OpenCode

One container. Everything inside. OpenCode execs into it.

## What's inside

| Component | Path |
|---|---|
| KICE engine (6 modules) | `/opt/exoskeleton/KICE/` |
| Epistemic gates (3 modules) | `/opt/exoskeleton/Benchmarks/` |
| Headless GitHub CLI Agent | `/opt/exoskeleton/Dependencies/` |
| The_Beeper ingestion node | `/opt/exoskeleton/Sensory/The_Beeper/` |
| A2A-Networks transport | `/opt/exoskeleton/A2A-Networks/` |
| Memory schemas | `/opt/exoskeleton/Memory/` |
| Python 3.12 + all deps | System |
| GitHub CLI (headless) | System |
| DuckDB 2.0 | Python package |
| Universal Makefile | `/opt/exoskeleton/Makefile` |

## Quick Start

```bash
export GH_TOKEN=ghp_your_token_here
make up
make opencode
# Inside: make help
```

## All Commands

```bash
# Lifecycle
make up                    # Start sandbox
make down                  # Stop sandbox
make build                 # Rebuild image
make logs                  # Follow logs
make clean                 # Stop + remove volumes

# OpenCode
make opencode              # Drop into sandbox shell
make shell                 # Drop into bash
make run CMD="make kice-foil"   # Run any command

# KICE (from host)
make kice-demo
make kice-foil
make kice-benchmark
make kice-common-mode
make kice-budget
make kice-sovereign

# Epistemic
make epistemic-gate
make benchmark-full

# System
make status
make health
```

## Health

```bash
make health
# {"status":"healthy","sandbox":"exoskeleton","mode":"opencode","ts":"..."}
```

## Network

| URL | Purpose |
|---|---|
| `http://sandbox.exoskeleton.kiri.localhost` | Sandbox health |
| `http://localhost:9099/health` | Direct health check |
```