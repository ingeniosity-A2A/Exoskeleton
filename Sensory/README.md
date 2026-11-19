# Sensory — Tier 1 Sensory Edge Nodes

Sensory Capability Nodes ingest raw perturbations at high speed.
They are **headless and non-thinking** — they stream raw data
without semantic reflection. High-order cognition connects to
a specific sensory node only through the Cognitive Coupling Gate.

## Nodes

| Node | Description | Status |
|---|---|---|
| [The_Beeper](The_Beeper/README.md) | Image/telemetry ingestion, DuckDB replication, rustunnel transport | Active |

## Tier Architecture

```
Tier 1: Sensory Edge (≤1% compute)
  └── The_Beeper: headless ingestion, no reflection
       └── Raw data → DuckDB (Orange Band)

Tier 2: Subconscious (≤50% compute)
  └── KICE model inference
  └── Disagreement calculation
  └── Confidence aggregation

Tier 3: Recursive Core (≥49% compute)
  └── Sovereign decision
  └── Epistemic verification
  └── Teach-back gate
```
