# API Reference

## HTTP Endpoints

### The_Beeper (port 8080)

| Method | Path | Body | Response |
|---|---|---|---|
| `GET` | `/health` | — | `{status, node, tier, database}` |
| `GET` | `/status` | — | Full node status (events by type, epistemic) |
| `POST` | `/upload` | `multipart/form-data` (file) | `{status, saved_locally, metrics}` |
| `POST` | `/telemetry` | `{latency_ms, bytes_in, ...}` | `{status, node}` |
| `GET` | `/query/network` | — | Network health dashboard |
| `GET` | `/query/epistemic` | — | Epistemic state breakdown |
| `GET` | `/query/replication` | — | Replication health |

### GitHub Agent (port 9090)

| Method | Path | Response |
|---|---|---|
| `GET` | `/health` | `{status, agent, uptime_seconds}` |
| `GET` | `/status` | Full agent status (JSON) |

### Sandbox (port 9099)

| Method | Path | Response |
|---|---|---|
| `GET` | `/health` | `{status, sandbox, mode, ts}` |

### DuckDB (port 9999)

Standard DuckDB HTTP endpoint. See DuckDB documentation.

## CLI Commands

### KICE Engine

```bash
python3 KICE/kice_schema.py --demo        # Demo evaluation
python3 KICE/kice_foil_tests.py           # 9 adversarial tests
python3 KICE/kice_benchmark_suite.py      # 6-category benchmarks
python3 KICE/compute_budget.py            # 99%/1% profiler
python3 KICE/common_mode_analysis.py      # Training overlap analysis
python3 KICE/sovereign_authority.py       # Ava-007 authority demo
```

### Epistemic Gates

```bash
python3 Benchmarks/epistemic_gates.py     # Claim graduation engine
python3 Benchmarks/foil_tests.py          # 17 epistemic foil tests
python3 Benchmarks/benchmark_suite.py     # Full benchmark suite
```

### Headless GitHub CLI Agent

```bash
python3 Dependencies/gh_headless_agent.py run          # One autonomous cycle
python3 Dependencies/gh_headless_agent.py status       # Agent status
python3 Dependencies/gh_headless_agent.py render       # Render INDEX.md
python3 Dependencies/gh_headless_agent.py auth         # Check auth
python3 Dependencies/gh_headless_agent.py search "q"   # Search repos
python3 Dependencies/gh_headless_agent.py issues o r   # List issues
python3 Dependencies/gh_headless_agent.py prs o r      # List PRs
```

### The_Beeper

```bash
python3 Sensory/The_Beeper/server.py      # Start ingestion node
```

## Make Targets

### Sandbox (host-side)

```bash
make -C sandbox up                # Start sandbox
make -C sandbox down              # Stop sandbox
make -C sandbox opencode          # Drop in
make -C sandbox kice-foil         # Run foil tests
make -C sandbox kice-benchmark    # Run benchmarks
make -C sandbox kice-budget       # Run budget profiler
make -C sandbox kice-common-mode  # Run overlap analysis
make -C sandbox kice-sovereign    # Run sovereign demo
make -C sandbox epistemic-gate    # Run epistemic foils
make -C sandbox status            # System status
make -C sandbox health            # Health check
```

### Sandbox (inside container)

```bash
make help                         # Show all targets
make kice-demo                    # KICE demo
make kice-foil                    # 9 foil tests
make kice-benchmark               # 6-category benchmark
make kice-common-mode             # Training overlap
make kice-budget                  # 99%/1% profiler
make kice-sovereign               # Ava-007 demo
make epistemic-gate               # 17 epistemic foils
make benchmark-full               # Full suite
make beeper-start                 # Start The_Beeper
make agent-start                  # Start GitHub Agent
make status                       # Full status
make shell                        # Interactive bash
```

### The_Beeper

```bash
make -C Sensory/The_Beeper sandbox-up     # Deploy container
make -C Sensory/The_Beeper start          # Start node + rustunnel
make -C Sensory/The_Beeper replicate-db   # Snapshot local → replica
make -C Sensory/The_Beeper push-replica   # Push to OCI Core Anchor
make -C Sensory/The_Beeper replicate-loop # Auto-replicate + push
make -C Sensory/The_Beeper status         # Status panel
make -C Sensory/The_Beeper monitor        # Tail logs
```

## KICE Decision Output

```json
{
  "decision": "PROCEED",
  "c_final": 0.82,
  "c_weighted": 0.87,
  "c_weakest": 0.82,
  "weakest_model": "salience",
  "max_disagreement": 0.12,
  "violations": 0,
  "notes": [],
  "epistemic_state": "INFERRED"
}
```

## Sovereign Authority Output

```json
{
  "decision": "APPROVE",
  "kice_decision": "PROCEED",
  "c_final": 0.82,
  "reasoning": "KICE PROCEED (C_final=0.82, C_weakest=0.82). No contrary evidence. APPROVE.",
  "evidence_count": 0,
  "content_hash": "a1b2c3...",
  "prev_hash": "genesis",
  "event_hash": "d4e5f6...",
  "approved_by": "Ava-007"
}
```
